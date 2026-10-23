import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { checkEntries, checkTree, fetchLedger, isContained } from "../../scripts/ledger/fetch.mjs";

const run = promisify(execFile);
const root = path.join(tmpdir(), "site", ".ledger", ".extract");

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ledger-fetch-"));
  temps.push(dir);
  return dir;
}

const RECORD = JSON.stringify({
  date: "2026-10-01T10:00:00Z",
  workflow: "build",
  spec: "002",
  issue: 20,
  pr: null,
  cost_usd: 0.5,
  turns: 4,
  duration_s: 60,
  outcome: "success",
});

// Builds a codeload-style tarball (one top-level `<repo>-<branch>/` folder) with system tar.
async function tarball(files: Record<string, string>, links: Record<string, string> = {}): Promise<Buffer> {
  const src = await tempDir();
  const top = path.join(src, "agent-team-metrics");
  await mkdir(top, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(top, name)), { recursive: true });
    await writeFile(path.join(top, name), body);
  }
  for (const [name, target] of Object.entries(links)) await symlink(target, path.join(top, name));
  const out = path.join(src, "metrics.tar.gz");
  await run("tar", ["-czf", out, "-C", src, "agent-team-metrics"]);
  return readFile(out);
}

function serve(body: Buffer | null, status = 200): typeof fetch {
  return async () => new Response(body === null ? null : new Uint8Array(body), { status });
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  );
}

describe("path containment for the unpacked ledger", () => {
  it("accepts paths under the root", () => {
    expect(isContained(root, "agent-team-metrics/ledger/2026/10/1-1-build.json")).toBe(true);
    expect(isContained(root, "./agent-team-metrics/")).toBe(true);
    expect(isContained(root, "a/../b")).toBe(true);
    expect(isContained(root, "..hidden/file.json")).toBe(true);
  });

  it("rejects paths that escape the root", () => {
    expect(isContained(root, "../x.json")).toBe(false);
    expect(isContained(root, "agent-team-metrics/../../x.json")).toBe(false);
    expect(isContained(root, "a/b/../../../etc/passwd")).toBe(false);
    expect(isContained(root, "/etc/passwd")).toBe(false);
    expect(isContained(root, "C:/Windows/x")).toBe(false);
    expect(isContained(root, "..")).toBe(false);
  });

  it("checks every listed entry and returns the single top-level folder", () => {
    expect(
      checkEntries(["agent-team-metrics/", "agent-team-metrics/ledger/", "agent-team-metrics/ledger/a.json", ""], root),
    ).toBe("agent-team-metrics");
    expect(() => checkEntries(["agent-team-metrics/a.json", "agent-team-metrics/../../evil"], root)).toThrow(/outside/);
    expect(() => checkEntries(["/abs/path"], root)).toThrow(/outside/);
    expect(() => checkEntries(["one/a.json", "two/b.json"], root)).toThrow(/one top-level/);
    expect(() => checkEntries([], root)).toThrow(/empty/);
    expect(() => checkEntries(["t/a", "t/b", "t/c"], root, 2)).toThrow(/more than 2/);
  });

  it("rejects symlinks in the unpacked tree", async () => {
    const dir = await tempDir();
    await mkdir(path.join(dir, "t"));
    await symlink("/etc", path.join(dir, "t", "escape"));
    await expect(checkTree(dir)).rejects.toThrow(/symlink/);
  });

  it("stops at the file and byte caps", async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, "a.json"), "12345");
    await writeFile(path.join(dir, "b.json"), "12345");
    await expect(checkTree(dir, { maxFiles: 1 })).rejects.toThrow(/more than 1 files/);
    await expect(checkTree(dir, { maxBytes: 8 })).rejects.toThrow(/more than 8 bytes/);
    await expect(checkTree(dir)).resolves.toBeUndefined();
  });
});

describe("fetching the ledger before the build", () => {
  const quiet = () => {};

  it("unpacks the ledger folder from a codeload tarball into .ledger/ledger", async () => {
    const siteDir = await tempDir();
    const body = await tarball({ "ledger/2026/10/1-1-build.json": RECORD, "README.md": "metrics" });
    await expect(fetchLedger({ siteDir, env: {}, fetchImpl: serve(body), log: quiet })).resolves.toBe("fetched");
    expect(await readdir(path.join(siteDir, ".ledger"))).toEqual(["ledger"]);
    expect(await readFile(path.join(siteDir, ".ledger", "ledger", "2026", "10", "1-1-build.json"), "utf8")).toBe(RECORD);
  });

  it("copies the e2e fixture instead of downloading when LEDGER_SKIP_FETCH=1, and says so", async () => {
    const siteDir = await tempDir();
    const fixture = path.join(siteDir, "e2e", "fixtures", "ledger", "ledger", "2026", "10");
    await mkdir(fixture, { recursive: true });
    await writeFile(path.join(fixture, "1-1-build.json"), RECORD);
    // A stale ledger from an earlier build must not survive alongside the fixture.
    await mkdir(path.join(siteDir, ".ledger", "ledger", "2025"), { recursive: true });
    await writeFile(path.join(siteDir, ".ledger", "ledger", "2025", "old.json"), RECORD);

    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response(null, { status: 500 });
    };
    const logs: string[] = [];
    await expect(
      fetchLedger({ siteDir, env: { LEDGER_SKIP_FETCH: "1" }, fetchImpl, log: (m) => logs.push(m) }),
    ).resolves.toBe("fixture");
    expect(called).toBe(false);
    expect(logs).toEqual(["LEDGER_SKIP_FETCH=1, so the e2e fixture ledger was copied"]);
    expect(await readdir(path.join(siteDir, ".ledger", "ledger"))).toEqual(["2026"]);
    expect(await readFile(path.join(siteDir, ".ledger", "ledger", "2026", "10", "1-1-build.json"), "utf8")).toBe(RECORD);
  });

  it("copies the committed e2e fixture by default", async () => {
    const siteDir = await tempDir();
    const fixtureDir = path.join(__dirname, "..", "..", "e2e", "fixtures", "ledger", "ledger");
    await expect(fetchLedger({ siteDir, fixtureDir, env: { LEDGER_SKIP_FETCH: "1" }, log: quiet })).resolves.toBe(
      "fixture",
    );
    expect(await readdir(path.join(siteDir, ".ledger", "ledger", "2026"))).toEqual(["08", "09", "10"]);
  });

  it("never uses the fixture on Vercel: VERCEL=1 with LEDGER_SKIP_FETCH=1 leaves no ledger", async () => {
    const siteDir = await tempDir();
    const fixture = path.join(siteDir, "e2e", "fixtures", "ledger", "ledger", "2026", "10");
    await mkdir(fixture, { recursive: true });
    await writeFile(path.join(fixture, "1-1-build.json"), RECORD);
    await mkdir(path.join(siteDir, ".ledger", "ledger"), { recursive: true });

    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response(null, { status: 500 });
    };
    await expect(
      fetchLedger({ siteDir, env: { LEDGER_SKIP_FETCH: "1", VERCEL: "1" }, fetchImpl, log: quiet }),
    ).resolves.toBe("skipped");
    expect(called).toBe(false);
    expect(await exists(path.join(siteDir, ".ledger"))).toBe(false);
  });

  it("leaves no ledger when the fixture is missing or holds a symlink", async () => {
    const missing = await tempDir();
    await expect(fetchLedger({ siteDir: missing, env: { LEDGER_SKIP_FETCH: "1" }, log: quiet })).resolves.toBe(
      "failed",
    );
    expect(await exists(path.join(missing, ".ledger"))).toBe(false);

    const linked = await tempDir();
    const fixture = path.join(linked, "e2e", "fixtures", "ledger", "ledger");
    await mkdir(fixture, { recursive: true });
    await symlink("/etc", path.join(fixture, "escape"));
    await expect(fetchLedger({ siteDir: linked, env: { LEDGER_SKIP_FETCH: "1" }, log: quiet })).resolves.toBe(
      "failed",
    );
    expect(await exists(path.join(linked, ".ledger"))).toBe(false);
  });

  it("leaves no ledger when the branch does not exist yet", async () => {
    const siteDir = await tempDir();
    await expect(fetchLedger({ siteDir, env: {}, fetchImpl: serve(null, 404), log: quiet })).resolves.toBe("missing");
    expect(await exists(path.join(siteDir, ".ledger"))).toBe(false);
  });

  it("warns and leaves no ledger when the download fails, without throwing", async () => {
    const siteDir = await tempDir();
    const warnings: string[] = [];
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network down");
    };
    await expect(fetchLedger({ siteDir, env: {}, fetchImpl, log: (m) => warnings.push(m) })).resolves.toBe("failed");
    expect(warnings.join("\n")).toMatch(/network down/);
    expect(await exists(path.join(siteDir, ".ledger"))).toBe(false);
  });

  it("rejects a download over the size cap", async () => {
    const siteDir = await tempDir();
    const body = await tarball({ "ledger/2026/10/1-1-build.json": RECORD });
    await expect(
      fetchLedger({ siteDir, env: {}, fetchImpl: serve(body), log: quiet, maxBytes: 64 }),
    ).resolves.toBe("failed");
    expect(await exists(path.join(siteDir, ".ledger"))).toBe(false);
  });

  it("rejects a tarball that holds a symlink", async () => {
    const siteDir = await tempDir();
    const body = await tarball({ "ledger/2026/10/1-1-build.json": RECORD }, { "ledger/escape": "/etc" });
    await expect(fetchLedger({ siteDir, env: {}, fetchImpl: serve(body), log: quiet })).resolves.toBe("failed");
    expect(await exists(path.join(siteDir, ".ledger"))).toBe(false);
  });
});
