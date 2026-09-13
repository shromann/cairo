import React, { useRef, useEffect } from "react";

/**
 * Real-Time Canvas Volume-Time V(t) Telemetry Chart (Instatic Palette)
 */
export function VolumeCurveChart({
  telemetryData = [],
  currentPhase = 0,
  studyParams = {}
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetryData.length) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement.clientWidth;
    const height = 175;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Layout with generous padding and vertical clearance
    const padding = { top: 28, right: 20, bottom: 24, left: 42 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVol = Math.max(160, (studyParams.edv || 120) * 1.15);
    const minVol = 0;

    // Draw Background Grid Lines
    ctx.strokeStyle = "#232328";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const yVal = minVol + (i / gridSteps) * (maxVol - minVol);
      const y = padding.top + chartH - (i / gridSteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = "#71717a";
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(yVal)}`, padding.left - 6, y + 3);
    }

    // Phase markers (Systole / Diastole divider at t = 0.38)
    const systoleEndX = padding.left + 0.38 * chartW;
    ctx.fillStyle = "rgba(248, 113, 113, 0.04)";
    ctx.fillRect(padding.left, padding.top, 0.38 * chartW, chartH);

    ctx.fillStyle = "rgba(155, 220, 255, 0.02)";
    ctx.fillRect(systoleEndX, padding.top, 0.62 * chartW, chartH);

    ctx.fillStyle = "#f87171";
    ctx.font = "8.5px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SYSTOLE", padding.left + 0.19 * chartW, padding.top - 8);

    ctx.fillStyle = "#9bdcff";
    ctx.fillText("DIASTOLE", padding.left + 0.69 * chartW, padding.top - 8);

    // Draw V(t) Volume Curve
    ctx.beginPath();
    telemetryData.forEach((pt, idx) => {
      const x = padding.left + pt.t * chartW;
      const y = padding.top + chartH - ((pt.volume - minVol) / (maxVol - minVol)) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Gradient fill under volume curve
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, "rgba(155, 220, 255, 0.22)");
    gradient.addColorStop(1, "rgba(155, 220, 255, 0.0)");

    ctx.strokeStyle = "#9bdcff";
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Current Phase Vertical Cursor
    const cursorX = padding.left + currentPhase * chartW;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(cursorX, padding.top - 6);
    ctx.lineTo(cursorX, padding.top + chartH + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live Cursor Dot on Curve
    const currentPt = telemetryData.find((p) => Math.abs(p.t - currentPhase) < 0.015) || telemetryData[0];
    if (currentPt) {
      const dotY = padding.top + chartH - ((currentPt.volume - minVol) / (maxVol - minVol)) * chartH;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cursorX, dotY, 4.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Units label (positioned in y-axis gutter, completely clear of phase banners)
    ctx.fillStyle = "#71717a";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("mL", padding.left - 6, padding.top - 8);

    ctx.textAlign = "right";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.fillText("0% → 100%", padding.left + chartW, padding.top + chartH + 16);
  }, [telemetryData, currentPhase, studyParams]);

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-header">
        <span className="telemetry-title">Continuous Left Ventricle Volume V(t)</span>
        <span className="telemetry-badge">Kinematic Telemetry</span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}
