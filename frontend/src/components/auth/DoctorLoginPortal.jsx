import React, { useState } from "react";
import { Heart, Stethoscope, ShieldCheck, ArrowRight, Sparkles, Key, UserCheck } from "lucide-react";

/**
 * Doctor Authentication & Landing Portal
 * Provides pass-through authentication with 1-click clinical demo login.
 */
export function DoctorLoginPortal({ onLoginSuccess }) {
  const [doctorId, setDoctorId] = useState("dr.schen@cairo.health");
  const [password, setPassword] = useState("••••••••••••");
  const [department, setDepartment] = useState("Cardiology & Advanced Imaging");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const doctorProfile = {
        name: "Dr. Sarah Chen, MD, FACC",
        title: "Director of Echocardiography & Cardiac Imaging",
        institution: "Cairo Cardiovascular Institute",
        department: department || "Cardiology & Advanced Imaging",
        email: doctorId || "dr.schen@cairo.health",
        id: "MD-90421",
        avatar: "SC"
      };
      onLoginSuccess(doctorProfile);
    }, 350);
  };

  const handleQuickDemo = () => {
    setDoctorId("dr.schen@cairo.health");
    setPassword("cairo-demo-2026");
    handleLogin();
  };

  return (
    <div className="login-portal-root">
      {/* Background ambient lighting effects */}
      <div className="login-ambient-glow login-glow-1"></div>
      <div className="login-ambient-glow login-glow-2"></div>

      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-logo-pill">
            <Heart size={20} className="pulse-heart text-crimson" />
            <span className="login-logo-title">CAIRO</span>
          </div>
          <h1 className="login-hero-title">Cardiac Digital Twin</h1>
          <p className="login-hero-sub">
            Precision 3D Biomechanical Heart Modeling &amp; PanEcho™ 40-Task AI Clinical Workstation
          </p>
        </div>

        {/* Login Form */}
        <form className="login-form-card" onSubmit={handleLogin}>
          <div className="login-form-header">
            <div className="physician-tag">
              <Stethoscope size={13} className="text-cyan" />
              <span>Physician Authentication</span>
            </div>
            <span className="auth-bypass-badge">Pass-Through Active</span>
          </div>

          <div className="login-input-group">
            <label className="login-label" htmlFor="doc-id">
              Physician ID / Hospital Email
            </label>
            <input
              id="doc-id"
              type="text"
              className="login-input"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              placeholder="e.g. dr.name@hospital.org"
              required
            />
          </div>

          <div className="login-input-group">
            <label className="login-label" htmlFor="doc-pwd">
              Security Key / Password
            </label>
            <input
              id="doc-pwd"
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Any password accepted"
              required
            />
          </div>

          <div className="login-input-group">
            <label className="login-label" htmlFor="doc-dept">
              Clinical Department
            </label>
            <select
              id="doc-dept"
              className="login-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="Cardiology & Advanced Imaging">Cardiology &amp; Advanced Imaging</option>
              <option value="Cardiac Surgery & TAVR Clinic">Cardiac Surgery &amp; TAVR Clinic</option>
              <option value="Heart Failure & Transplant Service">Heart Failure &amp; Transplant Service</option>
              <option value="Emergency Medicine & Resuscitation">Emergency Medicine &amp; Resuscitation</option>
            </select>
          </div>

          <div className="login-actions-group">
            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              <span>{isLoading ? "Authenticating Session…" : "Enter Clinical Workstation"}</span>
              <ArrowRight size={15} />
            </button>

            <button type="button" className="login-demo-btn" onClick={handleQuickDemo}>
              <Sparkles size={14} className="accent-sparkle" />
              <span>Quick Login as Dr. Sarah Chen, MD (Cardiology)</span>
            </button>
          </div>

          <div className="login-footer-security">
            <ShieldCheck size={13} className="text-muted" />
            <span>Encrypted HIPAA Diagnostic Sandbox • PanEcho v1.0 Active</span>
          </div>
        </form>

        {/* System Specs Footer */}
        <div className="login-system-specs">
          <div className="spec-pill">
            <span className="dot dot-cyan"></span>
            <span>PanEcho 40-Head Model</span>
          </div>
          <div className="spec-pill">
            <span className="dot dot-cyan"></span>
            <span>Cloud SQL Asia-SE1</span>
          </div>
          <div className="spec-pill">
            <span className="dot dot-cyan"></span>
            <span>Z-Anatomy Draco 3D</span>
          </div>
        </div>
      </div>
    </div>
  );
}
