import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@monitor/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  /** Whether the user ticked "remember me" at login. Sessions without it
   *  get auto-logged-out by useIdleLogout after a period of inactivity. */
  rememberMe: boolean;
  /** True when the user logged in with a one-time reset code. While set, the
   *  router redirects every navigation to /first-time-password so the only
   *  thing they can do is set a real password. */
  mustChangePassword: boolean;
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: User;
    rememberMe?: boolean;
    mustChangePassword?: boolean;
  }) => void;
  setTokens: (data: {
    accessToken: string;
    refreshToken: string;
    mustChangePassword?: boolean;
  }) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      rememberMe: false,
      mustChangePassword: false,
      setAuth: ({
        accessToken,
        refreshToken,
        user,
        rememberMe = false,
        mustChangePassword = false,
      }) => set({ accessToken, refreshToken, user, rememberMe, mustChangePassword }),
      setTokens: ({ accessToken, refreshToken, mustChangePassword = false }) =>
        set({ accessToken, refreshToken, mustChangePassword }),
      setUser: (user) => set({ user }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          rememberMe: false,
          mustChangePassword: false,
        }),
    }),
    { name: 'auth' },
  ),
);
