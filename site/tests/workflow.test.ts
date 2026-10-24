import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GATES, type Gate } from "../lib/gates";
import {
  LOOPS,
  STEPS,
  STEP_NAMES,
  asApprover,
  formatOwners,
  gateDrift,
  wordCount,
  type Step,
} from "../lib/workflow";

// Spec 006: the homepage "How work flows" diagram. AC8 keeps its gate steps in step with the gate
// list How we work renders; AC1, AC2 and AC5 are checked here where they don't need a browser.

const WORKFLOW_DIR = path.join(__dirname, "..", "public", "workflow");

/** A deep copy, so a test can mutate one side without touching the modules. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("AC8: the diagram's gate steps match GATES", () => {
  it("agree in name, order and approvers", () => {
    expect(gateDrift(STEPS, GATES)).toEqual([]);
    const gateSteps = STEPS.filter((s) => s.gate);
    expect(gateSteps.map((s) => s.name)).toEqual(GATES.map((g) => g.name));
    expect(gateSteps.map((s) => s.name)).toEqual(["Spec", "CI", "Review", "Merge"]);
  });

  it("give each gate the approvers AC8 names", () => {
    const byName = Object.fromEntries(GATES.map((g) => [g.name, g.approvers]));
    expect(byName).toEqual({
      Spec: [{ kind: "graham" }],
      CI: [{ kind: "automation" }],
      Review: [{ kind: "agent", role: "code-reviewer" }],
      Merge: [{ kind: "graham" }, { kind: "automation", scope: "low-risk" }],
    });
  });

  it("fails when GATES changes an approver and the diagram does not", () => {
    const gates = copy(GATES) as Gate[];
    gates[3] = { ...gates[3], approvers: [{ kind: "graham" }] };
    expect(gateDrift(STEPS, gates)).not.toEqual([]);
  });

  it("fails when the diagram changes an approver and GATES does not", () => {
    const steps = copy(STEPS) as Step[];
    const review = steps.find((s) => s.name === "Review")!;
    review.participants = [{ kind: "agent", role: "engineer" }];
    expect(gateDrift(steps, GATES)).not.toEqual([]);
  });

  it("fails when a gate is renamed on one side only", () => {
    const gates = copy(GATES) as Gate[];
    gates[1] = { ...gates[1], name: "Checks" };
    expect(gateDrift(STEPS, gates)).not.toEqual([]);

    const steps = copy(STEPS) as Step[];
    steps[3] = { ...steps[3], name: "Checks", gate: "Checks" };
    expect(gateDrift(steps, GATES)).not.toEqual([]);
  });

  it("fails when the gates are reordered on one side only", () => {
    const gates = copy(GATES) as Gate[];
    [gates[2], gates[3]] = [gates[3], gates[2]];
    expect(gateDrift(STEPS, gates)).not.toEqual([]);
  });

  it("fails when the Spec step drops Graham's approval", () => {
    const steps = copy(STEPS) as Step[];
    steps[0].participants = steps[0].participants.filter((p) => p.kind !== "graham");
    expect(gateDrift(steps, GATES)).not.toEqual([]);
  });

  it("reads gate approvers from GATES rather than restating them", () => {
    for (const step of STEPS.filter((s) => s.gate)) {
      const gate = GATES.find((g) => g.name === step.name)!;
      for (const approver of gate.approvers) {
        expect(step.participants.map(asApprover)).toContainEqual(approver);
      }
    }
  });
});

describe("AC1: the six steps", () => {
  it("are exactly Spec, Plan, Build, CI, Review and Merge, in order", () => {
    expect(STEPS.map((s) => s.name)).toEqual(["Spec", "Plan", "Build", "CI", "Review", "Merge"]);
    expect(STEPS.map((s) => s.name)).toEqual([...STEP_NAMES]);
  });

  it("each have a description of at most eight words, as one sentence", () => {
    for (const step of STEPS) {
      expect(wordCount(step.description), step.name).toBeGreaterThan(0);
      expect(wordCount(step.description), step.name).toBeLessThanOrEqual(8);
      expect(step.description.match(/[.!?]/g)?.length ?? 0, step.name).toBeLessThanOrEqual(1);
    }
  });

  it("name who does each step", () => {
    const owners = Object.fromEntries(STEPS.map((s) => [s.name, formatOwners(s.participants)]));
    expect(owners).toEqual({
      Spec: "Spec writer agent drafts; Graham approves",
      Plan: "Tech lead agent",
      Build: "Engineer and QA agents",
      CI: "Automation",
      Review: "Code reviewer agent",
      Merge: "Graham; automation for low-risk changes (ADR 0006)",
    });
  });
});

describe("formatOwners", () => {
  it("formats a single agent, a single approver and a scoped approver", () => {
    expect(formatOwners([{ kind: "agent", role: "tech-lead" }])).toBe("Tech lead agent");
    expect(formatOwners([{ kind: "graham" }])).toBe("Graham");
    expect(formatOwners([{ kind: "automation", scope: "low-risk" }])).toBe(
      "Automation for low-risk changes (ADR 0006)",
    );
  });

  it("joins agents with no verb into one phrase and uses the role name for an unknown role", () => {
    expect(
      formatOwners([
        { kind: "agent", role: "engineer" },
        { kind: "agent", role: "qa-automation" },
        { kind: "agent", role: "release-manager" },
      ]),
    ).toBe("Engineer, QA and release manager agents");
  });
});

describe("AC2: the loops", () => {
  it("are the merge, fix agent and unblock loops", () => {
    expect(LOOPS.map((l) => l.name)).toEqual(["A merge starts the next step", "Fix agent", "Unblock round"]);
  });

  it("each have a trigger and a target that is a step or Graham", () => {
    const allowed = new Set<string>([...STEP_NAMES, "Graham"]);
    for (const loop of LOOPS) {
      expect(loop.trigger.trim(), loop.name).not.toBe("");
      expect(loop.then.trim(), loop.name).not.toBe("");
      expect(loop.targets.length, loop.name).toBeGreaterThan(0);
      for (const target of loop.targets) {
        expect(allowed.has(target), `${loop.name} -> ${target}`).toBe(true);
        expect(loop.then, loop.name).toContain(target);
      }
    }
  });

  it("send the fix agent back to CI or Graham, and the unblock round back to Build or Graham", () => {
    const byName = Object.fromEntries(LOOPS.map((l) => [l.name, l.targets]));
    expect(byName["Fix agent"]).toEqual(["CI", "Graham"]);
    expect(byName["Unblock round"]).toEqual(["Build", "Graham"]);
  });
});

describe("AC5: the diagram's images", () => {
  const files = readdirSync(WORKFLOW_DIR);

  it("total at most 200 KB", () => {
    const total = files.reduce((sum, f) => sum + statSync(path.join(WORKFLOW_DIR, f)).size, 0);
    expect(files.length).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(200 * 1024);
  });

  it("are a wash for every step and the loops, plus the paper grain", () => {
    const expected = [...new Set(STEPS.map((s) => s.wash)), "loop"].map((w) => `wash-${w}.webp`);
    expect(files.sort()).toEqual([...expected, "paper.webp"].sort());
  });
});
