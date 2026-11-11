import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showMessage } from '@/components/kit/dialogs';
import { Radius } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const RED = '#D32F2F';
const RED_DARK = '#8E1414';

const NUMBERS = [
  { number: '166', label: 'Ambulance', sub: 'EKAB', icon: 'medkit' as const },
  { number: '100', label: 'Police', sub: 'Hellenic Police', icon: 'shield' as const },
  { number: '199', label: 'Fire', sub: 'Fire Service', icon: 'flame' as const },
];

type Fix = { lat: number; lng: number; accuracy: number | null };

const mapsLink = (f: Fix) => `https://www.google.com/maps/search/?api=1&query=${f.lat.toFixed(6)},${f.lng.toFixed(6)}`;
const helpText = (f: Fix) =>
  `I need help — my location: ${mapsLink(f)}` + (f.accuracy ? ` (±${Math.round(f.accuracy)} m)` : '') + ' — sent from TrailRiders';

async function call(number: string) {
  const url = `tel:${number.replace(/[^\d+]/g, '')}`;
  try {
    await Linking.openURL(url);
  } catch {
    showMessage(`Call ${number}`, `This device cannot place calls. Dial ${number} from a phone.`);
  }
}

export default function SosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // latest emergency info (it may have been edited on another device)
  useFocusEffect(
    useCallback(() => {
      if (user) refreshUser();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const locate = useCallback(async (ask: boolean) => {
    setLocating(true);
    setLocError(null);
    try {
      const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (ask) setLocError('Location permission is off. Enable it in Settings, or tell the operator where you are.');
        return null;
      }
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        pos = await Location.getLastKnownPositionAsync();
      }
      if (!pos) throw new Error('no position');
      const f = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
      setFix(f);
      return f;
    } catch {
      setLocError('Could not get your position. Make sure location services are on.');
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  // If permission was already given, get the position right away so it's ready to share
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((perm) => {
        if (perm.status === 'granted') locate(false);
      })
      .catch(() => {});
  }, [locate]);

  const ensureFix = async () => fix ?? (await locate(true));

  const shareLocation = async () => {
    const f = await ensureFix();
    if (!f) return;
    const text = helpText(f);
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied', 'Your location message is on the clipboard — paste it in any app.');
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // cancelled
    }
  };

  const smsLocation = async () => {
    const f = await ensureFix();
    if (!f) return;
    const to = (user?.emergencyPhone ?? '').replace(/[^\d+]/g, '');
    const body = encodeURIComponent(helpText(f));
    const url = Platform.OS === 'ios' ? `sms:${to}&body=${body}` : `sms:${to}?body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      showMessage('Cannot open SMS', 'Use "Share" instead to send your location with another app.');
    }
  };

  const contactPhone = user?.emergencyPhone?.trim();
  const hasIce = !!(user?.bloodType || user?.allergies || user?.medicalNotes || user?.emergencyName || contactPhone);

  return (
    <LinearGradient colors={[RED, RED_DARK]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 30, paddingHorizontal: 18 }}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            style={styles.back}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>SOS</Text>
          <View style={{ width: 42 }} />
        </View>

        <Text style={styles.h1}>Emergency</Text>
        <Text style={styles.lead}>Stay calm. Tap a number to call. Move to a safe place away from traffic if you can.</Text>

        {/* 112 */}
        <Pressable onPress={() => call('112')} style={({ pressed }) => [styles.big, pressed && styles.pressed]} accessibilityLabel="Call 112, European emergency number">
          <View style={styles.bigIcon}>
            <Ionicons name="call" size={30} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigNumber}>112</Text>
            <Text style={styles.bigLabel}>European emergency number</Text>
            <Text style={styles.bigSub}>Works from any phone, even without credit</Text>
          </View>
        </Pressable>

        <View style={styles.grid}>
          {NUMBERS.map((n) => (
            <Pressable
              key={n.number}
              onPress={() => call(n.number)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              accessibilityLabel={`Call ${n.number}, ${n.label}`}
            >
              <Ionicons name={n.icon} size={22} color={RED} />
              <Text style={styles.tileNumber}>{n.number}</Text>
              <Text style={styles.tileLabel}>{n.label}</Text>
              <Text style={styles.tileSub} numberOfLines={1}>{n.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* Location */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="location" size={20} color={RED} />
            <Text style={styles.cardTitle}>Share my location</Text>
          </View>
          {locating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={RED} />
              <Text style={styles.muted}>Getting your position…</Text>
            </View>
          ) : fix ? (
            <Text style={styles.coords} selectable>
              {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
              {fix.accuracy ? `  ·  ±${Math.round(fix.accuracy)} m` : ''}
            </Text>
          ) : (
            <Text style={styles.muted}>{locError ?? 'Sends a Google Maps link to your position.'}</Text>
          )}
          {!!locError && fix && <Text style={[styles.muted, { marginTop: 4 }]}>{locError}</Text>}
          <View style={styles.row}>
            <ActionBtn icon="share-social" label="Share" onPress={shareLocation} />
            <ActionBtn icon="chatbubble-ellipses" label={contactPhone ? `SMS ${user?.emergencyName || 'contact'}` : 'Send SMS'} onPress={smsLocation} />
            <ActionBtn icon="refresh" label="Update" onPress={() => locate(true)} subtle />
          </View>
        </View>

        {/* Emergency contact */}
        {contactPhone ? (
          <Pressable onPress={() => call(contactPhone)} style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
            <View style={styles.contactIcon}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Call my emergency contact</Text>
              <Text style={styles.contactName} numberOfLines={1}>
                {user?.emergencyName || 'Emergency contact'} · {contactPhone}
              </Text>
            </View>
            <Ionicons name="call" size={22} color="#fff" />
          </Pressable>
        ) : null}

        {/* ICE card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="medkit" size={20} color={RED} />
            <Text style={styles.cardTitle}>Medical info (ICE)</Text>
            {user && (
              <Pressable onPress={() => router.push('/HeaderScreens/emergencyInfo')} hitSlop={8} style={{ marginLeft: 'auto' }}>
                <Text style={styles.edit}>{hasIce ? 'Edit' : 'Add'}</Text>
              </Pressable>
            )}
          </View>
          {!user ? (
            <Text style={styles.muted}>Log in to save your blood type, allergies and an emergency contact here.</Text>
          ) : !hasIce ? (
            <>
              <Text style={styles.muted}>
                Add your blood type, allergies, medical notes and an emergency contact so they are one tap away in an emergency.
              </Text>
              <Pressable onPress={() => router.push('/HeaderScreens/emergencyInfo')} style={styles.addBtn}>
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add emergency info</Text>
              </Pressable>
            </>
          ) : (
            <>
              <IceRow label="Blood type" value={user.bloodType} big />
              <IceRow label="Allergies" value={user.allergies} />
              <IceRow label="Medical notes" value={user.medicalNotes} />
              <IceRow
                label="Emergency contact"
                value={[user.emergencyName, contactPhone].filter(Boolean).join(' · ') || null}
              />
              <IceRow label="Name" value={user.fullName || user.username} />
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function ActionBtn({ icon, label, onPress, subtle }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, subtle && styles.actionSubtle, pressed && styles.pressed]}>
      <Ionicons name={icon} size={17} color={subtle ? RED : '#fff'} />
      <Text style={[styles.actionText, subtle && { color: RED }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function IceRow({ label, value, big }: { label: string; value?: string | null; big?: boolean }) {
  return (
    <View style={styles.iceRow}>
      <Text style={styles.iceLabel}>{label}</Text>
      <Text style={[styles.iceValue, big && styles.iceBig, !value && { color: '#9CA3AF', fontWeight: '600' }]} selectable>
        {value || 'Not set'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 3 },
  h1: { color: '#fff', fontSize: 34, fontWeight: '900' },
  lead: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: 18 },
  big: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 12,
  },
  bigIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  bigNumber: { fontSize: 44, fontWeight: '900', color: RED, lineHeight: 48 },
  bigLabel: { fontSize: 15, fontWeight: '800', color: '#111827' },
  bigSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
  tileNumber: { fontSize: 26, fontWeight: '900', color: '#111827', marginTop: 4 },
  tileLabel: { fontSize: 13, fontWeight: '800', color: '#111827' },
  tileSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  muted: { color: '#6B7280', fontSize: 14, lineHeight: 20 },
  coords: { fontSize: 17, fontWeight: '800', color: '#111827' },
  row: { flexDirection: 'row', gap: 8, marginTop: 14 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: RED,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  actionSubtle: { flex: 0.8, backgroundColor: '#FDECEC' },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13, flexShrink: 1 },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 14,
  },
  contactIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { color: '#fff', fontWeight: '900', fontSize: 15 },
  contactName: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  edit: { color: RED, fontWeight: '800', fontSize: 14 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: RED,
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginTop: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  iceRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  iceLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' },
  iceValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 2 },
  iceBig: { fontSize: 24, fontWeight: '900', color: RED },
});
