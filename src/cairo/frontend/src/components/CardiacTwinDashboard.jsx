import React from "react";
import {
  Activity,
  FileText,
  X,
} from "lucide-react";

import { DoctorLoginPortal } from "./auth/DoctorLoginPortal";
import { PatientDirectory } from "./directory/PatientDirectory";
import { CardiacTwinCanvas } from "./twin/CardiacTwinCanvas";
import { BlenderViewportToolbar } from "./controls/BlenderViewportToolbar";
import { FloatingTransportBar } from "./controls/FloatingTransportBar";
import { VideoSyncPlayer } from "./clinical/VideoSyncPlayer";
import { PanEchoDrawer } from "./clinical/PanEchoDrawer";
import { AHABullseyePlot } from "./telemetry/AHABullseyePlot";
import { VolumeCurveChart } from "./telemetry/VolumeCurveChart";
import { WiggersDiagram } from "./telemetry/WiggersDiagram";
import { useCardiacTwinDashboard } from "./dashboard/useCardiacTwinDashboard";
import { DashboardHeader } from "./dashboard/DashboardHeader";

export function CardiacTwinDashboard() {
  const {
    doctor,
    currentView,
    activePatient,
    cohort,
    currentStudy,
    apiError,
    inferring,
    displayMode,
    setDisplayMode,
    viewMode,
    setViewMode,
    cameraPreset,
    setCameraPreset,
    showHeatmap,
    setShowHeatmap,
    showValves,
    setShowValves,
    showSimpsonTracings,
    setShowSimpsonTracings,
    highlightSegment,
    selectedNode,
    setSelectedNode,
    sidebarCollapsed,
    setSidebarCollapsed,
    phase,
    isPlaying,
    setIsPlaying,
    bpm,
    setBpm,
    speedMultiplier,
    setSpeedMultiplier,
    activeTab,
    setActiveTab,
    runInference,
    studyResults,
    videoSrc,
    videoFps,
    videoFrames,
    studyParams,
    kinematics,
    telemetryData,
    handleSeekPhase,
    handleStepPhase,
    handleSelectSegment,
    handleSelectNode,
    handleLoginSuccess,
    handleSelectStudyFromDirectory,
    handleBackToDirectory,
    handleLogout,
  } = useCardiacTwinDashboard();

  if (currentView === "login") {
    return <DoctorLoginPortal onLoginSuccess={handleLoginSuccess} />;
  }

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

  return (
    <div className="cardiac-twin-root blender-layout-root">
      {apiError && (
        <div className="diagnostic-alert" role="alert">
          {apiError}
        </div>
      )}

      <DashboardHeader
        activePatient={activePatient}
        currentStudy={currentStudy}
        sidebarCollapsed={sidebarCollapsed}
        inferring={inferring}
        studyResults={studyResults}
        onBackToDirectory={handleBackToDirectory}
        onRunInference={runInference}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={`blender-workspace-grid ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
        <div className="blender-viewport-area">
          <div className="r3f-canvas-wrapper blender-canvas-frame">
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

        {!sidebarCollapsed && (
          <aside className="sidebar-column blender-sidebar">
            <div className="sidebar-tabs-nav">
              <button
                className={`sidebar-tab-btn ${activeTab === "video" ? "active" : ""}`}
                onClick={() => setActiveTab("video")}
              >
                <Activity size={14} />
                <span>Echo &amp; Curves</span>
              </button>
              <button
                className={`sidebar-tab-btn ${activeTab === "clinical" ? "active" : ""}`}
                onClick={() => setActiveTab("clinical")}
              >
                <FileText size={14} />
                <span>PanEcho AI</span>
              </button>
            </div>

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

            {activeTab === "clinical" && (
              <div className="tab-pane">
                <PanEchoDrawer
                  studyResults={studyResults}
                  onRunInference={runInference}
                  inferring={inferring}
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
