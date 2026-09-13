import React, { useState, useMemo } from "react";
import {
  Heart,
  Search,
  User,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  LogOut,
  Sparkles,
  SlidersHorizontal,
  Stethoscope,
  FileText,
  Play
} from "lucide-react";
import { DEMO_PATIENTS } from "../../data/patientData";

/**
 * Doctor's Clinical Patient & Study Directory
 * Lists assigned cardiology patients, clinical histories, and associated echocardiogram studies with collapsible dropdowns.
 */
export function PatientDirectory({
  doctor,
  cohort = [],
  onSelectStudy,
  onLogout
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState("all"); // "all" | "critical" | "warning" | "stable"
  
  // Track which patient study accordions are expanded (default: closed as requested)
  const [expandedPatientIds, setExpandedPatientIds] = useState(() => new Set());

  const togglePatientExpanded = (patientId) => {
    setExpandedPatientIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedPatientIds(new Set(DEMO_PATIENTS.map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpandedPatientIds(new Set());
  };

  // Merge demo patient registry with any dynamic cohort records from the API
  const patients = useMemo(() => {
    return DEMO_PATIENTS;
  }, []);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // Risk filter
      if (filterRisk !== "all" && patient.riskLevel !== filterRisk) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = patient.name.toLowerCase().includes(q);
        const matchesMrn = patient.mrn.toLowerCase().includes(q);
        const matchesDiag = patient.primaryDiagnosis.toLowerCase().includes(q);
        const matchesStudy = patient.studies.some(
          (s) => s.id.toLowerCase().includes(q) || s.indication.toLowerCase().includes(q)
        );
        return matchesName || matchesMrn || matchesDiag || matchesStudy;
      }
      return true;
    });
  }, [patients, filterRisk, searchQuery]);

  const stats = useMemo(() => {
    const total = patients.length;
    const critical = patients.filter((p) => p.riskLevel === "critical").length;
    const warning = patients.filter((p) => p.riskLevel === "warning").length;
    const stable = patients.filter((p) => p.riskLevel === "stable").length;
    return { total, critical, warning, stable };
  }, [patients]);

  return (
    <div className="directory-root">
      {/* Top Professional Header */}
      <header className="directory-header">
        <div className="directory-brand-wrap">
          <div className="heart-logo-wrap">
            <Heart size={16} className="pulse-heart text-crimson" />
          </div>
          <div className="brand-text-block">
            <h1 className="brand-title">CAIRO</h1>
            <span className="brand-sub">Cardiology Clinical Directory</span>
          </div>
        </div>

        <div className="doctor-profile-strip">
          <div className="doctor-avatar">{doctor?.avatar || "SC"}</div>
          <div className="doctor-info-text">
            <span className="doctor-name">{doctor?.name || "Dr. Sarah Chen, MD"}</span>
            <span className="doctor-dept">{doctor?.department || "Cardiology & Imaging"}</span>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Sign Out">
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="directory-main-container">
        {/* Controls Bar & Triage Stats */}
        <section className="directory-toolbar-section">
          <div className="directory-stats-row">
            <div className="stat-card" onClick={() => setFilterRisk("all")}>
              <span className="stat-num">{stats.total}</span>
              <span className="stat-label">Total Assigned Patients</span>
            </div>
            <div
              className={`stat-card stat-critical ${filterRisk === "critical" ? "active" : ""}`}
              onClick={() => setFilterRisk(filterRisk === "critical" ? "all" : "critical")}
            >
              <div className="stat-num-row">
                <AlertTriangle size={14} />
                <span className="stat-num">{stats.critical}</span>
              </div>
              <span className="stat-label">Critical / Severe HFrEF</span>
            </div>
            <div
              className={`stat-card stat-warning ${filterRisk === "warning" ? "active" : ""}`}
              onClick={() => setFilterRisk(filterRisk === "warning" ? "all" : "warning")}
            >
              <div className="stat-num-row">
                <Activity size={14} />
                <span className="stat-num">{stats.warning}</span>
              </div>
              <span className="stat-label">Moderate / Surveillance</span>
            </div>
            <div
              className={`stat-card stat-stable ${filterRisk === "stable" ? "active" : ""}`}
              onClick={() => setFilterRisk(filterRisk === "stable" ? "all" : "stable")}
            >
              <div className="stat-num-row">
                <CheckCircle2 size={14} />
                <span className="stat-num">{stats.stable}</span>
              </div>
              <span className="stat-label">Preserved / Cleared</span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="directory-search-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                className="directory-search-input"
                placeholder="Search patient by name, MRN, cardiac pathology, or study accession number…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
                  ×
                </button>
              )}
            </div>

            <div className="filter-pill-group">
              <span className="filter-label">Risk Filter:</span>
              {[
                { id: "all", label: "All" },
                { id: "critical", label: "Critical" },
                { id: "warning", label: "Moderate" },
                { id: "stable", label: "Normal" }
              ].map((f) => (
                <button
                  key={f.id}
                  className={`filter-pill ${filterRisk === f.id ? "active" : ""}`}
                  onClick={() => setFilterRisk(f.id)}
                >
                  {f.label}
                </button>
              ))}

              <div className="dropdown-accordion-actions">
                <button className="accordion-action-btn" onClick={expandAll} title="Expand all studies dropdowns">
                  Expand All
                </button>
                <span className="divider">•</span>
                <button className="accordion-action-btn" onClick={collapseAll} title="Collapse all studies dropdowns">
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Patients & Studies List */}
        <section className="patient-cards-grid">
          {filteredPatients.length === 0 ? (
            <div className="directory-empty-state">
              <FileText size={32} className="text-muted" />
              <h3>No patients found</h3>
              <p>Try adjusting your search criteria or clearing active filters.</p>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSearchQuery("");
                  setFilterRisk("all");
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const isExpanded = expandedPatientIds.has(patient.id);
              const latestStudy = patient.studies[0];

              return (
                <div key={patient.id} className={`patient-card risk-${patient.riskLevel}`}>
                  {/* Patient Profile Header */}
                  <div className="patient-card-header">
                    <div className="patient-avatar-wrap">
                      <div className="patient-avatar">{patient.avatar}</div>
                      <div>
                        <div className="patient-name-row">
                          <h2 className="patient-name">{patient.name}</h2>
                          <span className={`risk-badge risk-${patient.riskLevel}`}>
                            {patient.riskLevel === "critical"
                              ? "Critical Priority"
                              : patient.riskLevel === "warning"
                              ? "Moderate Risk"
                              : "Preserved / Normal"}
                          </span>
                        </div>
                        <div className="patient-demographics-row">
                          <span>
                            {patient.age} y/o {patient.sex}
                          </span>
                          <span className="divider">•</span>
                          <span>{patient.mrn}</span>
                          <span className="divider">•</span>
                          <span>{patient.room}</span>
                        </div>
                      </div>
                    </div>

                    <div className="patient-vitals-pill">
                      <div className="vital-item">
                        <span className="vital-lbl">BP</span>
                        <span className="vital-val">{patient.recentVitals.bp}</span>
                      </div>
                      <div className="vital-item">
                        <span className="vital-lbl">HR</span>
                        <span className="vital-val">{patient.recentVitals.hr}</span>
                      </div>
                      <div className="vital-item">
                        <span className="vital-lbl">BNP</span>
                        <span className="vital-val">{patient.recentVitals.bnp}</span>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Indication & Care Team */}
                  <div className="patient-card-body">
                    <div className="patient-diagnosis-box">
                      <span className="diagnosis-label">Primary Diagnosis:</span>
                      <span className="diagnosis-text">{patient.primaryDiagnosis}</span>
                    </div>
                    <p className="patient-clinical-note">{patient.clinicalSummary}</p>

                    {/* Assigned Medical Students & Care Team */}
                    <div className="patient-care-team-strip">
                      <div className="care-team-member">
                        <span className="ct-label">Attending:</span>
                        <span className="ct-val">{patient.attending || "Dr. Sarah Chen, MD"}</span>
                      </div>
                      {patient.assignedResident && (
                        <div className="care-team-member">
                          <span className="ct-label">Resident/Fellow:</span>
                          <span className="ct-val">{patient.assignedResident}</span>
                        </div>
                      )}
                      {patient.assignedStudent && (
                        <div className="care-team-member student-member">
                          <span className="ct-label">Medical Student:</span>
                          <span className="ct-val">{patient.assignedStudent}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Patient Studies Collapsible Dropdown Section */}
                  <div className="patient-studies-section">
                    <button
                      className={`studies-dropdown-toggle-btn ${isExpanded ? "expanded" : ""}`}
                      onClick={() => togglePatientExpanded(patient.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="sdt-left">
                        <ChevronDown
                          size={15}
                          className={`dropdown-chevron-icon ${isExpanded ? "open" : ""}`}
                        />
                        <span className="studies-count-title">
                          Echocardiogram Studies ({patient.studies.length})
                        </span>
                        {!isExpanded && latestStudy && (
                          <span className="studies-collapsed-preview">
                            • Latest: {latestStudy.date} ({latestStudy.severity})
                          </span>
                        )}
                      </div>
                      <div className="sdt-right">
                        <span className="panecho-verified-tag">
                          <Sparkles size={11} /> PanEcho 40-Head AI Ready
                        </span>
                        <span className="toggle-indicator-text">
                          {isExpanded ? "Hide Studies ▲" : "View Studies ▼"}
                        </span>
                      </div>
                    </button>

                    {/* Collapsible Studies List */}
                    {isExpanded && (
                      <div className="studies-list animated-dropdown-list">
                        {patient.studies.map((study) => (
                          <div
                            key={study.id}
                            className="study-row-card"
                            onClick={() => onSelectStudy(study, patient)}
                          >
                            <div className="study-left-info">
                              <div className="study-top-line">
                                <span className="study-id-badge">{study.id}</span>
                                <span className="study-date">
                                  <Calendar size={12} /> {study.date}
                                </span>
                                <span className="study-modality">{study.modality}</span>
                              </div>
                              <span className="study-indication">{study.indication}</span>
                            </div>

                            {/* Quantitative Metrics Summary */}
                            <div className="study-vitals-strip">
                              <div className="study-vital-metric">
                                <span className="svm-lbl">LVEF</span>
                                <span
                                  className={`svm-val ${
                                    study.ef < 40
                                      ? "text-danger"
                                      : study.ef < 50
                                      ? "text-warning"
                                      : "text-normal"
                                  }`}
                                >
                                  {study.ef}%
                                </span>
                              </div>
                              <div className="study-vital-metric">
                                <span className="svm-lbl">EDV</span>
                                <span className="svm-val">{study.edv} mL</span>
                              </div>
                              <div className="study-vital-metric">
                                <span className="svm-lbl">ESV</span>
                                <span className="svm-val">{study.esv} mL</span>
                              </div>
                              <div className="study-vital-metric">
                                <span className="svm-lbl">GLS</span>
                                <span className="svm-val">{study.gls}%</span>
                              </div>
                            </div>

                            {/* Open Workstation Button */}
                            <div className="study-action-col">
                              <span className="study-severity-tag">{study.severity}</span>
                              <button
                                className="open-study-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectStudy(study, patient);
                                }}
                              >
                                <span>Open 3D Twin</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
