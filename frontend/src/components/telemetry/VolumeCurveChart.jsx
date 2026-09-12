import React, { useRef, useEffect } from "react";

/**
 * Real-Time Canvas Volume-Time V(t) & Pressure-Time P(t) Telemetry Chart
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
    const height = 150;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Layout
    const padding = { top: 20, right: 40, bottom: 25, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVol = Math.max(160, (studyParams.edv || 120) * 1.15);
    const minVol = 0;

    // Draw Background Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
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

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(yVal)}`, padding.left - 8, y + 3);
    }

    // Phase markers (Systole / Diastole divider at t = 0.38)
    const systoleEndX = padding.left + 0.38 * chartW;
    ctx.fillStyle = "rgba(255, 45, 85, 0.08)";
    ctx.fillRect(padding.left, padding.top, 0.38 * chartW, chartH);

    ctx.fillStyle = "rgba(0, 240, 255, 0.04)";
    ctx.fillRect(systoleEndX, padding.top, 0.62 * chartW, chartH);

    ctx.fillStyle = "rgba(255, 45, 85, 0.6)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SYSTOLE", padding.left + 0.19 * chartW, padding.top - 6);

    ctx.fillStyle = "rgba(0, 240, 255, 0.6)";
    ctx.fillText("DIASTOLE", padding.left + 0.69 * chartW, padding.top - 6);

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
    gradient.addColorStop(0, "rgba(0, 240, 255, 0.3)");
    gradient.addColorStop(1, "rgba(0, 240, 255, 0.0)");

    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Current Phase Vertical Cursor
    const cursorX = padding.left + currentPhase * chartW;
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(cursorX, padding.top - 8);
    ctx.lineTo(cursorX, padding.top + chartH + 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live Cursor Dot on Curve
    const currentPt = telemetryData.find((p) => Math.abs(p.t - currentPhase) < 0.015) || telemetryData[0];
    if (currentPt) {
      const dotY = padding.top + chartH - ((currentPt.volume - minVol) / (maxVol - minVol)) * chartH;
      ctx.fillStyle = "#ffea00";
      ctx.beginPath();
      ctx.arc(cursorX, dotY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Units label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("LV Vol (mL)", padding.left, padding.top - 6);

    ctx.textAlign = "right";
    ctx.fillText("Phase: 0% → 100%", padding.left + chartW, padding.top + chartH + 16);
  }, [telemetryData, currentPhase, studyParams]);

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-header">
        <span className="telemetry-title">Continuous Left Ventricle Volume Curve $V(t)$</span>
        <span className="telemetry-badge">Kinematic Telemetry</span>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}
