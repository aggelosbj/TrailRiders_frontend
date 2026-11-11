import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signupApi } from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { AuthShell } from '@/components/kit/auth-shell';
import { Button } from '@/components/kit/button';
import { FormField } from '@/components/kit/form';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type Errors = Partial<Record<'name' | 'userName' | 'email' | 'password' | 'confirm' | 'terms', string>>;

export default function Register() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const validate = () => {
    const e: Errors = {};
    const u = userName.trim();
    if (!u) e.userName = 'Username is required';
    else if (u.length < 3 || u.length > 12) e.userName = 'Username must be 3-12 characters';
    else if (!/^[A-Za-z0-9_.]+$/.test(u)) e.userName = "Use only letters, numbers, '_' and '.'";
    if (!email.trim()) e.email = 'E-mail is required';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Please enter a valid e-mail';
    else if (email.trim().length > 30) e.email = 'E-mail must be at most 30 characters';
    if (password.length < 6) e.password = 'At least 6 characters';
    if (confirmPassword !== password) e.confirm = 'Passwords do not match';
    if (!accepted) e.terms = 'Please accept the Terms and Privacy Policy';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await signupApi(userName.trim(), password, email.trim(), name.trim(), true);
      setDone(true);
      // Log the new user in straight away
      await login(userName.trim(), password);
      setTimeout(() => router.replace('/(tabs)/home'), 900);
    } catch (err) {
      setDone(false);
      setServerError(errorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={styles.success}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Ionicons name="checkmark-circle" size={110} color={Brand.primary} />
        </Animated.View>
        <Text style={styles.successTitle}>Welcome aboard!</Text>
        <Text style={styles.successText}>Your account has been created.</Text>
      </View>
    );
  }

  return (
    <AuthShell title="Create account ✨" subtitle="Join the community of riders and drivers.">
      <FormField label="Full name" icon="id-card-outline" placeholder="e.g. Thanasis Papadopoulos" value={name} onChangeText={setName} />
      <FormField
        label="Username"
        icon="at-outline"
        placeholder="3-12 characters"
        value={userName}
        onChangeText={setUserName}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={12}
        error={errors.userName}
      />
      <FormField
        label="E-mail"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={30}
        error={errors.email}
      />
      <FormField
        label="Password"
        icon="lock-closed-outline"
        placeholder="At least 6 characters"
        password
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <FormField
        label="Confirm password"
        icon="lock-closed-outline"
        placeholder="Repeat your password"
        password
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirm}
        onSubmitEditing={handleSignup}
      />

      <Pressable style={styles.terms} onPress={() => setAccepted((a) => !a)}>
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={22} color={errors.terms && !accepted ? Brand.danger : Brand.primary} />
        <Text style={styles.termsText}>
          I am 18+ and accept the{' '}
          <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>Terms of Service</Text> and{' '}
          <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>
        </Text>
      </Pressable>
      {errors.terms && !accepted && <Text style={styles.termsError}>{errors.terms}</Text>}

      {serverError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{serverError}</Text>
        </View>
      )}

      <Button title="Create account" onPress={handleSignup} loading={loading} icon="person-add-outline" />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.replace('/loginRegister/login')}>
          <Text style={styles.link}>Log in</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { color: Brand.primary, fontWeight: '700', fontSize: 14 },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, marginTop: -4 },
  termsText: { flex: 1, color: Brand.textSoft, fontSize: 13, lineHeight: 20 },
  termsLink: { color: Brand.primary, fontWeight: '700' },
  termsError: { color: Brand.danger, fontSize: 12, marginBottom: 10, fontWeight: '500' },
  errorBox: { backgroundColor: Brand.dangerSoft, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: Brand.danger, fontWeight: '600', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' },
  footerText: { color: Brand.muted, fontSize: 14 },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  successTitle: { marginTop: 18, fontSize: 24, fontWeight: '900', color: Brand.navy },
  successText: { marginTop: 6, fontSize: 15, color: Brand.muted },
});
