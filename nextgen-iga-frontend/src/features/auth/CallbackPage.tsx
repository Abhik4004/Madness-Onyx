//
// Flow:
//   KC PKCE exchange → KC tokens
//   → POST /api/user/login { email, kc_token } → backend JWT   (backend must validate KC token via JWKS)
//   → store: accessToken = backendJWT, kcRefreshToken = KC refresh token
//   → navigate to app

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, AlertTriangle } from "lucide-react";
import { exchangeCode, parseKCToken } from "../../api/keycloak.api";
import { usersApi } from "../../api/users.api";
import { useAuthStore } from "../../stores/auth.store";

let exchangeStarted = false;

export function CallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (exchangeStarted) return;
    exchangeStarted = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const kcError = params.get("error");
    const kcErrorDesc = params.get("error_description");

    const verifier = localStorage.getItem("pkce_verifier");
    const redirectTo =
      localStorage.getItem("post_login_redirect") ?? "/dashboard";

    localStorage.removeItem("pkce_verifier");
    localStorage.removeItem("post_login_redirect");

    if (kcError) {
      exchangeStarted = false;
      setErrorMsg(`KC error: ${kcError} — ${kcErrorDesc ?? ""}`);
      return;
    }
    if (!code) {
      exchangeStarted = false;
      setErrorMsg(
        "No auth code in callback URL. Check KC redirect URI config.",
      );
      return;
    }
    if (!verifier) {
      exchangeStarted = false;
      setErrorMsg("PKCE verifier missing. Try logging in again.");
      return;
    }

    exchangeCode(code, verifier)
      .then(async (kcTokens) => {
        // Parse identity from KC token
        let kcUser;
        try {
          kcUser = parseKCToken(kcTokens.access_token);
        } catch {
          exchangeStarted = false;
          setErrorMsg(
            "Failed to parse KC identity token. Check KC client configuration.",
          );
          return;
        }

        // Store KC access_token — backend must validate KC JWTs via JWKS.
        // If backend uses its own JWT system, use email+password form on the login page instead.
        setAuth(
          kcUser,
          kcTokens.access_token,
          kcTokens.refresh_token,
          kcTokens.refresh_token,
        );

        // Sync user to backend on first login
        try {
          const kc = kcUser as any;
          const syncPayload = {
            userId: kcUser.id || kc.sub || kc.uid,
            email: kcUser.email,
            full_name: kcUser.full_name || kc.name || `${kc.given_name || ''} ${kc.family_name || ''}`.trim() || kc.preferred_username,
            role: kcUser.role || "end_user"
          };
          await usersApi.syncUser(syncPayload, kcTokens.access_token);
        } catch (e) {
          console.error("Failed to sync user on login", e);
        }

        exchangeStarted = false;
        setTimeout(() => navigate(redirectTo, { replace: true }), 0);
      })
      .catch((err: Error) => {
        exchangeStarted = false;
        setErrorMsg(`Token exchange failed: ${err.message}`);
      });
  }, [navigate, setAuth]);

  if (errorMsg) {
    return (
      <div className="auth-page" style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#f8fafc',
        padding: 20
      }}>
        <div className="glass" style={{ 
          width: '100%', 
          maxWidth: 440, 
          padding: 40, 
          borderRadius: 28, 
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.05)',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          textAlign: "center" 
        }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ 
              width: 64, 
              height: 64, 
              background: 'var(--grad-primary)', 
              borderRadius: 16, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 16px'
            }}>
              <Shield size={32} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>NextGen IGA</h1>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              color: "#dc2626",
              marginBottom: 16,
              fontWeight: 600
            }}
          >
            <AlertTriangle size={20} />
            <span>Authentication failed</span>
          </div>
          <p
            style={{ marginBottom: 24, wordBreak: "break-word", color: '#64748b', fontSize: '0.9rem' }}
          >
            {errorMsg}
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 52, borderRadius: 14, fontWeight: 700, background: 'var(--grad-primary)', color: '#fff', border: 'none' }}
            onClick={() => {
              exchangeStarted = false;
              navigate("/login", { replace: true });
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#f8fafc',
      padding: 20
    }}>
      <div className="glass" style={{ 
        width: '100%', 
        maxWidth: 440, 
        padding: 40, 
        borderRadius: 28, 
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.05)',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        textAlign: "center" 
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ 
            width: 64, 
            height: 64, 
            background: 'var(--grad-primary)', 
            borderRadius: 16, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px'
          }}>
            <Shield size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>NextGen IGA</h1>
        </div>
        <div
          className="spinner spinner-lg"
          style={{ margin: "24px auto 16px", borderTopColor: 'var(--color-primary)' }}
        />
        <p style={{ color: '#64748b', fontWeight: 500 }}>Completing sign-in…</p>
      </div>
    </div>
  );
}
