import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

interface ScanResultProps {
  result: {
    allowed: boolean;
    holderName: string;
    ticketType: string;
    message: string;
    isSeasonPass?: boolean;
  };
}

// Total display duration in deciseconds (25 × 100 ms = 2 500 ms)
const TOTAL_DECISECONDS = 25;

export default function ScanResult({ result }: ScanResultProps) {
  const { allowed, holderName, ticketType, message, isSeasonPass } = result;

  // ── 1. Fade-in animation ─────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [fadeAnim]);

  // ── 2. Countdown (deciseconds → ceil to whole seconds for display) ────────
  const [countdown, setCountdown] = useState(TOTAL_DECISECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 100);
    return () => {
      clearInterval(id);
    };
  }, []);

  // ── 3. Pulse animation for denied state ──────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (allowed) return; // only pulse on denied

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [allowed, pulseAnim]);

  // ── Configure state data & icons ──────────────────────────────────────────
  let bgOverlay = 'rgba(239, 68, 68, 0.92)'; // Default red denied
  let themeColor = '#EF4444';
  let title = '';
  let subtitle = '';
  let iconElement: React.ReactNode = <Feather name="x" size={48} color="#FFFFFF" />;

  if (allowed) {
    if (isSeasonPass) {
      bgOverlay = 'rgba(2, 132, 199, 0.94)'; // Sky/Cobalt blue
      themeColor = '#38BDF8';
      title = 'ABONADO VALIDADO';
      subtitle = ticketType || 'Pase de temporada';
      iconElement = <Feather name="user-check" size={48} color="#FFFFFF" />;
    } else {
      bgOverlay = 'rgba(16, 185, 129, 0.94)'; // Emerald green
      themeColor = '#10B981';
      title = 'ACCESO PERMITIDO';
      subtitle = holderName || 'Entrada válida';
      iconElement = <Feather name="check" size={54} color="#FFFFFF" />;
    }
  } else if (message && message.includes('no están habilitados')) {
    bgOverlay = 'rgba(30, 41, 59, 0.96)';
    themeColor = '#94A3B8';
    title = 'ABONOS DESACTIVADOS';
    subtitle = 'Este evento no admite pases de abonado';
    iconElement = <Feather name="slash" size={48} color="#FFFFFF" />;
  } else if (message && message.includes('ya utilizado hoy')) {
    bgOverlay = 'rgba(217, 119, 6, 0.94)'; // Amber
    themeColor = '#F59E0B';
    title = 'ABONO YA UTILIZADO HOY';
    subtitle = 'Este abonado ya ha registrado su entrada';
    iconElement = <Feather name="clock" size={48} color="#FFFFFF" />;
  } else if (message && message.includes('no es válido para este evento')) {
    bgOverlay = 'rgba(185, 28, 28, 0.94)';
    themeColor = '#EF4444';
    title = 'ABONO NO HABILITADO';
    subtitle = 'Los abonos están desactivados para este evento';
    iconElement = <Feather name="alert-triangle" size={48} color="#FFFFFF" />;
  } else if (message && message.includes('ya utilizada')) {
    bgOverlay = 'rgba(220, 38, 38, 0.94)';
    themeColor = '#EF4444';
    title = 'ENTRADA YA USADA';
    subtitle = 'Este ticket ya fue registrado previamente';
    iconElement = <Feather name="x-circle" size={48} color="#FFFFFF" />;
  } else if (message === 'Fuera de temporada') {
    bgOverlay = 'rgba(2, 132, 199, 0.94)';
    themeColor = '#38BDF8';
    title = 'FUERA DE TEMPORADA';
    subtitle = 'La instalación no está en período activo';
    iconElement = <Ionicons name="water-outline" size={48} color="#FFFFFF" />;
  } else if (message && message.includes('no es válida para hoy')) {
    bgOverlay = 'rgba(217, 119, 6, 0.94)';
    themeColor = '#F59E0B';
    title = 'ENTRADA NO VÁLIDA HOY';
    subtitle = 'Este ticket está fechado para otro día';
    iconElement = <Feather name="calendar" size={48} color="#FFFFFF" />;
  } else if (message === 'Sin perfil configurado') {
    bgOverlay = 'rgba(51, 65, 85, 0.94)';
    themeColor = '#94A3B8';
    title = 'SIN PERFIL CONFIGURADO';
    subtitle = 'Configura el perfil del club en el panel web';
    iconElement = <Feather name="settings" size={48} color="#FFFFFF" />;
  } else {
    bgOverlay = 'rgba(220, 38, 38, 0.94)';
    themeColor = '#EF4444';
    title = message || 'ACCESO DENEGADO';
    subtitle = 'Credencial no autorizada';
    iconElement = <Feather name="x" size={48} color="#FFFFFF" />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Background with pulse on denied */}
      <Animated.View
        style={[
          styles.background,
          { backgroundColor: bgOverlay },
          !allowed && { opacity: pulseAnim },
        ]}
      />

      {/* Countdown badge — top right */}
      <View style={styles.countdownBadge}>
        <Text style={styles.countdownText}>{Math.ceil(countdown / 10)}s</Text>
      </View>

      {/* Center Tactical Card */}
      <View style={styles.hudCard}>
        <View style={[styles.iconCircle, { borderColor: themeColor }]}>
          {iconElement}
        </View>

        <Text style={styles.primaryText}>{title}</Text>

        {!!subtitle && <Text style={styles.secondaryText}>{subtitle}</Text>}

        {allowed && isSeasonPass && !!holderName && (
          <View style={styles.holderBox}>
            <Feather name="user" size={13} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.holderText}>{holderName}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  countdownBadge: {
    position: 'absolute',
    top: 52,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  hudCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(9, 13, 22, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(248, 250, 252, 0.8)',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  holderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  holderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.4,
  },
});
