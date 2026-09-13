import React from "react";
import {
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  User,
} from "lucide-react";

export function DashboardHeader({
  activePatient,
  currentStudy,
  sidebarCollapsed,
  inferring,
  studyResults,
  onBackToDirectory,
  onRunInference,
  onToggleSidebar,
}) {
  return (
    <header className="cardiac-header blender-header">
      <div className="blender-nav-left">
        <button
          className="back-directory-btn"
          onClick={onBackToDirectory}
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

      <div className="header-actions">
        <button
          className="model-tag-badge"
          onClick={onRunInference}
          disabled={inferring || !currentStudy}
          title={studyResults.hasPredictions ? "Re-run PanEcho on this study" : "Run PanEcho on this study"}
          style={{ cursor: inferring ? "wait" : "pointer" }}
        >
          <Sparkles size={13} className="accent-icon" />
          <span>
            {inferring ? "Running PanEcho…" : studyResults.hasPredictions ? "PanEcho: scored" : "Run PanEcho"}
          </span>
        </button>

        <button
          className={`sidebar-toggle-btn ${sidebarCollapsed ? "collapsed" : ""}`}
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Expand Diagnostic Inspector (420px)" : "Collapse Inspector for Fullscreen 3D"}
        >
          {sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>
      </div>
    </header>
  );
}
