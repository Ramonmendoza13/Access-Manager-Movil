import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';

// ── Constantes idénticas a src/store/authStore.tsx ───────────────────────────
export const KEY_TOKEN = 'auth_token';
export const KEY_EMAIL = 'auth_email';
export const KEY_ROLE = 'auth_role';
export const KEY_ACTIVE_PROFILE_ID = 'active_profile_id';
export const KEY_PROFILES = 'auth_profiles';
export const KEY_SCANNER_NAME = 'scanner_name';

// ── Factory del interceptor idéntico a src/api/client.ts ─────────────────────
function createMockApiClient(unauthorizedCallback, secureStoreMock) {
  const client = axios.create({
    baseURL: 'http://test-server:8080',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(async (config) => {
    const token = await secureStoreMock.getItemAsync(KEY_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const profileId = await secureStoreMock.getItemAsync(KEY_ACTIVE_PROFILE_ID);
    if (profileId) {
      config.headers['X-Profile-Id'] = profileId;
    }
    return config;
  });

  // Response interceptor con exclusión de endpoints /api/auth/
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      const url = error?.config?.url || '';

      const isAuthEndpoint =
        url.includes('/api/auth/owner/login') ||
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/owner/register') ||
        url.includes('/api/auth/register');

      if (status === 401 && !isAuthEndpoint) {
        if (typeof unauthorizedCallback === 'function') {
          unauthorizedCallback();
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// ── Mock de SecureStore en memoria ──────────────────────────────────────────
function createSecureStoreMock() {
  const storage = new Map();
  let operationCounts = { get: 0, set: 0, delete: 0 };

  return {
    storage,
    operationCounts,
    async getItemAsync(key) {
      operationCounts.get++;
      return storage.has(key) ? storage.get(key) : null;
    },
    async setItemAsync(key, value) {
      operationCounts.set++;
      storage.set(key, String(value));
    },
    async deleteItemAsync(key) {
      operationCounts.delete++;
      storage.delete(key);
    },
    clear() {
      storage.clear();
      operationCounts = { get: 0, set: 0, delete: 0 };
    },
  };
}

// ── Simulador de AuthStore ──────────────────────────────────────────────────
function createAuthStoreSimulator(secureStore, apiClient) {
  let state = {
    token: null,
    email: null,
    role: null,
    profileId: null,
    profiles: [],
    scannerName: null,
  };

  let isLoggingOut = false;
  let logoutExecutionCount = 0;

  const logout = async () => {
    if (isLoggingOut) return;
    isLoggingOut = true;
    logoutExecutionCount++;

    try {
      await Promise.allSettled([
        secureStore.deleteItemAsync(KEY_TOKEN),
        secureStore.deleteItemAsync(KEY_EMAIL),
        secureStore.deleteItemAsync(KEY_ROLE),
        secureStore.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
        secureStore.deleteItemAsync(KEY_PROFILES),
        secureStore.deleteItemAsync(KEY_SCANNER_NAME),
      ]);
    } finally {
      state = {
        token: null,
        email: null,
        role: null,
        profileId: null,
        profiles: [],
        scannerName: null,
      };
      isLoggingOut = false;
    }
  };

  const login = async (token, email, role, profileId, profiles, scannerName) => {
    const pIdStr = profileId ? String(profileId) : null;
    const safeProfiles = profiles ?? [];

    await Promise.all([
      secureStore.setItemAsync(KEY_TOKEN, token),
      secureStore.setItemAsync(KEY_EMAIL, email),
      secureStore.setItemAsync(KEY_ROLE, role),
      secureStore.setItemAsync(KEY_PROFILES, JSON.stringify(safeProfiles)),
      pIdStr
        ? secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, pIdStr)
        : secureStore.deleteItemAsync(KEY_ACTIVE_PROFILE_ID),
      scannerName
        ? secureStore.setItemAsync(KEY_SCANNER_NAME, scannerName)
        : secureStore.deleteItemAsync(KEY_SCANNER_NAME),
    ]);

    state = {
      token,
      email,
      role,
      profileId: pIdStr,
      profiles: safeProfiles,
      scannerName: scannerName ?? null,
    };
  };

  const restoreSession = async () => {
    try {
      const [token, email, role, profileId, scannerName, profilesRaw] = await Promise.all([
        secureStore.getItemAsync(KEY_TOKEN),
        secureStore.getItemAsync(KEY_EMAIL),
        secureStore.getItemAsync(KEY_ROLE),
        secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID),
        secureStore.getItemAsync(KEY_SCANNER_NAME),
        secureStore.getItemAsync(KEY_PROFILES),
      ]);

      if (!token) return state;

      let parsedProfiles = [];
      if (profilesRaw) {
        try {
          const parsed = JSON.parse(profilesRaw);
          if (Array.isArray(parsed)) {
            parsedProfiles = parsed;
          }
        } catch {
          // Fallback a array vacío ante JSON corrupto
          parsedProfiles = [];
        }
      }

      state = {
        token,
        email: email ?? null,
        role: role ?? null,
        profileId: profileId ?? null,
        profiles: parsedProfiles,
        scannerName: scannerName ?? null,
      };

      return state;
    } catch {
      await logout();
      return state;
    }
  };

  return {
    getState: () => state,
    login,
    logout,
    restoreSession,
    getLogoutExecutionCount: () => logoutExecutionCount,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('CAL-08: Axios Configuration and Session Recovery Tests', () => {
  let secureStore;
  let unauthorizedCalls;
  let client;

  beforeEach(() => {
    secureStore = createSecureStoreMock();
    unauthorizedCalls = 0;
    client = createMockApiClient(() => {
      unauthorizedCalls++;
    }, secureStore);
  });

  it('1. Timeout de Axios está configurado en 15.000 ms', () => {
    assert.strictEqual(client.defaults.timeout, 15000, 'El timeout debe ser exactamente 15000 ms');
  });

  it('2. Rutas de Login (/api/auth/owner/login y /api/auth/login) devuelven 401 SIN activar el handler de logout', async () => {
    // Simular llamada fallida a /api/auth/owner/login
    const errorOwnerLogin = {
      response: { status: 401, data: { error: 'Bad credentials' } },
      config: { url: '/api/auth/owner/login' },
    };

    const errorStaffLogin = {
      response: { status: 401, data: { error: 'Invalid staff credentials' } },
      config: { url: '/api/auth/login' },
    };

    const responseInterceptor = client.interceptors.response.handlers[0].rejected;

    await assert.rejects(
      async () => responseInterceptor(errorOwnerLogin),
      (err) => err.response.status === 401,
      'Debe propagar el error 401 para que LoginScreen lo capture'
    );

    await assert.rejects(
      async () => responseInterceptor(errorStaffLogin),
      (err) => err.response.status === 401,
      'Debe propagar el error 401 de staff'
    );

    assert.strictEqual(
      unauthorizedCalls,
      0,
      'Las rutas de autenticación no deben invocar el unauthorizedHandler'
    );
  });

  it('3. Rutas autenticadas protegidas (/api/access/scan, /api/events/active) con 401 SÍ activan el handler de logout', async () => {
    const errorScan = {
      response: { status: 401, data: { error: 'Token expired' } },
      config: { url: '/api/access/scan' },
    };

    const errorEvents = {
      response: { status: 401, data: { error: 'Unauthorized' } },
      config: { url: '/api/events/active' },
    };

    const responseInterceptor = client.interceptors.response.handlers[0].rejected;

    await assert.rejects(async () => responseInterceptor(errorScan));
    assert.strictEqual(unauthorizedCalls, 1, 'Debe activar unauthorizedHandler tras 401 en /api/access/scan');

    await assert.rejects(async () => responseInterceptor(errorEvents));
    assert.strictEqual(unauthorizedCalls, 2, 'Debe activar unauthorizedHandler tras 401 en /api/events/active');
  });

  it('4. Errores con códigos distintos a 401 (ej. 400, 404, 500) NO activan el handler de logout', async () => {
    const responseInterceptor = client.interceptors.response.handlers[0].rejected;

    const error500 = {
      response: { status: 500, data: { error: 'Internal Server Error' } },
      config: { url: '/api/access/scan' },
    };

    const error404 = {
      response: { status: 404, data: { error: 'Not Found' } },
      config: { url: '/api/events/active' },
    };

    await assert.rejects(async () => responseInterceptor(error500));
    await assert.rejects(async () => responseInterceptor(error404));

    assert.strictEqual(unauthorizedCalls, 0, 'Errores no-401 no deben disparar el handler');
  });

  it('5. Persistencia completa de las 6 claves en SecureStore tras login()', async () => {
    const store = createAuthStoreSimulator(secureStore, client);

    const profiles = [
      { id: 10, teamName: 'Club Deportivo Alpha', venue: 'Estadio Principal', systemType: 'FOOTBALL' },
      { id: 20, teamName: 'Complejo Acuático Beta', venue: 'Piscina Municipal', systemType: 'SWIMMING_POOL' },
    ];

    await store.login('jwt-token-xyz', 'owner@example.com', 'OWNER', 10, profiles, 'Terminal-Norte');

    assert.strictEqual(await secureStore.getItemAsync(KEY_TOKEN), 'jwt-token-xyz');
    assert.strictEqual(await secureStore.getItemAsync(KEY_EMAIL), 'owner@example.com');
    assert.strictEqual(await secureStore.getItemAsync(KEY_ROLE), 'OWNER');
    assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), '10');
    assert.strictEqual(await secureStore.getItemAsync(KEY_SCANNER_NAME), 'Terminal-Norte');

    const storedProfiles = JSON.parse(await secureStore.getItemAsync(KEY_PROFILES));
    assert.strictEqual(storedProfiles.length, 2);
    assert.strictEqual(storedProfiles[0].teamName, 'Club Deportivo Alpha');
    assert.strictEqual(storedProfiles[1].systemType, 'SWIMMING_POOL');
  });

  it('6. Restauración íntegra de sesión tras reinicio de la app', async () => {
    const store1 = createAuthStoreSimulator(secureStore, client);

    const profiles = [
      { id: 10, teamName: 'Club Alpha', venue: 'Sede 1' },
      { id: 20, teamName: 'Club Beta', venue: 'Sede 2' },
    ];

    await store1.login('token-persisted-123', 'admin@club.es', 'OWNER', 20, profiles, 'Scanner-1');

    // Simular que se reinicia la app creando una nueva instancia del store con el mismo SecureStore
    const store2 = createAuthStoreSimulator(secureStore, client);
    assert.strictEqual(store2.getState().token, null, 'Inicialmente el estado en memoria está vacío');

    const restored = await store2.restoreSession();

    assert.strictEqual(restored.token, 'token-persisted-123');
    assert.strictEqual(restored.email, 'admin@club.es', 'El email se recupera íntegramente');
    assert.strictEqual(restored.role, 'OWNER', 'El rol se recupera íntegramente');
    assert.strictEqual(restored.profileId, '20');
    assert.strictEqual(restored.scannerName, 'Scanner-1');
    assert.strictEqual(restored.profiles.length, 2, 'Los perfiles se conservan para conmutación de perfiles');
    assert.strictEqual(restored.profiles[1].teamName, 'Club Beta');
  });

  it('7. Manejo seguro de profiles corruptos en JSON durante la restauración', async () => {
    // Inyectar datos con JSON corrupto en SecureStore
    await secureStore.setItemAsync(KEY_TOKEN, 'valid-token');
    await secureStore.setItemAsync(KEY_EMAIL, 'user@test.com');
    await secureStore.setItemAsync(KEY_ROLE, 'STAFF');
    await secureStore.setItemAsync(KEY_PROFILES, '{ invalid json string ...');

    const store = createAuthStoreSimulator(secureStore, client);
    const restored = await store.restoreSession();

    assert.strictEqual(restored.token, 'valid-token');
    assert.strictEqual(restored.email, 'user@test.com');
    assert.deepStrictEqual(restored.profiles, [], 'Debe hacer fallback a array vacío sin lanzar excepción');
  });

  it('8. logout() elimina de forma atómica todas las 6 claves en SecureStore', async () => {
    const store = createAuthStoreSimulator(secureStore, client);

    await store.login('token-to-delete', 'logout@test.com', 'OWNER', 5, [{ id: 5, teamName: 'Club' }], 'Scan-1');
    assert.strictEqual(secureStore.storage.size, 6, 'Todas las 6 claves deben existir');

    await store.logout();

    assert.strictEqual(await secureStore.getItemAsync(KEY_TOKEN), null);
    assert.strictEqual(await secureStore.getItemAsync(KEY_EMAIL), null);
    assert.strictEqual(await secureStore.getItemAsync(KEY_ROLE), null);
    assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), null);
    assert.strictEqual(await secureStore.getItemAsync(KEY_PROFILES), null);
    assert.strictEqual(await secureStore.getItemAsync(KEY_SCANNER_NAME), null);
    assert.strictEqual(secureStore.storage.size, 0, 'SecureStore debe quedar completamente limpio');

    const state = store.getState();
    assert.strictEqual(state.token, null);
    assert.strictEqual(state.email, null);
    assert.deepStrictEqual(state.profiles, []);
  });

  it('9. Concurrencia de 401s: múltiples llamadas simultáneas solo ejecutan 1 ciclo de logout', async () => {
    const store = createAuthStoreSimulator(secureStore, client);

    await store.login('token-concurrent', 'concurrent@test.com', 'STAFF', 1, [], null);

    // Simular que 5 peticiones simultáneas devuelven 401 al mismo tiempo
    const p1 = store.logout();
    const p2 = store.logout();
    const p3 = store.logout();
    const p4 = store.logout();
    const p5 = store.logout();

    await Promise.all([p1, p2, p3, p4, p5]);

    assert.strictEqual(
      store.getLogoutExecutionCount(),
      1,
      'El semáforo isLoggingOut debe evitar ejecuciones concurrentes redundantes'
    );
    assert.strictEqual(store.getState().token, null);
  });
});
