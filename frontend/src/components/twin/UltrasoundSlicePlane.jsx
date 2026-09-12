import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * Interactive Ultrasound Slicing Plane & Beam Sector
 * Renders the 2D ultrasound scan cone (A4C, A2C, PLAX, PSAX)
 * and generates hardware clipping planes for the 3D heart meshes.
 */
export function UltrasoundSlicePlane({
  viewMode = "A4C", // "none" | "A4C" | "A2C" | "PLAX" | "PSAX"
  visible = true,
  opacity = 0.25
}) {
  // 1. Calculate clipping plane equation based on viewMode
  const clippingPlane = useMemo(() => {
    if (viewMode === "none") return null;

    if (viewMode === "A4C") {
      // Coronal slice (normal points along +Z)
      return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.1);
    } else if (viewMode === "A2C") {
      // Sagittal slice (normal points along +X)
      return new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.15);
    } else if (viewMode === "PLAX") {
      // Oblique Parasternal Long Axis slice (normal along (0.7, 0, 0.7))
      const normal = new THREE.Vector3(0.707, 0, 0.707).normalize();
      return new THREE.Plane(normal, 0.2);
    } else if (viewMode === "PSAX") {
      // Transverse Short Axis slice (normal points along +Y)
      return new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
    }
    return null;
  }, [viewMode]);

  // 2. Build 2D Ultrasound Sector Fan Geometry (80 degree fan with apex at transducer)
  const sectorGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    const numSegments = 32;
    const apex = new THREE.Vector3(0, -3.2, 0); // Transducer probe placed at apex
    const depth = 5.6;
    const halfAngle = (42 * Math.PI) / 180; // 84 deg field of view

    // Apex vertex (index 0)
    vertices.push(apex.x, apex.y, apex.z);
    uvs.push(0.5, 0);

    for (let i = 0; i <= numSegments; i++) {
      const frac = i / numSegments;
      const angle = -halfAngle + frac * (2 * halfAngle);
      const x = apex.x + depth * Math.sin(angle);
      const y = apex.y + depth * Math.cos(angle);
      const z = 0;

      vertices.push(x, y, z);
      uvs.push(frac, 1);

      if (i < numSegments) {
        indices.push(0, i + 1, i + 2);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, []);

  // 3. Grid line arcs and ray markers
  const gridLines = useMemo(() => {
    const points = [];
    const apex = new THREE.Vector3(0, -3.2, 0);
    const halfAngle = (42 * Math.PI) / 180;

    // Depth arcs at r = 2.0, 3.5, 5.0
    [2.2, 3.8, 5.4].forEach((r) => {
      const arc = [];
      for (let i = 0; i <= 30; i++) {
        const angle = -halfAngle + (i / 30) * (2 * halfAngle);
        arc.push(
          new THREE.Vector3(
            apex.x + r * Math.sin(angle),
            apex.y + r * Math.cos(angle),
            0
          )
        );
      }
      points.push(arc);
    });

    return points;
  }, []);

  if (viewMode === "none" || !visible) {
    return null;
  }

  // Transform rotation of the scan sector based on viewMode
  let rotation = [0, 0, 0];
  let position = [0, 0, 0];

  if (viewMode === "A4C") {
    rotation = [0, 0, 0];
    position = [0, 0, 0.1];
  } else if (viewMode === "A2C") {
    rotation = [0, Math.PI / 2, 0];
    position = [0.15, 0, 0];
  } else if (viewMode === "PLAX") {
    rotation = [0, Math.PI / 4, 0];
    position = [0.1, 0, 0.1];
  } else if (viewMode === "PSAX") {
    rotation = [Math.PI / 2, 0, 0];
    position = [0, -0.1, 0];
  }

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Semi-transparent Ultrasound Scan Beam Fan */}
      <mesh geometry={sectorGeometry}>
        <meshBasicMaterial
          color={new THREE.Color("#00f0ff")}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Glowing Beam Perimeter Border */}
      <mesh geometry={sectorGeometry}>
        <meshBasicMaterial
          color={new THREE.Color("#00f0ff")}
          wireframe
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Depth Range Arcs */}
      {gridLines.map((arcPoints, idx) => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
        return (
          <line key={idx} geometry={lineGeo}>
            <lineBasicMaterial
              color="#00f0ff"
              transparent
              opacity={0.4}
              linewidth={1}
            />
          </line>
        );
      })}

      {/* 4. Transducer Probe Apex Marker */}
      <mesh position={[0, -3.2, 0]}>
        <cylinderGeometry args={[0.22, 0.35, 0.45, 16]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

/**
 * Helper to get active clipping planes array for materials
 */
export function getClippingPlanesForMode(viewMode) {
  if (viewMode === "A4C") {
    return [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.1)];
  } else if (viewMode === "A2C") {
    return [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.15)];
  } else if (viewMode === "PLAX") {
    const normal = new THREE.Vector3(0.707, 0, 0.707).normalize();
    return [new THREE.Plane(normal, 0.2)];
  } else if (viewMode === "PSAX") {
    return [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1)];
  }
  return [];
}
