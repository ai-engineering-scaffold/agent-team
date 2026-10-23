// The record job's entry point (spec 002, AC1-AC2; design 002, sections 1 and 2): reads the
// agent job's outputs and timings, builds one record and pushes it as its own file to the
// `metrics` branch. Workflows pass every value through `env:`; nothing comes from `${{ }}`.
//
//   node site/scripts/ledger/record.ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildRecord, WORKFLOWS, type JobResult, type LedgerRecord, type RecordInput, type Workflow } from "../../lib/ledger/record.ts";
import { defaultDeps, isMain, message, positiveInt, required, setOutputs, type Deps, type Env } from "./cli.ts";

const JOB_RESULTS: readonly string[] = ["success", "failure", "cancelled", "skipped"];
const AGENT_STEP = "anthropics/claude-code-action";
const IDENTITY = ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com"];
export const MAX_PUSH_TRIES = 3;

export interface RecordArgs {
  workflow: Workflow;
  // The agent job's name; a called workflow's job shows as `<caller job> / <name>`.
  agentJob: string;
  timeoutMinutes: number;
  jobResult: JobResult;
  agentOutput: { subtype: string; cost_usd: string; turns: string };
  planSpec: string | null;
  issue: number | null;
  pr: number | null;
  repo: string;
  runId: number;
  attempt: number;
}

export function parseRecordEnv(env: Env): RecordArgs {
  const workflow = required(env, "WORKFLOW");
  if (!(WORKFLOWS as readonly string[]).includes(workflow)) throw new Error(`WORKFLOW must be one of ${WORKFLOWS.join(", ")}`);
  const jobResult = required(env, "JOB_RESULT");
  if (!JOB_RESULTS.includes(jobResult)) throw new Error(`JOB_RESULT must be one of ${JOB_RESULTS.join(", ")}`);
  const repo = required(env, "GITHUB_REPOSITORY");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("GITHUB_REPOSITORY must be owner/name");

  let planSpec: string | null = null;
  if (workflow === "plan") {
    planSpec = required(env, "PLAN_SPEC");
    if (!/^[0-9]{3}$/.test(planSpec)) throw new Error("PLAN_SPEC must be three digits");
  }
  const issue = workflow === "build" || workflow === "unblock" ? positiveInt(required(env, "ISSUE"), "ISSUE") : null;
  const pr = workflow === "review" || workflow === "fix" ? positiveInt(required(env, "PR"), "PR") : null;

  return {
    workflow: workflow as Workflow,
    agentJob: required(env, "AGENT_JOB"),
    timeoutMinutes: positiveInt(required(env, "TIMEOUT_MINUTES"), "TIMEOUT_MINUTES") as number,
    jobResult: jobResult as JobResult,
    agentOutput: { subtype: env.SUBTYPE ?? "", cost_usd: env.COST_USD ?? "", turns: env.TURNS ?? "" },
    planSpec,
    issue,
    pr,
    repo,
    runId: positiveInt(required(env, "GITHUB_RUN_ID"), "GITHUB_RUN_ID") as number,
    attempt: positiveInt(required(env, "GITHUB_RUN_ATTEMPT"), "GITHUB_RUN_ATTEMPT") as number,
  };
}

interface ApiStep {
  name: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ApiJob {
  name: string;
  started_at: string;
  completed_at: string | null;
  steps?: ApiStep[];
}

async function issueLabels(args: RecordArgs, deps: Deps): Promise<string[]> {
  return JSON.parse(
    await deps.gh(["issue", "view", String(args.issue), "--repo", args.repo, "--json", "labels", "--jq", "[.labels[].name]"]),
  ) as string[];
}

// Reads the run's start, the agent job and step timings, and the PR, branch or labels that
// give the record its spec, issue and pr.
export async function gatherInput(args: RecordArgs, deps: Deps): Promise<RecordInput> {
  const attemptPath = `repos/${args.repo}/actions/runs/${args.runId}/attempts/${args.attempt}`;
  const runStartedAt = (await deps.gh(["api", attemptPath, "--jq", ".run_started_at"])).trim();
  const jobs = (await deps.gh(["api", `${attemptPath}/jobs`, "--paginate", "--jq", ".jobs[]"]))
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ApiJob);
  const job = jobs.find((j) => j.name === args.agentJob || j.name.endsWith(` / ${args.agentJob}`));
  if (!job) throw new Error(`no job named ${args.agentJob} in run ${args.runId}`);
  const step = job.steps?.find((s) => s.name.includes(AGENT_STEP)) ?? null;

  let branch: string | null = null;
  let labels: string[] = [];
  let pr = args.pr;
  if (args.workflow === "build") {
    // The build opens its PR partway through, so find it now: the open PR on spec-NNN/issue-N-.
    const open = JSON.parse(
      await deps.gh(["pr", "list", "--repo", args.repo, "--state", "open", "--limit", "200", "--json", "number,headRefName"]),
    ) as { number: number; headRefName: string }[];
    const pattern = new RegExp(`^spec-[0-9]{3}/issue-${args.issue}-`);
    const found = open.find((p) => pattern.test(p.headRefName));
    pr = found?.number ?? null;
    branch = found?.headRefName ?? null;
    labels = await issueLabels(args, deps);
  } else if (args.workflow === "unblock") {
    // The tech lead's send-back works on the issue only, so its spec comes from the issue's label.
    labels = await issueLabels(args, deps);
  } else if (pr !== null) {
    branch = (await deps.gh(["api", `repos/${args.repo}/pulls/${pr}`, "--jq", ".head.ref"])).trim();
  }

  return {
    workflow: args.workflow,
    runStartedAt,
    agentOutput: args.agentOutput,
    job: {
      result: args.jobResult,
      startedAt: job.started_at,
      completedAt: job.completed_at ?? new Date().toISOString(),
      timeoutMinutes: args.timeoutMinutes,
    },
    agentStep: step ? { conclusion: step.conclusion, startedAt: step.started_at, completedAt: step.completed_at } : null,
    planSpec: args.planSpec,
    branch,
    labels,
    issue: args.issue,
    pr,
  };
}

// `ledger/YYYY/MM/<run_id>-<attempt>-<job>.json`, dated by the run's start.
export function recordPath(record: LedgerRecord, runId: number, attempt: number): string {
  const [year, month] = record.date.split("-");
  return path.posix.join("ledger", year, month, `${runId}-${attempt}-${record.workflow}.json`);
}

// Commits the record in a temporary worktree of `metrics` (starting the branch as an orphan if
// it doesn't exist) and pushes, rebasing and retrying when another run pushed first. Returns
// the worktree, which holds the whole ledger including the new record.
export async function writeRecord(record: LedgerRecord, file: string, deps: Deps, repoDir = process.cwd()): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "metrics-"));
  const git = (args: string[]) => deps.git([...IDENTITY, ...args], dir);
  const fetched = await deps.git(["fetch", "--depth=1", "origin", "metrics"], repoDir).then(
    () => true,
    () => false,
  );
  if (fetched) {
    await deps.git(["worktree", "add", "--detach", dir, "FETCH_HEAD"], repoDir);
  } else {
    deps.log("No metrics branch yet, so this run starts it.");
    await deps.git(["worktree", "add", "--orphan", "-b", `metrics-${path.basename(dir)}`, dir], repoDir);
  }

  await mkdir(path.join(dir, path.dirname(file)), { recursive: true });
  await writeFile(path.join(dir, file), `${JSON.stringify(record, null, 2)}\n`);
  await git(["add", file]);
  await git(["commit", "--quiet", "-m", `Record ${file}`]);

  for (let attempt = 1; ; attempt += 1) {
    try {
      await git(["push", "--quiet", "origin", "HEAD:refs/heads/metrics"]);
      return dir;
    } catch (error) {
      if (attempt >= MAX_PUSH_TRIES) throw new Error(`push to metrics failed after ${attempt} tries: ${message(error)}`);
      deps.log(`Push to metrics was rejected (try ${attempt} of ${MAX_PUSH_TRIES}), so rebasing and retrying.`);
      await git(["pull", "--quiet", "--rebase", "origin", "metrics"]);
    }
  }
}

export async function main(env: Env = process.env, deps: Deps = defaultDeps, repoDir = process.cwd()): Promise<void> {
  const args = parseRecordEnv(env);
  const result = buildRecord(await gatherInput(args, deps));
  if (!result.recorded) {
    deps.log(`Not recorded: ${result.reason}.`);
    await setOutputs(env, { recorded: "false" });
    return;
  }
  const file = recordPath(result.record, args.runId, args.attempt);
  const dir = await writeRecord(result.record, file, deps, repoDir);
  deps.log(`Recorded ${file}: ${JSON.stringify(result.record)}`);
  await setOutputs(env, { recorded: "true", spec: result.record.spec, ledger_dir: dir });
}

if (isMain(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`::error::Could not record this run: ${message(error)}`);
    process.exitCode = 1;
  });
}
