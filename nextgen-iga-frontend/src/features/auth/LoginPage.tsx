import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Shield, QrCode } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/auth.store";
import { useAuth } from "../../hooks/useAuth";
import type { User } from "../../types/auth.types";

import { authApi } from "../../api/auth.api";

type LoginStep = "LOGIN" | "MFA_SETUP" | "MFA_VERIFY";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ??
    "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      const target = from === "/login" ? "/dashboard" : from;
      console.log("[login] Authenticated, navigating to:", target);
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const [step, setStep] = useState<LoginStep>("LOGIN");
  const [uidInput, setUidInput] = useState("");

  // Auto-fill from query params (activation link)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const uid = params.get("uid");
    if (uid) setUidInput(uid);
  }, [location.search]);
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [tempRefreshToken, setTempRefreshToken] = useState("");
  const [tempUid, setTempUid] = useState("");
  const [tempUserType, setTempUserType] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Role Mapping: Backend -> Frontend
  const mapRole = (backendRole: string): "end_user" | "supervisor" | "admin" => {
    const r = backendRole?.toLowerCase() || "";
    console.log("Mapping backend role:", backendRole, "-> Cleaned:", r);

    if (r.includes("admin")) return "admin";
    if (r.includes("supervisor")) return "supervisor";
    if (r === "user" || r === "end_user" || r === "employee") return "end_user";

    console.warn("Unrecognized role from backend, defaulting to end_user:", backendRole);
    return "end_user"; // Safe default
  };

  const handleLogin = async () => {
    if (!uidInput || !password) {
      setError("UID and Password are required");
      return;
    }
    setLoading(true);
    setError("");
    setMfaCode("");
    try {
      // STEP 0: Check Approval Status in Governance DB
      try {
        const statusRes = await authApi.checkStatus(uidInput);
        const userData = statusRes.data;
        if (userData && userData.isApproved === 0 && userData.status !== 'ACTIVE') {
          setError("Your account is pending administrator approval. Please try again once approved.");
          setLoading(false);
          return;
        }
      } catch (statusErr) {
        console.warn("[login] Status check failed or user not found in governance DB. Proceeding with LDAP auth.");
      }


      // STEP 1: Login — send { uid, password }
      console.log("[login] Calling loginPrimary with:", { uid: uidInput });
      const res = await authApi.loginPrimary({ uid: uidInput, password });
      const base = (res as any).data || res;
      const token = base.tokens?.jwtToken || base.jwtToken || "";
      const refresh = base.tokens?.refreshToken || base.refreshToken || "";
      const uid = base.uid || base.userId || "";
      const type = mapRole(base.userType || base.role);

      if (!uid) throw new Error("User ID missing from server response");

      setTempToken(token);
      setTempRefreshToken(refresh);
      setTempUid(uid);
      setTempUserType(type);

      if (base.mfaEnabled) {
        // SCENARIO 2: MFA already set up — go straight to verify
        setStep("MFA_VERIFY");
      } else {
        // SCENARIO 1: First-time login — call setup to get QR, then verify
        setStep("MFA_SETUP");
        try {
          const setupRes = await authApi.setupMfa({ uid }, token);
          const setupBase = (setupRes as any).data || setupRes;
          const qr = setupBase?.data?.qrCodeUrl || setupBase?.qrCodeUrl || "";
          if (qr) {
            setQrCodeUrl(qr);
          } else {
            // MFA already enabled server-side (400 response) — go to verify
            setStep("MFA_VERIFY");
          }
        } catch (setupErr: any) {
          // If setup returns 400 (already enabled), switch to verify flow
          if (setupErr?.response?.status === 400 || setupErr?.response?.data?.mfaEnabled) {
            setStep("MFA_VERIFY");
          } else {
            throw new Error("MFA setup failed — " + (setupErr?.response?.data?.message || setupErr.message));
          }
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || (err instanceof Error ? err.message : "Login failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setError("Valid 6-digit OTP code required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // STEP 3: Verify OTP — { uid, code } + Authorization header (per API doc)
      const verifyRes = await authApi.verifyMfa(
        { uid: tempUid, code: mfaCode },
        tempToken
      );
      const baseVerify = (verifyRes as any).data || verifyRes;

      if (baseVerify.statusCode === 401 || baseVerify.statusCode === 303) {
        setError(baseVerify.message || "Invalid OTP or session expired");
        setLoading(false);
        return;
      }

      // Use login tokens (MFA verify may not return new tokens)
      const finalToken = baseVerify.tokens?.jwtToken || baseVerify.jwtToken || tempToken;
      const finalRefresh = baseVerify.tokens?.refreshToken || baseVerify.refreshToken || tempRefreshToken;

      const userProfile: User = {
        id: tempUid,
        email: `${tempUid}@iga.local`,
        full_name: tempUid,
        role: mapRole(baseVerify.userType || baseVerify.role || tempUserType),
        status: 'ACTIVE' as const,
        manager: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setAuth(userProfile, finalToken, finalRefresh);
      toast.success("Authentication successful!", { position: "top-center" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || (err instanceof Error ? err.message : "MFA verification failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'rgba(37, 99, 235, 0.05)', filter: 'blur(100px)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'rgba(79, 70, 229, 0.05)', filter: 'blur(100px)', borderRadius: '50%' }} />

      <div className="glass" style={{
        width: '100%',
        maxWidth: 440,
        padding: 40,
        borderRadius: 28,
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0,0,0,0.1)',
        zIndex: 1,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72,
            height: 72,
            background: 'var(--grad-primary)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 12px 24px rgba(37, 99, 235, 0.2)'
          }}>
            <Shield size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-1px' }}>NextGen IGA</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: 6, fontWeight: 500 }}>Secure Identity Gateway</p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#b91c1c',
            padding: '14px 18px',
            borderRadius: 14,
            fontSize: '0.875rem',
            marginBottom: 28,
            textAlign: 'center',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {step === "LOGIN" && (
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="form-group">
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>UID / Username</label>
                <input
                  className="form-input"
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '14px 16px', borderRadius: 14, width: '100%', fontSize: '1rem', transition: 'all 0.2s ease' }}
                  type="text"
                  placeholder="e.g. jdoe"
                  value={uidInput}
                  onChange={(e) => setUidInput(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Password</label>
                <input
                  className="form-input"
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '14px 16px', borderRadius: 14, width: '100%', fontSize: '1rem', transition: 'all 0.2s ease' }}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  background: 'var(--grad-primary)',
                  border: 'none',
                  height: 52,
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.2)',
                  marginTop: 10,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {loading ? <span className="spinner" /> : "Sign In to Console"}
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 40, fontSize: "0.95rem", color: '#64748b' }}>
              New to the platform? <Link to="/register" style={{ color: "var(--color-primary)", fontWeight: 700, textDecoration: 'none' }}>Create an account</Link>
            </div>
          </form>
        )}

        {step === "MFA_SETUP" && (
          <form onSubmit={(e) => { e.preventDefault(); handleVerifyMfa(); }} style={{ textAlign: "center" }}>
            <h2 style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 800, marginBottom: 10 }}>Setup MFA</h2>
            <p style={{ color: "#64748b", marginBottom: 32, fontSize: "0.95rem" }}>
              Scan this code with your authenticator app
            </p>

            <div style={{ display: "inline-block", padding: 20, background: "white", borderRadius: 24, marginBottom: 32, boxShadow: '0 15px 35px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
              {qrCodeUrl ? (
                <QRCodeSVG value={qrCodeUrl} size={200} level="H" includeMargin={false} />
              ) : (
                <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 16 }}>
                  <QrCode size={56} color="#cbd5e1" />
                </div>
              )}
            </div>

            <div className="form-group" style={{ textAlign: "left" }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Verification Code</label>
              <input
                className="form-input"
                style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '14px 16px', borderRadius: 14, width: '100%', fontSize: '1.5rem', textAlign: 'center', letterSpacing: 8, fontWeight: 700 }}
                type="text"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading || mfaCode.length !== 6}
              style={{ background: 'var(--grad-primary)', height: 52, borderRadius: 14, fontWeight: 700, marginTop: 32, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
            >
              {loading ? <span className="spinner" /> : "Verify and Continue"}
            </button>
          </form>
        )}

        {step === "MFA_VERIFY" && (
          <form onSubmit={(e) => { e.preventDefault(); handleVerifyMfa(); }} style={{ textAlign: "center" }}>
            <h2 style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 800, marginBottom: 10 }}>Two-Factor Auth</h2>
            <p style={{ color: "#64748b", marginBottom: 32, fontSize: "0.95rem" }}>
              Enter the 6-digit code from your app
            </p>

            <div className="form-group" style={{ textAlign: "left" }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Security Code</label>
              <input
                className="form-input"
                style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', padding: '16px 16px', borderRadius: 14, width: '100%', fontSize: '1.75rem', textAlign: 'center', letterSpacing: 10, fontWeight: 700 }}
                type="text"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading || mfaCode.length !== 6}
              style={{ background: 'var(--grad-primary)', height: 52, borderRadius: 14, fontWeight: 700, marginTop: 32, width: '100%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {loading ? <span className="spinner" /> : "Authenticate"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep("LOGIN")}
              style={{ color: '#64748b', marginTop: 24, fontSize: '0.95rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              Back to login method
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
