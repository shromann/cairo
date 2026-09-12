# CAIRO viewer: procedural → Z-Anatomy GLB migration plan

Status: **plan only, no code changed.** Blocked on asset prep (see §0).

## 0. Asset prep status

- `CardioVascular41.fbx` (65 MB, FBX 7.4 binary) cloned to the scratchpad. **Blender is not installed on this machine**, so
  steps 1–5 of the prep have not run and there is no `heart.glb` / `nodes.txt` yet.
- Node names were extracted directly from the FBX binary (760 Model records) so the mapping below is real, not guessed.
- Options: (a) `brew install --cask blender` and run the prep headlessly with a script
  (`blender -b --python tools/prep_heart.py`: import FBX → keep whitelist → decimate to ~150k tris → apply transforms →
  origin at heart centroid → orient → export GLB with names); (b) you do the prep in the Blender UI as written.
  Either way, `npx @gltf-transform/cli inspect heart.glb` afterwards is the ground truth for Stage 1.

### Orientation decision (needs a yes)
The prep says "+Y is the LV long axis pointing base→apex". **The existing viewer has the apex at −Y** (AHA bands: apex
y=−1.8, base y=+1.4; Simpson maps image-y to +Y with apex lower; ultrasound transducer sits at y=−3.2 and beams +Y).
Recommendation: export with **apex at −Y, base at +Y** so nothing downstream flips. If the GLB arrives the other way, the
loader applies a single 180° rotation about X — cheap, but one more thing to remember.

## 1. What the FBX contains (heart-relevant, `.g/.j/.t` empties excluded)

Chambers are **single meshes each** — per-chamber clicking is feasible. No interventricular septum mesh (folded into
LV/RV), no appendages as separate meshes, no chordae. Suffixes seen: `.g` = group empty, `.j` = junction marker,
`.t` = text-label anchor (all three are empties → skip), `.l`/`.r` = sides (only on non-heart vessels).

| existing chamber ID | FBX node(s) | note |
|---|---|---|
| lv | Left ventricle, Inferior papillary muscle of left ventricle (→ papillary_muscles) | |
| rv | Right ventricle | |
| la | Left atrium | LAA not separate |
| ra | Right atrium | RAA not separate |
| laa, raa | — | **expected ID, no node**: resolve clicks to la/ra, log |
| pulmonary_veins | Left/Right Superior/Inferior pulmonary vein (4) | |
| svc | Superior vena cava | |
| ivc | Inferior vena cava (thoracic part) | abdominal part deleted in prep |
| aorta | Ascending aorta, Aortic arch | thoracic/abdominal deleted in prep |
| aorta_sinus | Root of aorta (if it is a mesh; else Left/Right/Non-coronary leaflet region) | verify in nodes.txt |
| brachiocephalic | Brachiocephalic trunk | |
| carotid | Left common carotid artery | |
| subclavian | Left subclavian artery | |
| pulmonary_trunk | Pulmonary trunk, Bifurcation of pulmonary trunk | |
| lpa / rpa | Left / Right pulmonary artery | |
| lad | Anterior interventricular artery, Septal branches of anterior interventricular artery | |
| lad_d1, lad_d2 | — | no diagonals in model: **log missing** |
| lcx | Circumflex artery of heart | |
| rca | Right coronary artery | |
| rca_marginal | Right inferolateral branch of right coronary artery | closest match; "Marginal artery" is colic — do not map |
| gcv | Great cardiac vein, Coronary sinus, Middle cardiac vein | |
| mitral_valve | Posterior leaflet of left atrioventricular valve (+ Anterior leaflet if present in export) | anterior leaflet **not found** in FBX scan |
| aortic_valve | Left coronary leaflet, Right coronary leaflet, Non-coronary leaflet | |
| papillary_muscles | Inferior papillary muscle of left ventricle, Anterior/Inferior/Septal papillary muscle of right ventricle | LV anterior papillary **not found** |
| *(new)* tricuspid_valve | Inferior/Septal leaflet of right atrioventricular valve | additive entry in `cardiacNodes.js` |
| *(new)* pulmonary_valve | Anterior/Left/Right semilunar leaflet of pulmonary valve | additive entry |

Matching rule: normalise `name.replace(/\.(\d{3}|g|j|t|l|r)$/,'')` repeatedly, lower-case, then exact-match the
table; unmatched meshes → `chamberId:'unmapped'`, rendered in neutral material, and logged once at load together with
every expected ID that has no node.

## 2. Frame facts every stage must respect (from the current code)

- `HeartMesh` root: `position [0,−0.2,0] rotation [0.15,−0.25,0.08]`. `SimpsonTracingsOverlay`, `AHA17Heatmap`,
  `ValveLeaflets` **copy that transform verbatim**; `UltrasoundSlicePlane` and `getClippingPlanesForMode` are **world
  space** and cut the already-rotated heart.
- LV long axis = local +Y, apex ≈ y −1.8, base ≈ +1.4, mitral group at (−0.3,1.25,−0.2), aortic at (−0.05,1.55,0.1).
- Camera at (0,0.7,5.2) fov 45, orbit target (0,0.2,0); transducer at (0,−3.2,0), depth 5.6, half-angle 42°.
- Volume readout is **not** derived from geometry: `kinematics.currentVolume = EDV − (EDV−ESV)·f(t)`. Consistency with
  EDV/ESV is therefore preserved by construction; Stage 2 must drive geometry *from* that curve.
- Current LV motion: x,z scale `(V/EDV)^0.45` (endo) ×wall-thickening (epi); y scale `1 − |GLS|/100·f`; torsion
  `rotation.y = 12°·(EF/60)·f`.

## 3. Stages

### Stage 1 — Loader + registry (do now; stop and show)
- Feature flag `PUBLIC_HEART_RENDERER=procedural|glb` (Astro env). `procedural` keeps `HeartMesh.jsx` untouched;
  `glb` mounts new `HeartMeshGLB.jsx`. `CardiacTwinCanvas` chooses; nothing else changes.
- `twin/glbRegistry.js`: `loadHeartRegistry(url)` → `useGLTF` (drei, already a dependency), one load, cached by drei;
  traverse once; build `{ [chamberId]: { nodes: Mesh[], centroid, axis (PCA on vertex cloud), bbox, basePositions:
  Float32Array } }`. PCA via 3×3 covariance + Jacobi (no new dependency). Unmapped/missing lists logged.
- Normalise scale at load: uniform factor so the LV bbox extent along its principal axis equals the procedural LV's
  (3.2 units) and its centroid sits at the procedural LV centroid. That keeps camera, sector, Simpson pixel mapping,
  clipping constants and orbit limits valid without touching them.
- Render static under the same root transform as `HeartMesh`, reusing its material factories per chamber family
  (epicardium for lv/rv, atria, aorta, pulmonary, venous, coronary). Textures need UVs; Z-Anatomy meshes may not
  carry them → those materials are created without maps (PBR colour only) when `geometry.attributes.uv` is absent.
- Click-to-inspect: `onClick` on each chamber `<group>`, `e.stopPropagation()`, resolves `userData.chamberId` →
  `CARDIAC_NODES[id]`; laa/raa fall back to la/ra. Same `onSelectNode` callback, same highlight (emissive) rule.
- Overlays (AHA patches, valves, Simpson, sector) keep rendering exactly as today in Stage 1.
- Footer attribution line: "Heart model: Z-Anatomy — CardioVascular (Cardiovascular system), CC BY-SA 4.0,
  https://www.z-anatomy.com". (Verify the exact model title from the repo README/licence file before shipping.)

### Stage 2 — GPU deformation
- `material.onBeforeCompile` on each chamber material: inject uniforms `uCentroid (vec3)`, `uFrame (mat3, columns =
  principal axes)`, `uScale (vec3: radial1, longitudinal, radial2)`, `uTorsion (float)`, `uApicobasalRange (vec2)`.
  Vertex shader, before `#include <project_vertex>`: `p = transpose(uFrame)*(position−uCentroid); p *= uScale;
  twist about long axis by uTorsion·(apicobasal coord); transformed = uFrame*p + uCentroid`. Also transform
  `objectNormal` with the inverse-transpose (diag(1/uScale) in the frame) so lighting stays right. Because this runs
  before `project_vertex`, three's clipping, shadows and fog chunks see the deformed vertex for free.
- Buffers never change; uniforms update in `useFrame` (a handful of floats per chamber).
- LV factors from the existing curve: `sL = longitudinalShortening`, `sR = sqrt((V/EDV)/sL)` ⇒ cavity volume scales
  exactly as V(t) under this model, so the readout and the mesh agree by construction. With EF 58 / GLS 18 this gives
  radial ≈ 32 % vs longitudinal 18 % (≈1.8×); the requested ≈2.5× ratio is met by exposing `radialLongRatio` in the
  factor computation and clamping sL so volume still matches. Epicardium: `sR·wallThickeningFactor` as now.
- RV: `sR = 1 − 0.28·f`, `sL = 0.95·longitudinalShortening` (as now). Atria: `1 + 0.16·(1−f)` (antiphase, as now),
  LA/RA torsion 0. Great vessels: aorta pulse `1+0.08·aorticOpen` radial only.
- Caveat: raycasting uses undeformed buffers → click targets lag the deformed surface by ≤ ~30 % of LV radius at ES.
  Acceptable for chamber-sized targets; noted, not fixed.

### Stage 3 — AHA 17 on real geometry
- At load, for LV vertices: `u = apicobasal ∈ [0,1]` along the LV principal axis (0 apex, 1 base = mitral annulus
  plane, taken as the 98th percentile along +axis); `θ` about the axis with 0° at the **anterior RV insertion**,
  defined as the LV surface point nearest the RV centroid projected to the mid-ventricular plane; then the standard
  bins (basal u>0.66: 6×60°, mid 0.33–0.66: 6×60°, apical 0.10–0.33: 4×90° offset −45°, apex u<0.10). Stored as a
  float vertex attribute `aSegment`.
- Strain Heatmap mode: fragment colouring by `aSegment` from a `uniform float uStrain[17]` via the same
  `onBeforeCompile`; palette identical to `getStrainColor`. Feed all 17 with GLS now; `strains[]` prop already
  carries per-segment values so nothing changes when real ones arrive. Segment click: raycast hit → face → read
  `aSegment` → build the same `{id,name,strain,wallMotion}` payload `onSelectSegment` expects. In GLB mode the
  spheroid-patch `AHA17Heatmap` is hidden; in procedural mode it is untouched.

### Stage 4 — Cutting planes from the LV frame
- Keep `getClippingPlanesForMode(viewMode, frame?)` signature; when `frame` (centroid, axis, rvInsertionDir,
  aorticRootDir) is supplied, planes are: A4C = plane containing the long axis and the RV-insertion direction;
  A2C = long axis × A4C normal; PLAX = plane containing the long axis and the aortic-root direction; PSAX = normal =
  long axis, through the mid-ventricular point. Transform by the root group's `matrixWorld` (planes stay world space,
  as three requires). Because Stage 2 deforms about the centroid along the same axes, the planes remain valid during
  the cycle without per-frame recomputation.
- Sector group is placed from the same plane (position = point on plane, rotation from plane normal), replacing the
  four hardcoded pos/rot pairs. Open shells accepted; no stencil capping.

### Stage 5 — Simpson discs from geometry
- Need the LV **endocardial** surface. If the Z-Anatomy LV is a shell with inner and outer surfaces, each cutting
  plane yields two loops; take the inner (smaller-area) loop. Slice at 20 levels between apex and the annulus plane,
  intersect triangles → segments → chain into loops → shoelace area. `V = Σ Aᵢ·h`. Log `|V − currentVolume| / V`
  when > 5 %. Rings rendered from the actual loop polylines (replacing `heartData.simpsonTracings`), deformed by the
  same scale factors as the LV so they move with it.
- Fallback if the LV mesh has no inner surface: keep the current pixel-tracing overlay and say so.
- Optional calibration: choose the load-time scale so the *mesh* cavity volume at rest equals EDV; then Stage 5's
  check becomes meaningful in mL, not just relative.

## 4. Risks / fallbacks
- FBX sample may lack the anterior mitral leaflet and LV anterior papillary; the export will tell. Valve overlay
  (`ValveLeaflets`) stays as the animated valve representation regardless; GLB leaflets are static click targets.
- No UVs → no procedural textures on imported meshes (colour-only PBR). Wireframe/X-ray/heatmap modes unaffected.
- If chambers turn out merged after decimation (Blender "join"), Stage 1 stops and we keep procedural.
- Kill switch: the env flag; procedural path is byte-for-byte untouched.
