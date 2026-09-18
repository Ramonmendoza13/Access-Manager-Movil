import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import Logo from '../components/Logo';
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
          <Logo size={32} />
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
            <Feather name="repeat" size={16} color="#94A3B8" />
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
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Scanner')}
        >
          <View style={styles.scannerIconWrapper}>
            <Feather name="maximize" size={32} color="#38BDF8" />
          </View>
          <Text style={styles.scannerTitle}>ABRIR SCANNER</Text>
          <Text style={styles.scannerHint}>Toca para activar la cámara y validar entradas QR</Text>
          
          <View style={styles.scannerStatusPill}>
            <View style={styles.scannerStatusDot} />
            <Text style={styles.scannerStatusText}>TERMINAL ACTIVO</Text>
          </View>
        </TouchableOpacity>

        {/* Pool: show season info instead of event */}
        {isSwimmingPool ? (
          <View style={styles.eventCard}>
            <View style={styles.eventCardHeader}>
              <View style={styles.cardHeaderWithIcon}>
                <Ionicons name="water-outline" size={14} color="#0EA5E9" style={{ marginRight: 6 }} />
                <Text style={styles.eventCardTitle}>Modo Piscina</Text>
              </View>
            </View>
            <View style={styles.eventInfo}>
              <Text style={[styles.eventName, { fontSize: 15 }]}>
                Acceso diario y abono de temporada
              </Text>
              {clubProfile?.venue ? (
                <View style={styles.eventRow}>
                  <Feather name="map-pin" size={13} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.eventValue}>{clubProfile.venue}</Text>
                </View>
              ) : null}
              <View style={[styles.eventActiveDot, { marginTop: 10 }]}>
                <View style={[styles.activePulse, { backgroundColor: '#0284C7' }]} />
                <Text style={[styles.eventActiveLabel, { color: '#38BDF8' }]}>
                  Validación QR en puerta
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* Football: active event card */
          <View style={styles.eventCard}>
            <View style={styles.eventCardHeader}>
              <View style={styles.cardHeaderWithIcon}>
                <Feather name="activity" size={13} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.eventCardTitle}>Evento activo</Text>
              </View>
              <TouchableOpacity onPress={fetchActiveEvent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="rotate-cw" size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            {eventLoading ? (
              <ActivityIndicator color="#0284C7" style={{ marginTop: 16 }} />
            ) : event ? (
              <View style={styles.eventInfo}>
                <View style={styles.eventActiveDot}>
                  <View style={styles.activePulse} />
                  <Text style={styles.eventActiveLabel}>En curso</Text>
                </View>
                <Text style={styles.eventName}>{event.name}</Text>
                <View style={styles.eventRow}>
                  <Feather name="calendar" size={13} color="#64748B" style={{ marginRight: 8 }} />
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
                  <Feather name="map-pin" size={13} color="#64748B" style={{ marginRight: 8 }} />
                  <Text style={styles.eventValue}>{event.venue}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noEvent}>
                <Feather name="clock" size={28} color="#475569" style={{ marginBottom: 8 }} />
                <Text style={styles.noEventText}>
                  {eventError ? 'Sin evento activo en este momento' : 'No se pudo cargar el evento'}
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
        <Feather name="log-out" size={16} color="#EF4444" style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
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
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    maxWidth: 200,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  profileSwitchButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBadgeRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.2)',
    alignSelf: 'flex-start',
  },
  profileBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  profileBadgeName: {
    color: '#E0F2FE',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 200,
  },
  profileBadgeChange: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(2, 132, 199, 0.3)',
    paddingLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  // ── Scanner card ──
  scannerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  scannerIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  scannerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  scannerHint: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  scannerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scannerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  scannerStatusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  // ── Event card ──
  eventCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  eventActiveLabel: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventValue: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },
  noEvent: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  noEventText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  retryText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  // ── Logout ──
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
