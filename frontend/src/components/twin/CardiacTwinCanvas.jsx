import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Center } from "@react-three/drei";
import * as THREE from "three";
import { HeartMesh } from "./HeartMesh";
import { AHA17Heatmap } from "./AHA17Heatmap";
import { ValveLeaflets } from "./ValveLeaflets";
import { UltrasoundSlicePlane, getClippingPlanesForMode } from "./UltrasoundSlicePlane";
import { SimpsonTracingsOverlay } from "./SimpsonTracingsOverlay";

/**
 * React Three Fiber 3D Canvas Viewport for the Cardiac Digital Twin
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
  onSelectSegment = () => {}
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
          toneMappingExposure: 1.15
        }}
        shadows
      >
        <PerspectiveCamera makeDefault position={[0, 0.8, 5.4]} fov={45} />
        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minDistance={2.5}
          maxDistance={9.0}
          target={[0, 0.2, 0]}
        />

        {/* --- STUDIO MEDICAL LIGHTING --- */}
        <ambientLight intensity={0.8} />
        {/* Main Key Light */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* Cool Rim Backlight */}
        <directionalLight position={[-6, 4, -5]} intensity={1.2} color="#00f0ff" />
        {/* Warm Fill Light */}
        <directionalLight position={[0, -5, 3]} intensity={0.6} color="#ff4d6d" />
        <pointLight position={[0, 0, 0]} intensity={0.4} color="#ffffff" />

        <Center top position={[0, 0, 0]}>
          {/* 1. Parametric Deformable Heart Anatomy Mesh */}
          <HeartMesh
            kinematics={kinematics}
            displayMode={displayMode}
            clippingPlanes={clippingPlanes}
            highlightSegment={highlightSegment}
          />

          {/* 2. AHA 17-Segment Regional Strain Heatmap Overlay */}
          <AHA17Heatmap
            strains={strains}
            visible={showHeatmap || displayMode === "heatmap"}
            clippingPlanes={clippingPlanes}
            highlightSegment={highlightSegment}
            onSelectSegment={onSelectSegment}
          />

          {/* 3. Synchronized Mitral & Aortic Valves */}
          {showValves && (
            <ValveLeaflets
              kinematics={kinematics}
              clippingPlanes={clippingPlanes}
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
            opacity={0.2}
          />
        </Center>

        {/* Subtle Grid Floor */}
        <gridHelper
          args={[14, 28, "#00f0ff", "#1c2538"]}
          position={[0, -2.4, 0]}
        />
      </Canvas>
    </div>
  );
}
