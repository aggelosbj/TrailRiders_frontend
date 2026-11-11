import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius } from '@/constants/brand';

/** Shared layout for login / register / forgot password: gradient header + white sheet */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <LinearGradient colors={[Brand.navy, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/loginRegister/loginRegisterScreen'))}
            style={styles.back}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.heroRow}>
            <Image source={require('@/images/logo.webp')} style={styles.logo} />
            <Text style={styles.brand}>Trail Riders</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </LinearGradient>

        <Animated.View entering={FadeInDown.duration(450)} style={styles.sheet}>
          <View style={styles.inner}>{children}</View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingBottom: 56 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  logo: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff' },
  brand: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 10, letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#DCEFFF', fontSize: 15, marginTop: 6, lineHeight: 21 },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xl + 6,
    borderTopRightRadius: Radius.xl + 6,
    marginTop: -28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
});
