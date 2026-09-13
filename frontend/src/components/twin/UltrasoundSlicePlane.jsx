import React, { useMemo } from "react";
import * as THREE from "three";
import { useHeartManifest } from "../../lib/heartAsset";
import { DEFAULT_FRAME, localPointToScene, localDirToScene } from "../../lib/heartFrame";

const SECTOR_DEPTH = 5.6;
const SECTOR_HALF_ANGLE = (42 * Math.PI) / 180; // 84 deg field of view
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/**
 * Probe placement per view, in heart-local space, from the manifest frame.
 * Returns { origin, beam, normal }: transducer position, beam direction (sector centre line) and the
 * fan-plane normal. Sector geometry is authored with its apex at the origin beaming +Y in the XY plane.
 *
 *  A4C / A2C  apical window: probe just below the LV apex, beaming up the long axis toward the base.
 *             A4C plane contains the long axis and the RV; A2C is rotated ~60 deg about the long axis.
 *  PLAX       parasternal window: probe anterior + superior, beam toward the LV centre, fan plane
 *             contains the long axis (aortic root + mitral valve are in that plane).
 *  PSAX       same window as PLAX, fan rotated 90 deg about the beam -> short-axis ring.
 */
export function getProbePlacement(viewMode, frame = DEFAULT_FRAME) {
  const c = V(frame.lvCentre);
  const up = V(frame.lvAxis).multiplyScalar(-1).normalize();            // apex->base (manifest axis points to the apex)
  const half = (frame.lvLength || 3.2) / 2;
  const rv = V(frame.rvInsertionDir); rv.addScaledVector(up, -rv.dot(up)).normalize();   // RV direction, perpendicular to long axis
  const ant = V(frame.anteriorDir || DEFAULT_FRAME.anteriorDir); ant.addScaledVector(up, -ant.dot(up)).normalize();

  if (viewMode === "A4C" || viewMode === "A2C") {
    const origin = c.clone().addScaledVector(up, -(half + 0.55));      // just below the apex
    let lateral = rv.clone();
    if (viewMode === "A2C") {
      // rotate ~60 deg about the long axis, choosing the direction that swings toward the anterior wall
      const plus = rv.clone().applyAxisAngle(up, Math.PI / 3), minus = rv.clone().applyAxisAngle(up, -Math.PI / 3);
      lateral = plus.dot(ant) >= minus.dot(ant) ? plus : minus;
    }
    return { origin, beam: up.clone(), normal: new THREE.Vector3().crossVectors(up, lateral).normalize() };
  }
  if (viewMode === "PLAX" || viewMode === "PSAX") {
    const R = frame.heartRadius || 2.3;
    const origin = c.clone().addScaledVector(ant, R * 1.25).addScaledVector(up, half * 0.55);   // anterior + toward the base
    const beam = c.clone().addScaledVector(up, 0.2).sub(origin).normalize();                     // aim at the LV
    const longAxisNormal = new THREE.Vector3().crossVectors(up, beam).normalize();               // plane containing long axis + beam
    if (viewMode === "PLAX") return { origin, beam, normal: longAxisNormal };
    const shortAxisNormal = new THREE.Vector3().crossVectors(beam, longAxisNormal).normalize();  // rotated 90 deg about the beam
    return { origin, beam, normal: shortAxisNormal };
  }
  return null;
}

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
    const apex = new THREE.Vector3(0, 0, 0); // transducer at the group origin; the group is placed per view
    const depth = SECTOR_DEPTH;
    const halfAngle = SECTOR_HALF_ANGLE;

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
    const apex = new THREE.Vector3(0, 0, 0);
    const halfAngle = SECTOR_HALF_ANGLE;

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

  // 4. Place the probe from the manifest frame (LV centroid, principal axis, RV + anterior directions),
  //    transformed through the heart root transform so it sits in the same space as the heart meshes.
  const manifest = useHeartManifest();
  const placement = useMemo(() => {
    const frame = manifest?.frame ? { ...DEFAULT_FRAME, ...manifest.frame } : DEFAULT_FRAME;
    const p = getProbePlacement(viewMode, frame);
    if (!p) return null;
    const origin = localPointToScene(p.origin.toArray());
    const beam = localDirToScene(p.beam.toArray());
    const normal = localDirToScene(p.normal.toArray());
    const x = new THREE.Vector3().crossVectors(beam, normal).normalize();   // local +X, +Y=beam, +Z=fan normal
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, beam, normal));
    return { position: origin, quaternion: q };
  }, [viewMode, manifest]);

  if (viewMode === "none" || !visible || !placement) {
    return null;
  }

  return (
    <group position={placement.position} quaternion={placement.quaternion}>
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

      {/* 4. Transducer Probe Apex Marker (at the sector apex) */}
      <mesh position={[0, -0.2, 0]}>
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
