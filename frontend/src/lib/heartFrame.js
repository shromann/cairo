/**
 * Shared heart frame: the root transform every heart-space component uses (HeartMesh, HeartMeshGLB,
 * the AHA / Simpson / valve overlays) and helpers to move manifest (heart-local) vectors into scene space.
 *
 * Heart-local convention (see public/models/heart-manifest.json `frame`):
 *   LV long axis = Y, apex at -Y, base at +Y; RV on +X; anterior = manifest.frame.anteriorDir.
 */
import * as THREE from "three";

export const HEART_ROOT_POSITION = [0, -0.2, 0];
export const HEART_ROOT_ROTATION = [0.15, -0.25, 0.08];

const _m = new THREE.Matrix4();
export function heartRootMatrix() {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...HEART_ROOT_ROTATION));
  return _m.clone().compose(new THREE.Vector3(...HEART_ROOT_POSITION), q, new THREE.Vector3(1, 1, 1));
}

/** Heart-local point -> scene space (the space the heart root group lives in). */
export function localPointToScene(p) { return new THREE.Vector3(...p).applyMatrix4(heartRootMatrix()); }
/** Heart-local direction -> scene space (rotation only). */
export function localDirToScene(d) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...HEART_ROOT_ROTATION));
  return new THREE.Vector3(...d).applyQuaternion(q).normalize();
}

/** Fallback frame if the manifest is unavailable (matches the procedural LV). */
export const DEFAULT_FRAME = {
  lvCentre: [0, -0.2, 0], lvAxis: [0, -1, 0], lvLength: 3.2,
  rvInsertionDir: [1, 0, 0], anteriorDir: [0, 0, -1], heartRadius: 2.3,
};
