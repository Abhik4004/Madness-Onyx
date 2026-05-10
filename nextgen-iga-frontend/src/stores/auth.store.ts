import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types/auth.types";

interface AuthState {
  user: User | null;
  accessToken: string | null;      // backend JWT — used for all API calls
  refreshToken: string | null;     // backend refresh token (or KC refresh as fallback)
  kcRefreshToken: string | null;   // KC refresh token — re-obtain backend JWT when it expires
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setAuth: (user: User, accessToken: string, refreshToken: string, kcRefreshToken?: string) => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  setKcRefreshToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      kcRefreshToken: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setAuth: (user, accessToken, refreshToken, kcRefreshToken) =>
        set({ user, accessToken, refreshToken, kcRefreshToken: kcRefreshToken ?? null }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setKcRefreshToken: (kcRefreshToken) => set({ kcRefreshToken }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, kcRefreshToken: null }),
    }),
    {
      name: "iga-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        kcRefreshToken: state.kcRefreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
