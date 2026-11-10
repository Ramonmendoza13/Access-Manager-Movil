import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, { setUnauthorizedHandler } from '../api/client';

export interface ProfileSummary {
  id: number;
  teamName: string;
  venue?: string;
  systemType?: string;
}

export const KEY_TOKEN = 'auth_token';
export const KEY_EMAIL = 'auth_email';
export const KEY_ROLE = 'auth_role';
export const KEY_ACTIVE_PROFILE_ID = 'active_profile_id';
export const KEY_PROFILES = 'auth_profiles';
export const KEY_SCANNER_NAME = 'scanner_name';

interface AuthState {
  token: string | null;
  email: string | null;
  role: string | null;
  profileId: string | null;
  profiles: ProfileSummary[];
  scannerName: string | null;
}

interface AuthContextType extends AuthState {
  login: (
    token: string,
    email: string,
    role: string,
    profileId?: number | string | null,
    profiles?: ProfileSummary[],
    scannerName?: string | null
  ) => Promise<void>;
  switchProfile: (profileId: number | string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    email: null,
    role: null,
    profileId: null,
    profiles: [],
    scannerName: null,
  });

  const isLoggingOutRef = useRef(false);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await Promise.allSettled([
        SecureStore.deleteItemAsync(KEY_TOKEN),
        SecureStore.deleteItemAsync(KEY_EMAIL),
        SecureStore.deleteItemAsync(KEY_ROLE),
        SecureStore.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
        SecureStore.deleteItemAsync(KEY_PROFILES),
        SecureStore.deleteItemAsync(KEY_SCANNER_NAME),
      ]);
    } finally {
      setState({
        token: null,
        email: null,
        role: null,
        profileId: null,
        profiles: [],
        scannerName: null,
      });
      isLoggingOutRef.current = false;
    }
  }, []);

  // Registrar callback para 401 Unauthorized desde Axios
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const [token, email, role, profileId, scannerName, profilesRaw] = await Promise.all([
          SecureStore.getItemAsync(KEY_TOKEN),
          SecureStore.getItemAsync(KEY_EMAIL),
          SecureStore.getItemAsync(KEY_ROLE),
          SecureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID),
          SecureStore.getItemAsync(KEY_SCANNER_NAME),
          SecureStore.getItemAsync(KEY_PROFILES),
        ]);

        if (!token) {
          return;
        }

        let parsedProfiles: ProfileSummary[] = [];
        if (profilesRaw) {
          try {
            const parsed = JSON.parse(profilesRaw);
            if (Array.isArray(parsed)) {
              parsedProfiles = parsed;
            }
          } catch {
            console.warn('Failed to parse cached profiles JSON, defaulting to empty list');
          }
        }

        if (isMounted) {
          setState({
            token,
            email: email ?? null,
            role: role ?? null,
            profileId: profileId ?? null,
            profiles: parsedProfiles,
            scannerName: scannerName ?? null,
          });
        }

        // Sincronización en segundo plano de perfiles para OWNER
        if (role === 'OWNER') {
          try {
            const { data } = await apiClient.get<{ profiles?: ProfileSummary[] }>('/api/profiles');
            if (isMounted && data?.profiles && Array.isArray(data.profiles)) {
              setState((prev) => ({
                ...prev,
                profiles: data.profiles ?? [],
              }));
              await SecureStore.setItemAsync(KEY_PROFILES, JSON.stringify(data.profiles));
            }
          } catch {
            // Silencioso: si no hay red o falla la sincronización, se conservan los perfiles cacheados
          }
        }
      } catch (e) {
        console.warn('Failed to restore session:', e);
        await logout();
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const login = async (
    token: string,
    email: string,
    role: string,
    profileId?: number | string | null,
    profiles?: ProfileSummary[],
    scannerName?: string | null
  ) => {
    const pIdStr = profileId ? String(profileId) : null;
    const safeProfiles = profiles ?? [];

    await Promise.all([
      SecureStore.setItemAsync(KEY_TOKEN, token),
      SecureStore.setItemAsync(KEY_EMAIL, email),
      SecureStore.setItemAsync(KEY_ROLE, role),
      SecureStore.setItemAsync(KEY_PROFILES, JSON.stringify(safeProfiles)),
      pIdStr
        ? SecureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, pIdStr)
        : SecureStore.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
      scannerName
        ? SecureStore.setItemAsync(KEY_SCANNER_NAME, scannerName)
        : SecureStore.deleteItemAsync(KEY_SCANNER_NAME),
    ]);

    setState({
      token,
      email,
      role,
      profileId: pIdStr,
      profiles: safeProfiles,
      scannerName: scannerName ?? null,
    });
  };

  const switchProfile = async (profileId: number | string) => {
    const pIdStr = String(profileId);
    await SecureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, pIdStr);
    setState((prev) => ({ ...prev, profileId: pIdStr }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, switchProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
