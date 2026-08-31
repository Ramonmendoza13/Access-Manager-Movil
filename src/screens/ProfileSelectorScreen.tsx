import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../store/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileSelectorScreen() {
  const { profiles, profileId, switchProfile, email, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  const handleSelect = async (id: number) => {
    await switchProfile(id);
    // Navigate back to Home — Home will refetch active event with new profile header
    navigation.replace('Home');
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
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>AM</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Selecciona perfil</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{email}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>
        {profiles.length} {profiles.length === 1 ? 'perfil disponible' : 'perfiles disponibles'}
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
                  <Text style={styles.profileVenue} numberOfLines={1}>
                    📍 {item.venue}
                  </Text>
                ) : null}
                <Text style={styles.profileType}>
                  {item.systemType === 'SWIMMING_POOL' ? '🏊 Piscina' : '⚽ Club Deportivo'}
                </Text>
              </View>

              {/* Indicator */}
              {isActive ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Activo</Text>
                </View>
              ) : (
                <View style={styles.arrowContainer}>
                  <Text style={styles.arrowText}>›</Text>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>← Volver al panel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileCardActive: {
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: '#7c3aed',
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 16,
  },
  avatarTextActive: {
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileNameActive: {
    color: '#fff',
  },
  profileVenue: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 2,
  },
  profileType: {
    color: '#475569',
    fontSize: 11,
  },
  activeBadge: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  activeBadgeText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
  },
  arrowContainer: {
    paddingHorizontal: 4,
  },
  arrowText: {
    color: '#334155',
    fontSize: 22,
    fontWeight: '300',
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
    borderTopColor: '#1e293b',
  },
  backButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
