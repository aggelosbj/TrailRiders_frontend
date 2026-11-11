import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown, FadeInLeft } from 'react-native-reanimated';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/kit/button';
import { GoogleButton } from '@/components/kit/google-button';
import { Brand } from '@/constants/brand';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'compass', text: 'Discover rides near you' },
  { icon: 'people', text: 'Ride together with others' },
  { icon: 'map', text: 'Plan routes and stops' },
];

export default function LoginRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={[Brand.navy, '#0A4F8F', Brand.primary]} style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />

      <Animated.View entering={FadeIn.duration(600)} style={styles.banner}>
        <View style={styles.logoWrap}>
          <Image source={require('@/images/logo.webp')} style={styles.logo} />
        </View>
        <Text style={styles.appName}>Trail Riders</Text>
        <Text style={styles.slogan}>Your next ride is waiting — discover it, plan it, live it.</Text>

        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.text} entering={FadeInLeft.duration(400).delay(300 + i * 120)} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={16} color="#fff" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.buttons}>
        <Button title="Login" onPress={() => router.push('/loginRegister/login')} style={styles.loginBtn} variant="ghost" />
        <Button title="Create account" onPress={() => router.push('/loginRegister/register')} variant="outlineLight" style={styles.registerBtn} />

        <View style={styles.orRow}>
          <View style={styles.line} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.line} />
        </View>

        <GoogleButton />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  banner: { alignItems: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' },
  logoWrap: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logo: { width: 110, height: 110, borderRadius: 55 },
  appName: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  slogan: { fontSize: 15, color: '#DCEFFF', textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 12 },
  features: { marginTop: 28, alignSelf: 'stretch', paddingHorizontal: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttons: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  loginBtn: { backgroundColor: '#fff', marginBottom: 12 },
  registerBtn: { borderColor: '#fff', marginBottom: 6 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  orText: { color: '#DCEFFF', marginHorizontal: 12, fontWeight: '600' },
});
