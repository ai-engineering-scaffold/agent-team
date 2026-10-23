// PreToolUse guard for file edits. Exit 2 blocks the edit and shows stderr to Claude.
// Two rules: protected files need Graham, and each subagent role writes only where it owns.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!filePath) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join("/");

function block(reason) {
  process.stderr.write(`Blocked edit to ${rel}: ${reason}\n`);
  process.exit(2);
}

if (rel.startsWith("..")) process.exit(0); // outside the repo, e.g. a scratch file

if (/(^|\/)\.env(\.|$)/.test(rel)) block("env files hold secrets and are never edited by agents.");

// Graham opts in per session with SCAFFOLD_ALLOW_PROTECTED=1.
const PROTECTED = [/^\.github\/workflows\//, /^\.github\/low-risk-paths\.txt$/, /^\.github\/CODEOWNERS$/, /^plugin\/hooks\//];
if (PROTECTED.some((re) => re.test(rel)) && process.env.SCAFFOLD_ALLOW_PROTECTED !== "1") {
  block("this file controls the org's gates. Describe the change in your PR and Graham will make it.");
}

// Subagents arrive as "scaffold-org:<role>"; the main session has no agent_type.
const role = input.agent_type?.split(":").pop();
const OWNS = {
  "spec-writer": [/^specs\//],
  "tech-lead": [/^docs\//, /^decisions\//],
  "qa-automation": [/^site\/e2e\//, /\.spec\.ts$/, /\.test\.ts$/],
  scribe: [/^decisions\//, /^docs\//, /^metrics\//, /^CHANGELOG\.md$/],
  "code-reviewer": [],
};
// ADR 0012: the engineer may add an ADR from its issue's Design section, and fix it in later rounds,
// but never touch an ADR that is already on main.
function onMain(file) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", "origin/main"], { cwd: root, stdio: "ignore" });
  } catch {
    block("origin/main is not fetched, so this ADR can't be checked. Run `git fetch origin main` and retry.");
  }
  try {
    execFileSync("git", ["cat-file", "-e", `origin/main:${file}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (role === "engineer") {
  if (/^specs\//.test(rel)) block("specs belong to the spec writer.");
  if (/^decisions\//.test(rel) && onMain(rel)) {
    block("this ADR is already on main. Supersede it with a new one, and say so in the PR.");
  }
}
if (role in OWNS && !OWNS[role].some((re) => re.test(rel))) {
  block(`the ${role} role does not write here.`);
}
