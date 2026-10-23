// Stop hook: when the site has uncommitted or unpushed changes, lint, typecheck and unit tests
// must pass before the agent may finish. Exit 2 sends the failure back to Claude.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.stop_hook_active) process.exit(0); // already retried once this turn; don't loop

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const site = path.join(root, "site");
if (!existsSync(path.join(site, "package.json")) || !existsSync(path.join(site, "node_modules"))) process.exit(0);

const sh = (cmd) => execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let changed = "";
try {
  changed = sh("git status --porcelain -- site decisions");
} catch {
  process.exit(0); // not a git checkout
}
if (!changed.trim()) process.exit(0);

try {
  sh("npm --prefix site run check --silent");
} catch (err) {
  const output = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim().split("\n").slice(-40).join("\n");
  process.stderr.write(`Checks fail on your changes. Fix them before finishing:\n${output}\n`);
  process.exit(2);
}
