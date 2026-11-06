import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('ALTA-08: Scanner Mutual Exclusion and Debounce Tests', () => {
  let isProcessing = false;
  let scanning = true;
  let resetTimeout = null;
  let apiCallCount = 0;
  let lastProcessedQr = null;
  let lastResult = null;
  let hapticCount = 0;

  // Mock de la lógica síncrona implementada en ScannerScreen
  async function simulateBarcodeScan(qrCode, mockApiCall) {
    // 1. Bloqueo síncrono atómico
    if (isProcessing || !scanning) {
      return { skipped: true };
    }
    isProcessing = true;
    scanning = false;

    // 2. Feedback háptico de detección
    hapticCount++;

    try {
      apiCallCount++;
      lastProcessedQr = qrCode;
      const response = await mockApiCall(qrCode);
      lastResult = response;
      return { skipped: false, response };
    } catch (err) {
      lastResult = { allowed: false, message: err?.message || 'Error de red' };
      return { skipped: false, error: err };
    } finally {
      // 3. Temporizador de liberación / reseteo controlado
      if (resetTimeout) {
        clearTimeout(resetTimeout);
      }
      resetTimeout = setTimeout(() => {
        lastResult = null;
        isProcessing = false;
        scanning = true;
      }, 2500);
    }
  }

  function simulateReset() {
    if (resetTimeout) {
      clearTimeout(resetTimeout);
    }
    lastResult = null;
    isProcessing = false;
    scanning = true;
  }

  beforeEach(() => {
    isProcessing = false;
    scanning = true;
    resetTimeout = null;
    apiCallCount = 0;
    lastProcessedQr = null;
    lastResult = null;
    hapticCount = 0;
  });

  it('1. Dos callbacks síncronos con el mismo QR: solo uno invoca la API', async () => {
    let apiExecuted = 0;
    const mockApi = async (qr) => {
      apiExecuted++;
      return { allowed: true, message: 'Acceso concedido' };
    };

    // Dos llamadas consecutivas simulando callbacks rápidos del native camera frame
    const p1 = simulateBarcodeScan('TICKET-123', mockApi);
    const p2 = simulateBarcodeScan('TICKET-123', mockApi);

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.strictEqual(res1.skipped, false, 'La primera llamada debe procesarse');
    assert.strictEqual(res2.skipped, true, 'La segunda llamada síncrona debe descartarse inmediatamente');
    assert.strictEqual(apiExecuted, 1, 'La API solo debe invocarse exactamente 1 vez');
    assert.strictEqual(hapticCount, 1, 'El háptico inicial solo se ejecuta 1 vez');
  });

  it('2. Dos callbacks simultáneos con distinto QR: el segundo se bloquea', async () => {
    let apiExecuted = 0;
    const mockApi = async (qr) => {
      apiExecuted++;
      // Simular latencia de red
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { allowed: true, message: 'Acceso concedido' };
    };

    const p1 = simulateBarcodeScan('TICKET-A', mockApi);
    const p2 = simulateBarcodeScan('TICKET-B', mockApi);

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.strictEqual(res1.skipped, false);
    assert.strictEqual(res2.skipped, true);
    assert.strictEqual(apiExecuted, 1);
    assert.strictEqual(lastProcessedQr, 'TICKET-A');
  });

  it('3. Respuesta autorizada: resultado guardado y estado bloqueado hasta reset', async () => {
    const mockApi = async () => ({ allowed: true, message: 'Acceso concedido' });

    await simulateBarcodeScan('TICKET-VALID', mockApi);

    assert.strictEqual(lastResult.allowed, true);
    assert.strictEqual(isProcessing, true, 'El escáner permanece bloqueado durante la visualización del resultado');
    assert.strictEqual(scanning, false);

    // Intentar escanear mientras muestra resultado
    const attemptDuringCooldown = await simulateBarcodeScan('TICKET-OTHER', mockApi);
    assert.strictEqual(attemptDuringCooldown.skipped, true);
    assert.strictEqual(apiCallCount, 1);
  });

  it('4. Respuesta denegada: estado bloqueado y resultado reflejado', async () => {
    const mockApi = async () => ({ allowed: false, message: 'Entrada ya utilizada' });

    await simulateBarcodeScan('TICKET-USED', mockApi);

    assert.strictEqual(lastResult.allowed, false);
    assert.strictEqual(lastResult.message, 'Entrada ya utilizada');
    assert.strictEqual(isProcessing, true);
  });

  it('5. Error de red: no deja bloqueado permanentemente el escáner tras reset', async () => {
    const mockApi = async () => {
      throw new Error('Network timeout');
    };

    await simulateBarcodeScan('TICKET-FAIL', mockApi);

    assert.strictEqual(lastResult.allowed, false);
    assert.strictEqual(lastResult.message, 'Network timeout');

    // Tras el reseteo manual o por timeout
    simulateReset();

    assert.strictEqual(isProcessing, false, 'El escáner debe quedar desbloqueado tras el reset');
    assert.strictEqual(scanning, true, 'El escáner debe volver a permitir lecturas');

    // Ahora una nueva llamada debe ser admitida
    const mockOk = async () => ({ allowed: true, message: 'Ok' });
    const retryResult = await simulateBarcodeScan('TICKET-RETRY', mockOk);
    assert.strictEqual(retryResult.skipped, false);
    assert.strictEqual(apiCallCount, 2);
  });

  it('6. Reinicio del escáner limpia timer pendiente y reactiva lectura', async () => {
    const mockApi = async () => ({ allowed: true, message: 'Ok' });

    await simulateBarcodeScan('TICKET-1', mockApi);
    assert.strictEqual(isProcessing, true);

    // Simular unmount o navegación / reset
    simulateReset();

    assert.strictEqual(isProcessing, false);
    assert.strictEqual(scanning, true);

    const nextScan = await simulateBarcodeScan('TICKET-2', mockApi);
    assert.strictEqual(nextScan.skipped, false);
    assert.strictEqual(lastProcessedQr, 'TICKET-2');
  });
});
