import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';

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
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

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
          toValue: 0.85,
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

  // ── Render ────────────────────────────────────────────────────────────────
  let bgColor = 'rgba(239,68,68,0.88)'; // default denied rojo
  let icon = '✗';
  let title = '';
  let subtitle = '';
  let showBadge = false;
  let titleColor: string | null = null;
  let subtitleColor: string | null = null;

  if (allowed) {
    if (isSeasonPass) {
      bgColor = 'rgba(26, 35, 126, 0.92)'; // #1a237e semi-transparente
      icon = '🎫';
      title = 'ABONADO';
      titleColor = '#facc15'; // amarillo
      subtitle = ticketType; // ej: "Abonado nº 7"
      subtitleColor = '#ffffff'; // blanco
    } else {
      bgColor = 'rgba(34,197,94,0.92)'; // verde
      icon = '✓';
      title = 'ACCESO PERMITIDO';
      subtitle = holderName;
    }
  } else if (message && message.includes('no están habilitados')) {
    bgColor = 'rgba(51, 65, 85, 0.92)'; // gris oscuro
    icon = '🚫';
    title = 'ABONOS DESACTIVADOS';
    subtitle = 'Este evento no admite abonos';
  } else if (message && message.includes('ya utilizado hoy')) {
    bgColor = 'rgba(249,115,22,0.92)'; // naranja
    icon = '⏰';
    title = 'ABONO YA USADO HOY';
    subtitle = 'Este abonado ya ha entrado hoy';
  } else if (message && message.includes('no es válido para este evento')) {
    bgColor = 'rgba(127,29,29,0.92)'; // rojo oscuro
    icon = '🚫';
    title = 'ABONO NO HABILITADO';
    subtitle = 'Los abonos están desactivados para este evento';
  } else if (message && message.includes('ya utilizada')) {
    bgColor = 'rgba(220,38,38,0.92)'; // rojo
    icon = '✗';
    title = 'ENTRADA YA USADA';
  } else if (message === 'Fuera de temporada') {
    bgColor = '#0D47A1'; // Azul oscuro
    icon = '❄️';
    title = 'FUERA DE TEMPORADA';
    subtitle = 'La piscina no está en temporada activa';
  } else if (message && message.includes('no es válida para hoy')) {
    bgColor = 'rgba(249,115,22,0.92)'; // Naranja
    icon = '📅';
    title = 'ENTRADA NO VÁLIDA HOY';
    subtitle = 'Esta entrada es para otro día';
  } else if (message === 'Sin perfil configurado') {
    bgColor = 'rgba(100, 116, 139, 0.92)'; // Gris
    icon = '⚙️';
    title = 'SIN CONFIGURAR';
    subtitle = 'Configura el perfil del club en el panel web';
  } else {
    // Cualquier otro denied
    bgColor = 'rgba(220,38,38,0.92)'; // rojo
    icon = '✗';
    title = message;
  }

  return (
    // Outer Animated.View: controls fade-in opacity
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/*
        Inner Animated.View: controls pulse opacity on denied.
        On allowed it stays at opacity=1 (no animation applied).
      */}
      <Animated.View
        style={[
          styles.background,
          { backgroundColor: bgColor },
          !allowed && { opacity: pulseAnim },
        ]}
      />

      {/* Countdown badge — top right */}
      <View style={styles.countdownBadge}>
        <Text style={styles.countdownText}>{Math.ceil(countdown / 10)}</Text>
      </View>

      {/* Central content */}
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.primaryText, titleColor ? { color: titleColor } : null]}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={[styles.secondaryText, subtitleColor ? { color: subtitleColor, textTransform: 'none' } : null]}>
          {subtitle}
        </Text>
      )}
      {allowed && isSeasonPass && !!holderName && (
        <Text style={styles.holderText}>{holderName}</Text>
      )}
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🎫 ABONO</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Outer container: covers the whole screen, handles fade-in ──
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  // ── Background layer: handles pulse (behind content) ──
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // ── Countdown badge ──
  countdownBadge: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // ── Central icon ──
  icon: {
    fontSize: 80,
    color: '#fff',
    fontWeight: '900',
    marginBottom: 16,
    lineHeight: 96,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  primaryText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb', // badge azul
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  holderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#cbd5e1', // slate-300 (gris claro)
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
