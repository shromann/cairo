import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { adaptStudy } from "../data/panEchoData";
import { matchPatientForStudy } from "../data/patientData";
import { api } from "../lib/api";
import { getCardiacKinematics, generateWiggersTelemetry } from "../data/kinematics";

import { DoctorLoginPortal } from "./auth/DoctorLoginPortal";
import { PatientDirectory } from "./directory/PatientDirectory";
import { CardiacTwinCanvas } from "./twin/CardiacTwinCanvas";
import { BlenderViewportToolbar } from "./controls/BlenderViewportToolbar";
import { FloatingTransportBar } from "./controls/FloatingTransportBar";
import { StudySelector } from "./controls/StudySelector";

import { VolumeCurveChart } from "./telemetry/VolumeCurveChart";
import { WiggersDiagram } from "./telemetry/WiggersDiagram";
import { AHABullseyePlot } from "./telemetry/AHABullseyePlot";
import { PanEchoDrawer } from "./clinical/PanEchoDrawer";
import { VideoSyncPlayer } from "./clinical/VideoSyncPlayer";

import {
  Heart,
  Activity,
  Sparkles,
  FileText,
  Play,
  X,
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  User,
  LogOut,
  Info
} from "lucide-react";

/**
 * Main Cairo Clinical Suite
 * Manages the Doctor Login Portal, Patient Directory, and Blender-Style 3D Digital Twin Workstation.
 */
export function CardiacTwinDashboard() {
  // 1. Doctor Session & Navigation State
  const [doctor, setDoctor] = useState(null);
  const [currentView, setCurrentView] = useState("login"); // "login" | "directory" | "workstation"
  const [selectedPatient, setSelectedPatient] = useState(null);

  // 2. Study & Cohort State
  const [cohort, setCohort] = useState([]);
  const [currentStudy, setCurrentStudy] = useState(null);
  const [studyDetail, setStudyDetail] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [inferring, setInferring] = useState(false);

  // 3. 3D Viewport State (DEFAULT WIREFRAME AS REQUESTED)
  const [displayMode, setDisplayMode] = useState("wireframe"); // "wireframe" (DEFAULT) | "solid" | "xray" | "heatmap"
  const [viewMode, setViewMode] = useState("none");             // "none" | "A4C" | "A2C" | "PLAX" | "PSAX"
  const [cameraPreset, setCameraPreset] = useState("anterior"); // "anterior" | "lateral" | "superior" | "apical" | "reset"
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showValves, setShowValves] = useState(true);
  const [showSimpsonTracings, setShowSimpsonTracings] = useState(false);
  const [highlightSegment, setHighlightSegment] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 4. Cardiac Clock & Kinematics State
  const [phase, setPhase] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [bpm, setBpm] = useState(70);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [activeTab, setActiveTab] = useState("clinical"); // "clinical" | "telemetry" | "video"

  // Load cohort studies on mount
  useEffect(() => {
    api.listStudies(60)
      .then((rows) => {
        setCohort(rows);
        if (rows.length && !currentStudy) {
          setCurrentStudy(rows[0]);
        }
      })
      .catch((e) => setApiError(String(e)));
  }, []);

  // Fetch full study details when active study changes
  useEffect(() => {
    if (!currentStudy?.id) return;
    setStudyDetail(null);
    api.getStudy(currentStudy.id)
      .then(setStudyDetail)
      .catch((e) => setApiError(String(e)));
  }, [currentStudy?.id]);

  // Derive patient profile for active study if not already selected
  const activePatient = useMemo(() => {
    if (selectedPatient) return selectedPatient;
    return matchPatientForStudy(currentStudy?.id, cohort);
  }, [selectedPatient, currentStudy?.id, cohort]);

  const runInference = useCallback(async () => {
    if (!currentStudy) return;
    setInferring(true);
    try {
      await api.inferStudy(currentStudy.id);
      const [detail, rows] = await Promise.all([api.getStudy(currentStudy.id), api.listStudies(60)]);
      setStudyDetail(detail);
      setCohort(rows);
    } catch (e) {
      setApiError(String(e));
    } finally {
      setInferring(false);
    }
  }, [currentStudy?.id]);

  const studyResults = useMemo(() => adaptStudy(studyDetail), [studyDetail]);
  const video0 = studyDetail?.videos?.[0];
  const videoSrc = api.absolute(video0?.stream);
  const videoFps = video0?.fps || 50;
  const videoFrames = video0?.frame_count || 200;

  // Instantaneous kinematics parameters
  const studyParams = useMemo(() => {
    const ef = studyResults.ef ?? currentStudy?.ef ?? 55;
    const edv = studyResults.edv ?? currentStudy?.edv ?? 100;
    const esv = studyResults.esv ?? currentStudy?.esv ?? 45;
    return {
      ef,
      edv,
      esv,
      gls: studyResults.gls ?? -18.5,
      heartRate: bpm,
      strokeVolume: edv - esv
    };
  }, [currentStudy, studyResults, bpm]);

  const kinematics = useMemo(() => {
    return getCardiacKinematics(phase, studyParams);
  }, [phase, studyParams]);

  const telemetryData = useMemo(() => {
    return generateWiggersTelemetry(studyParams, 100);
  }, [studyParams]);

  // RequestAnimationFrame Continuous Cardiac Loop
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

  // Navigation handlers
  const handleLoginSuccess = (doctorProfile) => {
    setDoctor(doctorProfile);
    setCurrentView("directory");
  };

  const handleSelectStudyFromDirectory = (study, patient) => {
    setCurrentStudy(study);
    setSelectedPatient(patient);
    setCurrentView("workstation");
  };

  const handleBackToDirectory = () => {
    setCurrentView("directory");
  };

  const handleLogout = () => {
    setDoctor(null);
    setCurrentView("login");
  };

  // --- VIEW 1: Doctor Login Portal ---
  if (currentView === "login") {
    return <DoctorLoginPortal onLoginSuccess={handleLoginSuccess} />;
  }

  // --- VIEW 2: Patient & Study Directory ---
  if (currentView === "directory") {
    return (
      <PatientDirectory
        doctor={doctor}
        cohort={cohort}
        onSelectStudy={handleSelectStudyFromDirectory}
        onLogout={handleLogout}
      />
    );
  }

  // --- VIEW 3: Blender-Style 3D Digital Twin Workstation ---
  return (
    <div className="cardiac-twin-root blender-layout-root">
      {/* Top Breadcrumbs & Clinical Workstation Header */}
      <header className="cardiac-header blender-header">
        <div className="blender-nav-left">
          <button
            className="back-directory-btn"
            onClick={handleBackToDirectory}
            title="Return to Patient Directory"
          >
            <ArrowLeft size={14} />
            <span>Patients</span>
          </button>

          <div className="blender-breadcrumb-trail">
            <span className="breadcrumb-divider">/</span>
            <div className="breadcrumb-patient-pill">
              <User size={12} className="text-muted" />
              <span className="bp-name">{activePatient?.name || "Patient"}</span>
              <span className="bp-mrn">{activePatient?.mrn || ""}</span>
            </div>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-study-id">{currentStudy?.id || "Study"}</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="header-actions">
          <StudySelector
            cohort={cohort}
            selectedStudyId={currentStudy?.id || ""}
            onSelectStudy={(study) => {
              setCurrentStudy(study);
              setSelectedPatient(matchPatientForStudy(study.id, cohort));
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

          {/* Toggle Sidebar Collapse */}
          <button
            className={`sidebar-toggle-btn ${sidebarCollapsed ? "collapsed" : ""}`}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Diagnostic Inspector (420px)" : "Collapse Inspector for Fullscreen 3D"}
          >
            {sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>
        </div>
      </header>

      {/* Main Blender Workstation Workspace */}
      <div className={`blender-workspace-grid ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
        {/* Hero 3D Viewport Area */}
        <div className="blender-viewport-area">
          <div className="r3f-canvas-wrapper blender-canvas-frame">
            {/* Top Floating Viewport Toolbar (Shading, Ultrasound Slice, Overlays, Vitals HUD) */}
            <BlenderViewportToolbar
              displayMode={displayMode}
              viewMode={viewMode}
              showHeatmap={showHeatmap}
              showValves={showValves}
              showSimpsonTracings={showSimpsonTracings}
              studyParams={studyParams}
              kinematics={kinematics}
              activeCameraPreset={cameraPreset}
              onChangeDisplayMode={setDisplayMode}
              onChangeViewMode={setViewMode}
              onSelectCameraPreset={setCameraPreset}
              onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
              onToggleValves={() => setShowValves(!showValves)}
              onToggleSimpson={() => setShowSimpsonTracings(!showSimpsonTracings)}
            />

            {/* 3D React Three Fiber Viewport */}
            <CardiacTwinCanvas
              kinematics={kinematics}
              strains={studyResults.aha17Strains}
              displayMode={displayMode}
              viewMode={viewMode}
              cameraPreset={cameraPreset}
              showHeatmap={showHeatmap}
              showValves={showValves}
              showSimpsonTracings={showSimpsonTracings}
              showSlicePlane={true}
              highlightSegment={highlightSegment}
              selectedNodeId={selectedNode?.id}
              onSelectSegment={handleSelectSegment}
              onSelectNode={handleSelectNode}
              onCameraPresetHandled={() => setCameraPreset(null)}
            />

            {/* Bottom Floating Blender-Style Transport Timeline */}
            <FloatingTransportBar
              currentPhase={phase}
              isPlaying={isPlaying}
              bpm={bpm}
              speedMultiplier={speedMultiplier}
              phaseName={kinematics.phaseName}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onSeekPhase={handleSeekPhase}
              onStepPhase={handleStepPhase}
              onChangeBpm={setBpm}
              onChangeSpeed={setSpeedMultiplier}
            />

            {/* Floating Overlays */}
            <div className="canvas-overlay-badges">
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
          </div>
        </div>

        {/* Collapsible Right Inspector Sidebar */}
        {!sidebarCollapsed && (
          <aside className="sidebar-column blender-sidebar">
            {/* Tabs Navigation */}
            <div className="sidebar-tabs-nav">
              <button
                className={`sidebar-tab-btn ${activeTab === "clinical" ? "active" : ""}`}
                onClick={() => setActiveTab("clinical")}
              >
                <FileText size={14} />
                <span>PanEcho AI (40)</span>
              </button>
              <button
                className={`sidebar-tab-btn ${activeTab === "telemetry" ? "active" : ""}`}
                onClick={() => setActiveTab("telemetry")}
              >
                <Activity size={14} />
                <span>Curves</span>
              </button>
              <button
                className={`sidebar-tab-btn ${activeTab === "video" ? "active" : ""}`}
                onClick={() => setActiveTab("video")}
              >
                <Play size={14} />
                <span>Echo &amp; Bullseye</span>
              </button>
            </div>

            {/* Tab 1: PanEcho AI 40-Head Clinical Diagnostics */}
            {activeTab === "clinical" && (
              <div className="tab-pane">
                <PanEchoDrawer
                  studyResults={studyResults}
                  onRunInference={runInference}
                  inferring={inferring}
                />
              </div>
            )}

            {/* Tab 2: Telemetry Curves */}
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

            {/* Tab 3: Echo Video & AHA Bullseye */}
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
          </aside>
        )}
      </div>
    </div>
  );
}
