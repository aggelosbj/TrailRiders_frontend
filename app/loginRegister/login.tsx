import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { AuthShell } from '@/components/kit/auth-shell';
import { Button } from '@/components/kit/button';
import { FormField } from '@/components/kit/form';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!userName.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(userName.trim(), password);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(errorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back 👋" subtitle="Log in to continue your journey.">
      <FormField
        label="Username"
        icon="person-outline"
        placeholder="Your username"
        value={userName}
        onChangeText={setUserName}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
      />
      <FormField
        label="Password"
        icon="lock-closed-outline"
        placeholder="Your password"
        password
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleLogin}
        returnKeyType="go"
      />

      <Pressable onPress={() => router.push('/loginRegister/forgotPassword')} style={styles.forgot}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Button title="Login" onPress={handleLogin} loading={loading} icon="log-in-outline" />

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to TrailRiders? </Text>
        <Pressable onPress={() => router.replace('/loginRegister/register')}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 18 },
  link: { color: Brand.primary, fontWeight: '700', fontSize: 14 },
  errorBox: { backgroundColor: Brand.dangerSoft, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: Brand.danger, fontWeight: '600', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' },
  footerText: { color: Brand.muted, fontSize: 14 },
});
