/**
 * Heart GLB asset access. Built by `npm run build:heart` (tools/heart-asset) into public/models/.
 *
 *   import { HEART_GLB_URL, useHeartModel, fetchHeartManifest } from "../lib/heartAsset";
 *   const { scene, nodes, manifest } = useHeartModel();   // inside a <Canvas> / Suspense boundary
 *
 * Draco decoding uses three's bundled decoder copied to public/draco/ (no CDN).
 * Node names in `nodes` are the original Z-Anatomy names; manifest.nodes maps name -> chamber ID and
 * manifest.chambers[id] carries build-time centroid / principal axis / bbox in viewer coordinates.
 */
import { useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";

export const HEART_GLB_URL = "/models/heart.glb";
export const HEART_MANIFEST_URL = "/models/heart-manifest.json";
export const DRACO_DECODER_PATH = "/draco/";

let manifestPromise = null;
export function fetchHeartManifest() {
  if (!manifestPromise) manifestPromise = fetch(HEART_MANIFEST_URL).then((r) => { if (!r.ok) throw new Error(`manifest ${r.status}`); return r.json(); });
  return manifestPromise;
}

export function useHeartManifest() {
  const [manifest, setManifest] = useState(null);
  useEffect(() => { fetchHeartManifest().then(setManifest).catch((e) => console.error("heart manifest", e)); }, []);
  return manifest;
}

/** Loads (and caches, via drei) the GLB with Draco. Suspends until ready. */
export function useHeartModel() {
  const gltf = useGLTF(HEART_GLB_URL, DRACO_DECODER_PATH);
  const manifest = useHeartManifest();
  return { ...gltf, manifest };
}

/**
 * three's GLTFLoader sanitises node names ("Left ventricle" -> "Left_ventricle") and keeps the original in
 * userData.name. Resolve a loaded Object3D to its chamber ID using either.
 */
export function chamberIdOf(object3d, manifest) {
  if (!manifest || !object3d) return null;
  const raw = object3d.userData?.name;
  return (raw && manifest.nodes[raw]) || manifest.nodesByThreeName?.[object3d.name] || manifest.nodes[object3d.name] || null;
}

/** All meshes of the loaded scene grouped by chamber ID: { lv: [Mesh, ...], ... , unmapped: [...] }. */
export function groupMeshesByChamber(scene, manifest) {
  const groups = {};
  scene.traverse((o) => { if (o.isMesh) (groups[chamberIdOf(o, manifest) || "unmapped"] ||= []).push(o); });
  return groups;
}

export function preloadHeartModel() { useGLTF.preload(HEART_GLB_URL, DRACO_DECODER_PATH); }
