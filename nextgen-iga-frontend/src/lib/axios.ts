import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/auth.store";

const AUTH_URL = "/";
const AI_BASE_URL = "http://13.234.90.97/api/v1/";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/";
const KC_BASE = import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080";
const REALM = import.meta.env.VITE_KEYCLOAK_REALM || "iga-realm";
const CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "onyx-frontend";

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Standard API client (uses Vite proxy)
export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Direct Auth client (hits the external server directly)
export const authClient = axios.create({
  baseURL: "http://18.60.129.12:8080",
  headers: { "Content-Type": "application/json" },
});

// AI Analytics client
export const aiClient = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 120000, // Increased to 2 minutes for report generation
  headers: { "Content-Type": "application/json" },
});

// IGA Recommendation engine client
export const igaRecommendationClient = axios.create({
  baseURL: "https://iga-accessrecomendation.onrender.com",
  headers: { "Content-Type": "application/json" },
});

// ── Attach Bearer token + auto-detect Content-Type ───────────────────────────
// ── Attach Bearer token + auto-detect Content-Type ───────────────────────────
const authInterceptor = (config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  const isLoginPath = config.url?.endsWith("/login") || config.url?.endsWith("/api/login");

  if (token && config.headers && !isLoginPath) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }


  if (config.data instanceof FormData && config.headers) {
    config.headers.delete("Content-Type");
  }

  return config;
};

apiClient.interceptors.request.use(authInterceptor);
aiClient.interceptors.request.use(authInterceptor);
authClient.interceptors.request.use(authInterceptor);

// ── Response interceptor for authClient ──────────────────────────────────────
authClient.interceptors.response.use(
  (response) => {
    console.log(`[auth] ${response.config.method?.toUpperCase()} ${response.config.url} success:`, response.status);
    return response;
  },
  (error) => {
    console.error(`[auth] ${error.config?.method?.toUpperCase()} ${error.config?.url} error:`, error.response?.status || error.message);
    return Promise.reject(error);
  }
);


// ── Response interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ── 401 → refresh via Keycloak ───────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // ↓ Only change from original — hits KC instead of your backend
        const res = await fetch(
          `${KC_BASE}/realms/${REALM}/protocol/openid-connect/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: CLIENT,
              refresh_token: refreshToken,
            }),
          },
        );

        const tokens = await res.json();
        if (!tokens.access_token) throw new Error("KC refresh failed");

        const newAccessToken: string = tokens.access_token;
        const newRefreshToken: string = tokens.refresh_token;
        // ↑ End of change

        useAuthStore.getState().setAccessToken(newAccessToken);
        useAuthStore.getState().setRefreshToken(newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 403) {
      window.location.href = "/403";
    }

    const isNotification = error.config?.url?.includes("/api/notifications");

    if (!isNotification) {
      if (error.response?.status === 500) {
        toast.error("Something went wrong. Please try again.");
      }

      if (error.response?.status === 502) {
        toast.error("Service unavailable. Please try again shortly.");
      }

      if (error.response?.status === 504) {
        toast.error("Service timeout — please retry.");
      }
    }

    return Promise.reject(error);
  },
);
