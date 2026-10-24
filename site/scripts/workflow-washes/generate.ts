// Paints the watercolor washes and paper grain behind the homepage "How work flows" figure
// (spec 006; decisions/0018, docs/design/006-homepage-workflow-diagram.md).
//
// Run it by hand from the repo root, once, when the washes need to change:
//
//   npm --prefix site run washes        (or: node site/scripts/workflow-washes/generate.ts)
//
// Its output, site/public/workflow/*.webp, is committed. Nothing in build, check or CI runs it,
// and nothing runs in the visitor's browser. It needs no new dependency: Node 22 strips the types,
// and it paints in the Chromium that @playwright/test already installs (set PW_CHROMIUM_PATH to
// use a preinstalled Chromium, as playwright.config.ts allows). The seeds below make the output
// repeatable: a rerun on the same Chromium gives the same images.
//
// Technique: each wash is a seeded, noise-deformed polygon painted as many low-opacity layers, each
// deformed again (the layered-polygon watercolor technique). Some layers also get a faint stroke,
// so pigment pools at the edge, and an feTurbulence grain lifts pigment out like rough paper. The
// tints are theme tokens (ADR 0017) mixed toward white; they live only inside these images.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/** Each tint is a theme token mixed toward white by `toWhite` (0 is the token, 1 is white). */
const TINTS = {
  cool: { token: "accent", hex: "#0969DA", toWhite: 0.35 },
  green: { token: "success", hex: "#1A7F37", toWhite: 0.35 },
  warm: { token: "highlight", hex: "#BC4C00", toWhite: 0.35 },
} as const;

type TintName = keyof typeof TINTS;

/** The paper grain is the `fg` token at a low, noisy alpha. */
const GRAIN = { token: "fg", hex: "#1F2328", seed: 7, size: 160 } as const;

/** One wash per step, plus one shared by the loop cards. */
const WASHES: { name: string; tint: TintName; seed: number; width: number; height: number }[] = [
  { name: "wash-spec", tint: "warm", seed: 11, width: 320, height: 240 },
  { name: "wash-plan", tint: "cool", seed: 23, width: 320, height: 240 },
  { name: "wash-build", tint: "cool", seed: 37, width: 320, height: 240 },
  { name: "wash-ci", tint: "green", seed: 41, width: 320, height: 240 },
  { name: "wash-review", tint: "cool", seed: 53, width: 320, height: 240 },
  { name: "wash-merge", tint: "warm", seed: 67, width: 320, height: 240 },
  { name: "wash-loop", tint: "cool", seed: 79, width: 440, height: 220 },
];

/** WebP quality passed to canvas.toDataURL: washes are soft, so they compress well. */
const WASH_QUALITY = 0.5;
const GRAIN_QUALITY = 0.4;

/** Opacity of each painted layer, of the pooled-edge strokes, and of the grain lift. */
const LAYER_ALPHA = 0.014;
const EDGE_ALPHA = 0.05;
const LIFT_ALPHA = 0.3;

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "workflow");

/** A token mixed toward white, as #RRGGBB. Exported values are listed in ADR 0018. */
export function mixToWhite(hex: string, toWhite: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mixed = channels.map((c) => Math.round(c + (255 - c) * toWhite));
  return "#" + mixed.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

type PaintJob = {
  washes: { name: string; rgb: string; seed: number; width: number; height: number }[];
  grain: { rgb: string; seed: number; size: number };
  washQuality: number;
  grainQuality: number;
  layerAlpha: number;
  edgeAlpha: number;
  liftAlpha: number;
};

/** Runs inside the headless page. Returns a WebP data URL per file name. */
async function paintInPage(job: PaintJob): Promise<Record<string, string>> {
  type Pt = { x: number; y: number; v: number };

  const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const gauss = (rand: () => number) => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };

  /** Splits every edge at a jittered midpoint, `depth` times. Each point keeps its own variance. */
  const deform = (pts: Pt[], depth: number, rand: () => number): Pt[] => {
    let out = pts;
    for (let d = 0; d < depth; d++) {
      const next: Pt[] = [];
      for (let i = 0; i < out.length; i++) {
        const a = out[i];
        const b = out[(i + 1) % out.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const v = (a.v + b.v) / 2;
        next.push(a, {
          x: (a.x + b.x) / 2 + gauss(rand) * len * v * 0.5,
          y: (a.y + b.y) / 2 + gauss(rand) * len * v * 0.5,
          v: Math.min(0.6, Math.max(0.05, v * (0.8 + rand() * 0.5))),
        });
      }
      out = next;
    }
    return out;
  };

  /** A rounded-rectangle-like base shape (a superellipse) that fills most of the canvas. */
  const baseShape = (w: number, h: number, rand: () => number): Pt[] => {
    const pts: Pt[] = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const k = 0.5;
      pts.push({
        x: w / 2 + Math.sign(c) * Math.pow(Math.abs(c), k) * w * 0.45,
        y: h / 2 + Math.sign(s) * Math.pow(Math.abs(s), k) * h * 0.44,
        v: 0.08 + rand() * 0.18,
      });
    }
    return pts;
  };

  const trace = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  };

  /** An feTurbulence noise image, with a colour matrix applied, drawn to a canvas size. */
  const turbulence = async (w: number, h: number, seed: number, freq: number, matrix: string) => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<filter id="f" x="0" y="0" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="${matrix}"/></filter>` +
      `<rect width="100%" height="100%" filter="url(#f)"/></svg>`;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    return img;
  };

  const out: Record<string, string> = {};

  for (const wash of job.washes) {
    const rand = mulberry32(wash.seed);
    const canvas = document.createElement("canvas");
    canvas.width = wash.width;
    canvas.height = wash.height;
    const ctx = canvas.getContext("2d")!;
    const base = deform(baseShape(wash.width, wash.height, rand), 3, rand);

    // Three groups of thin layers, each from a slightly different variant of the base.
    for (let g = 0; g < 3; g++) {
      const variant = deform(base, 1, rand);
      for (let layer = 0; layer < 18; layer++) {
        const pts = deform(variant, 3, rand);
        ctx.globalAlpha = job.layerAlpha;
        ctx.fillStyle = wash.rgb;
        trace(ctx, pts);
        ctx.fill();
        if (layer % 3 === 0) {
          // Pigment pools at the edge of a drying wash.
          ctx.globalAlpha = job.edgeAlpha;
          ctx.strokeStyle = wash.rgb;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Lift some pigment out in a grain pattern, as rough paper does.
    ctx.globalAlpha = job.liftAlpha;
    ctx.globalCompositeOperation = "destination-out";
    const lift = await turbulence(
      wash.width,
      wash.height,
      wash.seed,
      0.035,
      "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.8 0 0 0 -0.75",
    );
    ctx.drawImage(lift, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    out[wash.name] = canvas.toDataURL("image/webp", job.washQuality);
  }

  // The paper grain tile: the grain colour at a low, noisy alpha, seamless when repeated.
  const { size, seed, rgb } = job.grain;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(rgb.slice(i, i + 2), 16) / 255);
  const paper = document.createElement("canvas");
  paper.width = size;
  paper.height = size;
  const noise = await turbulence(size, size, seed, 0.75, `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0.3 0 0 0 -0.1`);
  paper.getContext("2d")!.drawImage(noise, 0, 0);
  out.paper = paper.toDataURL("image/webp", job.grainQuality);

  return out;
}

async function main(): Promise<void> {
  const job: PaintJob = {
    washes: WASHES.map((w) => ({
      name: w.name,
      rgb: mixToWhite(TINTS[w.tint].hex, TINTS[w.tint].toWhite),
      seed: w.seed,
      width: w.width,
      height: w.height,
    })),
    grain: { rgb: GRAIN.hex, seed: GRAIN.seed, size: GRAIN.size },
    washQuality: WASH_QUALITY,
    grainQuality: GRAIN_QUALITY,
    layerAlpha: LAYER_ALPHA,
    edgeAlpha: EDGE_ALPHA,
    liftAlpha: LIFT_ALPHA,
  };

  const executablePath = process.env.PW_CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><title>washes</title>");
    const images = await page.evaluate(paintInPage, job);

    await mkdir(OUT_DIR, { recursive: true });
    let total = 0;
    for (const [name, dataUrl] of Object.entries(images)) {
      if (!dataUrl.startsWith("data:image/webp;base64,")) throw new Error(`${name}: Chromium did not encode WebP`);
      const bytes = Buffer.from(dataUrl.slice("data:image/webp;base64,".length), "base64");
      await writeFile(path.join(OUT_DIR, `${name}.webp`), bytes);
      total += bytes.length;
      console.log(`${name}.webp ${bytes.length} bytes`);
    }
    for (const [name, t] of Object.entries(TINTS)) {
      console.log(`tint ${name}: ${mixToWhite(t.hex, t.toWhite)} from ${t.token} ${t.hex}, ${t.toWhite} toward white`);
    }
    console.log(`total ${total} bytes (limit 204800)`);
  } finally {
    await browser.close();
  }
}

await main();
