import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';
import { useAuth } from '../store/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface ActiveEvent {
  id: number;
  name: string;
  date: string;
  venue: string;
  active: boolean;
}

interface ClubProfile {
  id: number;
  teamName: string;
  venue?: string;
  systemType?: string;
}

export default function HomeScreen() {
  const { email, logout, profileId, profiles } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState(false);
  const [clubProfile, setClubProfile] = useState<ClubProfile | null>(null);

  const fetchActiveEvent = useCallback(async () => {
    setEventLoading(true);
    setEventError(false);
    try {
      const { data } = await apiClient.get<ActiveEvent>('/api/events/active');
      setEvent(data);
    } catch {
      setEvent(null);
      setEventError(true);
    } finally {
      setEventLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await apiClient.get<ClubProfile>('/api/profile');
      setClubProfile(data);
    } catch {
      // silently ignore — optional info
    }
  }, []);

  // Refetch whenever screen comes into focus (e.g. after profile switch)
  useFocusEffect(
    useCallback(() => {
      fetchActiveEvent();
      fetchProfile();
    }, [fetchActiveEvent, fetchProfile])
  );

  // Also refetch when profileId changes (immediate reaction to switch)
  useEffect(() => {
    fetchActiveEvent();
    fetchProfile();
  }, [profileId, fetchActiveEvent, fetchProfile]);

  // Resolve active profile name for display
  const activeProfileName =
    clubProfile?.teamName ||
    profiles.find((p) => String(p.id) === profileId)?.teamName ||
    'Perfil';

  const isOwnerWithMultipleProfiles = profiles.length > 1;
  const isSwimmingPool = clubProfile?.systemType === 'SWIMMING_POOL';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>AM</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Access Manager</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{email}</Text>
          </View>
        </View>

        {/* Profile switcher button — shown only if owner with multiple profiles */}
        {isOwnerWithMultipleProfiles && (
          <TouchableOpacity
            style={styles.profileSwitchButton}
            onPress={() => navigation.navigate('ProfileSelector')}
            activeOpacity={0.75}
          >
            <Text style={styles.profileSwitchIcon}>⇄</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active Profile Badge */}
      <View style={styles.profileBadgeRow}>
        <View style={styles.profileBadge}>
          <View style={styles.profileBadgeDot} />
          <Text style={styles.profileBadgeName} numberOfLines={1}>
            {activeProfileName}
          </Text>
          {isOwnerWithMultipleProfiles && (
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileSelector')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.profileBadgeChange}>Cambiar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>

        {/* Scanner card */}
        <TouchableOpacity
          style={styles.scannerCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Text style={styles.scannerIcon}>📷</Text>
          <Text style={styles.scannerTitle}>Abrir Scanner</Text>
          <Text style={styles.scannerHint}>Toca para escanear entradas QR</Text>
        </TouchableOpacity>

        {/* Pool: show season info instead of event */}
        {isSwimmingPool ? (
          <View style={styles.eventCard}>
            <Text style={styles.eventCardTitle}>🏊 Modo Piscina</Text>
            <View style={styles.eventInfo}>
              <Text style={[styles.eventName, { fontSize: 15 }]}>
                Acceso por día y abono de temporada
              </Text>
              {clubProfile?.venue ? (
                <View style={styles.eventRow}>
                  <Text style={styles.eventEmoji}>📍</Text>
                  <Text style={styles.eventValue}>{clubProfile.venue}</Text>
                </View>
              ) : null}
              <View style={[styles.eventActiveDot, { marginTop: 8 }]}>
                <View style={[styles.activePulse, { backgroundColor: '#0e7490' }]} />
                <Text style={[styles.eventActiveLabel, { color: '#22d3ee' }]}>
                  Escanea QR en la entrada
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* Football: active event card */
          <View style={styles.eventCard}>
            <View style={styles.eventCardHeader}>
              <Text style={styles.eventCardTitle}>Evento activo</Text>
              <TouchableOpacity onPress={fetchActiveEvent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.refreshButton}>↻</Text>
              </TouchableOpacity>
            </View>

            {eventLoading ? (
              <ActivityIndicator color="#7c3aed" style={{ marginTop: 12 }} />
            ) : event ? (
              <View style={styles.eventInfo}>
                <View style={styles.eventActiveDot}>
                  <View style={styles.activePulse} />
                  <Text style={styles.eventActiveLabel}>En curso</Text>
                </View>
                <Text style={styles.eventName}>{event.name}</Text>
                <View style={styles.eventRow}>
                  <Text style={styles.eventEmoji}>📅</Text>
                  <Text style={styles.eventValue}>
                    {new Date(event.date).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.eventRow}>
                  <Text style={styles.eventEmoji}>📍</Text>
                  <Text style={styles.eventValue}>{event.venue}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noEvent}>
                <Text style={styles.noEventEmoji}>🕐</Text>
                <Text style={styles.noEventText}>
                  {eventError ? 'Sin evento activo ahora' : 'No se pudo cargar el evento'}
                </Text>
                <TouchableOpacity onPress={fetchActiveEvent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Footer: logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => logout()}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
    maxWidth: 200,
  },
  profileSwitchButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSwitchIcon: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '600',
  },
  profileBadgeRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    alignSelf: 'flex-start',
  },
  profileBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#a78bfa',
  },
  profileBadgeName: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 200,
  },
  profileBadgeChange: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(124,58,237,0.3)',
    paddingLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  // ── Scanner card ──
  scannerCard: {
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  scannerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  scannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  scannerHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  // ── Event card ──
  eventCard: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  eventCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  refreshButton: {
    color: '#475569',
    fontSize: 20,
    fontWeight: '600',
  },
  eventInfo: {
    marginTop: 10,
  },
  eventActiveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  eventActiveLabel: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eventEmoji: {
    fontSize: 14,
  },
  eventValue: {
    fontSize: 13,
    color: '#94a3b8',
    flex: 1,
  },
  noEvent: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  noEventEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  noEventText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  retryText: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '600',
  },
  // ── Logout ──
  logoutButton: {
    marginHorizontal: 20,
    marginBottom: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.05)',
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
