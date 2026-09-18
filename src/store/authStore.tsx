import React, { createContext, useContext, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

export interface ProfileSummary {
  id: number;
  teamName: string;
  venue?: string;
  systemType?: string;
}

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

  React.useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        const profileId = await SecureStore.getItemAsync('active_profile_id');
        const scannerName = await SecureStore.getItemAsync('scanner_name');
        if (token) {
          setState((prev) => ({
            ...prev,
            token,
            profileId,
            scannerName,
          }));
        }
      } catch (e) {
        console.warn('Failed to restore session:', e);
      }
    };
    restoreSession();
  }, []);

  const login = async (
    token: string,
    email: string,
    role: string,
    profileId?: number | string | null,
    profiles?: ProfileSummary[],
    scannerName?: string | null
  ) => {
    await SecureStore.setItemAsync('auth_token', token);
    const pIdStr = profileId ? String(profileId) : null;
    if (pIdStr) {
      await SecureStore.setItemAsync('active_profile_id', pIdStr);
    } else {
      await SecureStore.deleteItemAsync('active_profile_id');
    }
    if (scannerName) {
      await SecureStore.setItemAsync('scanner_name', scannerName);
    } else {
      await SecureStore.deleteItemAsync('scanner_name');
    }
    setState({
      token,
      email,
      role,
      profileId: pIdStr,
      profiles: profiles ?? [],
      scannerName: scannerName ?? null,
    });
  };

  const switchProfile = async (profileId: number | string) => {
    const pIdStr = String(profileId);
    await SecureStore.setItemAsync('active_profile_id', pIdStr);
    setState((prev) => ({ ...prev, profileId: pIdStr }));
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('active_profile_id');
    await SecureStore.deleteItemAsync('scanner_name');
    setState({ token: null, email: null, role: null, profileId: null, profiles: [], scannerName: null });
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
