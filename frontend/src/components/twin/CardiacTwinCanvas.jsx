import React, { Suspense, useMemo, useState, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Heart } from "lucide-react";
import { HeartMesh } from "./HeartMesh";
import { HeartMeshGLB } from "./HeartMeshGLB";
import { DebugProbe } from "./DebugProbe";
import { AHA17Heatmap } from "./AHA17Heatmap";
import { ValveLeaflets } from "./ValveLeaflets";
import { UltrasoundSlicePlane, getClippingPlanesForMode } from "./UltrasoundSlicePlane";
import { SimpsonTracingsOverlay } from "./SimpsonTracingsOverlay";

// Kill switch for the mesh migration: "glb" loads public/models/heart.glb, anything else keeps the procedural heart.
const USE_GLB = import.meta.env.PUBLIC_HEART_RENDERER === "glb";

/**
 * High-End Glassmorphic Loading Spinner Overlay for 3D Mesh Assets
 * Displays during GLB download, Draco buffer decompression, and texture initialization.
 */
function ModelLoadingOverlay() {
  const { active, progress } = useProgress();
  const [visible, setVisible] = useState(true);
  const [hasFinished, setHasFinished] = useState(false);

  useEffect(() => {
    if (!active && (progress >= 100 || progress === 0)) {
      setHasFinished(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 400);
      return () => clearTimeout(timer);
    } else if (active) {
      setVisible(true);
      setHasFinished(false);
    }
  }, [active, progress]);

  if (!visible) return null;

  return (
    <div className={`model-loading-overlay ${hasFinished ? "model-loading-fade-out" : ""}`}>
      <div className="model-loading-card">
        <div className="model-loading-ring-wrap">
          <div className="model-loading-ring" />
          <div className="model-loading-ring-inner" />
          <Heart size={20} className="model-loading-heart" />
        </div>
        <div className="model-loading-info">
          <div className="model-loading-title-row">
            <span className="model-loading-title">Loading 3D Cardiac Anatomy</span>
            <span className="model-loading-pct">{Math.round(progress || 0)}%</span>
          </div>
          <div className="model-loading-bar-track">
            <div
              className="model-loading-bar-fill"
              style={{ width: `${Math.max(6, Math.min(100, progress || 0))}%` }}
            />
          </div>
          <span className="model-loading-sub">
            {progress < 100
              ? "Fetching High-Resolution Biomechanical Mesh & Draco Buffers…"
              : "Initializing Kinematics & Shaders…"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Smooth Camera Controller for 1-Click Anatomical View Presets
 */
function CameraController({ preset, onPresetHandled }) {
  const { camera } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (!preset) return;

    const targets = {
      anterior: { pos: [0, 0.45, 7.8], target: [0, 0.25, 0.3] },
      lateral: { pos: [-7.2, 0.45, 1.8], target: [0, 0.25, 0.3] },
      superior: { pos: [0.3, 7.2, 2.6], target: [0, 0.25, 0.3] },
      apical: { pos: [0, -6.8, 3.4], target: [0, 0.25, 0.3] },
      reset: { pos: [0, 0.45, 7.8], target: [0, 0.25, 0.3] }
    };

    const cfg = targets[preset] || targets.anterior;
    camera.position.set(...cfg.pos);
    camera.lookAt(...cfg.target);

    if (onPresetHandled) onPresetHandled();
  }, [preset, camera, onPresetHandled]);

  return null;
}

/**
 * React Three Fiber 3D Canvas Viewport for the Cardiac Digital Twin
 * High-End Cinematic Medical Studio Viewport
 */
export function CardiacTwinCanvas({
  kinematics,
  strains = [],
  displayMode = "wireframe", // "wireframe" | "solid" | "xray" | "heatmap"
  viewMode = "none",         // "none" | "A4C" | "A2C" | "PLAX" | "PSAX"
  cameraPreset = null,
  showHeatmap = false,
  showValves = true,
  showSimpsonTracings = false,
  showSlicePlane = true,
  highlightSegment = null,
  selectedNodeId = null,
  onSelectSegment = () => {},
  onSelectNode = () => {},
  onCameraPresetHandled = () => {}
}) {
  const controlsRef = useRef();

  // Compute hardware clipping planes for current ultrasound viewMode
  const clippingPlanes = useMemo(() => {
    return getClippingPlanesForMode(viewMode);
  }, [viewMode]);

  return (
    <div className="cardiac-canvas-container" style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* 3D Model Loading Spinner Overlay */}
      <ModelLoadingOverlay />

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
        <DebugProbe />
        <CameraController preset={cameraPreset} onPresetHandled={onCameraPresetHandled} />

        {/* Reframed Perspective Camera: perfectly centered, comfortable focal length without wide-angle distortion */}
        <PerspectiveCamera makeDefault position={[0, 0.45, 7.8]} fov={38} />

        {/* OrbitControls pivoting around the true volumetric centroid of the heart */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={3.0}
          maxDistance={12.0}
          target={[0, 0.25, 0.3]}
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
        <pointLight position={[0, 0.25, 0]} intensity={0.4} color="#ff99aa" distance={4} />

        <group name="heart-scene-wrapper">
          {/* 1. Heart anatomy mesh with node click: procedural or Z-Anatomy GLB */}
          {USE_GLB ? (
            <Suspense fallback={null}>
              <HeartMeshGLB
                kinematics={kinematics}
                displayMode={displayMode}
                clippingPlanes={clippingPlanes}
                highlightSegment={highlightSegment}
                selectedNodeId={selectedNodeId}
                showValves={showValves}
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

          {/* 3. Synchronized Fibrous Mitral & Aortic Valves (procedural overlay; GLB has its own leaflets) */}
          {showValves && !USE_GLB && (
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
        </group>

        {/* Studio Ground Grid Floor positioned just beneath the apex */}
        <gridHelper
          args={[14, 28, "#27272a", "#121214"]}
          position={[0, -2.8, 0]}
        />
      </Canvas>
    </div>
  );
}
