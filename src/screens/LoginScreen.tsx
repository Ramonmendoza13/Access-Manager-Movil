import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Logo from '../components/Logo';
import apiClient from '../api/client';
import { useAuth, type ProfileSummary } from '../store/authStore';

interface StaffLoginResponse {
  token: string;
  email: string;
  role: string;
  clubProfileId?: number;
  clubProfileName?: string;
  scannerName?: string | null;
}

interface OwnerLoginResponse {
  token: string;
  email: string;
  role?: string;
  nombre?: string;
  profiles?: ProfileSummary[];
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Por favor, introduce tu email y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Try Owner login first
    try {
      const { data } = await apiClient.post<OwnerLoginResponse>('/api/auth/owner/login', {
        email: email.trim(),
        password,
      });
      const profiles = data.profiles ?? [];
      const firstProfileId = profiles.length > 0 ? profiles[0].id : null;
      // Pass full profiles array to store
      await login(data.token, data.email, 'OWNER', firstProfileId, profiles);
      setLoading(false);
      return;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 401 && status !== 404 && status !== 400) {
        setError('Error al conectar con el servidor.');
        setLoading(false);
        return;
      }
    }

    // 2. Try Staff login
    try {
      const { data } = await apiClient.post<StaffLoginResponse>('/api/auth/login', {
        email: email.trim(),
        password,
      });
      await login(data.token, data.email, data.role, data.clubProfileId, undefined, data.scannerName);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg =
        axiosErr?.response?.data?.error ||
        axiosErr?.message ||
        'Error al iniciar sesión. Verifica tus credenciales.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoRow}>
          <Logo size={56} />
        </View>
        <Text style={styles.title}>ACCESS MANAGER</Text>
        <Text style={styles.subtitle}>Terminal de Control de Accesos</Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario@ejemplo.com"
            placeholderTextColor="#475569"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
            editable={!loading}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>CONTRASEÑA</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#475569"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!loading}
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color="#ef4444" style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>Acceder al terminal</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
