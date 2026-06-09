import axios from 'axios';
import { useAuthStore } from '@/features/auth/store';
import { toast } from '@/lib/toast';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 on any authenticated endpoint means the access token expired or
    // was revoked — drop the session and notify, so the user understands the
    // sudden return to login. We skip the toast on the /auth/login endpoint
    // itself (wrong-credentials messaging is shown inline by the page).
    if (error.response?.status === 401) {
      const url: string = error.config?.url ?? '';
      const wasLoggedIn = useAuthStore.getState().accessToken != null;
      useAuthStore.getState().clear();
      if (wasLoggedIn && !url.includes('/auth/login')) {
        toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      }
    }
    return Promise.reject(error);
  },
);
