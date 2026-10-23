// Shared plumbing for the ledger CLIs that workflows run with Node's type stripping
// (design 002, section 3): erasable syntax and relative `.ts` imports only. Every command
// runs through `execFile` with an argument array, so no value ever reaches a shell.
import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type Env = Record<string, string | undefined>;

export interface Deps {
  gh: (args: string[]) => Promise<string>;
  git: (args: string[], cwd?: string) => Promise<string>;
  log: (message: string) => void;
}

async function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  const { stdout } = await exec(cmd, args, { cwd, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

export const defaultDeps: Deps = {
  gh: (args) => run("gh", args),
  git: (args, cwd) => run("git", args, cwd),
  log: (message) => console.log(message),
};

export function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function positiveInt(value: string | undefined, name: string): number | null {
  if (value === undefined || value.trim() === "") return null;
  if (!/^[1-9][0-9]*$/.test(value.trim())) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

// Writes `key=value` lines to $GITHUB_OUTPUT when it is set. Values never hold a newline.
export async function setOutputs(env: Env, outputs: Record<string, string>): Promise<void> {
  if (!env.GITHUB_OUTPUT) return;
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value.replace(/[\r\n]/g, "")}\n`);
  await appendFile(env.GITHUB_OUTPUT, lines.join(""));
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isMain(url: string): boolean {
  return Boolean(process.argv[1]) && url === pathToFileURL(path.resolve(process.argv[1])).href;
}
