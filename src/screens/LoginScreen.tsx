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
import apiClient from '../api/client';
import { useAuth, type ProfileSummary } from '../store/authStore';

interface StaffLoginResponse {
  token: string;
  email: string;
  role: string;
  clubProfileId?: number;
  clubProfileName?: string;
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
      await login(data.token, data.email, data.role, data.clubProfileId);
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
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>AM</Text>
          </View>
        </View>
        <Text style={styles.title}>Access Scanner</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          returnKeyType="next"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          editable={!loading}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
