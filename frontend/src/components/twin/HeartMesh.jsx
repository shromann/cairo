import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getMyocardialTextures } from "./myocardialTextures";
import { CARDIAC_NODES } from "../../data/cardiacNodes";
import {
  buildLeftVentricleGeometries,
  buildRightVentricleGeometry,
  buildLeftAtriumGeometries,
  buildRightAtriumGeometries,
  buildAortaGeometries,
  buildPulmonaryGeometries
} from "./cardiacGeometry";

/**
 * Photorealistic 3D Parametric Anatomical Heart Mesh with Node Click Inspection
 */
export function HeartMesh({
  kinematics,
  displayMode = "solid", // "solid" | "wireframe" | "xray" | "heatmap"
  clippingPlanes = [],
  highlightSegment = null,
  selectedNodeId = null,
  onSelectNode = () => {}
}) {
  const lvOuterRef = useRef();
  const lvInnerRef = useRef();
  const rvRef = useRef();
  const laRef = useRef();
  const raRef = useRef();
  const aortaRef = useRef();
  const pulmonaryRef = useRef();
  const vesselsRef = useRef();

  // Load procedural PBR textures
  const textures = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getMyocardialTextures();
  }, []);

  // 1. Procedural Left Ventricle (Epicardium & Endocardium)
  const { outerGeometry, innerGeometry } = useMemo(() => {
    return buildLeftVentricleGeometries();
  }, []);

  // 2. Right Ventricle with Infundibulum (RVOT)
  const rvGeometry = useMemo(() => {
    return buildRightVentricleGeometry();
  }, []);

  // 3. Left Atrium with LAA & 4 Pulmonary Veins
  const laGeos = useMemo(() => {
    return buildLeftAtriumGeometries();
  }, []);

  // 4. Right Atrium with RAA & SVC / IVC Conduits
  const raGeos = useMemo(() => {
    return buildRightAtriumGeometries();
  }, []);

  // 5. Aorta with Tri-Lobed Sinuses of Valsalva & 3 Arch Branches
  const aortaGeos = useMemo(() => {
    return buildAortaGeometries();
  }, []);

  // 6. Pulmonary Trunk with LPA & RPA Bifurcation
  const pulmonaryGeos = useMemo(() => {
    return buildPulmonaryGeometries();
  }, []);

  // 7. 3D Branching Coronary Artery & Vein Network
  const coronaryVessels = useMemo(() => {
    // A. Left Anterior Descending (LAD) Artery (seated in anterior sulcus)
    const ladCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.05, 1.42, 0.55),
      new THREE.Vector3(0.12, 1.05, 0.90),
      new THREE.Vector3(0.17, 0.52, 1.12),
      new THREE.Vector3(0.14, -0.05, 1.08),
      new THREE.Vector3(0.08, -0.65, 0.85),
      new THREE.Vector3(0.02, -1.25, 0.50),
      new THREE.Vector3(-0.04, -1.75, 0.16)
    ]);
    const ladGeo = new THREE.TubeGeometry(ladCurve, 32, 0.048, 10, false);

    // Diagonal Branch 1 (D1)
    const d1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.17, 0.52, 1.12),
      new THREE.Vector3(-0.35, 0.22, 1.22),
      new THREE.Vector3(-0.85, -0.15, 1.02),
      new THREE.Vector3(-1.15, -0.55, 0.70)
    ]);
    const d1Geo = new THREE.TubeGeometry(d1Curve, 18, 0.032, 8, false);

    // Diagonal Branch 2 (D2)
    const d2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.14, -0.05, 1.08),
      new THREE.Vector3(-0.32, -0.35, 1.04),
      new THREE.Vector3(-0.75, -0.75, 0.75)
    ]);
    const d2Geo = new THREE.TubeGeometry(d2Curve, 14, 0.026, 8, false);

    // B. Right Coronary Artery (RCA) (in right AV groove)
    const rcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.35, 1.38, 0.35),
      new THREE.Vector3(0.85, 1.22, 0.45),
      new THREE.Vector3(1.35, 0.92, 0.32),
      new THREE.Vector3(1.48, 0.32, 0.15),
      new THREE.Vector3(1.38, -0.28, -0.12),
      new THREE.Vector3(1.15, -0.78, -0.35)
    ]);
    const rcaGeo = new THREE.TubeGeometry(rcaCurve, 28, 0.044, 10, false);

    // Acute Marginal Branch from RCA
    const margCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.48, 0.32, 0.15),
      new THREE.Vector3(1.25, 0.02, 0.55),
      new THREE.Vector3(0.95, -0.48, 0.65)
    ]);
    const margGeo = new THREE.TubeGeometry(margCurve, 14, 0.028, 8, false);

    // C. Left Circumflex (LCx) Artery
    const lcxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, 1.38, 0.35),
      new THREE.Vector3(-0.75, 1.32, 0.25),
      new THREE.Vector3(-1.25, 1.12, -0.15),
      new THREE.Vector3(-1.35, 0.62, -0.55),
      new THREE.Vector3(-1.18, 0.12, -0.85)
    ]);
    const lcxGeo = new THREE.TubeGeometry(lcxCurve, 24, 0.04, 10, false);

    // D. Great Cardiac Vein
    const gcvCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.02, -1.65, 0.20),
      new THREE.Vector3(0.05, -1.15, 0.55),
      new THREE.Vector3(0.11, -0.55, 0.88),
      new THREE.Vector3(0.18, 0.05, 1.12),
      new THREE.Vector3(0.13, 0.62, 1.14),
      new THREE.Vector3(-0.15, 1.12, 0.92),
      new THREE.Vector3(-0.65, 1.22, 0.42),
      new THREE.Vector3(-1.15, 1.02, -0.12)
    ]);
    const gcvGeo = new THREE.TubeGeometry(gcvCurve, 32, 0.042, 8, false);

    return { ladGeo, d1Geo, d2Geo, rcaGeo, margGeo, lcxGeo, gcvGeo };
  }, []);

  // 8. Internal Papillary Muscle Columns
  const { papillaryALGeo, papillaryPMGeo } = useMemo(() => {
    const alGeo = new THREE.CylinderGeometry(0.14, 0.24, 0.85, 12);
    const pmGeo = new THREE.CylinderGeometry(0.13, 0.22, 0.8, 12);
    return { papillaryALGeo: alGeo, papillaryPMGeo: pmGeo };
  }, []);

  // Dynamic kinematic animation loop
  useFrame(() => {
    if (!kinematics) return;

    const {
      radialScale,
      wallThickeningFactor,
      longitudinalShortening,
      currentApexTorsionRad,
      f_contraction
    } = kinematics;

    if (lvOuterRef.current) {
      const epicardialRadialScale = radialScale * wallThickeningFactor;
      lvOuterRef.current.scale.set(
        epicardialRadialScale,
        longitudinalShortening,
        epicardialRadialScale
      );
      lvOuterRef.current.rotation.y = currentApexTorsionRad;
    }

    if (lvInnerRef.current) {
      lvInnerRef.current.scale.set(
        radialScale,
        longitudinalShortening,
        radialScale
      );
      lvInnerRef.current.rotation.y = currentApexTorsionRad;
    }

    if (vesselsRef.current) {
      const epicardialRadialScale = radialScale * wallThickeningFactor;
      vesselsRef.current.scale.set(
        epicardialRadialScale,
        longitudinalShortening,
        epicardialRadialScale
      );
      vesselsRef.current.rotation.y = currentApexTorsionRad;
    }

    if (rvRef.current) {
      const rvRadialScale = 1.0 - 0.28 * f_contraction;
      rvRef.current.scale.set(rvRadialScale, longitudinalShortening * 0.95, rvRadialScale);
    }

    if (laRef.current && raRef.current) {
      const atrialScale = 1.0 + 0.16 * (1.0 - f_contraction);
      laRef.current.scale.set(atrialScale, atrialScale, atrialScale);
      raRef.current.scale.set(atrialScale, atrialScale, atrialScale);
    }

    if (aortaRef.current) {
      const pulse = 1.0 + 0.08 * Math.max(0, kinematics.aorticOpen);
      aortaRef.current.scale.set(pulse, 1.0, pulse);
    }
  });

  const isWireframe = displayMode === "wireframe";
  const isXray = displayMode === "xray";

  const handlePointerOver = (e) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  // Materials with dynamic selection highlighting
  const isSelected = (id) => selectedNodeId === id;

  const epicardiumMaterial = useMemo(() => {
    const sel = isSelected("lv");
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#d90429") : new THREE.Color("#b81d2e"),
      emissive: sel ? new THREE.Color("#700010") : new THREE.Color("#3d070f"),
      emissiveIntensity: sel ? 0.6 : 0.22,
      map: textures ? textures.epicardiumDiffuse : null,
      normalMap: textures ? textures.epicardiumNormal : null,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: textures ? textures.epicardiumRoughness : null,
      roughness: 0.58,
      metalness: 0.02,
      clearcoat: 0.12,
      clearcoatRoughness: 0.45,
      transmission: isXray ? 0.75 : 0.08,
      ior: 1.40,
      thickness: 1.4,
      attenuationColor: new THREE.Color("#ff0025"),
      attenuationDistance: 0.75,
      sheen: 0.4,
      sheenColor: new THREE.Color("#ff6b7e"),
      sheenRoughness: 0.5,
      opacity: isXray ? 0.45 : 1.0,
      transparent: isXray,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray, textures, selectedNodeId]);

  const endocardiumMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#e63950"),
      emissive: new THREE.Color("#5e0a19"),
      emissiveIntensity: 0.30,
      map: textures ? textures.endocardiumDiffuse : null,
      roughness: 0.60,
      metalness: 0.02,
      clearcoat: 0.08,
      clearcoatRoughness: 0.5,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.BackSide
    });
  }, [displayMode, clippingPlanes, isWireframe, textures]);

  const rvMaterial = useMemo(() => {
    const sel = isSelected("rv");
    const hasClipping = clippingPlanes && clippingPlanes.length > 0;
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#c1121f") : new THREE.Color("#991b29"),
      emissive: sel ? new THREE.Color("#5a000c") : new THREE.Color("#33060c"),
      emissiveIntensity: sel ? 0.55 : 0.20,
      map: textures ? textures.epicardiumDiffuse : null,
      normalMap: textures ? textures.epicardiumNormal : null,
      normalScale: new THREE.Vector2(0.60, 0.60),
      roughnessMap: textures ? textures.epicardiumRoughness : null,
      roughness: 0.55,
      metalness: 0.02,
      clearcoat: 0.14,
      clearcoatRoughness: 0.45,
      sheen: 0.35,
      sheenColor: new THREE.Color("#ff6b7e"),
      sheenRoughness: 0.5,
      transmission: isXray ? 0.7 : 0.0,
      thickness: 1.1,
      attenuationColor: new THREE.Color("#ff0025"),
      attenuationDistance: 0.8,
      opacity: isXray ? 0.45 : 1.0,
      transparent: isXray,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      clipShadows: true,
      side: hasClipping || isXray ? THREE.DoubleSide : THREE.FrontSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray, textures, selectedNodeId]);

  const atriaMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#7d1726"),
      emissive: new THREE.Color("#29060b"),
      emissiveIntensity: 0.16,
      roughness: 0.62,
      metalness: 0.02,
      clearcoat: 0.08,
      transmission: isXray ? 0.75 : 0.15,
      thickness: 0.6,
      attenuationColor: new THREE.Color("#ff2244"),
      attenuationDistance: 0.5,
      opacity: isXray ? 0.35 : 0.96,
      transparent: true,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray]);

  const laMaterial = useMemo(() => {
    const sel = isSelected("la");
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#a31621") : new THREE.Color("#7d1726"),
      emissive: sel ? new THREE.Color("#4d0812") : new THREE.Color("#29060b"),
      emissiveIntensity: sel ? 0.5 : 0.16,
      roughness: 0.62,
      metalness: 0.02,
      clearcoat: 0.08,
      transmission: isXray ? 0.75 : 0.15,
      opacity: isXray ? 0.35 : 0.96,
      transparent: true,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray, selectedNodeId]);

  const raMaterial = useMemo(() => {
    const sel = isSelected("ra");
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#a31621") : new THREE.Color("#7d1726"),
      emissive: sel ? new THREE.Color("#4d0812") : new THREE.Color("#29060b"),
      emissiveIntensity: sel ? 0.5 : 0.16,
      roughness: 0.62,
      metalness: 0.02,
      clearcoat: 0.08,
      transmission: isXray ? 0.75 : 0.15,
      opacity: isXray ? 0.35 : 0.96,
      transparent: true,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray, selectedNodeId]);

  const venousVesselMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#3a506b"),
      emissive: new THREE.Color("#0b132b"),
      emissiveIntensity: 0.22,
      roughness: 0.54,
      metalness: 0.04,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [isWireframe, clippingPlanes]);

  const aortaMaterial = useMemo(() => {
    const sel = isSelected("aorta") || isSelected("aorta_sinus");
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#ef233c") : new THREE.Color("#de3a3e"),
      emissive: sel ? new THREE.Color("#800010") : new THREE.Color("#590f12"),
      emissiveIntensity: sel ? 0.55 : 0.22,
      map: textures ? textures.aortaDiffuse : null,
      roughness: 0.50,
      metalness: 0.04,
      clearcoat: 0.14,
      clearcoatRoughness: 0.35,
      transmission: isXray ? 0.75 : 0.1,
      thickness: 0.8,
      attenuationColor: new THREE.Color("#ff2b38"),
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray, textures, selectedNodeId]);

  const pulmonaryMaterial = useMemo(() => {
    const sel = isSelected("pulmonary_trunk") || isSelected("lpa") || isSelected("rpa");
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#0077b6") : new THREE.Color("#2b749d"),
      emissive: sel ? new THREE.Color("#003049") : new THREE.Color("#022642"),
      emissiveIntensity: sel ? 0.55 : 0.25,
      roughness: 0.52,
      metalness: 0.04,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      transmission: isXray ? 0.75 : 0.08,
      thickness: 0.8,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes,
      side: THREE.DoubleSide
    });
  }, [displayMode, clippingPlanes, isWireframe, isXray, selectedNodeId]);

  const coronaryArteryMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ff2a45"),
      emissive: new THREE.Color("#700615"),
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.05,
      clearcoat: 0.18,
      clearcoatRoughness: 0.35,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes
    });
  }, [isWireframe, clippingPlanes]);

  const coronaryVeinMat = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#1e6091"),
      emissive: new THREE.Color("#052238"),
      emissiveIntensity: 0.30,
      roughness: 0.48,
      metalness: 0.05,
      clearcoat: 0.18,
      clearcoatRoughness: 0.35,
      wireframe: isWireframe,
      clippingPlanes: clippingPlanes
    });
  }, [isWireframe, clippingPlanes]);

  const papillaryMat = useMemo(() => {
    const sel = isSelected("papillary_muscles");
    return new THREE.MeshPhysicalMaterial({
      color: sel ? new THREE.Color("#e63946") : new THREE.Color("#b81d2e"),
      emissive: sel ? new THREE.Color("#700615") : new THREE.Color("#4a0710"),
      emissiveIntensity: sel ? 0.5 : 0.22,
      roughness: 0.60,
      clearcoat: 0.08,
      clippingPlanes: clippingPlanes
    });
  }, [clippingPlanes, selectedNodeId]);

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]}>
      {/* 1. Left Ventricle Epicardium */}
      <mesh
        ref={lvOuterRef}
        geometry={outerGeometry}
        material={epicardiumMaterial}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(CARDIAC_NODES.lv);
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* 2. Left Ventricle Endocardium (Inner Cavity) */}
      <mesh
        ref={lvInnerRef}
        geometry={innerGeometry}
        material={endocardiumMaterial}
        castShadow={false}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(CARDIAC_NODES.lv);
        }}
      />

      {/* 3. Right Ventricle with Infundibulum / Conus Arteriosus */}
      <mesh
        ref={rvRef}
        geometry={rvGeometry}
        material={rvMaterial}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(CARDIAC_NODES.rv);
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* 4. Left Atrium with LAA & 4 Pulmonary Veins */}
      <group ref={laRef} position={[-0.45, 1.7, -0.65]}>
        <mesh
          geometry={laGeos.laGeo}
          material={laMaterial}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.la);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={laGeos.laaGeo}
          material={laMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.laa);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={laGeos.lspvGeo}
          material={venousVesselMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.pulmonary_veins);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={laGeos.lipvGeo}
          material={venousVesselMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.pulmonary_veins);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={laGeos.rspvGeo}
          material={venousVesselMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.pulmonary_veins);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={laGeos.ripvGeo}
          material={venousVesselMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.pulmonary_veins);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>

      {/* 5. Right Atrium with RAA & SVC / IVC Conduits */}
      <group ref={raRef} position={[1.15, 1.5, -0.1]}>
        <mesh
          geometry={raGeos.raGeo}
          material={raMaterial}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.ra);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={raGeos.raaGeo}
          material={raMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.raa);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={raGeos.svcGeo}
          material={venousVesselMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.svc);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={raGeos.ivcGeo}
          material={venousVesselMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.ivc);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>

      {/* 6. Ascending Aorta & Arch Branches */}
      <group ref={aortaRef}>
        <mesh
          geometry={aortaGeos.aortaGeo}
          material={aortaMaterial}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.aorta);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        {/* Sinuses of Valsalva Bulbs */}
        <mesh
          geometry={aortaGeos.lccBulb}
          material={aortaMaterial}
          position={[-0.18, 1.48, 0.08]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.aorta_sinus);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={aortaGeos.rccBulb}
          material={aortaMaterial}
          position={[0.14, 1.48, 0.12]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.aorta_sinus);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={aortaGeos.nccBulb}
          material={aortaMaterial}
          position={[-0.02, 1.48, -0.12]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.aorta_sinus);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        {/* 3 Supra-Aortic Branches */}
        <mesh
          geometry={aortaGeos.brachioGeo}
          material={aortaMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.brachiocephalic);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={aortaGeos.carotidGeo}
          material={aortaMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.carotid);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={aortaGeos.subclavGeo}
          material={aortaMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.subclavian);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>

      {/* 7. Pulmonary Trunk & Bifurcation */}
      <group ref={pulmonaryRef}>
        <mesh
          geometry={pulmonaryGeos.trunkGeo}
          material={pulmonaryMaterial}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.pulmonary_trunk);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={pulmonaryGeos.lpaGeo}
          material={pulmonaryMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.lpa);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={pulmonaryGeos.rpaGeo}
          material={pulmonaryMaterial}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.rpa);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>

      {/* 8. 3D Coronary Artery & Vein Network */}
      <group ref={vesselsRef}>
        <mesh
          geometry={coronaryVessels.ladGeo}
          material={coronaryArteryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.lad);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={coronaryVessels.d1Geo}
          material={coronaryArteryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.lad_d1);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={coronaryVessels.d2Geo}
          material={coronaryArteryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.lad_d2);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />

        <mesh
          geometry={coronaryVessels.rcaGeo}
          material={coronaryArteryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.rca);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
        <mesh
          geometry={coronaryVessels.margGeo}
          material={coronaryArteryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.rca_marginal);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />

        <mesh
          geometry={coronaryVessels.lcxGeo}
          material={coronaryArteryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.lcx);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />

        <mesh
          geometry={coronaryVessels.gcvGeo}
          material={coronaryVeinMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.gcv);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>

      {/* 9. Internal Papillary Muscles */}
      <group position={[-0.45, 0.05, 0.35]} rotation={[0.2, 0.3, 0]}>
        <mesh
          geometry={papillaryALGeo}
          material={papillaryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.papillary_muscles);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>
      <group position={[0.25, 0.05, -0.45]} rotation={[-0.2, -0.3, 0]}>
        <mesh
          geometry={papillaryPMGeo}
          material={papillaryMat}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(CARDIAC_NODES.papillary_muscles);
          }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      </group>
    </group>
  );
}
