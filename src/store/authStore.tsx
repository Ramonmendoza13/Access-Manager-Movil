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
import {
  createAuthSessionController,
  EMPTY_AUTH_STATE,
  KEY_TOKEN,
  KEY_EMAIL,
  KEY_ROLE,
  KEY_ACTIVE_PROFILE_ID,
  KEY_PROFILES,
  KEY_SCANNER_NAME,
  type AuthSessionController,
  type AuthState,
  type ProfileSummary,
} from './authSessionController';

export {
  KEY_TOKEN,
  KEY_EMAIL,
  KEY_ROLE,
  KEY_ACTIVE_PROFILE_ID,
  KEY_PROFILES,
  KEY_SCANNER_NAME,
  type AuthState,
  type ProfileSummary,
};

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
  syncProfiles: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY_AUTH_STATE);
  const isMountedRef = useRef(true);

  const controllerRef = useRef<AuthSessionController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createAuthSessionController({
      storage: SecureStore,
      apiClient,
      onStateChange: (nextState) => {
        if (isMountedRef.current) {
          setState(nextState);
        }
      },
    });
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await controllerRef.current?.logout();
  }, []);

  // Registrar callback para 401 Unauthorized desde Axios
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  useEffect(() => {
    void controllerRef.current?.restoreSession();
  }, []);

  const login = useCallback(
    async (
      token: string,
      email: string,
      role: string,
      profileId?: number | string | null,
      profiles?: ProfileSummary[],
      scannerName?: string | null
    ) => {
      await controllerRef.current?.login(
        token,
        email,
        role,
        profileId,
        profiles,
        scannerName
      );
    },
    []
  );

  const switchProfile = useCallback(async (profileId: number | string) => {
    await controllerRef.current?.switchProfile(profileId);
  }, []);

  const syncProfiles = useCallback(async () => {
    await controllerRef.current?.syncOwnerProfiles();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, switchProfile, syncProfiles, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

