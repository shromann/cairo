import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Center } from "@react-three/drei";
import * as THREE from "three";
import { HeartMesh } from "./HeartMesh";
import { HeartMeshGLB } from "./HeartMeshGLB";

// Kill switch for the mesh migration: "glb" loads public/models/heart.glb, anything else keeps the procedural heart.
const USE_GLB = import.meta.env.PUBLIC_HEART_RENDERER === "glb";
import { AHA17Heatmap } from "./AHA17Heatmap";
import { ValveLeaflets } from "./ValveLeaflets";
import { UltrasoundSlicePlane, getClippingPlanesForMode } from "./UltrasoundSlicePlane";
import { SimpsonTracingsOverlay } from "./SimpsonTracingsOverlay";

/**
 * React Three Fiber 3D Canvas Viewport for the Cardiac Digital Twin
 * High-End Cinematic Medical Studio Viewport
 */
export function CardiacTwinCanvas({
  kinematics,
  strains = [],
  displayMode = "solid", // "solid" | "wireframe" | "xray" | "heatmap"
  viewMode = "none",     // "none" | "A4C" | "A2C" | "PLAX" | "PSAX"
  showHeatmap = false,
  showValves = true,
  showSimpsonTracings = false,
  showSlicePlane = true,
  highlightSegment = null,
  selectedNodeId = null,
  onSelectSegment = () => {},
  onSelectNode = () => {}
}) {
  // Compute hardware clipping planes for current ultrasound viewMode
  const clippingPlanes = useMemo(() => {
    return getClippingPlanesForMode(viewMode);
  }, [viewMode]);

  return (
    <div className="cardiac-canvas-container" style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          localClippingEnabled: true, // Crucial for Three.js clipping planes
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05
        }}
        shadows
      >
        <PerspectiveCamera makeDefault position={[0, 0.5, 6.0]} fov={45} />
        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minDistance={2.2}
          maxDistance={9.5}
          target={[0, -0.3, 0]}
        />

        {/* --- DIFFUSE MEDICAL STUDIO LIGHTING --- */}
        {/* Soft base ambient light for deep shadows */}
        <ambientLight intensity={0.8} />

        {/* 1. Primary Key Light (Upper Right, warm diffuse white) */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.3}
          castShadow
          shadow-bias={-0.0001}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* 2. Subsurface Scattering Transillumination Back-Light */}
        <directionalLight
          position={[0, 1.5, -5.0]}
          intensity={1.6}
          color="#ff4d5a"
        />

        {/* 3. Soft Rim Light */}
        <directionalLight
          position={[-5, 3, -3]}
          intensity={0.65}
          color="#9bdcff"
        />

        {/* 4. Soft Fill Light (Anterior inferior) */}
        <directionalLight
          position={[0, -4, 4]}
          intensity={0.45}
          color="#ffd6ba"
        />

        {/* 5. Central Internal Fill Point Light */}
        <pointLight position={[0, 0.5, 0]} intensity={0.4} color="#ff99aa" distance={4} />

        <Center top position={[0, 0, 0]}>
          {/* 1. Heart anatomy mesh with node click: procedural (default) or Z-Anatomy GLB (PUBLIC_HEART_RENDERER=glb) */}
          {USE_GLB ? (
            <Suspense fallback={null}>
              <HeartMeshGLB
                kinematics={kinematics}
                displayMode={displayMode}
                clippingPlanes={clippingPlanes}
                highlightSegment={highlightSegment}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
              />
            </Suspense>
          ) : (
            <HeartMesh
              kinematics={kinematics}
              displayMode={displayMode}
              clippingPlanes={clippingPlanes}
              highlightSegment={highlightSegment}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          )}

          {/* 2. AHA 17-Segment Regional Strain Heatmap Overlay */}
          <AHA17Heatmap
            strains={strains}
            visible={showHeatmap || displayMode === "heatmap"}
            clippingPlanes={clippingPlanes}
            highlightSegment={highlightSegment}
            onSelectSegment={onSelectSegment}
          />

          {/* 3. Synchronized Fibrous Mitral & Aortic Valves */}
          {showValves && (
            <ValveLeaflets
              kinematics={kinematics}
              clippingPlanes={clippingPlanes}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          )}

          {/* 4. Simpson's Method 20-Disc Tracings 3D Extrusion */}
          <SimpsonTracingsOverlay
            visible={showSimpsonTracings}
            f_contraction={kinematics ? kinematics.f_contraction : 0}
            clippingPlanes={clippingPlanes}
          />

          {/* 5. 2D Ultrasound Slicing Plane & Beam Cone */}
          <UltrasoundSlicePlane
            viewMode={viewMode}
            visible={showSlicePlane && viewMode !== "none"}
            opacity={0.18}
          />
        </Center>

        {/* Studio Ground Grid Floor */}
        <gridHelper
          args={[14, 28, "#27272a", "#121214"]}
          position={[0, -2.4, 0]}
        />
      </Canvas>
    </div>
  );
}
