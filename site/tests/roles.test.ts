import path from "node:path";
import { describe, expect, it } from "vitest";
import { listRoles, parseRole, sentenceCase } from "../lib/roles";

const fixtures = path.join(__dirname, "fixtures", "agents");

describe("sentenceCase", () => {
  it("turns a hyphenated name into sentence case", () => {
    expect(sentenceCase("code-reviewer")).toBe("Code reviewer");
    expect(sentenceCase("engineer")).toBe("Engineer");
  });
});

describe("parseRole", () => {
  it("reads name, description and model from frontmatter", () => {
    const raw = "---\nname: tech-lead\ndescription: Plans work.\nmodel: opus\ntools: Read\n---\nBody";
    expect(parseRole("tech-lead.md", raw)).toEqual({
      slug: "tech-lead",
      name: "Tech lead",
      description: "Plans work.",
      model: "opus",
    });
  });

  it("rejects a file with a missing field", () => {
    expect(() => parseRole("x.md", "---\nname: x\nmodel: opus\n---\n")).toThrow(/description/);
  });
});

describe("listRoles", () => {
  // AC3: the list follows the folder contents with no other code change.
  it("returns one role per .md file in the folder", async () => {
    const roles = await listRoles(fixtures);
    expect(roles.map((r) => r.name)).toEqual(["Code reviewer", "Engineer"]);
    expect(roles[1]).toMatchObject({ description: "Builds one issue at a time.", model: "sonnet" });
  });
});
