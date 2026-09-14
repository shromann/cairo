import React from "react";
import { getStrainColor } from "../../data/kinematics";

/**
 * 2D AHA 17-Segment Polar Bullseye Strain Diagram (Instatic Style)
 */
export function AHABullseyePlot({
  strains = [],
  highlightSegment = null,
  onSelectSegment = () => {}
}) {
  const strainMap = new Map((strains || []).map((s) => [s.segment, s]));

  // SVG dimensions
  const size = 190;
  const center = size / 2;
  const rApex = 17;
  const rApical = 40;
  const rMid = 65;
  const rBasal = 88;

  // Helper to generate SVG polar arc path
  const describeArc = (x, y, innerR, outerR, startAngle, endAngle) => {
    const startRad = (startAngle - 90) * (Math.PI / 180.0);
    const endRad = (endAngle - 90) * (Math.PI / 180.0);

    const x1 = x + outerR * Math.cos(startRad);
    const y1 = y + outerR * Math.sin(startRad);
    const x2 = x + outerR * Math.cos(endRad);
    const y2 = y + outerR * Math.sin(endRad);

    const x3 = x + innerR * Math.cos(endRad);
    const y3 = y + innerR * Math.sin(endRad);
    const x4 = x + innerR * Math.cos(startRad);
    const y4 = y + innerR * Math.sin(startRad);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M", x1, y1,
      "A", outerR, outerR, 0, largeArcFlag, 1, x2, y2,
      "L", x3, y3,
      "A", innerR, innerR, 0, largeArcFlag, 0, x4, y4,
      "Z"
    ].join(" ");
  };

  // Basal 1-6
  const basalSegs = [
    { seg: 1, start: -30, end: 30 },
    { seg: 2, start: 30, end: 90 },
    { seg: 3, start: 90, end: 150 },
    { seg: 4, start: 150, end: 210 },
    { seg: 5, start: 210, end: 270 },
    { seg: 6, start: 270, end: 330 }
  ];

  // Mid 7-12
  const midSegs = [
    { seg: 7, start: -30, end: 30 },
    { seg: 8, start: 30, end: 90 },
    { seg: 9, start: 90, end: 150 },
    { seg: 10, start: 150, end: 210 },
    { seg: 11, start: 210, end: 270 },
    { seg: 12, start: 270, end: 330 }
  ];

  // Apical 13-16
  const apicalSegs = [
    { seg: 13, start: -45, end: 45 },
    { seg: 14, start: 45, end: 135 },
    { seg: 15, start: 135, end: 225 },
    { seg: 16, start: 225, end: 315 }
  ];

  const renderSegment = (segId, pathD, labelX, labelY) => {
    const data = strainMap.get(segId) || { strain: -18, wallMotion: "Normokinetic", name: `Segment ${segId}` };
    const color = getStrainColor(data.strain);
    const isSelected = highlightSegment === segId;

    return (
      <g
        key={segId}
        onClick={() => onSelectSegment(data)}
        style={{ cursor: "pointer" }}
        className="bullseye-segment-group"
      >
        <path
          d={pathD}
          fill={color}
          stroke={isSelected ? "#ffffff" : "#121214"}
          strokeWidth={isSelected ? 2.2 : 1.0}
          opacity={isSelected ? 1.0 : 0.9}
        />
        <text
          x={labelX}
          y={labelY}
          fill="#09090b"
          fontSize="8.5"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
        >
          {segId}
        </text>
      </g>
    );
  };

  return (
    <div className="bullseye-container">
      <div className="bullseye-header">
        <span className="telemetry-title">AHA 17-Segment Polar Bullseye</span>
        <span className="telemetry-badge">Strain</span>
      </div>

      <div className="bullseye-svg-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} className="bullseye-svg">
          {/* Basal Ring (1-6) */}
          {basalSegs.map((b) => {
            const pathD = describeArc(center, center, rMid, rBasal, b.start, b.end);
            const midAngle = ((b.start + b.end) / 2 - 90) * (Math.PI / 180);
            const lx = center + ((rMid + rBasal) / 2) * Math.cos(midAngle);
            const ly = center + ((rMid + rBasal) / 2) * Math.sin(midAngle);
            return renderSegment(b.seg, pathD, lx, ly);
          })}

          {/* Mid Ring (7-12) */}
          {midSegs.map((m) => {
            const pathD = describeArc(center, center, rApical, rMid, m.start, m.end);
            const midAngle = ((m.start + m.end) / 2 - 90) * (Math.PI / 180);
            const lx = center + ((rApical + rMid) / 2) * Math.cos(midAngle);
            const ly = center + ((rApical + rMid) / 2) * Math.sin(midAngle);
            return renderSegment(m.seg, pathD, lx, ly);
          })}

          {/* Apical Ring (13-16) */}
          {apicalSegs.map((a) => {
            const pathD = describeArc(center, center, rApex, rApical, a.start, a.end);
            const midAngle = ((a.start + a.end) / 2 - 90) * (Math.PI / 180);
            const lx = center + ((rApex + rApical) / 2) * Math.cos(midAngle);
            const ly = center + ((rApex + rApical) / 2) * Math.sin(midAngle);
            return renderSegment(a.seg, pathD, lx, ly);
          })}

          {/* Apex Circle (Segment 17) */}
          {(() => {
            const apexData = strainMap.get(17) || { strain: -18, wallMotion: "Normokinetic", name: "Apex" };
            const apexColor = getStrainColor(apexData.strain);
            const isSelected = highlightSegment === 17;
            return (
              <g
                onClick={() => onSelectSegment(apexData)}
                style={{ cursor: "pointer" }}
                className="bullseye-segment-group"
              >
                <circle
                  cx={center}
                  cy={center}
                  r={rApex}
                  fill={apexColor}
                  stroke={isSelected ? "#ffffff" : "#121214"}
                  strokeWidth={isSelected ? 2.2 : 1.0}
                  opacity={isSelected ? 1.0 : 0.9}
                />
                <text
                  x={center}
                  y={center}
                  fill="#09090b"
                  fontSize="8.5"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  17
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Legend */}
        <div className="bullseye-legend">
          <div className="legend-item"><span className="legend-dot dot-green"></span> &lt; -18% (Normal)</div>
          <div className="legend-item"><span className="legend-dot dot-amber"></span> -12% to -17% (Mild)</div>
          <div className="legend-item"><span className="legend-dot dot-red"></span> &gt; -11% (Akinetic)</div>
        </div>
      </div>
    </div>
  );
}
