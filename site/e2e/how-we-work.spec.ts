import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Spec 001: How we work page. Tests run from site/, agent definitions live one level up.
const AGENTS_DIR = path.resolve(__dirname, "..", "..", "plugin", "agents");
const agentFiles = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));

function frontmatterField(file: string, key: string): string {
  const raw = readFileSync(path.join(AGENTS_DIR, file), "utf8");
  const block = raw.split(/^---\s*$/m)[1] ?? "";
  const line = block.split("\n").find((l) => l.startsWith(`${key}:`));
  return (line ?? "").slice(key.length + 1).trim();
}

function sentenceCase(name: string): string {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

test("AC1: /how-we-work shows a level-one heading 'How we work'", async ({ page }) => {
  await page.goto("/how-we-work");
  await expect(page.getByRole("heading", { level: 1, name: "How we work" })).toBeVisible();
});

test("AC2: one entry per agent file, with name, description and model", async ({ page }) => {
  expect(agentFiles.length).toBeGreaterThan(0);
  await page.goto("/how-we-work");
  const entries = page.getByRole("list", { name: "Agent roles" }).getByRole("listitem");
  await expect(entries).toHaveCount(agentFiles.length);

  for (const file of agentFiles) {
    const name = sentenceCase(frontmatterField(file, "name"));
    const entry = entries.filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(frontmatterField(file, "description"));
    await expect(entry).toContainText(frontmatterField(file, "model"));
  }
});

test("AC6: the main navigation links to /how-we-work from any page", async ({ page }) => {
  for (const start of ["/", "/decisions"]) {
    await page.goto(start);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How we work" }).click();
    await expect(page).toHaveURL(/\/how-we-work$/);
    await expect(page.getByRole("heading", { level: 1, name: "How we work" })).toBeVisible();
  }
});

test("AC7: at 375 px wide, roles are readable without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/how-we-work");
  const entries = page.getByRole("list", { name: "Agent roles" }).getByRole("listitem");
  await expect(entries).toHaveCount(agentFiles.length);
  await expect(entries.last()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

const GATE_APPROVERS: Array<{ name: string; approver: RegExp }> = [
  { name: "Spec", approver: /Graham/ },
  { name: "Design", approver: /Graham/ },
  { name: "CI", approver: /checks?/i },
  { name: "Review", approver: /reviewer/i },
  { name: "Merge", approver: /Graham/ },
];

test("AC4: the gates section lists Spec, Design, CI, Review, Merge in order, each with its approver", async ({ page }) => {
  await page.goto("/how-we-work");
  const section = page.getByRole("region", { name: "Gates" });
  await expect(section.getByRole("heading", { level: 2, name: "Gates" })).toBeVisible();

  const gates = section.getByRole("list", { name: "Gates" }).getByRole("listitem");
  await expect(gates).toHaveCount(GATE_APPROVERS.length);

  for (const [i, { name, approver }] of GATE_APPROVERS.entries()) {
    const gate = gates.nth(i);
    await expect(gate.getByRole("heading", { name, exact: true })).toBeVisible();
    // The approver text is the gate's first paragraph, apart from the ADR links.
    await expect(gate.getByRole("paragraph").first()).toHaveText(approver);
  }
});

test("AC5: every gate links to ADR 0002, and the Merge gate also links to ADR 0006", async ({ page }) => {
  await page.goto("/how-we-work");
  const gates = page.getByRole("region", { name: "Gates" }).getByRole("list", { name: "Gates" }).getByRole("listitem");
  await expect(gates).toHaveCount(GATE_APPROVERS.length);

  for (const [i, { name }] of GATE_APPROVERS.entries()) {
    const gate = gates.nth(i);
    await expect(gate.getByRole("link", { name: "ADR 0002" })).toHaveAttribute("href", /\/decisions\/0002-/);
    const adr6 = gate.getByRole("link", { name: "ADR 0006" });
    if (name === "Merge") {
      await expect(adr6).toHaveAttribute("href", /\/decisions\/0006-/);
    } else {
      await expect(adr6).toHaveCount(0);
    }
  }

  // The links resolve to the ADR pages.
  await gates.first().getByRole("link", { name: "ADR 0002" }).click();
  await expect(page).toHaveURL(/\/decisions\/0002-/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/how-we-work");
  await gates.last().getByRole("link", { name: "ADR 0006" }).click();
  await expect(page).toHaveURL(/\/decisions\/0006-/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
