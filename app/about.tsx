import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius, Shadow } from '@/constants/brand';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'compass', title: 'Discover', text: 'Browse and search rides by place, vehicle and difficulty.' },
  { icon: 'add-circle', title: 'Organize', text: 'Create rides with a route, stops, date and meeting time.' },
  { icon: 'people', title: 'Ride together', text: 'Join rides, see who is coming and chat in the discussion.' },
  { icon: 'notifications', title: 'Stay updated', text: 'Get notified when riders join, leave or comment.' },
];

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Brand.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={[Brand.navy, Brand.primary]} style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Image source={require('@/images/logo.webp')} style={styles.logo} />
        <Text style={styles.title}>Trail Riders Greece</Text>
        <Text style={styles.subtitle}>
          Connecting motorcyclists and car enthusiasts to plan and join rides — safely and together.
        </Text>
      </LinearGradient>

      <View style={{ padding: 20 }}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name={f.icon} size={22} color={Brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{f.title}</Text>
              <Text style={styles.cardText}>{f.text}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.footer}>Made with ❤️ for riders in Greece</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  close: { alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#fff', marginTop: 4 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 14 },
  subtitle: { color: '#DCEFFF', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 12, ...Shadow },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  cardText: { fontSize: 13, color: Brand.muted, marginTop: 2, lineHeight: 18 },
  footer: { textAlign: 'center', color: Brand.faint, marginTop: 16 },
});
