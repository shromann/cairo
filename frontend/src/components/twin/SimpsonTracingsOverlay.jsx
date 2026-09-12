import React, { useMemo } from "react";
import * as THREE from "three";
import heartData from "../../data/heartData.json";

/**
 * 3D Visualization of Simpson's Method 20-Disc Tracings from VolumeTracings.csv
 * Renders the clinical transverse disc contours and central long-axis contour
 * interpolating dynamically between End-Diastole (Frame 112) and End-Systole (Frame 134).
 */
export function SimpsonTracingsOverlay({
  visible = true,
  f_contraction = 0,
  clippingPlanes = []
}) {
  if (!visible) return null;

  const { endDiastole = [], endSystole = [] } = heartData.simpsonTracings || {};

  // Normalize image pixel coordinates (112x112 space) to 3D heart local space
  // In EchoNet, (x, y) ranges [0, 112]. The apex is at y ~ 20, base at y ~ 70.
  const discGeometries = useMemo(() => {
    if (!endDiastole.length || !endSystole.length) return [];

    const rings = [];
    const numDiscs = Math.min(endDiastole.length, endSystole.length);

    for (let i = 1; i < numDiscs; i++) {
      const ed = endDiastole[i];
      const es = endSystole[i];

      // Interpolate between ED and ES coordinates
      const t = f_contraction;
      const x1 = ed.x1 + (es.x1 - ed.x1) * t;
      const y1 = ed.y1 + (es.y1 - ed.y1) * t;
      const x2 = ed.x2 + (es.x2 - ed.x2) * t;
      const y2 = ed.y2 + (es.y2 - ed.y2) * t;

      // Disc center in 3D
      const cx = (x1 + x2) / 2.0;
      const cy = (y1 + y2) / 2.0;
      const diameter = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const radius = Math.max(0.05, diameter / 2.0);

      // Scale to 3D model coordinates
      const scaleFactor = 0.055;
      const posX = (cx - 50) * scaleFactor * 0.7;
      const posY = (45 - cy) * scaleFactor * 1.35; // Apex at top of 2D image is -y in 3D
      const posZ = 0;
      const rad3D = radius * scaleFactor;

      // Build 3D circular ring for the disc
      const curve = new THREE.EllipseCurve(
        0,
        0,
        rad3D,
        rad3D * 0.85, // slight lateral aspect
        0,
        2 * Math.PI,
        false,
        0
      );
      const points = curve.getPoints(24);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, 0, p.y))
      );

      rings.push({
        id: i,
        geometry: ringGeo,
        position: [posX, posY, posZ],
        radius: rad3D
      });
    }

    return rings;
  }, [endDiastole, endSystole, f_contraction]);

  // Central Long-Axis line
  const longAxisGeometry = useMemo(() => {
    if (!endDiastole.length || !endSystole.length) return null;
    const edAxis = endDiastole[0];
    const esAxis = endSystole[0];
    const t = f_contraction;

    const scaleFactor = 0.055;
    const pApex = new THREE.Vector3(
      ((edAxis.x1 + (esAxis.x1 - edAxis.x1) * t) - 50) * scaleFactor * 0.7,
      (45 - (edAxis.y1 + (esAxis.y1 - edAxis.y1) * t)) * scaleFactor * 1.35,
      0
    );
    const pBase = new THREE.Vector3(
      ((edAxis.x2 + (esAxis.x2 - edAxis.x2) * t) - 50) * scaleFactor * 0.7,
      (45 - (edAxis.y2 + (esAxis.y2 - edAxis.y2) * t)) * scaleFactor * 1.35,
      0
    );

    return new THREE.BufferGeometry().setFromPoints([pApex, pBase]);
  }, [endDiastole, endSystole, f_contraction]);

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]}>
      {/* 1. Transverse 20-Disc Contour Rings */}
      {discGeometries.map((disc) => (
        <line key={disc.id} geometry={disc.geometry} position={disc.position}>
          <lineBasicMaterial
            color="#00f0ff"
            transparent
            opacity={0.75}
            clippingPlanes={clippingPlanes}
          />
        </line>
      ))}

      {/* 2. Central Long Axis Line */}
      {longAxisGeometry && (
        <line geometry={longAxisGeometry}>
          <lineBasicMaterial
            color="#ffea00"
            linewidth={2}
            transparent
            opacity={0.85}
            clippingPlanes={clippingPlanes}
          />
        </line>
      )}
    </group>
  );
}
