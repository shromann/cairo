import React, { useState, useMemo } from "react";
import { PANECHO_TASK_METADATA, PANECHO_CATEGORIES } from "../../data/panEchoData";
import { Search, Filter, CheckCircle2, AlertTriangle, AlertCircle, Info, Stethoscope } from "lucide-react";

/**
 * Yale CarDS PanEcho 39-Task Clinical Diagnostic Report Drawer
 */
export function PanEchoDrawer({
  studyResults = {},
  isOpen = true,
  onClose = () => {}
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
            <Stethoscope size={18} className="text-cyan" />
            <span className="panecho-title">PanEcho Foundation Model Report</span>
          </div>
          <span className="panecho-badge">39 Multi-Task AI</span>
        </div>
        <p className="panecho-subtitle">
          Yale CarDS Lab • View-Agnostic Deep Learning Model (JAMA 2025)
        </p>

        {/* Search & Category Filter */}
        <div className="panecho-search-bar">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search clinical tasks (e.g. EF, Regurgitation, Effusion)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="panecho-search-input"
          />
        </div>

        <div className="panecho-category-tabs">
          <button
            className={`category-tab ${selectedCategory === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedCategory("ALL")}
          >
            All Tasks (39)
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
                        <Icon size={12} />
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
                        <Icon size={12} />
                        {pred.status || pred.label}
                      </span>
                    )}
                  </div>
                )}

                {/* Normal reference or probability */}
                <div className="task-footer-info">
                  {isRegression ? (
                    <span className="task-ref">Normal Ref: {task.normalRange}</span>
                  ) : (
                    <span className="task-ref">
                      Confidence: {pred ? `${(pred.probability * 100).toFixed(0)}%` : "95%"}
                    </span>
                  )}
                  {pred && pred.confidence && (
                    <span className="task-conf">Model Conf: {(pred.confidence * 100).toFixed(0)}%</span>
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
