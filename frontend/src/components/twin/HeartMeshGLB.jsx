import React, { useMemo } from "react";
import * as THREE from "three";
import { CARDIAC_NODES } from "../../data/cardiacNodes";
import { useHeartModel, groupMeshesByChamber } from "../../lib/heartAsset";

/**
 * Stage 1 of the mesh migration: the Z-Anatomy heart.glb rendered STATIC in place of the procedural
 * geometry, with click-to-inspect resolved through heart-manifest.json.
 *
 * - Selected by PUBLIC_HEART_RENDERER=glb (see CardiacTwinCanvas); HeartMesh.jsx is untouched.
 * - No deformation yet: `kinematics` is accepted for prop-compatibility and ignored.
 * - Chamber IDs, centroids and principal axes come from the manifest (build time), never recomputed here.
 * - Node names: three's GLTFLoader rewrites spaces to underscores; chamberIdOf() in heartAsset.js handles it.
 * - Same root transform as HeartMesh so the AHA / Simpson / valve overlays and the clipping planes line up.
 */

// Chamber IDs whose meshes exist in the model but have no catalogue entry of their own -> parent structure.
const ID_FALLBACK = { laa: "la", raa: "ra" };

// Material family per chamber ID; colours mirror HeartMesh.jsx (no procedural textures: UV layout of the
// source model is not the viewer's, so imported meshes are colour-only PBR).
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

export function HeartMeshGLB({
  kinematics, // unused in Stage 1 (static render)
  displayMode = "solid",
  clippingPlanes = [],
  highlightSegment = null, // unused in Stage 1; AHA patches still come from AHA17Heatmap
  selectedNodeId = null,
  onSelectNode = () => {},
}) {
  const { scene, manifest } = useHeartModel();
  const isWireframe = displayMode === "wireframe";
  const isXray = displayMode === "xray";

  // Group loaded meshes by chamber ID and attach the manifest's build-time geometry data.
  const chambers = useMemo(() => {
    if (!manifest) return [];
    const groups = groupMeshesByChamber(scene, manifest);
    return Object.entries(groups).map(([id, meshes]) => {
      const info = manifest.chambers[id] || null;
      for (const m of meshes) m.userData.chamberId = id;
      return { id, meshes, info, family: FAMILY[id] || "unmapped" };
    });
  }, [scene, manifest]);

  // One material per (family, selected) so highlighting a chamber only rebuilds its own material.
  const materials = useMemo(() => {
    const make = (fam, selected) => {
      const p = PALETTE[fam] || PALETTE.unmapped;
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(selected ? p.sel : p.color),
        emissive: new THREE.Color(selected ? p.selEmissive : p.emissive),
        emissiveIntensity: selected ? 0.55 : 0.22,
        roughness: p.roughness, metalness: 0.03, clearcoat: 0.12, clearcoatRoughness: 0.4,
        sheen: p.sheen || 0, sheenColor: new THREE.Color("#ff6b7e"), sheenRoughness: 0.5,
        opacity: isXray ? 0.4 : (p.opacity ?? 1.0), transparent: isXray || (p.opacity ?? 1) < 1,
        wireframe: isWireframe, side: THREE.DoubleSide, clippingPlanes,
      });
    };
    const out = {};
    for (const fam of Object.keys(PALETTE)) out[fam] = { base: make(fam, false), selected: make(fam, true) };
    return out;
  }, [isWireframe, isXray, clippingPlanes]);

  const resolveNode = (id) => CARDIAC_NODES[id] || CARDIAC_NODES[ID_FALLBACK[id]] || null;
  const handleOver = (e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; };
  const handleOut = () => { document.body.style.cursor = "auto"; };

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]} name="heart-glb-root">
      {chambers.map(({ id, meshes, info, family }) => {
        const node = resolveNode(id);
        const selected = node && selectedNodeId === node.id;
        const mat = materials[family][selected ? "selected" : "base"];
        return (
          <group
            key={id}
            name={`chamber:${id}`}
            userData={{ chamberId: id, centroid: info?.centroid, axis: info?.axis, bbox: info?.bbox }}
            onClick={(e) => { e.stopPropagation(); if (node) onSelectNode(node); }}
            onPointerOver={node ? handleOver : undefined}
            onPointerOut={node ? handleOut : undefined}
          >
            {meshes.map((m) => (
              <mesh key={m.uuid} geometry={m.geometry} material={mat} name={m.userData?.name || m.name} castShadow receiveShadow />
            ))}
          </group>
        );
      })}
    </group>
  );
}
