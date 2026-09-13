/**
 * End-to-end heart asset build.  `npm run build` here, or `npm run build:heart` from /frontend.
 *
 *   1. clone Z-Anatomy-Sample into .cache/zas (skipped if present)
 *   2. fbx2gltf  CardioVascular41.fbx -> .cache/raw.glb        (x86_64 binary; Rosetta on Apple Silicon)
 *   3. process.mjs: cull / orient / manifest -> .cache/heart-culled.glb
 *   4. optional simplify (SIMPLIFY_RATIO env, default off: the sample is already ~64k tris)
 *   5. weld + draco -> ../../frontend/public/models/heart.glb (+ manifest)
 *   6. copy three's Draco decoder -> ../../frontend/public/draco/
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import convert from "fbx2gltf";

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = path.join(here, ".cache");
const frontend = path.resolve(here, "../../frontend");
const outDir = path.join(frontend, "public", "models");
const dracoOut = path.join(frontend, "public", "draco");
const cli = path.join(here, "node_modules", ".bin", "gltf-transform");
const zas = path.join(cache, "zas");
const fbx = path.join(zas, "Assets", "Models", "1.0 Models", "CardioVascular41.fbx");
const raw = path.join(cache, "raw.glb"), culled = path.join(cache, "heart-culled.glb"), simplified = path.join(cache, "heart-simplified.glb"), welded = path.join(cache, "heart-welded.glb");
const manifest = path.join(cache, "heart-manifest.json");
const ratio = process.env.SIMPLIFY_RATIO ? parseFloat(process.env.SIMPLIFY_RATIO) : 0;
const MAX_MB = 6;

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit" }); if (r.status !== 0) throw new Error(`${path.basename(cmd)} ${args.join(" ")} failed`); };
const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(2);
const tris = (f) => { const csv = execFileSync(cli, ["inspect", f, "--format", "csv"]).toString(); let t = 0; for (const line of csv.split("\n")) { const c = line.split(","); if (c[2] === "TRIANGLES") t += +c[4] || 0; } return t; };

fs.mkdirSync(cache, { recursive: true }); fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(dracoOut, { recursive: true });

if (!fs.existsSync(fbx)) { console.log("[1/6] cloning Z-Anatomy-Sample"); sh("git", ["clone", "--depth", "1", "https://github.com/LluisV/Z-Anatomy-Sample.git", zas]); }
else console.log("[1/6] source present");

if (!fs.existsSync(raw)) { console.log("[2/6] fbx2gltf"); await convert(fbx, raw, ["--binary"]); } else console.log("[2/6] raw.glb cached");
console.log(`      raw.glb ${mb(raw)} MB`);

console.log("[3/6] cull / orient / manifest"); sh(process.execPath, [path.join(here, "process.mjs"), raw, culled, manifest]);
const t0 = tris(culled); console.log(`      culled: ${t0} triangles, ${mb(culled)} MB`);

let stage = culled;
if (ratio > 0) { console.log(`[4/6] simplify ratio ${ratio}`); sh(cli, ["simplify", culled, simplified, "--ratio", String(ratio), "--error", "0.001"]); stage = simplified; console.log(`      simplified: ${tris(stage)} triangles`); }
else console.log("[4/6] simplify skipped (set SIMPLIFY_RATIO=0.x to enable)");

console.log("[5/6] weld + draco"); sh(cli, ["weld", stage, welded]); const final = path.join(outDir, "heart.glb"); sh(cli, ["draco", welded, final]);
fs.copyFileSync(manifest, path.join(outDir, "heart-manifest.json"));
const size = +mb(final); console.log(`      heart.glb: ${tris(final)} triangles, ${size} MB (from ${t0} tris / ${mb(culled)} MB)`);
if (size > MAX_MB) { console.error(`heart.glb is ${size} MB > ${MAX_MB} MB: re-run with SIMPLIFY_RATIO (e.g. 0.5)`); process.exit(1); }

console.log("[6/6] draco decoder"); const src = path.join(frontend, "node_modules", "three", "examples", "jsm", "libs", "draco", "gltf");
for (const f of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) fs.copyFileSync(path.join(src, f), path.join(dracoOut, f));
console.log(`done -> ${path.relative(process.cwd(), final)}, ${path.relative(process.cwd(), path.join(outDir, "heart-manifest.json"))}, ${path.relative(process.cwd(), dracoOut)}/`);
