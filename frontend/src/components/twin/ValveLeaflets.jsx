import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CARDIAC_NODES } from "../../data/cardiacNodes";

/**
 * Dynamic Heart Valve Leaflets (Mitral & Aortic) with Fibrous Chordae Tendineae
 * Supports interactive click inspection and node selection highlighting
 */
export function ValveLeaflets({
  kinematics,
  clippingPlanes = [],
  selectedNodeId = null,
  onSelectNode = () => {}
}) {
  const mitralAntRef = useRef();
  const mitralPostRef = useRef();
  const aorticLeftRef = useRef();
  const aorticRightRef = useRef();
  const aorticNonRef = useRef();

  useFrame(() => {
    if (!kinematics) return;

    const { mitralOpen, aorticOpen } = kinematics;

    // 1. Mitral Valve Leaflet Hinges
    if (mitralAntRef.current && mitralPostRef.current) {
      const angle = (mitralOpen * 55 * Math.PI) / 180;
      mitralAntRef.current.rotation.x = -angle;
      mitralPostRef.current.rotation.x = angle;
    }

    // 2. Aortic Valve Cusps
    if (aorticLeftRef.current && aorticRightRef.current && aorticNonRef.current) {
      const angle = (aorticOpen * 58 * Math.PI) / 180;
      aorticLeftRef.current.rotation.z = angle;
      aorticRightRef.current.rotation.z = -angle;
      aorticNonRef.current.rotation.x = -angle;
    }
  });

  const isMitralSelected = selectedNodeId === "mitral_valve";
  const isAorticSelected = selectedNodeId === "aortic_valve";

  const valveMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f8f9fa"),
      emissive: new THREE.Color("#6c757d"),
      emissiveIntensity: 0.18,
      roughness: 0.48,
      metalness: 0.02,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      transmission: 0.38,
      ior: 1.38,
      thickness: 0.25,
      attenuationColor: new THREE.Color("#fff1e6"),
      opacity: 0.94,
      transparent: true,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [clippingPlanes]);

  const mitralHighlightMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: isMitralSelected ? new THREE.Color("#00f0ff") : new THREE.Color("#f8f9fa"),
      emissive: isMitralSelected ? new THREE.Color("#007799") : new THREE.Color("#6c757d"),
      emissiveIntensity: isMitralSelected ? 0.6 : 0.18,
      roughness: 0.45,
      transmission: 0.35,
      transparent: true,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [clippingPlanes, isMitralSelected]);

  const aorticHighlightMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: isAorticSelected ? new THREE.Color("#00f0ff") : new THREE.Color("#f8f9fa"),
      emissive: isAorticSelected ? new THREE.Color("#007799") : new THREE.Color("#6c757d"),
      emissiveIntensity: isAorticSelected ? 0.6 : 0.18,
      roughness: 0.45,
      transmission: 0.35,
      transparent: true,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [clippingPlanes, isAorticSelected]);

  const annulusMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#adb5bd"),
      roughness: 0.60,
      metalness: 0.05,
      clippingPlanes: clippingPlanes
    });
  }, [clippingPlanes]);

  const chordaeLines = useMemo(() => {
    const lines = [];
    const antEdge = [
      new THREE.Vector3(-0.15, -0.42, 0.25),
      new THREE.Vector3(0.0, -0.44, 0.25),
      new THREE.Vector3(0.15, -0.42, 0.25)
    ];
    const postEdge = [
      new THREE.Vector3(-0.18, -0.36, -0.25),
      new THREE.Vector3(0.0, -0.38, -0.25),
      new THREE.Vector3(0.18, -0.36, -0.25)
    ];
    const papAL = new THREE.Vector3(-0.15, -1.0, 0.35);
    const papPM = new THREE.Vector3(0.2, -1.0, -0.25);

    antEdge.forEach((p) => {
      lines.push(new THREE.BufferGeometry().setFromPoints([p, papAL]));
    });
    postEdge.forEach((p) => {
      lines.push(new THREE.BufferGeometry().setFromPoints([p, papPM]));
    });

    return lines;
  }, []);

  const handlePointerOver = (e) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]}>
      {/* --- 1. MITRAL VALVE (Atrioventricular Ring at y = 1.25) --- */}
      <group
        position={[-0.3, 1.25, -0.2]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(CARDIAC_NODES.mitral_valve);
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Valve Annulus Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.045, 16, 32]} />
          <primitive object={annulusMaterial} />
        </mesh>

        {/* Anterior Mitral Leaflet */}
        <group position={[0, 0, 0.25]}>
          <mesh ref={mitralAntRef} position={[0, -0.22, 0]} material={mitralHighlightMat}>
            <planeGeometry args={[0.55, 0.45, 4, 4]} />
          </mesh>
        </group>

        {/* Posterior Mitral Leaflet */}
        <group position={[0, 0, -0.25]}>
          <mesh ref={mitralPostRef} position={[0, -0.18, 0]} material={mitralHighlightMat}>
            <planeGeometry args={[0.65, 0.35, 4, 4]} />
          </mesh>
        </group>

        {/* Fibrous Chordae Tendineae Strands */}
        {chordaeLines.map((geo, idx) => (
          <line key={idx} geometry={geo}>
            <lineBasicMaterial
              color="#e9ecef"
              transparent
              opacity={0.65}
              clippingPlanes={clippingPlanes}
            />
          </line>
        ))}
      </group>

      {/* --- 2. AORTIC VALVE (Aortic Annulus at y = 1.55) --- */}
      <group
        position={[-0.05, 1.55, 0.1]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(CARDIAC_NODES.aortic_valve);
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Aortic Annulus Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.038, 16, 32]} />
          <primitive object={annulusMaterial} />
        </mesh>

        {/* Left Coronary Cusp */}
        <group position={[-0.15, 0, 0]}>
          <mesh ref={aorticLeftRef} position={[0, 0.18, 0]} material={aorticHighlightMat}>
            <planeGeometry args={[0.26, 0.32, 4, 4]} />
          </mesh>
        </group>

        {/* Right Coronary Cusp */}
        <group position={[0.15, 0, 0]}>
          <mesh ref={aorticRightRef} position={[0, 0.18, 0]} material={aorticHighlightMat}>
            <planeGeometry args={[0.26, 0.32, 4, 4]} />
          </mesh>
        </group>

        {/* Non-Coronary Cusp */}
        <group position={[0, 0, -0.16]}>
          <mesh ref={aorticNonRef} position={[0, 0.18, 0]} material={aorticHighlightMat}>
            <planeGeometry args={[0.3, 0.32, 4, 4]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
