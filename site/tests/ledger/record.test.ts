import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OUTCOMES,
  RECORD_FIELDS,
  buildRecord,
  outcomeFor,
  specFor,
  validateRecord,
  type BuildResult,
  type RecordInput,
} from "../../lib/ledger/record.ts";

const fixtures = path.join(__dirname, "..", "fixtures", "ledger");

interface Fixture {
  description: string;
  input: RecordInput;
  expected: BuildResult;
}

function load(name: string): Fixture {
  return JSON.parse(readFileSync(path.join(fixtures, `${name}.json`), "utf8")) as Fixture;
}

function expectFixture(name: string) {
  const { input, expected } = load(name);
  const result = buildRecord(input);
  expect(result.recorded).toBe(expected.recorded);
  if (expected.recorded && result.recorded) expect(result.record).toEqual(expected.record);
  return result;
}

const validRecord = load("spec-plan-job").expected;
if (!validRecord.recorded) throw new Error("spec-plan-job fixture must be recorded");
const sample = validRecord.record;

describe("AC1: one record with exactly the AC1 fields per agent run", () => {
  it.each(["spec-plan-job", "spec-branch-prefix", "spec-issue-label", "spec-none"])(
    "builds a record with every AC1 field from %s",
    (name) => {
      const result = expectFixture(name);
      if (!result.recorded) throw new Error("expected a record");
      expect(Object.keys(result.record).sort()).toEqual([...RECORD_FIELDS].sort());
    },
  );

  it("takes spec from the plan job's spec number", () => {
    const result = expectFixture("spec-plan-job");
    expect(result.recorded && result.record.spec).toBe("002");
  });

  it("takes spec and issue from the spec-NNN/issue-N- branch, ahead of any label", () => {
    const result = expectFixture("spec-branch-prefix");
    expect(result.recorded && [result.record.spec, result.record.issue]).toEqual(["002", 19]);
  });

  it("takes spec from the issue's spec-NNN label when there is no plan spec or spec branch", () => {
    const result = expectFixture("spec-issue-label");
    expect(result.recorded && result.record.spec).toBe("002");
  });

  it("sets spec to none and issue to null when no source applies", () => {
    const result = expectFixture("spec-none");
    expect(result.recorded && [result.record.spec, result.record.issue]).toEqual(["none", null]);
  });

  it("does not record a run that fails before the agent step starts", () => {
    expectFixture("fails-before-agent");
  });

  it("does not record a run whose agent step was skipped, even though it has timestamps", () => {
    expectFixture("agent-step-skipped");
  });

  it("does not record a run whose agent job was skipped", () => {
    const { input } = load("spec-plan-job");
    expect(buildRecord({ ...input, job: { ...input.job, result: "skipped" } }).recorded).toBe(false);
  });

  it("does not record an agent step that has no start time", () => {
    const { input } = load("spec-plan-job");
    const agentStep = { conclusion: null, startedAt: null, completedAt: null };
    expect(buildRecord({ ...input, agentStep }).recorded).toBe(false);
  });

  it("ignores a spec value that is not three digits and falls through to the next source", () => {
    expect(specFor("2; rm -rf /", "spec-003/issue-9-x", ["spec-004"])).toBe("003");
    expect(specFor("02", null, ["spec-004"])).toBe("004");
    expect(specFor(null, "spec-03/x", ["spec-0005", "spec-x"])).toBe("none");
  });
});

describe("AC2: outcome is one of the five values, and no-result runs are still recorded", () => {
  const cases: [string, (typeof OUTCOMES)[number]][] = [
    ["outcome-success", "success"],
    ["outcome-error", "error"],
    ["outcome-max-turns", "max_turns"],
    ["outcome-timeout", "timeout"],
    ["outcome-cancelled", "cancelled"],
  ];

  it.each(cases)("records %s as %s", (name, outcome) => {
    const result = expectFixture(name);
    expect(result.recorded && result.record.outcome).toBe(outcome);
  });

  it("covers every outcome with a fixture", () => {
    expect(cases.map(([, o]) => o).sort()).toEqual([...OUTCOMES].sort());
  });

  it("records success when the agent step succeeded but the job failed afterwards", () => {
    const result = expectFixture("outcome-success-job-failed-after");
    expect(result.recorded && result.record.outcome).toBe("success");
  });

  it.each(["outcome-timeout", "outcome-cancelled", "outcome-error-no-result"])(
    "sets cost_usd and turns to null and duration_s to the time until the run stopped for %s",
    (name) => {
      const result = expectFixture(name);
      if (!result.recorded) throw new Error("expected a record");
      expect(result.record.cost_usd).toBeNull();
      expect(result.record.turns).toBeNull();
      const { agentStep, job } = load(name).input;
      const stop = agentStep?.completedAt ?? job.completedAt;
      const seconds = (Date.parse(stop as string) - Date.parse(agentStep?.startedAt as string)) / 1000;
      expect(result.record.duration_s).toBe(seconds);
    },
  );

  it("decides from the agent's subtype first, then the job result and elapsed time", () => {
    expect(outcomeFor("success", "cancelled", 1200, 20)).toBe("success");
    expect(outcomeFor("error_max_turns", "failure", 1200, 20)).toBe("max_turns");
    expect(outcomeFor("error_during_execution", "cancelled", 1200, 20)).toBe("error");
    expect(outcomeFor("", "failure", 1140, 20)).toBe("timeout");
    expect(outcomeFor("", "cancelled", 3605, 60)).toBe("timeout");
    expect(outcomeFor("", "failure", 1139, 20)).toBe("error");
    expect(outcomeFor(null, "cancelled", 180, 20)).toBe("cancelled");
    expect(outcomeFor(undefined, "success", 1200, 20)).toBe("error");
  });
});

describe("AC3: a record has exactly the AC1 fields", () => {
  it("accepts a record with exactly the AC1 fields", () => {
    expect(validateRecord(sample)).toEqual({ ok: true, record: sample });
  });

  it.each([
    ["prompt", "Implement issue 19"],
    ["input_tokens", 12000],
    ["transcript", []],
    ["token", "ghs_example"],
  ])("rejects a record with an extra %s field", (field, value) => {
    const result = validateRecord({ ...sample, [field]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain(`unexpected field "${field}"`);
  });

  it("rejects a record with a missing field", () => {
    const rest: Record<string, unknown> = { ...sample };
    delete rest.turns;
    const result = validateRecord(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain(`missing field "turns"`);
  });

  it.each([
    ["outcome", "failed"],
    ["workflow", "spec-writer"],
    ["spec", "2"],
    ["spec", 2],
    ["date", "2026-10-23 09:00"],
    ["issue", 0],
    ["pr", "30"],
    ["cost_usd", -1],
    ["turns", 1.5],
    ["duration_s", null],
  ])("rejects a record whose %s is %j", (field, value) => {
    expect(validateRecord({ ...sample, [field]: value }).ok).toBe(false);
  });

  it("rejects values that are not objects", () => {
    for (const value of [null, "record", 3, [sample]]) expect(validateRecord(value).ok).toBe(false);
  });
});
