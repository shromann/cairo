import React, { useMemo } from "react";
import * as THREE from "three";
import { getStrainColor } from "../../data/kinematics";

/**
 * AHA 17-Segment 3D Myocardial Strain Heatmap Overlay
 * Renders 17 color-coded segments mapped around the left ventricular myocardial wall
 * based on PanEcho predicted regional strain and wall motion abnormalities.
 */
export function AHA17Heatmap({
  strains = [],
  visible = true,
  clippingPlanes = [],
  highlightSegment = null,
  onSelectSegment = () => {}
}) {
  if (!visible) return null;

  // Build the 17 geometric sectors mapped to polar coordinates along the LV prolate spheroid
  const segmentsGeo = useMemo(() => {
    const list = [];
    const strainMap = new Map((strains || []).map((s) => [s.segment, s]));

    // Segment definitions (ring: "basal" | "mid" | "apical" | "apex", angleRange: [startRad, endRad])
    // Base is at y ~ 0.8 to 1.4, Mid is at y ~ 0.0 to 0.8, Apical is at y ~ -0.8 to 0.0, Apex is at y < -0.8
    const basalAngles = [
      { seg: 1, name: "Basal Anterior", start: 0, end: Math.PI / 3 },
      { seg: 2, name: "Basal Anteroseptal", start: Math.PI / 3, end: (2 * Math.PI) / 3 },
      { seg: 3, name: "Basal Inferoseptal", start: (2 * Math.PI) / 3, end: Math.PI },
      { seg: 4, name: "Basal Inferior", start: Math.PI, end: (4 * Math.PI) / 3 },
      { seg: 5, name: "Basal Inferolateral", start: (4 * Math.PI) / 3, end: (5 * Math.PI) / 3 },
      { seg: 6, name: "Basal Anterolateral", start: (5 * Math.PI) / 3, end: 2 * Math.PI }
    ];

    const midAngles = [
      { seg: 7, name: "Mid Anterior", start: 0, end: Math.PI / 3 },
      { seg: 8, name: "Mid Anteroseptal", start: Math.PI / 3, end: (2 * Math.PI) / 3 },
      { seg: 9, name: "Mid Inferoseptal", start: (2 * Math.PI) / 3, end: Math.PI },
      { seg: 10, name: "Mid Inferior", start: Math.PI, end: (4 * Math.PI) / 3 },
      { seg: 11, name: "Mid Inferolateral", start: (4 * Math.PI) / 3, end: (5 * Math.PI) / 3 },
      { seg: 12, name: "Mid Anterolateral", start: (5 * Math.PI) / 3, end: 2 * Math.PI }
    ];

    const apicalAngles = [
      { seg: 13, name: "Apical Anterior", start: -Math.PI / 4, end: Math.PI / 4 },
      { seg: 14, name: "Apical Septal", start: Math.PI / 4, end: (3 * Math.PI) / 4 },
      { seg: 15, name: "Apical Inferior", start: (3 * Math.PI) / 4, end: (5 * Math.PI) / 4 },
      { seg: 16, name: "Apical Lateral", start: (5 * Math.PI) / 4, end: (7 * Math.PI) / 4 }
    ];

    const createSpheroidPatch = (yMin, yMax, thetaStart, thetaLength, radius = 1.63) => {
      const phiStart = Math.acos(Math.max(-1, Math.min(1, yMax / (radius * 1.45))));
      const phiEnd = Math.acos(Math.max(-1, Math.min(1, yMin / (radius * 1.45))));
      const phiLength = Math.max(0.01, phiEnd - phiStart);

      const geo = new THREE.SphereGeometry(radius, 16, 12, thetaStart, thetaLength, phiStart, phiLength);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i) * 1.45;
        let z = pos.getZ(i);
        if (y < 0) {
          const taper = 1.0 + y * 0.22;
          x *= Math.max(0.2, taper);
          z *= Math.max(0.2, taper);
        }
        if (x > 0.6) {
          x = 0.6 + (x - 0.6) * 0.7;
        }
        pos.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // 1. Basal Segments (1 - 6)
    basalAngles.forEach((b) => {
      const data = strainMap.get(b.seg) || { strain: -18, wallMotion: "Normokinetic" };
      list.push({
        id: b.seg,
        name: b.name,
        strain: data.strain,
        wallMotion: data.wallMotion,
        geometry: createSpheroidPatch(0.6, 1.4, b.start, b.end - b.start)
      });
    });

    // 2. Mid Segments (7 - 12)
    midAngles.forEach((m) => {
      const data = strainMap.get(m.seg) || { strain: -18, wallMotion: "Normokinetic" };
      list.push({
        id: m.seg,
        name: m.name,
        strain: data.strain,
        wallMotion: data.wallMotion,
        geometry: createSpheroidPatch(-0.2, 0.6, m.start, m.end - m.start)
      });
    });

    // 3. Apical Segments (13 - 16)
    apicalAngles.forEach((a) => {
      const data = strainMap.get(a.seg) || { strain: -18, wallMotion: "Normokinetic" };
      list.push({
        id: a.seg,
        name: a.name,
        strain: data.strain,
        wallMotion: data.wallMotion,
        geometry: createSpheroidPatch(-1.1, -0.2, a.start, a.end - a.start)
      });
    });

    // 4. Apex (Segment 17)
    const apexData = strainMap.get(17) || { strain: -18, wallMotion: "Normokinetic" };
    list.push({
      id: 17,
      name: "Apex",
      strain: apexData.strain,
      wallMotion: apexData.wallMotion,
      geometry: createSpheroidPatch(-1.8, -1.1, 0, Math.PI * 2)
    });

    return list;
  }, [strains]);

  return (
    <group position={[0, -0.2, 0]} rotation={[0.15, -0.25, 0.08]}>
      {segmentsGeo.map((seg) => {
        const color = getStrainColor(seg.strain);
        const isSelected = highlightSegment === seg.id;

        return (
          <mesh
            key={seg.id}
            geometry={seg.geometry}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSegment(seg);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <meshStandardMaterial
              color={new THREE.Color(color)}
              emissive={new THREE.Color(color)}
              emissiveIntensity={isSelected ? 0.8 : 0.35}
              roughness={0.2}
              metalness={0.1}
              transparent
              opacity={isSelected ? 0.95 : 0.78}
              wireframe={false}
              clippingPlanes={clippingPlanes}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
