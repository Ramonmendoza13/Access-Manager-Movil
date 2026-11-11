import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  createAuthSessionController,
  reconcileOwnerProfiles,
  KEY_TOKEN,
  KEY_EMAIL,
  KEY_ROLE,
  KEY_ACTIVE_PROFILE_ID,
  KEY_PROFILES,
  KEY_SCANNER_NAME,
} from '../src/store/authSessionController.ts';
import {
  createConfiguredApiClient,
  DEFAULT_API_TIMEOUT_MS,
} from '../src/api/interceptors.ts';

// ── Adaptador en memoria de SecureStore para inyección en el controlador real ──
function createInMemorySecureStore({ failOnKey = null } = {}) {
  const storage = new Map();
  const operationCounts = { get: 0, set: 0, delete: 0 };

  return {
    storage,
    operationCounts,
    async getItemAsync(key) {
      operationCounts.get++;
      return storage.has(key) ? storage.get(key) : null;
    },
    async setItemAsync(key, value) {
      operationCounts.set++;
      if (failOnKey && key === failOnKey) {
        throw new Error(`Simulated SecureStore write failure on key: ${key}`);
      }
      storage.set(key, String(value));
    },
    async deleteItemAsync(key) {
      operationCounts.delete++;
      storage.delete(key);
    },
    clear() {
      storage.clear();
      operationCounts.get = 0;
      operationCounts.set = 0;
      operationCounts.delete = 0;
    },
  };
}

describe('CAL-08: Real Production AuthSessionController & Axios Interceptors Suite (15 Mandatory Scenarios)', () => {
  let secureStore;
  let unauthorizedCalls;
  let client;

  beforeEach(() => {
    secureStore = createInMemorySecureStore();
    unauthorizedCalls = 0;
    client = createConfiguredApiClient({
      baseURL: 'http://test-server:8080',
      storage: secureStore,
      getUnauthorizedHandler: () => () => {
        unauthorizedCalls++;
      },
    });
  });

  it('Escenario 1: Restauración correcta de sesión OWNER y persistencia de las 6 claves en SecureStore', async () => {
    const initialProfiles = [
      { id: 10, teamName: 'Club Deportivo Alpha', venue: 'Estadio Norte', capacity: 5000, systemType: 'FOOTBALL' },
      { id: 20, teamName: 'Complejo Acuático Beta', venue: 'Piscina Olímpica', capacity: 800, systemType: 'SWIMMING_POOL' },
    ];

    let profilesApiCalls = 0;
    const mockApiClient = {
      async get(url) {
        assert.strictEqual(url, '/api/profiles');
        profilesApiCalls++;
        return {
          status: 200,
          data: {
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            maxProfiles: 3,
            currentProfiles: 2,
            profiles: initialProfiles,
          },
        };
      },
    };

    const controller1 = createAuthSessionController({
      storage: secureStore,
      apiClient: mockApiClient,
    });

    await controller1.login(
      'jwt-owner-token-123',
      'owner@club.es',
      'OWNER',
      20,
      initialProfiles,
      'Terminal-Principal'
    );

    assert.strictEqual(await secureStore.getItemAsync(KEY_TOKEN), 'jwt-owner-token-123');
    assert.strictEqual(await secureStore.getItemAsync(KEY_EMAIL), 'owner@club.es');
    assert.strictEqual(await secureStore.getItemAsync(KEY_ROLE), 'OWNER');
    assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), '20');
    assert.strictEqual(await secureStore.getItemAsync(KEY_SCANNER_NAME), 'Terminal-Principal');
    assert.strictEqual(JSON.parse(await secureStore.getItemAsync(KEY_PROFILES)).length, 2);

    // Simular reinicio de la app con una nueva instancia del controlador real
    const controller2 = createAuthSessionController({
      storage: secureStore,
      apiClient: mockApiClient,
    });

    const restored = await controller2.restoreSession();

    assert.strictEqual(profilesApiCalls, 1, 'OWNER debe sincronizar con GET /api/profiles al restaurar');
    assert.strictEqual(restored.token, 'jwt-owner-token-123');
    assert.strictEqual(restored.email, 'owner@club.es');
    assert.strictEqual(restored.role, 'OWNER');
    assert.strictEqual(restored.profileId, '20');
    assert.strictEqual(restored.scannerName, 'Terminal-Principal');
    assert.strictEqual(restored.profiles.length, 2);
  });

  it('Escenario 2: Restauración correcta de sesión STAFF (sin llamar a GET /api/profiles y sin permitir cambio de perfil)', async () => {
    let profilesApiCalls = 0;
    const mockApiClient = {
      async get() {
        profilesApiCalls++;
        throw new Error('GET /api/profiles must never be called for STAFF');
      },
    };

    const controller1 = createAuthSessionController({
      storage: secureStore,
      apiClient: mockApiClient,
    });

    await controller1.login(
      'jwt-staff-token-456',
      'portero@club.es',
      'STAFF',
      77,
      [],
      'Puerta-Sur-02'
    );

    const controller2 = createAuthSessionController({
      storage: secureStore,
      apiClient: mockApiClient,
    });

    const restored = await controller2.restoreSession();

    assert.strictEqual(profilesApiCalls, 0, 'STAFF jamás debe invocar GET /api/profiles');
    assert.strictEqual(restored.token, 'jwt-staff-token-456');
    assert.strictEqual(restored.email, 'portero@club.es');
    assert.strictEqual(restored.role, 'STAFF');
    assert.strictEqual(restored.profileId, '77');
    assert.strictEqual(restored.scannerName, 'Puerta-Sur-02');
    assert.deepStrictEqual(restored.profiles, []);

    // Verificar que un usuario STAFF no puede cambiar de perfil a otro tenant
    await assert.rejects(
      async () => controller2.switchProfile(99),
      /Only authenticated OWNER users can switch active profiles/
    );
    assert.strictEqual(controller2.getState().profileId, '77');
  });

  it('Escenario 3: Perfil activo que sigue disponible tras GET /api/profiles se conserva intacto', async () => {
    const cachedProfiles = [
      { id: 10, teamName: 'Club A' },
      { id: 20, teamName: 'Club B' },
    ];
    const updatedRemoteProfiles = [
      { id: 10, teamName: 'Club A' },
      { id: 20, teamName: 'Club B Renovado', venue: 'Nuevo Estadio' },
      { id: 30, teamName: 'Club C Nuevo' },
    ];

    await secureStore.setItemAsync(KEY_TOKEN, 'owner-token');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@test.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '20');
    await secureStore.setItemAsync(KEY_PROFILES, JSON.stringify(cachedProfiles));

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          return { data: { profiles: updatedRemoteProfiles } };
        },
      },
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(restored.profileId, '20', 'Debe conservar el perfil 20 porque sigue activo');
    assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), '20');
    assert.strictEqual(restored.profiles.length, 3);
    assert.strictEqual(restored.profiles[1].teamName, 'Club B Renovado');
  });

  it('Escenario 4: Detección de perfil activo archivado tras downgrade de Stripe en reconcileOwnerProfiles', () => {
    // El propietario tenía seleccionado el perfil 20, pero tras downgrade a FREE
    // GET /api/profiles (findByOwnerIdAndArchivedAtIsNull) solo devuelve el perfil 10.
    const result = reconcileOwnerProfiles('20', [
      { id: 10, teamName: 'Club Principal Superviviente', systemType: 'FOOTBALL' },
    ]);

    assert.strictEqual(result.resolution, 'AUTO_SELECTED_SINGLE');
    assert.strictEqual(result.profileId, '10');
    assert.strictEqual(result.profiles.length, 1);
  });

  it('Escenario 5: Un único perfil activo disponible tras archivado -> auto-selección y persistencia en SecureStore', async () => {
    // Estado previo al downgrade: 2 perfiles (10 y 20), con el perfil 20 seleccionado
    await secureStore.setItemAsync(KEY_TOKEN, 'owner-downgraded-token');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@stripe-downgrade.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '20');
    await secureStore.setItemAsync(
      KEY_PROFILES,
      JSON.stringify([
        { id: 10, teamName: 'Club Antiguo 10' },
        { id: 20, teamName: 'Club Archivado 20' },
      ])
    );

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          // GET /api/profiles ya no incluye el perfil 20 (archivado por StripeService.archiveExcessProfiles)
          return {
            data: {
              subscriptionPlan: 'FREE',
              subscriptionStatus: 'CANCELLED',
              maxProfiles: 1,
              currentProfiles: 1,
              profiles: [{ id: 10, teamName: 'Club Antiguo 10', systemType: 'FOOTBALL' }],
            },
          };
        },
      },
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(
      restored.profileId,
      '10',
      'Debe seleccionar automáticamente el único perfil activo restante (10)'
    );
    assert.strictEqual(
      await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID),
      '10',
      'Debe actualizar active_profile_id en SecureStore con el nuevo perfil activo'
    );
    assert.strictEqual(restored.profiles.length, 1);
    assert.strictEqual(restored.profiles[0].id, 10);
  });

  it('Escenario 6: Varios perfiles activos disponibles cuando el perfil activo fue archivado -> limpia profileId a null para elección explícita', async () => {
    // El propietario tenía 3 perfiles (10, 20, 30) con el 30 activo; el 30 fue archivado y quedan 10 y 20 activos
    await secureStore.setItemAsync(KEY_TOKEN, 'owner-multi-token');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@multi.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '30');
    await secureStore.setItemAsync(
      KEY_PROFILES,
      JSON.stringify([
        { id: 10, teamName: 'Club 10' },
        { id: 20, teamName: 'Club 20' },
        { id: 30, teamName: 'Club 30 Archivado' },
      ])
    );

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          return {
            data: {
              subscriptionPlan: 'PRO',
              subscriptionStatus: 'ACTIVE',
              maxProfiles: 3,
              currentProfiles: 2,
              profiles: [
                { id: 10, teamName: 'Club 10' },
                { id: 20, teamName: 'Club 20' },
              ],
            },
          };
        },
      },
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(
      restored.token,
      'owner-multi-token',
      'La sesión OWNER sigue autenticada'
    );
    assert.strictEqual(
      restored.profileId,
      null,
      'No debe elegir arbitrariamente entre varios perfiles: profileId debe quedar en null'
    );
    assert.strictEqual(
      await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID),
      null,
      'Debe eliminar active_profile_id de SecureStore hasta que el usuario elija en ProfileSelectorScreen'
    );
    assert.strictEqual(restored.profiles.length, 2);

    // Una vez que el usuario selecciona explícitamente el perfil 20 en ProfileSelectorScreen:
    const afterSelect = await controller.switchProfile(20);
    assert.strictEqual(afterSelect.profileId, '20');
    assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), '20');
  });

  it('Escenario 7: Ningún perfil activo disponible (profiles = []) -> conserva autenticación OWNER válida pero limpia profileId', async () => {
    await secureStore.setItemAsync(KEY_TOKEN, 'owner-zero-profiles-token');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@noprofiles.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '55');
    await secureStore.setItemAsync(
      KEY_PROFILES,
      JSON.stringify([{ id: 55, teamName: 'Club 55' }])
    );

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          return {
            data: {
              subscriptionPlan: 'FREE',
              subscriptionStatus: 'ACTIVE',
              maxProfiles: 1,
              currentProfiles: 0,
              profiles: [],
            },
          };
        },
      },
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(restored.token, 'owner-zero-profiles-token');
    assert.strictEqual(restored.email, 'owner@noprofiles.com');
    assert.strictEqual(restored.role, 'OWNER');
    assert.strictEqual(restored.profileId, null);
    assert.deepStrictEqual(restored.profiles, []);
    assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), null);
    assert.strictEqual(await secureStore.getItemAsync(KEY_PROFILES), '[]');
  });

  it('Escenario 8: Fallos temporales en GET /api/profiles (timeout, sin red, HTTP 500 o JSON malformado) conservan la sesión y el perfil cacheado', async () => {
    const cachedProfiles = [
      { id: 10, teamName: 'Club Cacheado 10' },
      { id: 20, teamName: 'Club Cacheado 20' },
    ];

    const transientFailures = [
      // 1. Timeout de Axios (15.000 ms)
      () => {
        const err = new Error('timeout of 15000ms exceeded');
        err.code = 'ECONNABORTED';
        throw err;
      },
      // 2. Caída total de red (sin objeto response)
      () => {
        throw new Error('Network Error');
      },
      // 3. Error 502 Bad Gateway / 500 Internal Server Error
      () => {
        const err = new Error('Server Error');
        err.response = { status: 502 };
        throw err;
      },
      // 4. Respuesta 200 con payload malformado (profiles no es un array)
      () => ({
        status: 200,
        data: { profiles: 'invalid-non-array-payload' },
      }),
    ];

    for (const simulateFailure of transientFailures) {
      secureStore.clear();
      await secureStore.setItemAsync(KEY_TOKEN, 'resilient-owner-token');
      await secureStore.setItemAsync(KEY_EMAIL, 'owner@offline.com');
      await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
      await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '20');
      await secureStore.setItemAsync(KEY_PROFILES, JSON.stringify(cachedProfiles));

      const controller = createAuthSessionController({
        storage: secureStore,
        apiClient: {
          async get() {
            return simulateFailure();
          },
        },
      });

      const restored = await controller.restoreSession();

      assert.strictEqual(restored.token, 'resilient-owner-token');
      assert.strictEqual(restored.profileId, '20', 'Debe conservar el profileId cacheado ante fallo transitorio');
      assert.strictEqual(restored.profiles.length, 2, 'Debe conservar los perfiles cacheados');
      assert.strictEqual(await secureStore.getItemAsync(KEY_TOKEN), 'resilient-owner-token');
      assert.strictEqual(await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID), '20');
    }
  });

  it('Escenario 9: Respuesta 401 (en GET /api/profiles y en el interceptor de Axios para rutas protegidas, excluyendo login) cierra sesión y limpia SecureStore', async () => {
    // 9.A: Verificar timeout de 15000ms e interceptores de Axios reales de src/api/interceptors.ts
    assert.strictEqual(client.defaults.timeout, DEFAULT_API_TIMEOUT_MS);
    assert.strictEqual(client.defaults.timeout, 15000);

    const responseInterceptor = client.interceptors.response.handlers[0].rejected;

    // Endpoints de login excluidos de logout automático en 401
    await assert.rejects(async () =>
      responseInterceptor({
        response: { status: 401 },
        config: { url: '/api/auth/owner/login' },
      })
    );
    await assert.rejects(async () =>
      responseInterceptor({
        response: { status: 401 },
        config: { url: '/api/auth/login' },
      })
    );
    assert.strictEqual(unauthorizedCalls, 0, 'Login con 401 no debe disparar unauthorizedHandler');

    // Endpoints protegidos con 401 sí disparan unauthorizedHandler
    await assert.rejects(async () =>
      responseInterceptor({
        response: { status: 401 },
        config: { url: '/api/access/scan' },
      })
    );
    assert.strictEqual(unauthorizedCalls, 1);

    // 9.B: 401 durante la sincronización de GET /api/profiles limpia las 6 claves y cierra sesión
    await secureStore.setItemAsync(KEY_TOKEN, 'expired-jwt');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@expired.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '10');
    await secureStore.setItemAsync(KEY_PROFILES, JSON.stringify([{ id: 10, teamName: 'Club' }]));
    await secureStore.setItemAsync(KEY_SCANNER_NAME, 'Scanner-1');

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          const err = new Error('Unauthorized');
          err.response = { status: 401 };
          throw err;
        },
      },
    });

    const stateAfter401 = await controller.restoreSession();

    assert.strictEqual(stateAfter401.token, null);
    assert.strictEqual(stateAfter401.email, null);
    assert.strictEqual(stateAfter401.role, null);
    assert.strictEqual(stateAfter401.profileId, null);
    assert.deepStrictEqual(stateAfter401.profiles, []);
    assert.strictEqual(secureStore.storage.size, 0, 'Todas las 6 claves deben borrarse tras 401');
  });

  it('Escenario 10: Respuesta 403 en GET /api/profiles limpia el perfil activo prohibido sin destruir la sesión autenticada', async () => {
    await secureStore.setItemAsync(KEY_TOKEN, 'valid-jwt-403');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@forbidden.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '999');
    await secureStore.setItemAsync(KEY_PROFILES, JSON.stringify([{ id: 999, teamName: 'Club Prohibido' }]));

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          const err = new Error('Forbidden');
          err.response = { status: 403 };
          throw err;
        },
      },
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(restored.token, 'valid-jwt-403', 'No debe destruir el token en un 403');
    assert.strictEqual(restored.email, 'owner@forbidden.com');
    assert.strictEqual(restored.role, 'OWNER');
    assert.strictEqual(restored.profileId, null, 'Debe limpiar el profileId prohibido');
    assert.strictEqual(
      await secureStore.getItemAsync(KEY_ACTIVE_PROFILE_ID),
      null,
      'Debe borrar active_profile_id en SecureStore para no seguir enviando X-Profile-Id prohibido'
    );
  });

  it('Escenario 11: JSON de perfiles corrupto en SecureStore (auth_profiles) se sanea a [] sin romper la restauración', async () => {
    await secureStore.setItemAsync(KEY_TOKEN, 'staff-valid-token');
    await secureStore.setItemAsync(KEY_EMAIL, 'staff@club.es');
    await secureStore.setItemAsync(KEY_ROLE, 'STAFF');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '15');
    await secureStore.setItemAsync(KEY_PROFILES, '{ malformed json [[[');

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: null,
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(restored.token, 'staff-valid-token');
    assert.strictEqual(restored.email, 'staff@club.es');
    assert.strictEqual(restored.role, 'STAFF');
    assert.strictEqual(restored.profileId, '15');
    assert.deepStrictEqual(restored.profiles, []);
    assert.strictEqual(
      await secureStore.getItemAsync(KEY_PROFILES),
      '[]',
      'Debe reescribir auth_profiles con un array JSON válido vacío'
    );
  });

  it('Escenario 12: Token ausente en SecureStore mantiene estado desautenticado y limpia claves huérfanas', async () => {
    // Sin token pero con claves residuales huérfanas
    await secureStore.setItemAsync(KEY_EMAIL, 'orphan@club.es');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '10');

    const controller = createAuthSessionController({
      storage: secureStore,
    });

    const restored = await controller.restoreSession();

    assert.strictEqual(restored.token, null);
    assert.strictEqual(restored.email, null);
    assert.strictEqual(restored.role, null);
    assert.strictEqual(restored.profileId, null);
    assert.strictEqual(
      secureStore.storage.size,
      0,
      'Debe limpiar cualquier clave huérfana si auth_token no existe'
    );
  });

  it('Escenario 13: Datos de sesión parcialmente guardados (token sin email/role o STAFF sin profileId) ejecutan logout defensivo', async () => {
    const partialCases = [
      // Caso A: token presente pero falta email
      async () => {
        await secureStore.setItemAsync(KEY_TOKEN, 'orphan-token-1');
        await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
      },
      // Caso B: token y email presentes pero falta role
      async () => {
        await secureStore.setItemAsync(KEY_TOKEN, 'orphan-token-2');
        await secureStore.setItemAsync(KEY_EMAIL, 'user@test.com');
      },
      // Caso C: role corrupto/desconocido
      async () => {
        await secureStore.setItemAsync(KEY_TOKEN, 'orphan-token-3');
        await secureStore.setItemAsync(KEY_EMAIL, 'user@test.com');
        await secureStore.setItemAsync(KEY_ROLE, 'SUPER_HACKER');
      },
      // Caso D: usuario STAFF sin active_profile_id obligatorio
      async () => {
        await secureStore.setItemAsync(KEY_TOKEN, 'staff-without-profile');
        await secureStore.setItemAsync(KEY_EMAIL, 'staff@test.com');
        await secureStore.setItemAsync(KEY_ROLE, 'STAFF');
      },
    ];

    for (const setupPartialState of partialCases) {
      secureStore.clear();
      await setupPartialState();

      const controller = createAuthSessionController({
        storage: secureStore,
      });

      const restored = await controller.restoreSession();

      assert.strictEqual(restored.token, null, 'Sesión parcialmente corrupta no debe restaurarse');
      assert.strictEqual(restored.email, null);
      assert.strictEqual(restored.role, null);
      assert.strictEqual(restored.profileId, null);
      assert.strictEqual(
        secureStore.storage.size,
        0,
        'Debe limpiar todas las claves de SecureStore ante una sesión parcialmente corrupta'
      );
    }
  });

  it('Escenario 14: Error durante una escritura en SecureStore durante login() realiza rollback completo', async () => {
    const failingStore = createInMemorySecureStore({ failOnKey: KEY_PROFILES });
    const controller = createAuthSessionController({
      storage: failingStore,
    });

    await assert.rejects(
      async () =>
        controller.login(
          'token-rollback',
          'owner@rollback.com',
          'OWNER',
          10,
          [{ id: 10, teamName: 'Club Rollback' }],
          'Scanner-Rollback'
        ),
      /Simulated SecureStore write failure on key: auth_profiles/
    );

    assert.strictEqual(
      failingStore.storage.size,
      0,
      'El rollback de login() debe eliminar todas las claves escritas antes del fallo'
    );
    assert.strictEqual(controller.getState().token, null);
    assert.strictEqual(controller.getState().email, null);
    assert.strictEqual(controller.getState().profileId, null);
  });

  it('Escenario 15: Concurrencia — logout() mientras GET /api/profiles está en vuelo (sessionEpoch) y ráfaga de logouts simultáneos', async () => {
    await secureStore.setItemAsync(KEY_TOKEN, 'token-in-flight');
    await secureStore.setItemAsync(KEY_EMAIL, 'owner@race.com');
    await secureStore.setItemAsync(KEY_ROLE, 'OWNER');
    await secureStore.setItemAsync(KEY_ACTIVE_PROFILE_ID, '10');
    await secureStore.setItemAsync(KEY_PROFILES, JSON.stringify([{ id: 10, teamName: 'Club 10' }]));

    let resolveProfilesRequest;
    const delayedProfilesPromise = new Promise((resolve) => {
      resolveProfilesRequest = resolve;
    });

    const controller = createAuthSessionController({
      storage: secureStore,
      apiClient: {
        async get() {
          return delayedProfilesPromise;
        },
      },
    });

    // 1. Iniciar restoreSession() -> lee SecureStore y queda esperando GET /api/profiles
    const restorePromise = controller.restoreSession();

    // Dar un tick para que restoreSession llegue al await de apiClient.get('/api/profiles')
    await new Promise((r) => setTimeout(r, 10));

    // 2. Disparar 5 llamadas concurrentes a logout() mientras GET /api/profiles sigue en vuelo
    await Promise.all([
      controller.logout(),
      controller.logout(),
      controller.logout(),
      controller.logout(),
      controller.logout(),
    ]);

    assert.strictEqual(
      controller.getLogoutExecutionCount(),
      1,
      'El semáforo isLoggingOut debe ejecutar un único ciclo de borrado ante llamadas simultáneas'
    );
    assert.strictEqual(secureStore.storage.size, 0);
    assert.strictEqual(controller.getState().token, null);

    // 3. Ahora llega la respuesta tardía de GET /api/profiles
    resolveProfilesRequest({
      status: 200,
      data: {
        profiles: [{ id: 10, teamName: 'Club Fantasma Tardío' }],
      },
    });

    const finalState = await restorePromise;

    // 4. Verificar que sessionEpoch descartó la respuesta tardía y no contaminó ni el estado ni SecureStore
    assert.strictEqual(finalState.token, null);
    assert.strictEqual(finalState.profileId, null);
    assert.deepStrictEqual(finalState.profiles, []);
    assert.strictEqual(
      secureStore.storage.size,
      0,
      'La respuesta tardía de GET /api/profiles no debe volver a escribir en SecureStore tras logout()'
    );
  });
});
