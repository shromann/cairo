import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { adaptStudy } from "../data/panEchoData";
import { api } from "../lib/api";
import { getCardiacKinematics, generateWiggersTelemetry } from "../data/kinematics";

import { CardiacTwinCanvas } from "./twin/CardiacTwinCanvas";
import { MetricBadges } from "./telemetry/MetricBadges";
import { VolumeCurveChart } from "./telemetry/VolumeCurveChart";
import { WiggersDiagram } from "./telemetry/WiggersDiagram";
import { AHABullseyePlot } from "./telemetry/AHABullseyePlot";
import { PanEchoDrawer } from "./clinical/PanEchoDrawer";
import { VideoSyncPlayer } from "./clinical/VideoSyncPlayer";
import { CardiacControls } from "./controls/CardiacControls";
import { StudySelector } from "./controls/StudySelector";
import { DisplayModeControls } from "./controls/DisplayModeControls";

import { Heart, Activity, Sparkles, Sliders, FileText, Play, Layers, X, Info } from "lucide-react";

/**
 * Main Interactive Cardiac Digital Twin Dashboard
 */
export function CardiacTwinDashboard() {
  // 1. Study & Patient State — cohort and predictions come from the backend API
  const [cohort, setCohort] = useState([]);
  const [currentStudy, setCurrentStudy] = useState(null);
  const [studyDetail, setStudyDetail] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [inferring, setInferring] = useState(false);

  useEffect(() => {
    api.listStudies(60)
      .then((rows) => { setCohort(rows); if (rows.length) setCurrentStudy(rows[0]); })
      .catch((e) => setApiError(String(e)));
  }, []);

  useEffect(() => {
    if (!currentStudy) return;
    setStudyDetail(null);
    api.getStudy(currentStudy.id).then(setStudyDetail).catch((e) => setApiError(String(e)));
  }, [currentStudy?.id]);

  const runInference = useCallback(async () => {
    if (!currentStudy) return;
    setInferring(true);
    try {
      await api.inferStudy(currentStudy.id);
      const [detail, rows] = await Promise.all([api.getStudy(currentStudy.id), api.listStudies(60)]);
      setStudyDetail(detail); setCohort(rows);
    } catch (e) { setApiError(String(e)); }
    finally { setInferring(false); }
  }, [currentStudy?.id]);

  const studyResults = useMemo(() => adaptStudy(studyDetail), [studyDetail]);
  const video0 = studyDetail?.videos?.[0];
  const videoSrc = api.absolute(video0?.stream);
  const videoFps = video0?.fps || 50;
  const videoFrames = video0?.frame_count || 200;

  // 2. Cardiac Clock & Kinematics State
  const [phase, setPhase] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [bpm, setBpm] = useState(70);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

  // 3. 3D Viewport Configuration State
  const [displayMode, setDisplayMode] = useState("solid"); // "solid" | "xray" | "wireframe" | "heatmap"
  const [viewMode, setViewMode] = useState("none");       // "none" | "A4C" | "A2C" | "PLAX" | "PSAX"
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showValves, setShowValves] = useState(true);
  const [showSimpsonTracings, setShowSimpsonTracings] = useState(false);
  const [highlightSegment, setHighlightSegment] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // 4. Sidebar Active Tab
  const [activeTab, setActiveTab] = useState("clinical"); // "clinical" | "telemetry" | "video"

  // Compute instantaneous kinematics
  // Twin is driven by PanEcho's predicted EF/EDV/ESV when available, else the dataset labels.
  const studyParams = useMemo(() => {
    const ef = studyResults.ef ?? currentStudy?.ef ?? 55;
    const edv = studyResults.edv ?? currentStudy?.edv ?? 100;
    const esv = studyResults.esv ?? currentStudy?.esv ?? 45;
    return { ef, edv, esv, gls: studyResults.gls ?? -18.5, heartRate: bpm, strokeVolume: edv - esv };
  }, [currentStudy, studyResults, bpm]);

  const kinematics = useMemo(() => {
    return getCardiacKinematics(phase, studyParams);
  }, [phase, studyParams]);

  const telemetryData = useMemo(() => {
    return generateWiggersTelemetry(studyParams, 100);
  }, [studyParams]);

  // RequestAnimationFrame Animation Loop for Continuous Cardiac Cycle
  const lastTimeRef = useRef(performance.now());
  const isPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm);
  const speedRef = useRef(speedMultiplier);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    bpmRef.current = bpm;
    speedRef.current = speedMultiplier;
  }, [isPlaying, bpm, speedMultiplier]);

  useEffect(() => {
    let animId;
    const animate = (time) => {
      const deltaSec = (time - lastTimeRef.current) / 1000.0;
      lastTimeRef.current = time;

      if (isPlayingRef.current) {
        const cycleDurationSec = 60.0 / bpmRef.current;
        const phaseDelta = (deltaSec / cycleDurationSec) * speedRef.current;
        setPhase((prev) => (prev + phaseDelta) % 1.0);
      }

      animId = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSeekPhase = useCallback((targetPhase) => {
    setPhase(((targetPhase % 1) + 1) % 1);
  }, []);

  const handleStepPhase = useCallback((delta) => {
    setPhase((prev) => ((prev + delta) % 1 + 1) % 1);
  }, []);

  const handleSelectSegment = useCallback((seg) => {
    setHighlightSegment(seg.id === highlightSegment ? null : seg.id);
  }, [highlightSegment]);

  const handleSelectNode = useCallback((node) => {
    setSelectedNode((prev) => (prev?.id === node?.id ? null : node));
  }, []);

  return (
    <div className="cardiac-twin-root">
      {/* Top Brand Header (Instatic Studio Chrome) */}
      <header className="cardiac-header">
        <div className="brand-group">
          <div className="heart-logo-wrap">
            <Heart size={16} className="pulse-heart text-crimson" />
          </div>
          <div className="brand-text-block">
            <h1 className="brand-title">CAIRO</h1>
            <span className="brand-sub">Cardiac Digital Twin &amp; PanEcho Engine</span>
          </div>
        </div>

        <div className="header-actions">
          <StudySelector
            cohort={cohort}
            selectedStudyId={currentStudy?.id || ""}
            onSelectStudy={(study) => {
              setCurrentStudy(study);
              setHighlightSegment(null);
              setSelectedNode(null);
            }}
          />

          <button
            className="model-tag-badge"
            onClick={runInference}
            disabled={inferring || !currentStudy}
            title={studyResults.hasPredictions ? "Re-run PanEcho on this study" : "Run PanEcho on this study"}
            style={{ cursor: inferring ? "wait" : "pointer" }}
          >
            <Sparkles size={13} className="accent-icon" />
            <span>{inferring ? "Running PanEcho…" : studyResults.hasPredictions ? "PanEcho: scored" : "Run PanEcho"}</span>
          </button>
          {apiError && <span className="overlay-badge" style={{ color: "#f87171" }}>API: {apiError}</span>}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="dashboard-grid">
        {/* Left Column: 3D Viewport & Direct Controls */}
        <div className="viewport-column">
          {/* Top Vital Badges */}
          <MetricBadges studyParams={studyParams} kinematics={kinematics} />

          {/* 3D React Three Fiber Viewport */}
          <div className="r3f-canvas-wrapper">
            <CardiacTwinCanvas
              kinematics={kinematics}
              strains={studyResults.aha17Strains}
              displayMode={displayMode}
              viewMode={viewMode}
              showHeatmap={showHeatmap}
              showValves={showValves}
              showSimpsonTracings={showSimpsonTracings}
              showSlicePlane={true}
              highlightSegment={highlightSegment}
              selectedNodeId={selectedNode?.id}
              onSelectSegment={handleSelectSegment}
              onSelectNode={handleSelectNode}
            />

            {/* Viewport Floating Info Overlays */}
            <div className="canvas-overlay-badges">
              <div className="overlay-badge">
                <span className="dot dot-cyan"></span>
                <span>{kinematics.phaseName}</span>
              </div>
              {viewMode !== "none" && (
                <div className="overlay-badge slice-badge">
                  <span>Cutting Plane: {viewMode}</span>
                </div>
              )}
              {highlightSegment && (
                <div className="overlay-badge highlight-badge">
                  <span>Segment {highlightSegment} Active</span>
                </div>
              )}
            </div>

            {/* Interactive Anatomical Node Inspector Card */}
            {selectedNode && (
              <div className="node-inspector-modal">
                <div className="node-inspector-header">
                  <div className="node-title-group">
                    <span className="node-category-tag">{selectedNode.category}</span>
                    <h3 className="node-name">{selectedNode.name}</h3>
                  </div>
                  <button
                    className="node-close-btn"
                    onClick={() => setSelectedNode(null)}
                    title="Close Inspector"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="node-inspector-body">
                  <p className="node-desc">{selectedNode.description}</p>
                  {selectedNode.pressure && (
                    <div className="node-stat-row">
                      <span className="node-stat-label">Normal Pressure:</span>
                      <span className="node-stat-val">{selectedNode.pressure}</span>
                    </div>
                  )}
                  {selectedNode.clinicalNotes && (
                    <div className="node-clinical-box">
                      <span className="node-clinical-title">Clinical Role:</span>
                      <span className="node-clinical-text">{selectedNode.clinicalNotes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Viewport Help */}
            <div className="canvas-interaction-help">
              <span>Click any heart chamber, vessel, or valve to inspect name &amp; function • Drag to Orbit</span>
            </div>
          </div>

          {/* Cardiac Timeline Controller */}
          <CardiacControls
            currentPhase={phase}
            isPlaying={isPlaying}
            bpm={bpm}
            speedMultiplier={speedMultiplier}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeekPhase={handleSeekPhase}
            onStepPhase={handleStepPhase}
            onChangeBpm={setBpm}
            onChangeSpeed={setSpeedMultiplier}
          />

          {/* Display Mode & Ultrasound Slice Toggles */}
          <DisplayModeControls
            displayMode={displayMode}
            viewMode={viewMode}
            showHeatmap={showHeatmap}
            showValves={showValves}
            showSimpsonTracings={showSimpsonTracings}
            onChangeDisplayMode={setDisplayMode}
            onChangeViewMode={setViewMode}
            onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
            onToggleValves={() => setShowValves(!showValves)}
            onToggleSimpson={() => setShowSimpsonTracings(!showSimpsonTracings)}
          />
        </div>

        {/* Right Column: Multi-tab Telemetry, Video & PanEcho Intelligence */}
        <div className="sidebar-column">
          {/* Tabs Navigation */}
          <div className="sidebar-tabs-nav">
            <button
              className={`sidebar-tab-btn ${activeTab === "clinical" ? "active" : ""}`}
              onClick={() => setActiveTab("clinical")}
            >
              <FileText size={15} />
              <span>PanEcho AI (40)</span>
            </button>
            <button
              className={`sidebar-tab-btn ${activeTab === "telemetry" ? "active" : ""}`}
              onClick={() => setActiveTab("telemetry")}
            >
              <Activity size={15} />
              <span>Telemetry Curves</span>
            </button>
            <button
              className={`sidebar-tab-btn ${activeTab === "video" ? "active" : ""}`}
              onClick={() => setActiveTab("video")}
            >
              <Play size={15} />
              <span>Echo Video & Bullseye</span>
            </button>
          </div>

          {/* Tab 1: PanEcho 39-Task Clinical Diagnostic Report */}
          {activeTab === "clinical" && (
            <div className="tab-pane">
              <PanEchoDrawer studyResults={studyResults} onRunInference={runInference} inferring={inferring} />
            </div>
          )}

          {/* Tab 2: Multichannel Telemetry, Wiggers & Volume Curves */}
          {activeTab === "telemetry" && (
            <div className="tab-pane telemetry-pane">
              <VolumeCurveChart
                telemetryData={telemetryData}
                currentPhase={phase}
                studyParams={studyParams}
              />
              <WiggersDiagram
                telemetryData={telemetryData}
                currentPhase={phase}
                studyParams={studyParams}
              />
            </div>
          )}

          {/* Tab 3: Synchronized 2D Echocardiogram Video & AHA 17 Bullseye */}
          {activeTab === "video" && (
            <div className="tab-pane video-bullseye-pane">
              <VideoSyncPlayer
                key={videoSrc || "none"}
                videoSrc={videoSrc}
                currentPhase={phase}
                isPlaying={isPlaying}
                fps={videoFps}
                totalFrames={videoFrames}
                onSeekPhase={handleSeekPhase}
              />

              <AHABullseyePlot
                strains={studyResults.aha17Strains}
                highlightSegment={highlightSegment}
                onSelectSegment={handleSelectSegment}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
