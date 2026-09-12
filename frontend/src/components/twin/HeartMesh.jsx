import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * 3D Parametric Anatomical Heart Mesh with Dynamic Cardiac Kinematics
 * Features:
 * - Thick-walled Left Ventricle with endocardial & epicardial surfaces
 * - Right Ventricle crescent mantle
 * - Left & Right Atria with phase-shifted filling/contraction
 * - Ascending Aorta & Pulmonary Trunk
 * - Dynamic vertex shader deformation: longitudinal strain shortening, radial contraction,
 *   myocardial incompressibility wall-thickening, apex wringing torsion.
 * - Hardware clipping plane support for real-time ultrasound slicing (A4C, A2C, PLAX).
 */
export function HeartMesh({
  kinematics,
  displayMode = "solid", // "solid" | "wireframe" | "xray" | "heatmap"
  clippingPlanes = [],
  highlightSegment = null
}) {
  const lvOuterRef = useRef();
  const lvInnerRef = useRef();
  const rvRef = useRef();
  const laRef = useRef();
  const raRef = useRef();
  const aortaRef = useRef();
  const pulmonaryRef = useRef();

  // 1. Procedural Left Ventricular Outer (Epicardium) & Inner (Endocardium) Geometry
  const { outerGeometry, innerGeometry } = useMemo(() => {
    const latSegments = 40;
    const lonSegments = 40;

    // Outer Epicardium (thick prolate spheroid with anatomical apex taper)
    const outerGeo = new THREE.SphereGeometry(1.6, lonSegments, latSegments);
    const outerPos = outerGeo.attributes.position;
    for (let i = 0; i < outerPos.count; i++) {
      let x = outerPos.getX(i);
      let y = outerPos.getY(i);
      let z = outerPos.getZ(i);

      // Elongate along vertical axis (apex at -y, base at +y)
      y *= 1.45;
      // Apex tapering toward bottom
      if (y < 0) {
        const taper = 1.0 + y * 0.22;
        x *= Math.max(0.2, taper);
        z *= Math.max(0.2, taper);
      }
      // Septal flattening on +X side (interventricular septum interface)
      if (x > 0.6) {
        x = 0.6 + (x - 0.6) * 0.7;
      }
      outerPos.setXYZ(i, x, y, z);
    }
    outerGeo.computeVertexNormals();

    // Inner Endocardium (ventricular cavity wall)
    const innerGeo = new THREE.SphereGeometry(1.22, lonSegments, latSegments);
    const innerPos = innerGeo.attributes.position;
    for (let i = 0; i < innerPos.count; i++) {
      let x = innerPos.getX(i);
      let y = innerPos.getY(i);
      let z = innerPos.getZ(i);

      y *= 1.35;
      if (y < 0) {
        const taper = 1.0 + y * 0.25;
        x *= Math.max(0.15, taper);
        z *= Math.max(0.15, taper);
      }
      if (x > 0.5) {
        x = 0.5 + (x - 0.5) * 0.7;
      }
      innerPos.setXYZ(i, x, y, z);
    }
    innerGeo.computeVertexNormals();

    return { outerGeometry: outerGeo, innerGeometry: innerGeo };
  }, []);

  // 2. Right Ventricle Geometry (Crescent mantle attached to LV anteroseptal wall)
  const rvGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1.4, 0.4, 2.3, 32, 16, false, 0, Math.PI * 0.85);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + 0.85;
      let y = pos.getY(i) - 0.1;
      let z = pos.getZ(i) + 0.35;

      // Wrap around LV contour
      if (y < 0) {
        const t = 1.0 + y * 0.35;
        x *= t;
        z *= t;
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // 3. Atria Geometries
  const { laGeometry, raGeometry } = useMemo(() => {
    const laGeo = new THREE.SphereGeometry(0.95, 24, 24);
    const raGeo = new THREE.SphereGeometry(0.9, 24, 24);
    return { laGeometry: laGeo, raGeometry: raGeo };
  }, []);

  // 4. Great Vessels Geometries (Aorta & Pulmonary Artery)
  const { aortaGeometry, pulmonaryGeometry } = useMemo(() => {
    // Curved Ascending Aorta Arch
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.1, 1.6, 0.1),
      new THREE.Vector3(-0.1, 2.4, 0.0),
      new THREE.Vector3(0.3, 2.9, -0.3),
      new THREE.Vector3(0.9, 2.7, -0.7),
      new THREE.Vector3(1.0, 1.8, -0.9)
    ]);
    const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.38, 20, false);

    // Pulmonary Trunk branching anterior to aorta
    const pulmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.5, 1.3, 0.6),
      new THREE.Vector3(0.3, 2.1, 0.4),
      new THREE.Vector3(-0.2, 2.4, 0.0),
      new THREE.Vector3(-0.8, 2.3, -0.3)
    ]);
    const pulmGeo = new THREE.TubeGeometry(pulmCurve, 24, 0.32, 18, false);

    return { aortaGeometry: aortaGeo, pulmonaryGeometry: pulmGeo };
  }, []);

  // Animate dynamic deformation frame-by-frame based on kinematics
  useFrame(() => {
    if (!kinematics) return;

    const {
      radialScale,
      wallThickeningFactor,
      longitudinalShortening,
      currentApexTorsionRad,
      f_contraction
    } = kinematics;

    // 1. Deform Left Ventricle Outer (Epicardium)
    if (lvOuterRef.current) {
      // Outer wall contracts radially but thickens due to incompressibility
      const epicardialRadialScale = radialScale * wallThickeningFactor;
      lvOuterRef.current.scale.set(
        epicardialRadialScale,
        longitudinalShortening,
        epicardialRadialScale
      );
      lvOuterRef.current.rotation.y = currentApexTorsionRad;
    }

    // 2. Deform Left Ventricle Inner (Endocardium / Cavity)
    if (lvInnerRef.current) {
      // Cavity experiences full radial contraction
      lvInnerRef.current.scale.set(
        radialScale,
        longitudinalShortening,
        radialScale
      );
      lvInnerRef.current.rotation.y = currentApexTorsionRad;
    }

    // 3. Deform Right Ventricle (synchronized systolic bellows contraction)
    if (rvRef.current) {
      const rvRadialScale = 1.0 - 0.28 * f_contraction;
      rvRef.current.scale.set(rvRadialScale, longitudinalShortening * 0.95, rvRadialScale);
    }

    // 4. Deform Atria (Phase-shifted: expands during ventricular systole, contracts in late diastole)
    if (laRef.current && raRef.current) {
      const atrialScale = 1.0 + 0.16 * (1.0 - f_contraction);
      laRef.current.scale.set(atrialScale, atrialScale, atrialScale);
      raRef.current.scale.set(atrialScale, atrialScale, atrialScale);
    }

    // 5. Aorta Pulse Wave (expands during rapid ejection)
    if (aortaRef.current) {
      const pulse = 1.0 + 0.08 * Math.max(0, kinematics.aorticOpen);
      aortaRef.current.scale.set(pulse, 1.0, pulse);
    }
  });

  // Material configurations
  const isWireframe = displayMode === "wireframe";
  const isXray = displayMode === "xray";

  const epicardiumMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#c82333"),
      emissive: new THREE.Color("#4a0e17"),
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      transmission: isXray ? 0.75 : 0.0,
      opacity: isXray ? 0.45 : 1.0,
      transparent: isXray,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray]);

  const endocardiumMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ff4d6d"),
      emissive: new THREE.Color("#701224"),
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.15,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.BackSide
    });
  }, [displayMode, clippingPlanes, isWireframe]);

  const rvMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#9d172d"),
      emissive: new THREE.Color("#380a12"),
      emissiveIntensity: 0.2,
      roughness: 0.45,
      metalness: 0.1,
      opacity: isXray ? 0.4 : 0.92,
      transparent: true,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray]);

  const atriaMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#801b2b"),
      emissive: new THREE.Color("#2d080e"),
      emissiveIntensity: 0.15,
      roughness: 0.5,
      metalness: 0.1,
      opacity: isXray ? 0.35 : 0.95,
      transparent: true,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray]);

  const aortaMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#d9383a"),
      emissive: new THREE.Color("#6b1416"),
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.15,
      clearcoat: 0.6,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe]);

  const pulmonaryMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#2a6f97"),
      emissive: new THREE.Color("#012a4a"),
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.5,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe]);

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]}>
      {/* 1. Left Ventricle Epicardium (Outer Wall) */}
      <mesh
        ref={lvOuterRef}
        geometry={outerGeometry}
        material={epicardiumMaterial}
        castShadow
        receiveShadow
      />

      {/* 2. Left Ventricle Endocardium (Inner Cavity) */}
      <mesh
        ref={lvInnerRef}
        geometry={innerGeometry}
        material={endocardiumMaterial}
        castShadow={false}
      />

      {/* 3. Right Ventricle */}
      <mesh
        ref={rvRef}
        geometry={rvGeometry}
        material={rvMaterial}
        castShadow
        receiveShadow
      />

      {/* 4. Left Atrium (Posterior Superior) */}
      <mesh
        ref={laRef}
        geometry={laGeometry}
        material={atriaMaterial}
        position={[-0.45, 1.7, -0.65]}
        castShadow
      />

      {/* 5. Right Atrium (Anterior Superior) */}
      <mesh
        ref={raRef}
        geometry={raGeometry}
        material={atriaMaterial}
        position={[1.15, 1.5, -0.1]}
        castShadow
      />

      {/* 6. Ascending Aorta */}
      <mesh
        ref={aortaRef}
        geometry={aortaGeometry}
        material={aortaMaterial}
        castShadow
      />

      {/* 7. Pulmonary Trunk */}
      <mesh
        ref={pulmonaryRef}
        geometry={pulmonaryGeometry}
        material={pulmonaryMaterial}
        castShadow
      />
    </group>
  );
}
