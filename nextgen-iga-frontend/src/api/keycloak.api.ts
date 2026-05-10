// src/api/keycloak.api.ts

import type { UserRole } from "../types/auth.types";

const REALM = import.meta.env.VITE_KEYCLOAK_REALM || "iga-realm";
const CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "onyx-frontend";
const REDIRECT = `${window.location.origin}/auth/callback`;

// Direct KC URL for browser redirects (no proxy — cookie domain must match)
const KC_URL = import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080";
const KC_DIRECT_BASE = `${KC_URL}/realms/${REALM}/protocol/openid-connect`;

// Vite proxy for AJAX token calls (avoids CORS on fetch)
const KC_PROXY_BASE = `/kc/realms/${REALM}/protocol/openid-connect`;

// ─── Types ───────────────────────────────────────────────────

export type KCTokens = {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
};

// ─── Direct Grant (ROPC) — POST creds, get tokens, no redirect ───────────────
// Requires: KC client → Direct Access Grants Enabled = ON

export async function directLogin(
  username: string,
  password: string,
): Promise<KCTokens> {
  const res = await fetch(`${KC_PROXY_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: CLIENT,
      username,
      password,
      scope: "openid email profile",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Invalid credentials");
  }
  return data;
}

// ─── PKCE redirect flow (fallback / MFA scenarios) ───────────────────────────

export function buildAuthUrl(challenge: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (loginHint) params.set("login_hint", loginHint);
  // Use direct KC URL — browser must hit KC directly so session cookie stays on localhost:8080
  return `${KC_DIRECT_BASE}/auth?${params}`;
}

// ─── Step 2 — Exchange auth code for tokens (called in /auth/callback) ────────

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<KCTokens> {
  const res = await fetch(`${KC_PROXY_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT,
      redirect_uri: REDIRECT,
      code,
      code_verifier: verifier,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? `HTTP ${res.status} from token endpoint`,
    );
  }
  return data;
}

// ─── Refresh tokens ───────────────────────────────────────────

export async function refreshTokens(refresh_token: string): Promise<KCTokens> {
  const res = await fetch(`${KC_PROXY_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT,
      refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("Refresh failed");
  return data;
}

// ─── Logout ───────────────────────────────────────────────────

export async function kcLogout(refresh_token: string): Promise<void> {
  await fetch(`${KC_PROXY_BASE}/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT,
      refresh_token,
    }),
  });
}

// ─── Parse KC access token into User shape ────────────────────

export function parseKCToken(access_token: string) {
  const payload = JSON.parse(
    atob(access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
  );

  return {
    id: payload.sub as string,
    email: payload.email as string,
    full_name: payload.name as string,
    role: (
      ((payload.realm_access?.roles as string[]) ?? []).find((r) =>
        ["admin", "supervisor", "end_user"].includes(r),
      ) ?? "end_user"
    ) as UserRole,
    status: "ACTIVE" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
