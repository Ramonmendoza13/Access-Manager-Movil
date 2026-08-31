import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080',
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

export default apiClient;
