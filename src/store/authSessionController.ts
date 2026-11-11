export interface ProfileSummary {
  id: number;
  teamName: string;
  venue?: string;
  capacity?: number;
  systemType?: string;
}

export interface OwnerProfilesResponsePayload {
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  maxProfiles?: number;
  currentProfiles?: number;
  profiles?: ProfileSummary[];
}

export const KEY_TOKEN = 'auth_token';
export const KEY_EMAIL = 'auth_email';
export const KEY_ROLE = 'auth_role';
export const KEY_ACTIVE_PROFILE_ID = 'active_profile_id';
export const KEY_PROFILES = 'auth_profiles';
export const KEY_SCANNER_NAME = 'scanner_name';

export const ALL_STORAGE_KEYS = [
  KEY_TOKEN,
  KEY_EMAIL,
  KEY_ROLE,
  KEY_ACTIVE_PROFILE_ID,
  KEY_PROFILES,
  KEY_SCANNER_NAME,
] as const;

export const VALID_ROLES = new Set(['OWNER', 'STAFF', 'ADMIN', 'SCANNER']);

export interface AuthState {
  token: string | null;
  email: string | null;
  role: string | null;
  profileId: string | null;
  profiles: ProfileSummary[];
  scannerName: string | null;
}

export const EMPTY_AUTH_STATE: AuthState = {
  token: null,
  email: null,
  role: null,
  profileId: null,
  profiles: [],
  scannerName: null,
};

export interface SecureStoreAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface ApiClientAdapter {
  get<T = OwnerProfilesResponsePayload>(url: string): Promise<{ data: T; status?: number }>;
}

export type ProfileReconciliationResolution =
  | 'KEPT'
  | 'AUTO_SELECTED_SINGLE'
  | 'CLEARED_MULTIPLE_AVAILABLE'
  | 'CLEARED_NONE_AVAILABLE';

export interface ProfileReconciliationResult {
  profileId: string | null;
  profiles: ProfileSummary[];
  resolution: ProfileReconciliationResolution;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidRole(role: unknown): role is string {
  return isNonEmptyString(role) && VALID_ROLES.has(role.trim().toUpperCase());
}

export function isStaffRole(role: unknown): boolean {
  if (!isValidRole(role)) return false;
  return role.trim().toUpperCase() !== 'OWNER';
}

export function sanitizeProfilesList(rawList: unknown): ProfileSummary[] {
  if (!Array.isArray(rawList)) {
    return [];
  }

  const sanitized: ProfileSummary[] = [];
  for (const item of rawList) {
    if (
      item &&
      typeof item === 'object' &&
      'id' in item &&
      (typeof (item as ProfileSummary).id === 'number' ||
        (typeof (item as ProfileSummary).id === 'string' &&
          String((item as ProfileSummary).id).trim() !== '')) &&
      typeof (item as ProfileSummary).teamName === 'string'
    ) {
      const numericId = Number((item as ProfileSummary).id);
      if (Number.isFinite(numericId)) {
        sanitized.push({
          ...(item as ProfileSummary),
          id: numericId,
        });
      }
    }
  }
  return sanitized;
}

export function parseStoredProfiles(profilesRaw: string | null | undefined): {
  profiles: ProfileSummary[];
  wasCorrupt: boolean;
} {
  if (!profilesRaw) {
    return { profiles: [], wasCorrupt: false };
  }

  try {
    const parsed = JSON.parse(profilesRaw);
    if (!Array.isArray(parsed)) {
      return { profiles: [], wasCorrupt: true };
    }
    const sanitized = sanitizeProfilesList(parsed);
    const wasCorrupt = sanitized.length !== parsed.length;
    return { profiles: sanitized, wasCorrupt };
  } catch {
    return { profiles: [], wasCorrupt: true };
  }
}

/**
 * Reconcilia el `profileId` activo de un OWNER frente a la lista autoritativa
 * de perfiles activos (no archivados) devuelta por `GET /api/profiles`.
 */
export function reconcileOwnerProfiles(
  currentProfileId: string | number | null | undefined,
  activeProfilesInput: ProfileSummary[]
): ProfileReconciliationResult {
  const activeProfiles = sanitizeProfilesList(activeProfilesInput);
  const normalizedCurrentId =
    currentProfileId !== null &&
    currentProfileId !== undefined &&
    String(currentProfileId).trim() !== ''
      ? String(currentProfileId).trim()
      : null;

  // 1. Si el perfil activo seleccionado sigue en la lista de perfiles activos -> conservar
  if (
    normalizedCurrentId !== null &&
    activeProfiles.some((p) => String(p.id) === normalizedCurrentId)
  ) {
    return {
      profileId: normalizedCurrentId,
      profiles: activeProfiles,
      resolution: 'KEPT',
    };
  }

  // 2. El perfil activo fue archivado/eliminado o no había ninguno seleccionado:
  // 2a. Único perfil activo disponible -> seleccionarlo automáticamente
  if (activeProfiles.length === 1) {
    return {
      profileId: String(activeProfiles[0].id),
      profiles: activeProfiles,
      resolution: 'AUTO_SELECTED_SINGLE',
    };
  }

  // 2b. Varios perfiles activos disponibles -> limpiar selección para elección explícita
  if (activeProfiles.length > 1) {
    return {
      profileId: null,
      profiles: activeProfiles,
      resolution: 'CLEARED_MULTIPLE_AVAILABLE',
    };
  }

  // 2c. Ningún perfil activo disponible -> conservar sesión sin profileId activo
  return {
    profileId: null,
    profiles: [],
    resolution: 'CLEARED_NONE_AVAILABLE',
  };
}

export interface CreateAuthSessionControllerOptions {
  storage: SecureStoreAdapter;
  apiClient?: ApiClientAdapter | null;
  onStateChange?: (state: AuthState) => void;
}

export interface AuthSessionController {
  getState: () => AuthState;
  getLogoutExecutionCount: () => number;
  getSessionEpoch: () => number;
  login: (
    token: string,
    email: string,
    role: string,
    profileId?: number | string | null,
    profiles?: ProfileSummary[],
    scannerName?: string | null
  ) => Promise<AuthState>;
  logout: () => Promise<AuthState>;
  restoreSession: () => Promise<AuthState>;
  switchProfile: (profileId: number | string) => Promise<AuthState>;
  syncOwnerProfiles: () => Promise<AuthState>;
}

async function clearAllStorageKeys(storage: SecureStoreAdapter): Promise<void> {
  await Promise.allSettled([
    storage.deleteItemAsync(KEY_TOKEN),
    storage.deleteItemAsync(KEY_EMAIL),
    storage.deleteItemAsync(KEY_ROLE),
    storage.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
    storage.deleteItemAsync(KEY_PROFILES),
    storage.deleteItemAsync(KEY_SCANNER_NAME),
  ]);
}

export function createAuthSessionController(
  options: CreateAuthSessionControllerOptions
): AuthSessionController {
  const { storage, apiClient, onStateChange } = options;

  let state: AuthState = { ...EMPTY_AUTH_STATE };
  let isLoggingOut = false;
  let logoutPromise: Promise<AuthState> | null = null;
  let logoutExecutionCount = 0;
  let sessionEpoch = 0;

  const notify = () => {
    if (typeof onStateChange === 'function') {
      onStateChange({
        ...state,
        profiles: [...state.profiles],
      });
    }
  };

  const logout = async (): Promise<AuthState> => {
    if (isLoggingOut && logoutPromise) {
      return logoutPromise;
    }

    isLoggingOut = true;
    logoutExecutionCount++;
    sessionEpoch++;

    logoutPromise = (async () => {
      try {
        await clearAllStorageKeys(storage);
      } finally {
        state = { ...EMPTY_AUTH_STATE };
        notify();
        isLoggingOut = false;
        logoutPromise = null;
      }
      return state;
    })();

    return logoutPromise;
  };

  const login = async (
    token: string,
    email: string,
    role: string,
    profileId?: number | string | null,
    profiles?: ProfileSummary[],
    scannerName?: string | null
  ): Promise<AuthState> => {
    sessionEpoch++;
    const loginEpoch = sessionEpoch;

    if (!isNonEmptyString(token) || !isNonEmptyString(email) || !isValidRole(role)) {
      throw new Error('Invalid login credentials: token, email and valid role are required');
    }

    const normalizedToken = token.trim();
    const normalizedEmail = email.trim();
    const normalizedRole = role.trim().toUpperCase();
    const normalizedScannerName = isNonEmptyString(scannerName) ? scannerName.trim() : null;

    let resolvedProfileId: string | null =
      profileId !== null && profileId !== undefined && String(profileId).trim() !== ''
        ? String(profileId).trim()
        : null;

    if (isStaffRole(normalizedRole)) {
      if (!resolvedProfileId) {
        throw new Error('Staff session requires a valid clubProfileId');
      }
    }

    const safeProfiles =
      normalizedRole === 'OWNER' ? sanitizeProfilesList(profiles ?? []) : [];

    if (normalizedRole === 'OWNER' && safeProfiles.length > 0) {
      if (
        resolvedProfileId !== null &&
        !safeProfiles.some((p) => String(p.id) === resolvedProfileId)
      ) {
        const reconciled = reconcileOwnerProfiles(resolvedProfileId, safeProfiles);
        resolvedProfileId = reconciled.profileId;
      } else if (resolvedProfileId === null && safeProfiles.length === 1) {
        resolvedProfileId = String(safeProfiles[0].id);
      }
    }

    try {
      await Promise.all([
        storage.setItemAsync(KEY_TOKEN, normalizedToken),
        storage.setItemAsync(KEY_EMAIL, normalizedEmail),
        storage.setItemAsync(KEY_ROLE, normalizedRole),
        storage.setItemAsync(KEY_PROFILES, JSON.stringify(safeProfiles)),
        resolvedProfileId
          ? storage.setItemAsync(KEY_ACTIVE_PROFILE_ID, resolvedProfileId)
          : storage.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
        normalizedScannerName
          ? storage.setItemAsync(KEY_SCANNER_NAME, normalizedScannerName)
          : storage.deleteItemAsync(KEY_SCANNER_NAME),
      ]);
    } catch (writeError) {
      // Rollback atómico ante fallo de escritura en SecureStore
      await clearAllStorageKeys(storage);
      if (loginEpoch === sessionEpoch) {
        state = { ...EMPTY_AUTH_STATE };
        notify();
      }
      throw writeError;
    }

    if (loginEpoch !== sessionEpoch) {
      return state;
    }

    state = {
      token: normalizedToken,
      email: normalizedEmail,
      role: normalizedRole,
      profileId: resolvedProfileId,
      profiles: safeProfiles,
      scannerName: normalizedScannerName,
    };
    notify();

    return state;
  };

  const syncOwnerProfilesForEpoch = async (expectedEpoch: number): Promise<AuthState> => {
    if (!apiClient || expectedEpoch !== sessionEpoch) {
      return state;
    }
    if (!state.token || state.role !== 'OWNER') {
      return state;
    }

    try {
      const response = await apiClient.get<OwnerProfilesResponsePayload>('/api/profiles');

      // Protección contra condición de carrera: si hubo logout() o nuevo login() mientras
      // GET /api/profiles estaba en vuelo, descartar inmediatamente la respuesta.
      if (expectedEpoch !== sessionEpoch || !state.token || state.role !== 'OWNER') {
        return state;
      }

      const rawProfiles = response?.data?.profiles;
      if (!Array.isArray(rawProfiles)) {
        // Respuesta malformada: tratar como fallo transitorio sin destruir la sesión cacheada
        return state;
      }

      const reconciled = reconcileOwnerProfiles(state.profileId, rawProfiles);

      // Persistir en SecureStore solo si el epoch sigue siendo válido
      if (expectedEpoch !== sessionEpoch) {
        return state;
      }

      await Promise.all([
        storage.setItemAsync(KEY_PROFILES, JSON.stringify(reconciled.profiles)),
        reconciled.profileId !== null
          ? storage.setItemAsync(KEY_ACTIVE_PROFILE_ID, reconciled.profileId)
          : storage.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
      ]);

      if (expectedEpoch !== sessionEpoch) {
        return state;
      }

      state = {
        ...state,
        profileId: reconciled.profileId,
        profiles: reconciled.profiles,
      };
      notify();
      return state;
    } catch (err: unknown) {
      if (expectedEpoch !== sessionEpoch) {
        return state;
      }

      const status = (err as { response?: { status?: number } })?.response?.status;

      if (status === 401) {
        // Token inválido o expirado -> cerrar sesión y limpiar SecureStore
        return await logout();
      }

      if (status === 403) {
        // Acceso denegado -> limpiar perfil activo prohibido sin destruir la autenticación
        await storage.deleteItemAsync(KEY_ACTIVE_PROFILE_ID).catch(() => {});
        if (expectedEpoch === sessionEpoch && state.token) {
          state = {
            ...state,
            profileId: null,
          };
          notify();
        }
        return state;
      }

      // Timeout, ausencia de red o error 5xx -> conservar sesión e información cacheada
      return state;
    }
  };

  const syncOwnerProfiles = async (): Promise<AuthState> => {
    if (!state.token || state.role !== 'OWNER') {
      return state;
    }
    return syncOwnerProfilesForEpoch(sessionEpoch);
  };

  const restoreSession = async (): Promise<AuthState> => {
    sessionEpoch++;
    const restoreEpoch = sessionEpoch;

    try {
      const [token, email, role, profileId, scannerName, profilesRaw] = await Promise.all([
        storage.getItemAsync(KEY_TOKEN),
        storage.getItemAsync(KEY_EMAIL),
        storage.getItemAsync(KEY_ROLE),
        storage.getItemAsync(KEY_ACTIVE_PROFILE_ID),
        storage.getItemAsync(KEY_SCANNER_NAME),
        storage.getItemAsync(KEY_PROFILES),
      ]);

      if (restoreEpoch !== sessionEpoch) {
        return state;
      }

      const hasAnyStoredKey =
        token !== null ||
        email !== null ||
        role !== null ||
        profileId !== null ||
        scannerName !== null ||
        profilesRaw !== null;

      // 1. Token ausente
      if (!isNonEmptyString(token)) {
        if (hasAnyStoredKey) {
          // Limpiar claves huérfanas residuales si no hay token válido
          await logout();
        }
        return state;
      }

      // 2. Validar claves obligatorias (email y role válido)
      if (!isNonEmptyString(email) || !isValidRole(role)) {
        await logout();
        return state;
      }

      const normalizedToken = token.trim();
      const normalizedEmail = email.trim();
      const normalizedRole = role.trim().toUpperCase();
      const normalizedProfileId = isNonEmptyString(profileId) ? profileId.trim() : null;
      const normalizedScannerName = isNonEmptyString(scannerName) ? scannerName.trim() : null;

      // 3. Para STAFF: profileId es obligatorio y nunca se invoca GET /api/profiles
      if (isStaffRole(normalizedRole)) {
        if (!normalizedProfileId) {
          await logout();
          return state;
        }

        const { profiles: parsedProfiles, wasCorrupt } = parseStoredProfiles(profilesRaw);
        if (wasCorrupt && restoreEpoch === sessionEpoch) {
          await storage.setItemAsync(KEY_PROFILES, '[]').catch(() => {});
        }

        if (restoreEpoch !== sessionEpoch) {
          return state;
        }

        state = {
          token: normalizedToken,
          email: normalizedEmail,
          role: normalizedRole,
          profileId: normalizedProfileId,
          profiles: parsedProfiles,
          scannerName: normalizedScannerName,
        };
        notify();
        return state;
      }

      // 4. Para OWNER: parsear perfiles cacheados de forma defensiva
      const { profiles: cachedProfiles, wasCorrupt } = parseStoredProfiles(profilesRaw);
      if (wasCorrupt && restoreEpoch === sessionEpoch) {
        await storage.setItemAsync(KEY_PROFILES, JSON.stringify(cachedProfiles)).catch(() => {});
      }

      if (restoreEpoch !== sessionEpoch) {
        return state;
      }

      state = {
        token: normalizedToken,
        email: normalizedEmail,
        role: 'OWNER',
        profileId: normalizedProfileId,
        profiles: cachedProfiles,
        scannerName: normalizedScannerName,
      };
      notify();

      // 5. Sincronizar con GET /api/profiles para validar si el perfil activo fue archivado
      return await syncOwnerProfilesForEpoch(restoreEpoch);
    } catch {
      if (restoreEpoch === sessionEpoch) {
        await logout();
      }
      return state;
    }
  };

  const switchProfile = async (profileId: number | string): Promise<AuthState> => {
    if (!state.token || state.role !== 'OWNER') {
      throw new Error('Only authenticated OWNER users can switch active profiles');
    }

    const pIdStr = String(profileId).trim();
    if (!pIdStr) {
      throw new Error('Invalid profileId');
    }

    if (
      state.profiles.length > 0 &&
      !state.profiles.some((p) => String(p.id) === pIdStr)
    ) {
      throw new Error(`Profile ${pIdStr} is not available in active profiles`);
    }

    await storage.setItemAsync(KEY_ACTIVE_PROFILE_ID, pIdStr);
    state = {
      ...state,
      profileId: pIdStr,
    };
    notify();
    return state;
  };

  return {
    getState: () => ({
      ...state,
      profiles: [...state.profiles],
    }),
    getLogoutExecutionCount: () => logoutExecutionCount,
    getSessionEpoch: () => sessionEpoch,
    login,
    logout,
    restoreSession,
    switchProfile,
    syncOwnerProfiles,
  };
}
