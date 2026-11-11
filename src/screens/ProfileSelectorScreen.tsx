import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import Logo from '../components/Logo';
import { useAuth } from '../store/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileSelectorScreen() {
  const { profiles, profileId, switchProfile, email, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  const handleSelect = async (id: number) => {
    await switchProfile(id);
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Logo size={32} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Seleccionar Perfil</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{email}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>
        {profiles.length} {profiles.length === 1 ? 'PERFIL DISPONIBLE' : 'PERFILES DISPONIBLES'}
      </Text>

      <FlatList
        data={profiles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isActive = String(item.id) === profileId;
          return (
            <TouchableOpacity
              style={[styles.profileCard, isActive && styles.profileCardActive]}
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.75}
            >
              {/* Avatar */}
              <View style={[styles.avatar, isActive && styles.avatarActive]}>
                <Text style={[styles.avatarText, isActive && styles.avatarTextActive]}>
                  {getInitials(item.teamName)}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, isActive && styles.profileNameActive]}>
                  {item.teamName}
                </Text>
                {item.venue ? (
                  <View style={styles.venueRow}>
                    <Feather name="map-pin" size={11} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.profileVenue} numberOfLines={1}>
                      {item.venue}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.typeRow}>
                  {item.systemType === 'SWIMMING_POOL' ? (
                    <>
                      <Ionicons name="water-outline" size={12} color="#0EA5E9" style={{ marginRight: 4 }} />
                      <Text style={[styles.profileType, { color: '#0EA5E9' }]}>Piscina</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="football-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.profileType}>Club Deportivo</Text>
                    </>
                  )}
                </View>
              </View>

              {/* Indicator */}
              {isActive ? (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Activo</Text>
                </View>
              ) : (
                <View style={styles.arrowContainer}>
                  <Feather name="chevron-right" size={18} color="#475569" />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay perfiles disponibles.</Text>
          </View>
        }
      />

      {/* Footer actions */}
      <View style={styles.footer}>
        {profileId ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Volver al panel</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  profileCardActive: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  avatarText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 15,
  },
  avatarTextActive: {
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  profileNameActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  profileVenue: {
    color: '#94A3B8',
    fontSize: 12,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileType: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  activeBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  arrowContainer: {
    paddingHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
