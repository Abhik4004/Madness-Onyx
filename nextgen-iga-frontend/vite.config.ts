import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const AUTH_SERVER = process.env.AUTH_SERVER_URL || "http://18.60.129.12:8080";

function gatewayProxy() {
  return {
    target: GATEWAY,
    changeOrigin: true,
    secure: false,
    configure: (proxy: any) => {
      proxy.on("error", (err: any, _req: any, res: any) => {
        if (err.message?.includes("ECONNREFUSED")) return;
        const serverRes = res as import("http").ServerResponse;
        if (!serverRes.headersSent) {
          serverRes.writeHead(502, { "Content-Type": "application/json" });
          serverRes.end(JSON.stringify({ ok: false, status: 502, message: "Gateway unavailable" }));
        }
      });
    },
  };
}

function authProxy() {
  return {
    target: AUTH_SERVER,
    changeOrigin: true,
    secure: false,
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // ── Auth & Gateway ──────────────────────────────────────────
      "/api/login": gatewayProxy(),
      "/api/mfa": gatewayProxy(),
      "/api/user/register": gatewayProxy(),
      "/api/provision/users": authProxy(),

      // ── Gateway ───────────────────────────────────────────────────────
      "/api/users": gatewayProxy(),
      "/api/admin": gatewayProxy(),
      "/api": gatewayProxy(), // catch-all — must be last

      // ── Health ────────────────────────────────────────────────────────
      "/health": gatewayProxy(),

      // ── WebSocket ─────────────────────────────────────────────────────
      "/ws": {
        target: "ws://localhost:3000",
        changeOrigin: true,
        ws: true,
        configure: (proxy: any) => {
          proxy.on("error", (err: any) => {
            if (!err.message?.includes("ECONNREFUSED")) {
              console.error("[ws-proxy] error:", err.message);
            }
          });
        },
      },
    },
  },
});