import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Backend URL:
 *  1. EXPO_PUBLIC_API_URL (e.g. in a .env file: EXPO_PUBLIC_API_URL=http://192.168.1.10:8000)
 *  2. Same computer that runs `expo start` (works with Expo Go on the same Wi-Fi)
 *  3. localhost (web) / 10.0.2.2 (Android emulator)
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.10:8081"
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:8000`;

  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
}

export const BASE_URL = resolveBaseUrl();

const KEYS = {
  access: 'tr.accessToken',
  refresh: 'tr.refreshToken',
};

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export async function loadTokens() {
  const [[, a], [, r]] = await AsyncStorage.multiGet([KEYS.access, KEYS.refresh]);
  accessToken = a;
  refreshToken = r;
  return { accessToken, refreshToken };
}

export async function saveTokens(access: string, refresh?: string) {
  accessToken = access;
  if (refresh) refreshToken = refresh;
  await AsyncStorage.multiSet([
    [KEYS.access, access],
    ...(refresh ? ([[KEYS.refresh, refresh]] as [string, string][]) : []),
  ]);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh]);
}

export const hasSession = () => !!accessToken;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// When the access token expires, refresh it once and retry the request.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
    await saveTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && refreshToken) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      await clearTokens();
      onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);

/** Turns any API error into a readable message */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as AxiosError<{ message?: string }>;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.message === 'Network Error' || e?.code === 'ECONNABORTED') {
    return `Cannot reach the server (${BASE_URL}). Make sure the backend is running.`;
  }
  return fallback;
}
