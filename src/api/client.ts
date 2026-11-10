import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function getUnauthorizedHandler(): UnauthorizedHandler | null {
  return unauthorizedHandler;
}

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const profileId = await SecureStore.getItemAsync('active_profile_id');
  if (profileId) {
    config.headers['X-Profile-Id'] = profileId;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    // Rutas de autenticación excluidas del manejo global de 401
    // (permite el fallback de LoginScreen: Owner -> Staff)
    const isAuthEndpoint =
      url.includes('/api/auth/owner/login') ||
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/owner/register') ||
      url.includes('/api/auth/register');

    if (status === 401 && !isAuthEndpoint) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
