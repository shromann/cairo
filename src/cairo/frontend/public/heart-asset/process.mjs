/**
 * Cull, orient, normalise the raw fbx2gltf output and emit heart-manifest.json.
 *
 *   node process.mjs <raw.glb> <out.glb> <manifest.json>
 *
 * Output frame (matches the procedural viewer): LV long axis = Y, apex at -Y, base at +Y;
 * RV centroid on +X of the LV; LV centroid at (0, LV_CENTRE_Y, 0); LV long-axis extent = LV_LENGTH.
 * All node transforms are baked into vertices, so the runtime needs no transform and the manifest's
 * centroids/axes are directly in viewer coordinates.
 */
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { prune, dedup, flatten, transformMesh } from "@gltf-transform/functions";
import { CHAMBER_MAP, EXPECTED_IDS, DROP_NOTES } from "./mapping.mjs";

const LV_LENGTH = 3.2;      // procedural LV: apex y=-1.8 .. base y=+1.4
const LV_CENTRE_Y = -0.2;
const STUB_RADIUS_FACTOR = 1.15;
const STUB_LENGTH = 0.9;    // viewer units (~3 cm at the LV scale) kept beyond where each vessel starts

const [,, inPath, outPath, manifestPath] = process.argv;
if (!inPath || !outPath || !manifestPath) { console.error("usage: node process.mjs raw.glb out.glb manifest.json"); process.exit(2); }

// ---------------------------------------------------------------- small vector helpers
const v3 = { sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], dot: (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]), scale: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; } };

/** Column-major 4x4 (glTF / three convention). */
function mat4FromRotScaleTrans(R /* 3x3 row-major */, s, t) {
  return [R[0][0]*s, R[1][0]*s, R[2][0]*s, 0,  R[0][1]*s, R[1][1]*s, R[2][1]*s, 0,  R[0][2]*s, R[1][2]*s, R[2][2]*s, 0,  t[0], t[1], t[2], 1];
}
function mat3Mul(A, B) { const C = [[0,0,0],[0,0,0],[0,0,0]]; for (let i=0;i<3;i++) for (let j=0;j<3;j++) for (let k=0;k<3;k++) C[i][j]+=A[i][k]*B[k][j]; return C; }
function mat3Apply(R, p) { return [R[0][0]*p[0]+R[0][1]*p[1]+R[0][2]*p[2], R[1][0]*p[0]+R[1][1]*p[1]+R[1][2]*p[2], R[2][0]*p[0]+R[2][1]*p[1]+R[2][2]*p[2]]; }
/** Rotation taking unit vector a onto unit vector b (Rodrigues). */
function rotationFromTo(a, b) {
  const v = v3.cross(a, b), c = v3.dot(a, b), s = v3.len(v);
  if (s < 1e-9) return c > 0 ? [[1,0,0],[0,1,0],[0,0,1]] : [[-1,0,0],[0,-1,0],[0,0,1]];
  const [x, y, z] = v3.scale(v, 1 / s), C = 1 - c;
  return [[c + x*x*C, x*y*C - z*s, x*z*C + y*s], [y*x*C + z*s, c + y*y*C, y*z*C - x*s], [z*x*C - y*s, z*y*C + x*s, c + z*z*C]];
}
/** Largest-eigenvalue eigenvector of a symmetric 3x3 (Jacobi). */
function principalAxis(cov) {
  const A = cov.map((r) => r.slice()); let V = [[1,0,0],[0,1,0],[0,0,1]];
  for (let iter = 0; iter < 50; iter++) {
    let p = 0, q = 1, max = 0;
    for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) if (Math.abs(A[i][j]) > max) { max = Math.abs(A[i][j]); p = i; q = j; }
    if (max < 1e-12) break;
    const th = 0.5 * Math.atan2(2*A[p][q], A[q][q]-A[p][p]), c = Math.cos(th), s = Math.sin(th);
    const J = [[1,0,0],[0,1,0],[0,0,1]]; J[p][p] = c; J[q][q] = c; J[p][q] = s; J[q][p] = -s;
    const JT = J[0].map((_, i) => J.map((r) => r[i]));
    const An = mat3Mul(mat3Mul(JT, A), J); for (let i=0;i<3;i++) for (let j=0;j<3;j++) A[i][j]=An[i][j];
    V = mat3Mul(V, J);
  }
  const k = [0,1,2].reduce((b, i) => (A[i][i] > A[b][b] ? i : b), 0);
  return { axis: v3.norm([V[0][k], V[1][k], V[2][k]]), eigen: [A[0][0], A[1][1], A[2][2]] };
}

// ---------------------------------------------------------------- name handling
export function normaliseName(name) {
  let n = name.trim();
  for (let guard = 0; guard < 4; guard++) {
    const m = n.match(/^(.*)\.(\d{3}|g|j|t|l|r)$/);
    if (!m) break;
    n = m[1];
  }
  return n.toLowerCase();
}

// ---------------------------------------------------------------- mesh helpers
function positionsOf(mesh) {
  const out = [];
  for (const prim of mesh.listPrimitives()) { const a = prim.getAttribute("POSITION"); if (a) out.push(a.getArray()); }
  return out;
}
function statsOf(arrays) {
  let n = 0, c = [0,0,0], min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (const a of arrays) for (let i = 0; i < a.length; i += 3) { n++; for (let k = 0; k < 3; k++) { c[k] += a[i+k]; min[k] = Math.min(min[k], a[i+k]); max[k] = Math.max(max[k], a[i+k]); } }
  c = v3.scale(c, 1 / Math.max(1, n));
  const cov = [[0,0,0],[0,0,0],[0,0,0]];
  for (const a of arrays) for (let i = 0; i < a.length; i += 3) { const d = [a[i]-c[0], a[i+1]-c[1], a[i+2]-c[2]]; for (let r=0;r<3;r++) for (let s=0;s<3;s++) cov[r][s] += d[r]*d[s]; }
  for (let r=0;r<3;r++) for (let s=0;s<3;s++) cov[r][s] /= Math.max(1, n);
  const { axis } = principalAxis(cov);
  let lo = Infinity, hi = -Infinity;
  for (const a of arrays) for (let i = 0; i < a.length; i += 3) { const t = v3.dot([a[i]-c[0], a[i+1]-c[1], a[i+2]-c[2]], axis); lo = Math.min(lo, t); hi = Math.max(hi, t); }
  return { n, centroid: c, axis, bbox: { min, max }, axisExtent: hi - lo };
}
function triangleCount(mesh) { let t = 0; for (const p of mesh.listPrimitives()) { const idx = p.getIndices(); t += idx ? idx.getCount() / 3 : (p.getAttribute("POSITION")?.getCount() || 0) / 3; } return t; }
/** Remove triangles whose three vertices all lie farther than radius from centre. Returns removed count. */
function clipToSphere(doc, mesh, centre, radius) {
  let removed = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION").getArray(); const idx = prim.getIndices(); if (!idx) continue;
    const src = idx.getArray(); const keep = [];
    for (let i = 0; i < src.length; i += 3) {
      let inside = false;
      for (let k = 0; k < 3 && !inside; k++) { const j = src[i+k]*3; inside = v3.len([pos[j]-centre[0], pos[j+1]-centre[1], pos[j+2]-centre[2]]) <= radius; }
      if (inside) keep.push(src[i], src[i+1], src[i+2]); else removed++;
    }
    if (keep.length !== src.length) {
      const acc = doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(keep)).setBuffer(idx.getBuffer());
      prim.setIndices(acc);
    }
  }
  return removed;
}

// ---------------------------------------------------------------- main
const io = new NodeIO();
const doc = await io.read(inPath);
const root = doc.getRoot();
const log = { kept: [], dropped: 0, unmappedCardiacLooking: [], missingExpected: [], stubs: {}, notes: [] };

// 1. flatten (bake hierarchy into per-node world transforms, reparent to scene root), then bake into vertices
await doc.transform(flatten());
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  transformMesh(mesh, node.getWorldMatrix());
  node.setMatrix([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

// 2. cull by whitelist; skip empties
const cardiacLooking = /heart|ventric|atri|valve|leaflet|papill|septum|aort|pulmonary|vena cava|coronary|cardiac vein|circumflex artery of heart|interventricular/i;
const surviving = []; // {node, name, base, id, stub}
for (const node of root.listNodes()) {
  const name = node.getName(); const mesh = node.getMesh();
  if (!mesh) { node.dispose(); continue; }                           // .g/.j/.t empties + any other transform-only node
  const base = normaliseName(name); const entry = CHAMBER_MAP[base];
  if (!entry) {
    if (cardiacLooking.test(base) && !DROP_NOTES[base]) log.unmappedCardiacLooking.push(name);
    node.dispose(); log.dropped++; continue;
  }
  surviving.push({ node, name, base, id: entry.id, stub: !!entry.stub });
}
await doc.transform(prune());

// 3. orientation from the LV: principal axis -> -Y (apex down), RV -> +X, LV centroid -> (0, LV_CENTRE_Y, 0)
const byId = {};
for (const s of surviving) (byId[s.id] ||= []).push(s);
const need = (id) => { if (!byId[id]) throw new Error(`cannot orient: no node mapped to '${id}'`); return byId[id].flatMap((s) => positionsOf(s.node.getMesh())); };
const lv0 = statsOf(need("lv")), la0 = statsOf(need("la")), rv0 = statsOf(need("rv"));
let apexDir = lv0.axis; if (v3.dot(apexDir, v3.sub(lv0.centroid, la0.centroid)) < 0) apexDir = v3.scale(apexDir, -1);  // base is at the LA
const R1 = rotationFromTo(apexDir, [0, -1, 0]);
const rvDir = mat3Apply(R1, v3.sub(rv0.centroid, lv0.centroid)); const ang = Math.atan2(rvDir[2], rvDir[0]);           // rotate about Y so RV sits on +X
const R2 = [[Math.cos(ang), 0, Math.sin(ang)], [0, 1, 0], [-Math.sin(ang), 0, Math.cos(ang)]];
const R = mat3Mul(R2, R1);
const scale = LV_LENGTH / lv0.axisExtent;
const t = v3.sub([0, LV_CENTRE_Y, 0], v3.scale(mat3Apply(R, lv0.centroid), scale));
const M = mat4FromRotScaleTrans(R, scale, t);
for (const s of surviving) transformMesh(s.node.getMesh(), M);
log.notes.push(`source units: metres; LV axis extent ${lv0.axisExtent.toFixed(4)} m -> ${LV_LENGTH} viewer units (scale ${scale.toFixed(2)})`);

// 4. stubs: keep each vessel from its closest point to the heart core out to STUB_LENGTH beyond that
//    (never less than the core sphere itself), so branches that begin outside the core still get a stub
const core = statsOf(["lv", "rv", "la", "ra"].flatMap((id) => byId[id].flatMap((s) => positionsOf(s.node.getMesh()))));
const coreR = Math.max(...[core.bbox.max, core.bbox.min].flatMap((b) => b.map((x, i) => Math.abs(x - core.centroid[i]))));
const stubR = coreR * STUB_RADIUS_FACTOR;
for (const s of surviving.filter((x) => x.stub)) {
  const mesh = s.node.getMesh(); const before = triangleCount(mesh);
  let dmin = Infinity;
  for (const a of positionsOf(mesh)) for (let i = 0; i < a.length; i += 3) dmin = Math.min(dmin, v3.len([a[i]-core.centroid[0], a[i+1]-core.centroid[1], a[i+2]-core.centroid[2]]));
  const r = Math.max(stubR, dmin + STUB_LENGTH);
  const removed = clipToSphere(doc, mesh, core.centroid, r);
  log.stubs[s.name] = { before, removed, after: before - removed, radius: +r.toFixed(2), startsAt: +dmin.toFixed(2) };
}
await doc.transform(dedup(), prune());

// 5. manifest
const chambers = {};
for (const [id, list] of Object.entries(byId)) {
  const st = statsOf(list.flatMap((s) => positionsOf(s.node.getMesh())));
  const far = v3.len(v3.sub(st.centroid, core.centroid));
  chambers[id] = { nodes: list.map((s) => s.name), triangles: list.reduce((a, s) => a + triangleCount(s.node.getMesh()), 0),
    centroid: st.centroid.map((x) => +x.toFixed(4)), axis: st.axis.map((x) => +x.toFixed(4)),
    bbox: { min: st.bbox.min.map((x) => +x.toFixed(4)), max: st.bbox.max.map((x) => +x.toFixed(4)) },
    distanceFromHeartCentre: +far.toFixed(3), ...(far > coreR * 2 ? { warning: "far from heart core; check placement in source model" } : {}) };
}
for (const id of EXPECTED_IDS) if (!byId[id]) log.missingExpected.push(id);
for (const s of surviving) s.node.setName(s.name); // keep original names on nodes
const lvFinal = statsOf(byId.lv.flatMap((s) => positionsOf(s.node.getMesh())));
const rvFinal = statsOf(byId.rv.flatMap((s) => positionsOf(s.node.getMesh())));
const manifest = {
  source: { model: "Z-Anatomy CardioVascular41 (Z-Anatomy-Sample)", url: "https://github.com/LluisV/Z-Anatomy-Sample", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", attribution: "Z-Anatomy" },
  frame: { up: "+Y", lvApex: "-Y", rvSide: "+X", lvLength: LV_LENGTH, lvCentre: [0, LV_CENTRE_Y, 0], unitsPerMetre: +scale.toFixed(3),
    lvAxis: lvFinal.axis.map((x) => +x.toFixed(4)), rvInsertionDir: v3.norm(v3.sub(rvFinal.centroid, lvFinal.centroid)).map((x) => +x.toFixed(4)),
    heartCentre: core.centroid.map((x) => +x.toFixed(4)), heartRadius: +coreR.toFixed(3),
    // anterior = from LV centroid towards the pulmonary trunk, projected onto the short-axis plane
    anteriorDir: byId.pulmonary_trunk ? (() => { const d = v3.sub(statsOf(byId.pulmonary_trunk.flatMap((s) => positionsOf(s.node.getMesh()))).centroid, lvFinal.centroid); return v3.norm([d[0], 0, d[2]]).map((x) => +x.toFixed(4)); })() : null },
  nodes: Object.fromEntries(surviving.map((s) => [s.name, s.id])),
  // same map keyed by the name three's GLTFLoader will assign (PropertyBinding.sanitizeNodeName)
  nodesByThreeName: Object.fromEntries(surviving.map((s) => [s.name.replace(/\s/g, "_").replace(/[\[\]\.:\/]/g, ""), s.id])),
  chambers,
  newIds: Object.values(chambers).length ? Object.keys(chambers).filter((id) => !EXPECTED_IDS.includes(id)) : [],
  missingExpectedIds: log.missingExpected,
  stubs: log.stubs,
  build: { generatedAt: new Date().toISOString(), totalTriangles: surviving.reduce((a, s) => a + triangleCount(s.node.getMesh()), 0), nodesKept: surviving.length, nodesDropped: log.dropped },
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
await io.write(outPath, doc);

console.log(`kept ${surviving.length} nodes / ${manifest.build.totalTriangles} triangles; dropped ${log.dropped} mesh nodes`);
console.log(log.notes.join("\n"));
console.log("expected IDs with no node:", log.missingExpected.join(", ") || "none");
console.log("new IDs not in CARDIAC_NODES:", manifest.newIds.join(", ") || "none");
if (log.unmappedCardiacLooking.length) console.log("dropped but cardiac-looking (check mapping):", log.unmappedCardiacLooking.join(" | "));
for (const [n, s] of Object.entries(log.stubs)) if (s.removed) console.log(`stub ${n}: ${s.before} -> ${s.after} tris`);
for (const [id, c] of Object.entries(chambers)) if (c.warning) console.log(`WARNING ${id}: ${c.distanceFromHeartCentre} units from heart centre`);
