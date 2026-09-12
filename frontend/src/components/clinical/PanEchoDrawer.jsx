import React, { useState, useMemo } from "react";
import { PANECHO_TASK_METADATA, PANECHO_CATEGORIES, PANECHO_TASK_COUNT } from "../../data/panEchoData";
import { Search, CheckCircle2, AlertTriangle, AlertCircle, Stethoscope } from "lucide-react";

/**
 * Yale CarDS PanEcho 39-Task Clinical Diagnostic Report Drawer
 * Instatic Inspector Panel Style
 */
export function PanEchoDrawer({
  studyResults = {},
  onRunInference = null,
  inferring = false
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const predictions = studyResults.predictions || {};

  const filteredTasks = useMemo(() => {
    return PANECHO_TASK_METADATA.filter((task) => {
      const matchesCategory =
        selectedCategory === "ALL" || task.category === selectedCategory;
      const matchesQuery =
        !searchQuery ||
        task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="panecho-drawer">
      <div className="panecho-header">
        <div className="panecho-title-row">
          <div className="panecho-logo-wrap">
            <Stethoscope size={15} className="text-muted" />
            <span className="panecho-title">PanEcho Report</span>
          </div>
          <span className="panecho-badge">{PANECHO_TASK_COUNT} Tasks</span>
        </div>
        <p className="panecho-subtitle">
          Yale CarDS • View-Agnostic Foundation Model (JAMA 2025)
          {studyResults.predictions && Object.keys(studyResults.predictions).length > 0
            ? ` • live from database (${Object.keys(studyResults.predictions).length} heads)`
            : " • no predictions stored for this study"}
        </p>
        {!studyResults.hasPredictions && onRunInference && (
          <button className="category-tab active" onClick={onRunInference} disabled={inferring}>
            {inferring ? "Running PanEcho on this study…" : "Run PanEcho now"}
          </button>
        )}

        {/* Search & Category Filter */}
        <div className="panecho-search-bar">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Filter tasks (e.g. EF, Regurgitation, Effusion)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="panecho-search-input"
            aria-label="Filter clinical tasks"
          />
        </div>

        <div className="panecho-category-tabs">
          <button
            className={`category-tab ${selectedCategory === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedCategory("ALL")}
          >
            All ({PANECHO_TASK_COUNT})
          </button>
          {Object.values(PANECHO_CATEGORIES).map((cat) => (
            <button
              key={cat}
              className={`category-tab ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="panecho-tasks-list">
        {filteredTasks.map((task) => {
          const pred = predictions[task.id];
          const isRegression = task.type === "regression";

          let statusClass = "tag-normal";
          let Icon = CheckCircle2;

          if (pred) {
            const labelLower = (pred.status || pred.label || "").toLowerCase();
            if (pred.severe === false && labelLower === "normal") { /* keep tag-normal */ } else
            if (
              labelLower.includes("severe") ||
              labelLower.includes("akinetic") ||
              labelLower.includes("elevated") ||
              labelLower.includes("positive")
            ) {
              statusClass = "tag-severe";
              Icon = AlertCircle;
            } else if (
              labelLower.includes("mild") ||
              labelLower.includes("hypokinetic") ||
              labelLower.includes("moderate") ||
              labelLower.includes("borderline")
            ) {
              statusClass = "tag-warning";
              Icon = AlertTriangle;
            }
          }

          return (
            <div key={task.id} className="panecho-task-card">
              <div className="task-header">
                <span className="task-name">{task.name}</span>
                <span className="task-category-tag">{task.category.split(" ")[0]}</span>
              </div>

              <div className="task-body">
                {isRegression ? (
                  <div className="task-value-row">
                    <span className="task-number">
                      {pred ? pred.value : "--"}
                    </span>
                    <span className="task-unit">{task.unit}</span>
                    {pred && (
                      <span className={`task-status-tag ${statusClass}`}>
                        <Icon size={11} />
                        {pred.status}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="task-value-row">
                    <span className="task-label-text">
                      {pred ? pred.label : "--"}
                    </span>
                    {pred && (
                      <span className={`task-status-tag ${statusClass}`}>
                        <Icon size={11} />
                        {pred.status || pred.label}
                      </span>
                    )}
                  </div>
                )}

                {/* Normal reference or confidence */}
                <div className="task-footer-info">
                  {isRegression ? (
                    <span className="task-ref">Ref: {task.normalRange}</span>
                  ) : (
                    <span className="task-ref">
                      Prob: {pred ? `${(pred.probability * 100).toFixed(0)}%` : "--"}
                    </span>
                  )}
                  {pred && pred.nVideos > 1 && (
                    <span className="task-conf">avg of {pred.nVideos} clips</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
