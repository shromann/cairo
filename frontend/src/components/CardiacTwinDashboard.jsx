import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import heartData from "../data/heartData.json";
import { STUDY_PANECHO_RESULTS, PANECHO_TASK_METADATA } from "../data/panEchoData";
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
  // 1. Study & Patient State
  const defaultStudy = heartData.cohort[0] || {
    id: "0X2D1CE5FC57B6FBC1",
    label: "HFrEF Severe Dysfunction",
    ef: 26.7,
    edv: 149.8,
    esv: 109.8,
    fps: 50,
    frames: 212,
    video: "/videos/0X2D1CE5FC57B6FBC1.mp4"
  };

  const [currentStudy, setCurrentStudy] = useState(defaultStudy);
  const studyResults = STUDY_PANECHO_RESULTS[currentStudy.id] || STUDY_PANECHO_RESULTS["0X2D1CE5FC57B6FBC1"];

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
  const studyParams = useMemo(() => ({
    ef: currentStudy.ef,
    edv: currentStudy.edv,
    esv: currentStudy.esv,
    gls: studyResults ? studyResults.gls : -18.5,
    heartRate: bpm,
    strokeVolume: currentStudy.edv - currentStudy.esv
  }), [currentStudy, studyResults, bpm]);

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
            selectedStudyId={currentStudy.id}
            onSelectStudy={(study) => {
              setCurrentStudy(study);
              setHighlightSegment(null);
              setSelectedNode(null);
            }}
          />

          <div className="model-tag-badge">
            <Sparkles size={13} className="accent-icon" />
            <span>Yale PanEcho 39-Task AI</span>
          </div>
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
              <span>PanEcho AI (39)</span>
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
              <PanEchoDrawer studyResults={studyResults} />
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
                videoSrc={currentStudy.video}
                currentPhase={phase}
                isPlaying={isPlaying}
                fps={currentStudy.fps}
                totalFrames={currentStudy.frames}
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
