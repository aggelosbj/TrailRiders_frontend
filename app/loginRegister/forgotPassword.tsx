import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { forgotPasswordApi } from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { AuthShell } from '@/components/kit/auth-shell';
import { Button } from '@/components/kit/button';
import { FormField } from '@/components/kit/form';
import { Brand } from '@/constants/brand';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleForgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid e-mail.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await forgotPasswordApi(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.success}>
        <Animated.View entering={ZoomIn.springify().damping(15)}>
          <View style={styles.mailCircle}>
            <Ionicons name="mail-open" size={64} color={Brand.primary} />
          </View>
        </Animated.View>
        <Text style={styles.successTitle}>Check your inbox</Text>
        <Text style={styles.successText}>
          We sent a password reset link to{'\n'}
          <Text style={{ fontWeight: '800', color: Brand.text }}>{email.trim()}</Text>
          {'\n'}The link expires in 15 minutes.
        </Text>
        <Button title="Back to login" onPress={() => router.replace('/loginRegister/login')} style={{ marginTop: 28, alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your e-mail and we'll send you a link to reset your password.">
      <FormField
        label="E-mail"
        icon="mail-outline"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={handleForgot}
        error={error}
      />
      <Button title="Send reset link" onPress={handleForgot} loading={loading} icon="paper-plane-outline" />
      <Button title="Back to login" variant="ghost" onPress={() => router.replace('/loginRegister/login')} style={{ marginTop: 8 }} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 28 },
  mailCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  successTitle: { marginTop: 22, fontSize: 24, fontWeight: '900', color: Brand.navy },
  successText: { marginTop: 10, fontSize: 15, color: Brand.muted, textAlign: 'center', lineHeight: 22 },
});
