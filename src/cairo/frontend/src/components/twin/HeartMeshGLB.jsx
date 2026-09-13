import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CARDIAC_NODES } from "../../data/cardiacNodes";
import { useHeartModel, groupMeshesByChamber } from "../../lib/heartAsset";
import { HEART_ROOT_POSITION, HEART_ROOT_ROTATION } from "../../lib/heartFrame";

/**
 * Z-Anatomy heart.glb renderer (PUBLIC_HEART_RENDERER=glb). HeartMesh.jsx (procedural) is untouched.
 *
 * Stage 1: static render + click-to-inspect via heart-manifest.json.
 * Stage 2: phase deformation in the vertex shader (material.onBeforeCompile). Geometry buffers are never
 *          written; each chamber gets an anisotropic scale about its own build-time centroid in its own
 *          principal-axis frame, driven by uniforms updated in useFrame from `kinematics`.
 *
 *   LV      sL = longitudinalShortening (from GLS), sR = sqrt(volumeRatio / sL)  -> cavity volume tracks
 *           kinematics.currentVolume exactly under the scale model; apex-to-base torsion as before.
 *   RV      follows the LV with 0.8x the deformation.
 *   Atria   antiphase: fill through ejection, empty through the E-wave, A-wave kick near end-diastole.
 *   Valves, papillary muscles, coronaries: inherit the parent chamber's transform (they sit in/on it).
 *   Great-vessel stubs: static.
 *   Raycasting stays on the undeformed geometry (accepted).
 */

const ID_FALLBACK = { laa: "la", raa: "ra" };

const FAMILY = {
  lv: "epicardium", rv: "epicardium", papillary_muscles: "papillary",
  la: "atrium", ra: "atrium", pulmonary_veins: "venous", svc: "venous", ivc: "venous",
  aorta: "aorta", aorta_sinus: "aorta", brachiocephalic: "aorta", carotid: "aorta", subclavian: "aorta",
  pulmonary_trunk: "pulmonary", lpa: "pulmonary", rpa: "pulmonary",
  lad: "coronaryArtery", lcx: "coronaryArtery", rca: "coronaryArtery", rca_marginal: "coronaryArtery", left_main: "coronaryArtery",
  gcv: "coronaryVein",
  mitral_valve: "valve", tricuspid_valve: "valve", aortic_valve: "valve", pulmonary_valve: "valve",
};
const PALETTE = {
  epicardium:     { color: "#b81d2e", emissive: "#3d070f", sel: "#d90429", selEmissive: "#700010", roughness: 0.58, sheen: 0.4 },
  papillary:      { color: "#b81d2e", emissive: "#4a0710", sel: "#e63946", selEmissive: "#700615", roughness: 0.60 },
  atrium:         { color: "#7d1726", emissive: "#29060b", sel: "#a8323f", selEmissive: "#4d0812", roughness: 0.62, opacity: 0.96 },
  venous:         { color: "#3a506b", emissive: "#0b132b", sel: "#5b7ea3", selEmissive: "#0b132b", roughness: 0.54 },
  aorta:          { color: "#de3a3e", emissive: "#590f12", sel: "#ef233c", selEmissive: "#800010", roughness: 0.50 },
  pulmonary:      { color: "#2b749d", emissive: "#022642", sel: "#0077b6", selEmissive: "#003049", roughness: 0.52 },
  coronaryArtery: { color: "#ff2a45", emissive: "#700615", sel: "#ff5c70", selEmissive: "#900a1c", roughness: 0.45 },
  coronaryVein:   { color: "#2a6fb3", emissive: "#052238", sel: "#4a8fd3", selEmissive: "#0a3a5c", roughness: 0.48 },
  valve:          { color: "#e9d8c4", emissive: "#3a2a1c", sel: "#00f0ff", selEmissive: "#005c66", roughness: 0.55 },
  unmapped:       { color: "#6b7280", emissive: "#111827", sel: "#9ca3af", selEmissive: "#1f2937", roughness: 0.7 },
};
const VALVE_IDS = new Set(["mitral_valve", "tricuspid_valve", "aortic_valve", "pulmonary_valve"]);

// ---------------------------------------------------------------------------------------------
// Deformation parent: which chamber's transform a mesh follows. "static" = identity.
// ---------------------------------------------------------------------------------------------
const DEFORM_PARENT = {
  lv: "lv", rv: "rv", la: "la", ra: "ra",
  mitral_valve: "lv", tricuspid_valve: "rv",
  // semilunar valves sit at the ventriculo-arterial junction: keep them with the static vessel stubs
  aortic_valve: "static", pulmonary_valve: "static",
  lad: "lv", lcx: "lv", left_main: "lv", gcv: "lv", rca: "rv", rca_marginal: "rv",
};
function deformParentOf(chamberId, nodeName) {
  if (chamberId === "papillary_muscles") return /right ventricle/i.test(nodeName) ? "rv" : "lv";
  return DEFORM_PARENT[chamberId] || "static";
}

// ---------------------------------------------------------------------------------------------
// Shader injection: anisotropic scale + torsion about the chamber's principal axis, before project_vertex
// ---------------------------------------------------------------------------------------------
const DEFORM_UNIFORMS_GLSL = `
uniform vec3 uCentroid;   // chamber centroid (object space)
uniform mat3 uFrame;      // columns: principal axis e1 (long), e2, e3 (radial)
uniform vec3 uScale;      // scale along e1, e2, e3
uniform float uTwist;     // torsion (rad) at one half-length along e1, linear in the axial coordinate
uniform float uHalfLen;   // half extent along e1
uniform float uPivotX;    // frame-space e1 coordinate of the longitudinal scaling origin (apex end for
                          // ventricles, superior/venous end for atria); radial scaling is about the axis
vec3 cairoDeform(vec3 p) {
  vec3 q = transpose(uFrame) * (p - uCentroid);
  q.x = uPivotX + (q.x - uPivotX) * uScale.x;
  q.yz *= uScale.yz;
  float ang = uTwist * clamp(q.x / max(uHalfLen, 1e-4), -1.0, 1.0);
  float c = cos(ang), s = sin(ang);
  q = vec3(q.x, c * q.y - s * q.z, s * q.y + c * q.z);
  return uFrame * q + uCentroid;
}
vec3 cairoDeformNormal(vec3 n) {
  vec3 q = transpose(uFrame) * n;
  q /= max(uScale, vec3(1e-4));       // inverse-transpose of a diagonal scale
  return normalize(uFrame * q);
}
`;
function injectDeformation(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${DEFORM_UNIFORMS_GLSL}`)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n\tobjectNormal = cairoDeformNormal(objectNormal);")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\ttransformed = cairoDeform(transformed);");
  };
  material.customProgramCacheKey = () => "cairo-deform-v1";
  return material;
}
function makeUniforms() {
  return {
    uCentroid: { value: new THREE.Vector3() }, uFrame: { value: new THREE.Matrix3() },
    uScale: { value: new THREE.Vector3(1, 1, 1) }, uTwist: { value: 0 }, uHalfLen: { value: 1 },
    uPivotX: { value: 0 },
  };
}
/** Orthonormal frame from the manifest axis; e1 = axis, e2/e3 any perpendicular pair. */
function frameFromAxis(axisArr) {
  const e1 = new THREE.Vector3(...axisArr).normalize();
  const helper = Math.abs(e1.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e2 = new THREE.Vector3().crossVectors(e1, helper).normalize();
  const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
  return new THREE.Matrix3().set(e1.x, e2.x, e3.x, e1.y, e2.y, e3.y, e1.z, e2.z, e3.z); // columns e1 e2 e3
}
function halfLengthAlong(info, axisArr) {
  const e1 = new THREE.Vector3(...axisArr).normalize();
  const ext = new THREE.Vector3(info.bbox.max[0] - info.bbox.min[0], info.bbox.max[1] - info.bbox.min[1], info.bbox.max[2] - info.bbox.min[2]);
  return 0.5 * Math.abs(ext.x * e1.x) + 0.5 * Math.abs(ext.y * e1.y) + 0.5 * Math.abs(ext.z * e1.z);
}

// ---------------------------------------------------------------------------------------------
// Atrial volume curve (fraction of max reservoir fill), antiphase to the ventricle.
//   IVC 0-0.08 | ejection 0.08-0.38 (fills) | IVR 0.38-0.46 (full) | E-wave 0.46-0.75 (empties)
//   diastasis 0.75-0.88 (slow refill) | A-wave 0.88-1.0 (kick empties to minimum)
// ---------------------------------------------------------------------------------------------
function atrialFill(t) {
  const lerp = (a, b, x) => a + (b - a) * x;
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
  if (t < 0.08) return lerp(0.05, 0.10, t / 0.08);
  if (t < 0.38) return lerp(0.10, 1.00, ease((t - 0.08) / 0.30));
  if (t < 0.46) return 1.0;
  if (t < 0.75) return lerp(1.00, 0.35, ease((t - 0.46) / 0.29));
  if (t < 0.88) return lerp(0.35, 0.42, (t - 0.75) / 0.13);
  return lerp(0.42, 0.05, ease((t - 0.88) / 0.12));
}

export function HeartMeshGLB({
  kinematics,
  displayMode = "solid",
  clippingPlanes = [],
  highlightSegment = null, // AHA patches still come from AHA17Heatmap
  selectedNodeId = null,
  showValves = true,
  onSelectNode = () => {},
}) {
  const { scene, manifest } = useHeartModel();
  const isWireframe = displayMode === "wireframe";
  const isXray = displayMode === "xray";

  // Per-parent uniform objects (shared by every mesh that follows that chamber). "static" stays identity.
  const uniformsByParent = useMemo(() => {
    const out = { static: makeUniforms() };
    if (!manifest) return out;
    for (const id of ["lv", "rv", "la", "ra"]) {
      const info = manifest.chambers[id]; if (!info) continue;
      const u = makeUniforms();
      u.uCentroid.value.set(...info.centroid);
      u.uFrame.value.copy(frameFromAxis(info.axis));
      u.uHalfLen.value = halfLengthAlong(info, info.axis);
      // Longitudinal scaling origin, as a coordinate along e1 (= info.axis) from the centroid:
      //   ventricles: the apex end (the end of the axis pointing to -Y) -> apex fixed, base descends (MAPSE)
      //   atria:      the superior end (the end pointing to +Y, venous inflow) -> they expand down to the AV plane
      const axisDown = info.axis[1] < 0;               // does +e1 point toward -Y?
      const wantDownEnd = id === "lv" || id === "rv";
      u.uPivotX.value = (axisDown === wantDownEnd ? 1 : -1) * u.uHalfLen.value;
      out[id] = u;
    }
    return out;
  }, [manifest]);

  // Chambers: meshes grouped by click ID; per-mesh deformation parent; one material per chamber.
  const chambers = useMemo(() => {
    if (!manifest) return [];
    const groups = groupMeshesByChamber(scene, manifest);
    return Object.entries(groups).map(([id, meshes]) => {
      const info = manifest.chambers[id] || null;
      const family = FAMILY[id] || "unmapped";
      const items = meshes.map((m) => {
        const parent = deformParentOf(id, m.userData?.name || m.name);
        const uniforms = uniformsByParent[parent] || uniformsByParent.static;
        const p = PALETTE[family];
        const material = injectDeformation(new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(p.color), emissive: new THREE.Color(p.emissive), emissiveIntensity: 0.22,
          roughness: p.roughness, metalness: 0.03, clearcoat: 0.12, clearcoatRoughness: 0.4,
          sheen: p.sheen || 0, sheenColor: new THREE.Color("#ff6b7e"), sheenRoughness: 0.5,
          side: THREE.DoubleSide,
        }), uniforms);
        // shadow-map + point-light-shadow materials must deform identically
        const depth = injectDeformation(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms);
        const dist = injectDeformation(new THREE.MeshDistanceMaterial(), uniforms);
        m.userData.chamberId = id; m.userData.deformParent = parent;
        return { mesh: m, parent, material, depth, dist };
      });
      return { id, meshes: items, info, family };
    });
  }, [scene, manifest, uniformsByParent]);

  // Display mode / clipping / selection are applied to the existing materials (no re-creation).
  useEffect(() => {
    for (const ch of chambers) {
      const p = PALETTE[ch.family];
      const node = CARDIAC_NODES[ch.id] || CARDIAC_NODES[ID_FALLBACK[ch.id]];
      const selected = node && selectedNodeId === node.id;
      for (const it of ch.meshes) {
        const mat = it.material;
        mat.color.set(selected ? p.sel : p.color);
        mat.emissive.set(selected ? p.selEmissive : p.emissive);
        mat.emissiveIntensity = selected ? 0.55 : 0.22;
        mat.wireframe = isWireframe;
        mat.opacity = isXray ? 0.4 : (p.opacity ?? 1.0);
        mat.transparent = isXray || (p.opacity ?? 1) < 1;
        mat.clippingPlanes = clippingPlanes;
        it.depth.clippingPlanes = clippingPlanes;
        mat.needsUpdate = true;
      }
    }
  }, [chambers, selectedNodeId, isWireframe, isXray, clippingPlanes]);

  // ---- per-frame uniform update (no buffer writes) ----
  const kin = useRef(kinematics); kin.current = kinematics;
  useFrame(() => {
    const k = kin.current; if (!k) return;
    // volume ratio V(t)/EDV: kinematics exposes radialScale = (V/EDV)^0.45 -> invert it
    const volRatio = Math.pow(Math.max(0.05, k.radialScale), 1 / 0.45);
    const sL = Math.max(0.5, k.longitudinalShortening);
    const sR = Math.sqrt(volRatio / sL);
    const lv = uniformsByParent.lv;
    if (lv) { lv.uScale.value.set(sL, sR, sR); lv.uTwist.value = k.currentApexTorsionRad; }
    const rv = uniformsByParent.rv;
    if (rv) {
      const sLr = 1 - 0.8 * (1 - sL), vr = 1 - 0.8 * (1 - volRatio), sRr = Math.sqrt(vr / sLr);
      rv.uScale.value.set(sLr, sRr, sRr); rv.uTwist.value = 0.4 * k.currentApexTorsionRad;
    }
    const fill = atrialFill(k.phase);
    const sA = Math.cbrt(1 + 0.35 * fill);        // ~35 % reservoir volume swing -> ~10.5 % linear
    for (const id of ["la", "ra"]) { const u = uniformsByParent[id]; if (u) u.uScale.value.set(sA, sA, sA); }
  });

  const resolveNode = (id) => CARDIAC_NODES[id] || CARDIAC_NODES[ID_FALLBACK[id]] || null;
  const handleOver = (e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; };
  const handleOut = () => { document.body.style.cursor = "auto"; };

  return (
    <group position={HEART_ROOT_POSITION} rotation={HEART_ROOT_ROTATION} name="heart-glb-root">
      {chambers.map(({ id, meshes, info }) => {
        const node = resolveNode(id);
        if (VALVE_IDS.has(id) && !showValves) return null;
        return (
          <group
            key={id}
            name={`chamber:${id}`}
            userData={{ chamberId: id, centroid: info?.centroid, axis: info?.axis, bbox: info?.bbox }}
            onClick={(e) => { e.stopPropagation(); if (node) onSelectNode(node); }}
            onPointerOver={node ? handleOver : undefined}
            onPointerOut={node ? handleOut : undefined}
          >
            {meshes.map((it) => (
              <mesh key={it.mesh.uuid} geometry={it.mesh.geometry} material={it.material}
                customDepthMaterial={it.depth} customDistanceMaterial={it.dist}
                name={it.mesh.userData?.name || it.mesh.name} castShadow receiveShadow />
            ))}
          </group>
        );
      })}
    </group>
  );
}
