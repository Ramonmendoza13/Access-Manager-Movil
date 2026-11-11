import * as SecureStore from 'expo-secure-store';
import {
  createConfiguredApiClient,
  type UnauthorizedHandler,
} from './interceptors';

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function getUnauthorizedHandler(): UnauthorizedHandler | null {
  return unauthorizedHandler;
}

const apiClient = createConfiguredApiClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080',
  storage: SecureStore,
  getUnauthorizedHandler,
});

export default apiClient;

