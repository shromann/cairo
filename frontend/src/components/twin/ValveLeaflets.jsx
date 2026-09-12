import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Dynamic Heart Valve Leaflets (Mitral & Aortic)
 * Synchronized with ventricular systole and diastole phases.
 */
export function ValveLeaflets({ kinematics, clippingPlanes = [] }) {
  const mitralAntRef = useRef();
  const mitralPostRef = useRef();
  const aorticLeftRef = useRef();
  const aorticRightRef = useRef();
  const aorticNonRef = useRef();

  useFrame(() => {
    if (!kinematics) return;

    const { mitralOpen, aorticOpen } = kinematics;

    // 1. Mitral Valve Leaflet Hinges (open down into LV cavity during diastole)
    if (mitralAntRef.current && mitralPostRef.current) {
      const angle = (mitralOpen * 55 * Math.PI) / 180;
      mitralAntRef.current.rotation.x = -angle;
      mitralPostRef.current.rotation.x = angle;
    }

    // 2. Aortic Valve Cusps (open up into Aortic root during systole)
    if (aorticLeftRef.current && aorticRightRef.current && aorticNonRef.current) {
      const angle = (aorticOpen * 58 * Math.PI) / 180;
      aorticLeftRef.current.rotation.z = angle;
      aorticRightRef.current.rotation.z = -angle;
      aorticNonRef.current.rotation.x = -angle;
    }
  });

  const valveMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f8f9fa"),
    emissive: new THREE.Color("#495057"),
    emissiveIntensity: 0.2,
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.5,
    transmission: 0.25,
    opacity: 0.95,
    transparent: true,
    clippingPlanes: clippingPlanes,
    side: THREE.DoubleSide
  });

  const chordaeMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color("#dee2e6"),
    clippingPlanes: clippingPlanes,
    transparent: true,
    opacity: 0.8
  });

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]}>
      {/* --- 1. MITRAL VALVE (Atrioventricular Ring at y = 1.2) --- */}
      <group position={[-0.3, 1.25, -0.2]}>
        {/* Valve Annulus Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.04, 16, 32]} />
          <meshStandardMaterial color="#6c757d" clippingPlanes={clippingPlanes} />
        </mesh>

        {/* Anterior Mitral Leaflet */}
        <group position={[0, 0, 0.25]}>
          <mesh ref={mitralAntRef} position={[0, -0.22, 0]} material={valveMaterial}>
            <planeGeometry args={[0.55, 0.45]} />
          </mesh>
        </group>

        {/* Posterior Mitral Leaflet */}
        <group position={[0, 0, -0.25]}>
          <mesh ref={mitralPostRef} position={[0, -0.18, 0]} material={valveMaterial}>
            <planeGeometry args={[0.65, 0.35]} />
          </mesh>
        </group>
      </group>

      {/* --- 2. AORTIC VALVE (Aortic Annulus at y = 1.55) --- */}
      <group position={[-0.05, 1.55, 0.1]}>
        {/* Aortic Annulus Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.035, 16, 32]} />
          <meshStandardMaterial color="#6c757d" clippingPlanes={clippingPlanes} />
        </mesh>

        {/* Left Coronary Cusp */}
        <group position={[-0.15, 0, 0]}>
          <mesh ref={aorticLeftRef} position={[0, 0.18, 0]} material={valveMaterial}>
            <planeGeometry args={[0.26, 0.32]} />
          </mesh>
        </group>

        {/* Right Coronary Cusp */}
        <group position={[0.15, 0, 0]}>
          <mesh ref={aorticRightRef} position={[0, 0.18, 0]} material={valveMaterial}>
            <planeGeometry args={[0.26, 0.32]} />
          </mesh>
        </group>

        {/* Non-Coronary Cusp */}
        <group position={[0, 0, -0.16]}>
          <mesh ref={aorticNonRef} position={[0, 0.18, 0]} material={valveMaterial}>
            <planeGeometry args={[0.3, 0.32]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
