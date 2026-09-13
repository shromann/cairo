import React, { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useHeartModel, chamberIdOf } from "../../lib/heartAsset";

/** Dev-only viewer for the built heart.glb: verifies orientation, culling and per-node click identity. */
const COLORS = { lv: "#c0243a", rv: "#7a2a8f", la: "#d9576b", ra: "#9b59b6", aorta: "#e04b3c", pulmonary_trunk: "#3b6fd6", lpa: "#3b6fd6", rpa: "#3b6fd6",
  svc: "#2b5f9e", ivc: "#2b5f9e", pulmonary_veins: "#c2185b", mitral_valve: "#f5e6b3", tricuspid_valve: "#f5e6b3", aortic_valve: "#fff1c1", pulmonary_valve: "#fff1c1",
  papillary_muscles: "#8c1d2c", lad: "#ff6b6b", lcx: "#ff6b6b", rca: "#ff6b6b", rca_marginal: "#ff6b6b", left_main: "#ff6b6b", gcv: "#4a7bd0",
  brachiocephalic: "#e04b3c", carotid: "#e04b3c", subclavian: "#e04b3c" };

function Model({ onPick, wireframe }) {
  const { scene, manifest } = useHeartModel();
  const meshes = useMemo(() => { const out = []; scene.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }, [scene]);
  return (
    <group>
      {meshes.map((m) => {
        const id = chamberIdOf(m, manifest) || "unmapped";
        return (
          <mesh key={m.uuid} geometry={m.geometry} onClick={(e) => { e.stopPropagation(); onPick({ node: m.userData?.name || m.name, id, tris: m.geometry.index ? m.geometry.index.count / 3 : 0 }); }}>
            <meshStandardMaterial color={COLORS[id] || "#888"} roughness={0.55} metalness={0.05} wireframe={wireframe} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      <axesHelper args={[2.5]} />
      <gridHelper args={[10, 20, "#333", "#1a1a1a"]} position={[0, -2.4, 0]} />
    </group>
  );
}

export function HeartModelCheck() {
  const [pick, setPick] = useState(null);
  const [wire, setWire] = useState(false);
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0b0b0d", color: "#ddd", fontFamily: "system-ui", position: "relative" }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0.7, 7]} fov={45} />
        <OrbitControls target={[0.5, 0.3, 0]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -3]} intensity={0.6} color="#9bdcff" />
        <Suspense fallback={null}><Model onPick={setPick} wireframe={wire} /></Suspense>
      </Canvas>
      <div style={{ position: "absolute", top: 12, left: 12, fontSize: 13, lineHeight: 1.6 }}>
        <div><b>heart.glb check</b> — axes: X red (RV side), Y green (base up, apex down), Z blue</div>
        <div>{pick ? <>clicked: <b>{pick.node}</b> → id <b>{pick.id}</b> ({pick.tris} tris)</> : "click a structure"}</div>
        <label><input type="checkbox" checked={wire} onChange={(e) => setWire(e.target.checked)} /> wireframe</label>
      </div>
    </div>
  );
}
