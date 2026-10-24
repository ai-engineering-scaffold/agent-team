// The homepage "How work flows" diagram (spec 006): six steps and three loops. The four gate
// steps take their approvers from GATES (lib/gates.ts), the list How we work renders, so the
// diagram can't drift from the documented process; a unit test checks the two agree. Checked
// against the workflows on main and ADRs 0006, 0008, 0009, 0015 and 0016.
import { GATES, type Approver, type Gate } from "./gates";

/** Someone who takes part in a step: a gate approver or extra diagram text, with what they do. */
export type Participant = Approver & { does?: string };

/** The wash painted behind a card (ADR 0018). Files live in public/workflow/. */
export type Wash = "spec" | "plan" | "build" | "ci" | "review" | "merge" | "loop";

export type Step = {
  name: string;
  /** Set on the four gate steps: the gate whose approvers this step shows. */
  gate?: string;
  participants: readonly Participant[];
  /** One sentence of at most eight words, not counting the owner text. */
  description: string;
  wash: Wash;
};

export type Loop = {
  name: string;
  /** What starts the loop. */
  trigger: string;
  /** Where the work goes next, in words. */
  then: string;
  /** The steps (or Graham) the loop returns work to, for the unit tests. */
  targets: readonly string[];
};

export const STEP_NAMES = ["Spec", "Plan", "Build", "CI", "Review", "Merge"] as const;

/** Human labels for the agent roles in plugin/agents/. */
const ROLE_LABELS: Record<string, string> = {
  "spec-writer": "spec writer",
  "tech-lead": "tech lead",
  engineer: "engineer",
  "qa-automation": "QA",
  "code-reviewer": "code reviewer",
  scribe: "scribe",
};

/** The approvers of a gate in `gates`, by name. Throws if the gate is missing. */
export function gateApprovers(name: string, gates: readonly Gate[] = GATES): readonly Approver[] {
  const gate = gates.find((g) => g.name === name);
  if (!gate) throw new Error(`No gate named ${name}`);
  return gate.approvers;
}

/** Gate approvers with a verb added to each, e.g. Graham "approves". */
function approving(name: string, does?: string): Participant[] {
  return gateApprovers(name).map((a) => (does ? { ...a, does } : { ...a }));
}

export const STEPS: readonly Step[] = [
  {
    name: "Spec",
    gate: "Spec",
    participants: [{ kind: "agent", role: "spec-writer", does: "drafts" }, ...approving("Spec", "approves")],
    description: "A brief becomes a spec with acceptance criteria.",
    wash: "spec",
  },
  {
    name: "Plan",
    participants: [{ kind: "agent", role: "tech-lead" }],
    description: "Makes the technical choices and writes the issue.",
    wash: "plan",
  },
  {
    name: "Build",
    participants: [
      { kind: "agent", role: "engineer" },
      { kind: "agent", role: "qa-automation" },
    ],
    description: "Code, unit and Playwright tests in one PR.",
    wash: "build",
  },
  {
    name: "CI",
    gate: "CI",
    participants: approving("CI"),
    description: "Lint, types, unit tests, build and e2e pass.",
    wash: "ci",
  },
  {
    name: "Review",
    gate: "Review",
    participants: approving("Review"),
    description: "A fresh-context review must pass.",
    wash: "review",
  },
  {
    name: "Merge",
    gate: "Merge",
    participants: approving("Merge"),
    description: "Approved PRs merge into main.",
    wash: "merge",
  },
];

export const LOOPS: readonly Loop[] = [
  {
    // ADR 0008 and 0016, agent-pipeline.yml.
    name: "A merge starts the next step",
    trigger: "A spec or build PR merges.",
    then: "Plan starts for a merged spec, and Build for the spec's next issue. No one starts them by hand.",
    targets: ["Plan", "Build"],
  },
  {
    // ADRs 0009 and 0016, agent-fix.yml.
    name: "Fix agent",
    trigger: "Review asks for changes, CI fails, or the PR conflicts with main.",
    then: "The fix agent pushes, so the PR goes back to CI. After two rounds for one reason, it goes to Graham.",
    targets: ["CI", "Graham"],
  },
  {
    // ADR 0015, agent-build.yml and agent-unblock.yml.
    name: "Unblock round",
    trigger: "A build opens no PR.",
    then: "The tech lead gets one round, then the issue goes back to Build, or to Graham if it needs his decision.",
    targets: ["Build", "Graham"],
  },
];

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinAnd(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function label(p: Participant): string {
  if (p.kind === "graham") return "Graham";
  if (p.kind === "automation") return "automation";
  return ROLE_LABELS[p.role] ?? p.role.replace(/-/g, " ");
}

/**
 * The owner line for a step, formatted from its structured participants. Agents with no verb
 * share one phrase ("Engineer and QA agents"); each other participant is its own clause, and
 * clauses are joined with "; ". A low-risk scope adds "for low-risk changes (ADR 0006)".
 */
export function formatOwners(participants: readonly Participant[]): string {
  const clauses: string[] = [];
  let agents: string[] = [];
  const flush = () => {
    if (agents.length > 0) clauses.push(`${joinAnd(agents)} ${agents.length > 1 ? "agents" : "agent"}`);
    agents = [];
  };
  for (const p of participants) {
    if (p.kind === "agent" && !p.does && !p.scope) {
      agents.push(label(p));
      continue;
    }
    flush();
    let clause = p.kind === "agent" ? `${label(p)} agent` : label(p);
    if (p.scope === "low-risk") clause += " for low-risk changes (ADR 0006)";
    if (p.does) clause += ` ${p.does}`;
    clauses.push(clause);
  }
  flush();
  return capitalise(clauses.join("; "));
}

/** The words in a description, as AC1 counts them. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Strips a participant back to the approver it came from (drops `does`), for comparing with GATES. */
export function asApprover(p: Participant): Approver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { does, ...approver } = p;
  return approver as Approver;
}

/**
 * Differences between the diagram's gate steps and the gate list, in name, order or approvers.
 * Empty when they agree. Descriptions may differ (spec 006, AC8). The Spec step's extra
 * participant (the spec writer) is diagram text, so only participants that carry a gate's
 * approver role are compared: Graham, automation and the gate's own agents.
 */
export function gateDrift(steps: readonly Step[], gates: readonly Gate[]): string[] {
  const problems: string[] = [];
  const gateSteps = steps.filter((s) => s.gate !== undefined);
  const names = gateSteps.map((s) => s.name);
  const gateNames = gates.map((g) => g.name);
  if (names.join(",") !== gateNames.join(",")) {
    problems.push(`gate steps are ${names.join(", ")} but GATES is ${gateNames.join(", ")}`);
  }
  for (const step of gateSteps) {
    if (step.gate !== step.name) problems.push(`step ${step.name} reads gate ${step.gate}`);
    const gate = gates.find((g) => g.name === step.name);
    if (!gate) continue;
    const extras = EXTRA_PARTICIPANTS[step.name] ?? [];
    const shown = step.participants
      .map(asApprover)
      .filter((a) => !extras.some((e) => JSON.stringify(e) === JSON.stringify(a)));
    if (JSON.stringify(shown) !== JSON.stringify(gate.approvers)) {
      problems.push(`step ${step.name} shows ${JSON.stringify(shown)} but GATES has ${JSON.stringify(gate.approvers)}`);
    }
  }
  return problems;
}

/** Participants the diagram adds to a gate step that are not its approvers (AC8: extra text). */
const EXTRA_PARTICIPANTS: Record<string, readonly Approver[]> = {
  Spec: [{ kind: "agent", role: "spec-writer" }],
};
