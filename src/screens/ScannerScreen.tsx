import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';
import ScanResult from '../components/ScanResult';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../store/authStore';

interface ScanResponse {
  allowed: boolean;
  holderName: string;
  ticketType: string;
  message: string;
  isSeasonPass?: boolean;
}

interface ActiveEvent {
  id: number;
  name: string;
  seasonPassEnabled: boolean;
}

interface ClubProfile {
  systemType: 'FOOTBALL' | 'SWIMMING_POOL';
  seasonStartDate: string | null;
  seasonEndDate: string | null;
}

function generateDeviceId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Corner arm component: one horizontal or vertical arm of a corner ──────────
interface CornerArmProps {
  style: object;
  color: string;
}
function CornerArm({ style, color }: CornerArmProps) {
  return <View style={[style, { backgroundColor: color }]} />;
}

// ── Single corner: two perpendicular arms ─────────────────────────────────────
type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface ScanCornerProps {
  position: CornerPosition;
  color: string;
}

const ARM_LENGTH = 24;
const ARM_THICKNESS = 3;

function ScanCorner({ position, color }: ScanCornerProps) {
  const isTop = position === 'topLeft' || position === 'topRight';
  const isLeft = position === 'topLeft' || position === 'bottomLeft';

  return (
    <View
      style={[
        styles.cornerContainer,
        isTop ? { top: 0 } : { bottom: 0 },
        isLeft ? { left: 0 } : { right: 0 },
      ]}
    >
      {/* Horizontal arm */}
      <CornerArm
        color={color}
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: ARM_LENGTH,
          height: ARM_THICKNESS,
        }}
      />
      {/* Vertical arm */}
      <CornerArm
        color={color}
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: ARM_THICKNESS,
          height: ARM_LENGTH,
        }}
      />
    </View>
  );
}

// ── Scan guide overlay ────────────────────────────────────────────────────────
interface ScanGuideProps {
  scanning: boolean;
}

function ScanGuide({ scanning }: ScanGuideProps) {
  const cornerColor = scanning ? '#38BDF8' : '#64748B';

  return (
    <View style={styles.guideWrapper}>
      <View style={styles.guideWindow}>
        <ScanCorner position="topLeft" color={cornerColor} />
        <ScanCorner position="topRight" color={cornerColor} />
        <ScanCorner position="bottomLeft" color={cornerColor} />
        <ScanCorner position="bottomRight" color={cornerColor} />
      </View>
      <Text style={styles.guideHint}>Apunta al código QR</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ScannerScreen() {
  const { scannerName, profileId } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const isProcessingRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [profile, setProfile] = useState<ClubProfile | null>(null);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Refetch when profileId changes (reaction to profile switch or logout)
  useEffect(() => {
    let isMounted = true;

    const fetchActiveEvent = async () => {
      try {
        const response = await apiClient.get<ActiveEvent>('/api/events/active');
        if (isMounted) {
          if (response.status === 204 || !response.data) {
            setActiveEvent(null);
          } else {
            setActiveEvent(response.data);
          }
        }
      } catch (err) {
        if (isMounted) {
          setActiveEvent(null);
        }
      }
    };

    const fetchProfile = async () => {
      try {
        const response = await apiClient.get<ClubProfile>('/api/profile');
        if (isMounted && response.data) {
          setProfile(response.data);
        }
      } catch (err) {
        console.warn('Error fetching profile:', err);
      }
    };

    fetchActiveEvent();
    fetchProfile();
    const interval = setInterval(() => {
      fetchActiveEvent();
      fetchProfile();
    }, 120000); // Polling cada 2 min — reduce carga en BD un 75% sin impacto en UX

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [profileId]);

  // Clean up any pending scanner reset timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      isProcessingRef.current = false;
    };
  }, []);

  const getPoolStatus = () => {
    if (!profile || !profile.seasonStartDate || !profile.seasonEndDate) return null;
    // Use local date (not UTC toISOString) to correctly handle midnight in Spain/Madrid
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    const inSeason = today >= profile.seasonStartDate && today <= profile.seasonEndDate;
    return {
      inSeason,
      text: inSeason
        ? `Temporada activa\n${profile.seasonStartDate} al ${profile.seasonEndDate}`
        : 'Fuera de temporada',
      color: inSeason ? '#10B981' : '#EF4444',
    };
  };

  const poolStatus = getPoolStatus();

  const handleGoBack = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    isProcessingRef.current = false;
    navigation.goBack();
  }, [navigation]);

  const onBarcodeScanned = useCallback(
    async (scanResult: BarcodeScanningResult) => {
      const { data } = scanResult;
      // Synchronous mutual exclusion check:
      // Prevents rapid-fire camera callbacks from invoking the scan API concurrently
      if (isProcessingRef.current || !scanning) return;
      isProcessingRef.current = true;
      setScanning(false);

      // Haptic on scan detection
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        // Get or generate persistent device ID
        let deviceId = await SecureStore.getItemAsync('device_id');
        if (!deviceId) {
          deviceId = generateDeviceId();
          await SecureStore.setItemAsync('device_id', deviceId);
        }

        const resolvedDeviceId = scannerName?.trim() || deviceId;

        const { data: scanResponse } = await apiClient.post<ScanResponse>(
          '/api/access/scan',
          { qrCode: data, deviceId: resolvedDeviceId }
        );

        // Haptics BEFORE setResult so feedback syncs with visual appearance
        await Haptics.notificationAsync(
          scanResponse.allowed
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error
        );
        setResult(scanResponse);
      } catch (err: unknown) {
        const axiosErr = err as any;
        // Also haptic on network error
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({
          allowed: false,
          holderName: '',
          ticketType: '',
          message:
            axiosErr?.response?.data?.error ||
            axiosErr?.message ||
            'Error de conexión con el servidor',
        });
      } finally {
        // Auto-reset after 2500ms regardless of success or failure
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current);
        }
        resetTimeoutRef.current = setTimeout(() => {
          setResult(null);
          isProcessingRef.current = false;
          setScanning(true);
        }, 2500);
      }
    },
    [scanning, scannerName]
  );

  // ── Permission not yet determined ──
  if (!permission) {
    return <View style={styles.container} />;
  }

  // ── Permission denied ──
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrapper}>
            <Feather name="camera" size={32} color="#0284C7" />
          </View>
          <Text style={styles.permissionTitle}>Acceso a la cámara requerido</Text>
          <Text style={styles.permissionBody}>
            Esta aplicación requiere acceso al hardware de la cámara para escanear y validar credenciales QR en tiempo real.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.permissionButtonText}>Conceder acceso</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera active ──
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Camera feed */}
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
      />

      {/* Event/System Status Banner */}
      {profile?.systemType === 'SWIMMING_POOL' ? (
        <View style={styles.bannerContainer}>
          <View style={styles.bannerContent}>
            <View style={[styles.statusRow, { flex: 1 }]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: poolStatus?.color ?? '#ef4444', marginRight: 6 },
                ]}
              />
              <Text style={[styles.statusText, { fontSize: 10, flex: 1, lineHeight: 13 }]} numberOfLines={2}>
                {poolStatus?.text}
              </Text>
            </View>
            <View style={styles.scannerBadge}>
              <Feather name="smartphone" size={10} color="#38BDF8" />
              <Text style={styles.scannerBadgeText} numberOfLines={1}>
                {scannerName || 'Scanner General'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        activeEvent && (
          <View style={styles.bannerContainer}>
            <View style={styles.bannerContent}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {activeEvent.name}
                </Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: activeEvent.seasonPassEnabled ? '#10b981' : '#ef4444' },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {activeEvent.seasonPassEnabled ? 'Abonos activos' : 'Abonos desactivados'}
                  </Text>
                </View>
              </View>
              <View style={styles.scannerBadge}>
                <Feather name="map-pin" size={10} color="#38BDF8" />
                <Text style={styles.scannerBadgeText} numberOfLines={1}>
                  {scannerName || 'Scanner General'}
                </Text>
              </View>
            </View>
          </View>
        )
      )}

      {/* Dark vignette overlay with transparent center */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          {/* Transparent scan zone — guide drawn on top */}
          <View style={styles.scanZone} />
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay} />
      </View>

      {/* Scan guide (corners + hint) centered over the transparent zone */}
      <ScanGuide scanning={scanning} />

      {/* Back button — top left */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleGoBack}
        activeOpacity={0.75}
      >
        <Feather name="arrow-left" size={14} color="#F8FAFC" style={{ marginRight: 6 }} />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      {/* Scan result full-screen overlay */}
      {result && <ScanResult result={result} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const GUIDE_SIZE = 220;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Permission screen ──
  permissionContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  permissionIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionBody: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Dark vignette overlay ──
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,13,22,0.65)',
  },
  middleRow: {
    flexDirection: 'row',
    height: GUIDE_SIZE,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,13,22,0.65)',
  },
  // The center is transparent — no background
  scanZone: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,13,22,0.65)',
  },

  // ── Scan guide ──
  guideWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideWindow: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
  },
  guideHint: {
    marginTop: 20,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Corner container (absolute positioned within guideWindow) ──
  cornerContainer: {
    position: 'absolute',
    width: ARM_LENGTH,
    height: ARM_LENGTH,
  },

  // ── Back button ──
  backButton: {
    position: 'absolute',
    top: 52,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    zIndex: 20,
  },
  backText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // ── Event Status Banner ──
  bannerContainer: {
    position: 'absolute',
    top: 52,
    right: 20,
    left: 120, // Evita colisión con el botón de volver (left: 20)
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    zIndex: 10,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
  },
  scannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    gap: 3,
    maxWidth: 130,
  },
  scannerBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
