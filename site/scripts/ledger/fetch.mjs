// `prebuild`: download the `metrics` branch into `site/.ledger/` for the ledger loader
// (spec 002, AC4; design 002, section 1). Plain `.mjs`, so it runs on any Node the build host
// has, without type stripping. It never fails the build: on any problem it logs a warning,
// leaves no `.ledger/` behind (the loader then reports `available: false`) and exits 0.
//
// The tarball is untrusted input, since anyone with write access can push to `metrics`. It is
// capped at 10 MB (compressed and unpacked) and 20,000 files, every entry name is checked
// before system `tar` unpacks it, and the unpacked tree is checked again for symlinks and
// paths outside `site/.ledger/`.
//
// With `LEDGER_SKIP_FETCH=1` (CI's `site` and `e2e` jobs) it copies the committed e2e fixture
// ledger instead, so Playwright tests a fixed ledger (design 003). Never on Vercel (`VERCEL=1`),
// so a misconfigured production build shows "unavailable", never fixture numbers.
import { execFile } from "node:child_process";
import { cp, lstat, mkdir, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

const run = promisify(execFile);

export const LEDGER_URL = "https://codeload.github.com/ai-engineering-scaffold/agent-team/tar.gz/refs/heads/metrics";
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 20_000;
export const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// The committed fixture records, relative to the site directory.
export const FIXTURE_LEDGER = path.join("e2e", "fixtures", "ledger", "ledger");

/**
 * True when `entry`, resolved against `root`, is `root` itself or somewhere beneath it.
 * @param {string} root
 * @param {string} entry
 */
export function isContained(root, entry) {
  if (path.isAbsolute(entry) || /^[A-Za-z]:/.test(entry)) return false;
  const rel = path.relative(path.resolve(root), path.resolve(root, entry));
  return rel === "" || !(rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}

/**
 * Checks the names `tar -tf` lists before anything is unpacked. Codeload tarballs hold one
 * top-level directory (`<repo>-<branch>/`); returns its name.
 * @param {string[]} names
 * @param {string} root the directory the archive will be unpacked into
 * @param {number} [maxFiles]
 * @returns {string}
 */
export function checkEntries(names, root, maxFiles = MAX_FILES) {
  const entries = names.filter((n) => n !== "");
  if (entries.length === 0) throw new Error("the archive is empty");
  if (entries.length > maxFiles) throw new Error(`the archive has more than ${maxFiles} entries`);

  const tops = new Set();
  for (const name of entries) {
    if (!isContained(root, name)) throw new Error(`entry "${name}" would land outside ${root}`);
    const parts = path.posix.normalize(name).split("/").filter((p) => p !== "" && p !== ".");
    if (parts.length === 0 || parts[0] === "..") throw new Error(`entry "${name}" has no top-level directory`);
    tops.add(parts[0]);
  }
  if (tops.size !== 1) throw new Error("the archive must hold exactly one top-level directory");
  return [...tops][0];
}

/**
 * Walks the unpacked tree and rejects anything but plain files and directories inside `root`.
 * @param {string} root
 * @param {{ maxFiles?: number, maxBytes?: number }} [limits]
 */
export async function checkTree(root, { maxFiles = MAX_FILES, maxBytes = MAX_BYTES } = {}) {
  const realRoot = await realpath(root);
  let files = 0;
  let bytes = 0;
  /** @param {string} dir */
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const full = path.join(dir, name);
      const info = await lstat(full);
      if (info.isSymbolicLink()) throw new Error(`"${path.relative(root, full)}" is a symlink`);
      if (!isContained(realRoot, path.relative(realRoot, await realpath(full)))) {
        throw new Error(`"${path.relative(root, full)}" is outside ${root}`);
      }
      if (info.isDirectory()) {
        await walk(full);
      } else if (info.isFile()) {
        files += 1;
        bytes += info.size;
        if (files > maxFiles) throw new Error(`more than ${maxFiles} files unpacked`);
        if (bytes > maxBytes) throw new Error(`more than ${maxBytes} bytes unpacked`);
      } else {
        throw new Error(`"${path.relative(root, full)}" is not a file or directory`);
      }
    }
  }
  await walk(root);
}

/**
 * @param {Response} res
 * @param {number} maxBytes
 */
async function readCapped(res, maxBytes) {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) throw new Error(`the download is larger than ${maxBytes} bytes`);
  if (!res.body) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new Error(`the download is larger than ${maxBytes} bytes`);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * @typedef {{
 *   siteDir?: string,
 *   fixtureDir?: string,
 *   url?: string,
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 *   log?: (message: string) => void,
 *   maxBytes?: number,
 *   maxFiles?: number,
 * }} FetchOptions
 */

/**
 * Downloads and unpacks the ledger, or copies the e2e fixture when `LEDGER_SKIP_FETCH=1`.
 * Resolves to what happened and never rejects.
 * @param {FetchOptions} [options]
 * @returns {Promise<"skipped" | "fixture" | "fetched" | "missing" | "failed">}
 */
export async function fetchLedger(options = {}) {
  const {
    siteDir = SITE_DIR,
    fixtureDir = path.join(siteDir, FIXTURE_LEDGER),
    url = LEDGER_URL,
    env = process.env,
    fetchImpl = fetch,
    log = (message) => console.warn(`ledger: ${message}`),
    maxBytes = MAX_BYTES,
    maxFiles = MAX_FILES,
  } = options;

  const ledgerDir = path.join(siteDir, ".ledger");

  if (env.LEDGER_SKIP_FETCH === "1") {
    // Vercel sets VERCEL=1 on every build. There, skipping leaves no ledger at all, so the page
    // says the data is unavailable rather than showing fixture numbers as if they were real.
    if (env.VERCEL === "1") {
      await rm(ledgerDir, { recursive: true, force: true }).catch(() => {});
      log("LEDGER_SKIP_FETCH=1 on Vercel, so the ledger was not downloaded and the e2e fixture was not used");
      return "skipped";
    }
    try {
      await rm(ledgerDir, { recursive: true, force: true });
      await cp(fixtureDir, path.join(ledgerDir, "ledger"), { recursive: true });
      await checkTree(ledgerDir, { maxFiles, maxBytes });
      log("LEDGER_SKIP_FETCH=1, so the e2e fixture ledger was copied");
      return "fixture";
    } catch (error) {
      await rm(ledgerDir, { recursive: true, force: true }).catch(() => {});
      log(`could not copy the e2e fixture ledger, so it is unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return "failed";
    }
  }
  const extractDir = path.join(ledgerDir, ".extract");
  const archive = path.join(ledgerDir, "metrics.tar");

  try {
    await rm(ledgerDir, { recursive: true, force: true });

    const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (res.status === 404) {
      log("no metrics branch yet; the ledger is unavailable");
      return "missing";
    }
    if (!res.ok) throw new Error(`download failed with HTTP ${res.status}`);

    // Unzip here rather than in tar, so a gzip bomb stops at the cap before touching disk.
    const tar = gunzipSync(await readCapped(res, maxBytes), { maxOutputLength: maxBytes });

    await mkdir(extractDir, { recursive: true });
    await writeFile(archive, tar);

    const { stdout } = await run("tar", ["-tf", archive], { maxBuffer: 64 * 1024 * 1024 });
    const top = checkEntries(stdout.split("\n"), extractDir, maxFiles);

    await run("tar", ["-xf", archive, "-C", extractDir, "--no-same-owner"]);
    await checkTree(extractDir, { maxFiles, maxBytes });

    // Keep only the `ledger/` folder; a branch with no records yet is an empty ledger.
    const records = path.join(extractDir, top, "ledger");
    const target = path.join(ledgerDir, "ledger");
    const hasRecords = await lstat(records).then((s) => s.isDirectory(), () => false);
    if (hasRecords) await rename(records, target);
    else await mkdir(target, { recursive: true });

    await rm(extractDir, { recursive: true, force: true });
    await rm(archive, { force: true });
    return "fetched";
  } catch (error) {
    await rm(ledgerDir, { recursive: true, force: true }).catch(() => {});
    log(`could not load the ledger, so it is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return "failed";
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await fetchLedger();
  process.exitCode = 0;
}
