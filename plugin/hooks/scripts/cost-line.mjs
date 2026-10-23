// SessionEnd hook: append one line of token usage per session to a local, gitignored ledger.
// The weekly metrics job prices tokens per model; this hook only counts them.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
if (!input.transcript_path || !existsSync(input.transcript_path)) process.exit(0);

const byModel = {};
const seen = new Set();
for (const line of readFileSync(input.transcript_path, "utf8").split("\n")) {
  if (!line.includes('"usage"')) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }
  const msg = entry.message;
  if (entry.type !== "assistant" || !msg?.usage) continue;
  // One API message can be split across several transcript lines that repeat its usage.
  if (msg.id && seen.has(msg.id)) continue;
  if (msg.id) seen.add(msg.id);

  const t = (byModel[msg.model ?? "unknown"] ??= { input: 0, output: 0, cache_write: 0, cache_read: 0 });
  t.input += msg.usage.input_tokens ?? 0;
  t.output += msg.usage.output_tokens ?? 0;
  t.cache_write += msg.usage.cache_creation_input_tokens ?? 0;
  t.cache_read += msg.usage.cache_read_input_tokens ?? 0;
}
if (Object.keys(byModel).length === 0) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
let branch = "";
try {
  branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim();
} catch {}
const spec = /spec-(\d{3})/i.exec(branch)?.[1] ?? null;

const dir = path.join(root, ".claude");
mkdirSync(dir, { recursive: true });
appendFileSync(
  path.join(dir, "cost-ledger.local.jsonl"),
  JSON.stringify({ at: new Date().toISOString(), session: input.session_id, branch, spec, tokens: byModel }) + "\n",
);
