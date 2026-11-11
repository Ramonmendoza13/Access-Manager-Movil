import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export const DEFAULT_API_TIMEOUT_MS = 15000;
export const HEADER_PROFILE_ID = 'X-Profile-Id';
export const STORAGE_KEY_TOKEN = 'auth_token';
export const STORAGE_KEY_ACTIVE_PROFILE_ID = 'active_profile_id';

export type UnauthorizedHandler = () => void | Promise<void>;

export interface TokenProfileStorage {
  getItemAsync(key: string): Promise<string | null>;
}

export const AUTH_EXCLUDED_ENDPOINTS = [
  '/api/auth/owner/login',
  '/api/auth/login',
  '/api/auth/owner/register',
  '/api/auth/register',
] as const;

export function isExcludedAuthEndpoint(url?: string | null): boolean {
  if (!url) return false;
  return AUTH_EXCLUDED_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

export interface CreateApiClientOptions {
  baseURL?: string;
  timeout?: number;
  storage: TokenProfileStorage;
  getUnauthorizedHandler: () => UnauthorizedHandler | null;
}

export function attachAuthInterceptors(
  client: AxiosInstance,
  storage: TokenProfileStorage,
  getUnauthorizedHandler: () => UnauthorizedHandler | null
): AxiosInstance {
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getItemAsync(STORAGE_KEY_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const profileId = await storage.getItemAsync(STORAGE_KEY_ACTIVE_PROFILE_ID);
    if (profileId) {
      config.headers[HEADER_PROFILE_ID] = profileId;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      const url = error?.config?.url || '';

      // Rutas de autenticación excluidas del manejo global de 401
      // (permite el fallback de LoginScreen: Owner -> Staff)
      if (status === 401 && !isExcludedAuthEndpoint(url)) {
        const handler = getUnauthorizedHandler();
        if (typeof handler === 'function') {
          await handler();
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

export function createConfiguredApiClient(options: CreateApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080',
    timeout: options.timeout ?? DEFAULT_API_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return attachAuthInterceptors(client, options.storage, options.getUnauthorizedHandler);
}
