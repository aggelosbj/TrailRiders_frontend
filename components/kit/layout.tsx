import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Shadow } from '@/constants/brand';
import { Button } from './button';

/** Top bar for stack screens: back arrow, title, optional right action */
export function ScreenHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home')))}
        style={styles.iconBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={Brand.navy} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  color = Brand.navy,
  badge,
  dark,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  badge?: number;
  dark?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.iconBtn, dark && styles.iconBtnDark]} hitSlop={6}>
      <Ionicons name={name} size={21} color={dark ? '#fff' : color} />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={Brand.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.emptyMsg}>{message}</Text>}
      {actionLabel && <Button title={actionLabel} onPress={onAction} small style={{ marginTop: 16 }} />}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={Brand.primary} />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Brand.background,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Brand.text, marginLeft: 12 },
  right: { minWidth: 40, alignItems: 'flex-end' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow,
  },
  iconBtnDark: { backgroundColor: 'rgba(255,255,255,0.18)', shadowOpacity: 0, elevation: 0, boxShadow: 'none' } as object,
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  sectionAction: { color: Brand.primary, fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Brand.text, textAlign: 'center' },
  emptyMsg: { fontSize: 14, color: Brand.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.background },
  card: { backgroundColor: Brand.card, borderRadius: Radius.lg, padding: 16, ...Shadow },
});
