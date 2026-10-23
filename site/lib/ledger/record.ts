// The ledger record (spec 002, AC1-AC3) and the pure builder the record job runs.
// Workflows run this file with Node's type stripping (design 002, section 3), so it uses
// erasable syntax only and relative `.ts` imports, never the `@/` alias.

export const RECORD_FIELDS = [
  "date",
  "workflow",
  "spec",
  "issue",
  "pr",
  "cost_usd",
  "turns",
  "duration_s",
  "outcome",
] as const;

export const WORKFLOWS = ["plan", "build", "review", "fix", "unblock"] as const;
export const OUTCOMES = ["success", "error", "max_turns", "timeout", "cancelled"] as const;

export type Workflow = (typeof WORKFLOWS)[number];
export type Outcome = (typeof OUTCOMES)[number];

export interface LedgerRecord {
  date: string;
  workflow: Workflow;
  spec: string;
  issue: number | null;
  pr: number | null;
  cost_usd: number | null;
  turns: number | null;
  duration_s: number;
  outcome: Outcome;
}

export type ValidationResult = { ok: true; record: LedgerRecord } | { ok: false; errors: string[] };

const SPEC_PATTERN = /^[0-9]{3}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function isNullOr(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === null || check(value);
}

function isPositiveInteger(v: unknown): boolean {
  return Number.isInteger(v) && (v as number) > 0;
}

function isNonNegativeInteger(v: unknown): boolean {
  return Number.isInteger(v) && (v as number) >= 0;
}

function isNonNegativeNumber(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

// Strict: exactly the nine AC1 fields, so no prompt, transcript, token count or credential
// can ride along (AC3).
export function validateRecord(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["record must be an object"] };
  }
  const v = value as Record<string, unknown>;
  const errors: string[] = [];
  const allowed: readonly string[] = RECORD_FIELDS;

  for (const key of Object.keys(v)) {
    if (!allowed.includes(key)) errors.push(`unexpected field "${key}"`);
  }
  for (const key of RECORD_FIELDS) {
    if (!(key in v)) errors.push(`missing field "${key}"`);
  }

  if ("date" in v && !(typeof v.date === "string" && ISO_UTC.test(v.date) && !Number.isNaN(Date.parse(v.date)))) {
    errors.push(`"date" must be an ISO 8601 UTC timestamp`);
  }
  if ("workflow" in v && !(WORKFLOWS as readonly unknown[]).includes(v.workflow)) {
    errors.push(`"workflow" must be one of ${WORKFLOWS.join(", ")}`);
  }
  if ("spec" in v && !(v.spec === "none" || (typeof v.spec === "string" && SPEC_PATTERN.test(v.spec)))) {
    errors.push(`"spec" must be a three-digit string or "none"`);
  }
  if ("issue" in v && !isNullOr(v.issue, isPositiveInteger)) {
    errors.push(`"issue" must be a positive integer or null`);
  }
  if ("pr" in v && !isNullOr(v.pr, isPositiveInteger)) {
    errors.push(`"pr" must be a positive integer or null`);
  }
  if ("cost_usd" in v && !isNullOr(v.cost_usd, isNonNegativeNumber)) {
    errors.push(`"cost_usd" must be a non-negative number or null`);
  }
  if ("turns" in v && !isNullOr(v.turns, isNonNegativeInteger)) {
    errors.push(`"turns" must be a non-negative integer or null`);
  }
  if ("duration_s" in v && !isNonNegativeNumber(v.duration_s)) {
    errors.push(`"duration_s" must be a non-negative number`);
  }
  if ("outcome" in v && !(OUTCOMES as readonly unknown[]).includes(v.outcome)) {
    errors.push(`"outcome" must be one of ${OUTCOMES.join(", ")}`);
  }

  return errors.length === 0 ? { ok: true, record: v as unknown as LedgerRecord } : { ok: false, errors };
}

// `needs.<agent job>.result` in the record job.
export type JobResult = "success" | "failure" | "cancelled" | "skipped";

export interface RecordInput {
  workflow: Workflow;
  // `run_started_at` of the workflow run.
  runStartedAt: string;
  // The agent job's outputs, written by its final `if: always()` step from the action's
  // execution file. Empty strings, or null, when the job stopped before that step.
  agentOutput: { subtype?: string; cost_usd?: string; turns?: string } | null;
  // The agent job, from `needs` and the Jobs API.
  job: {
    result: JobResult;
    startedAt: string;
    completedAt: string;
    timeoutMinutes: number;
  };
  // The step that runs claude-code-action, from the Jobs API; null when the job has no such step.
  agentStep: { conclusion: string | null; startedAt: string | null; completedAt: string | null } | null;
  // The plan job's spec number, when this is the plan job.
  planSpec?: string | null;
  // The PR's head branch, when there is a PR.
  branch?: string | null;
  // The issue's labels, when there is an issue.
  labels?: readonly string[];
  // Explicit issue number; for reviews and fixes it otherwise comes from a `spec-NNN/issue-N-` branch.
  issue?: number | null;
  pr?: number | null;
}

export type BuildResult = { recorded: true; record: LedgerRecord } | { recorded: false; reason: string };

// A timed-out job stops at its limit; allow this much slack for runner shutdown.
export const TIMEOUT_SLACK_S = 60;

function seconds(from: string, to: string): number {
  const ms = Date.parse(to) - Date.parse(from);
  if (Number.isNaN(ms)) throw new Error(`invalid timestamps: ${from} to ${to}`);
  return ms / 1000;
}

// Design 002, section 2: the agent's own result decides first, because a job can fail after a
// successful agent step. Only with no result does the job's result decide.
export function outcomeFor(
  subtype: string | null | undefined,
  jobResult: JobResult,
  jobElapsedS: number,
  timeoutMinutes: number,
): Outcome {
  if (subtype === "success") return "success";
  if (subtype === "error_max_turns") return "max_turns";
  if (!subtype) {
    const stoppedEarly = jobResult === "failure" || jobResult === "cancelled";
    if (stoppedEarly && jobElapsedS >= timeoutMinutes * 60 - TIMEOUT_SLACK_S) return "timeout";
    if (jobResult === "cancelled") return "cancelled";
  }
  return "error";
}

// AC1 order: plan job spec, then the `spec-NNN/` branch prefix, then a `spec-NNN` label.
export function specFor(planSpec?: string | null, branch?: string | null, labels: readonly string[] = []): string {
  if (planSpec && SPEC_PATTERN.test(planSpec)) return planSpec;
  const fromBranch = branch?.match(/^spec-([0-9]{3})\//);
  if (fromBranch) return fromBranch[1];
  for (const label of labels) {
    const fromLabel = label.match(/^spec-([0-9]{3})$/);
    if (fromLabel) return fromLabel[1];
  }
  return "none";
}

// `spec-002/issue-19-ledger-record` gives 19.
export function issueFromBranch(branch?: string | null): number | null {
  const match = branch?.match(/^spec-[0-9]{3}\/issue-([1-9][0-9]*)-/);
  return match ? Number(match[1]) : null;
}

function parseCount(raw: string | undefined, integer: boolean): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) return null;
  return n;
}

function isoUtc(timestamp: string): string {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) throw new Error(`invalid timestamp: ${timestamp}`);
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
}

export function buildRecord(input: RecordInput): BuildResult {
  const { job, agentStep: step } = input;

  // Only runs whose agent step actually ran are recorded. A skipped step still has
  // timestamps, so the conclusion is checked as well as the start time.
  if (job.result === "skipped") return { recorded: false, reason: "agent job was skipped" };
  if (!step) return { recorded: false, reason: "agent step not found; the job failed before it" };
  if (step.conclusion === "skipped") return { recorded: false, reason: "agent step was skipped" };
  if (!step.startedAt) return { recorded: false, reason: "agent step never started" };

  const subtype = input.agentOutput?.subtype?.trim() || null;
  const hasResult = subtype !== null;

  const record: LedgerRecord = {
    date: isoUtc(input.runStartedAt),
    workflow: input.workflow,
    spec: specFor(input.planSpec, input.branch, input.labels),
    issue: input.issue ?? issueFromBranch(input.branch),
    pr: input.pr ?? null,
    cost_usd: hasResult ? parseCount(input.agentOutput?.cost_usd, false) : null,
    turns: hasResult ? parseCount(input.agentOutput?.turns, true) : null,
    // The agent step's own duration, or until the job stopped if the step never finished.
    duration_s: Math.max(0, Math.round(seconds(step.startedAt, step.completedAt ?? job.completedAt))),
    outcome: outcomeFor(subtype, job.result, seconds(job.startedAt, job.completedAt), job.timeoutMinutes),
  };

  const checked = validateRecord(record);
  if (!checked.ok) throw new Error(`built an invalid record: ${checked.errors.join("; ")}`);
  return { recorded: true, record: checked.record };
}
