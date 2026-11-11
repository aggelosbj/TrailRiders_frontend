import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius } from '@/constants/brand';

const STAR = '#F5A524';

/** Read-only stars, e.g. 4.5 -> ★★★★½ */
export function Stars({ value, size = 14, showValue, count }: { value: number; size?: number; showValue?: boolean; count?: number }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        return <Ionicons key={i} name={name} size={size} color={STAR} />;
      })}
      {showValue && (
        <Text style={[styles.value, { fontSize: size - 1 }]}>
          {value.toFixed(1)}
          {count !== undefined ? ` (${count})` : ''}
        </Text>
      )}
    </View>
  );
}

/** Tap to choose 1-5 stars */
export function StarInput({ value, onChange, size = 34 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={[styles.row, { gap: 6 }]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Ionicons name={value >= i ? 'star' : 'star-outline'} size={size} color={STAR} />
        </Pressable>
      ))}
    </View>
  );
}

/** Small gold "PRO" badge for premium users */
export function ProBadge({ small }: { small?: boolean }) {
  return (
    <View style={[styles.pro, small && styles.proSmall]}>
      <Ionicons name="star" size={small ? 9 : 11} color="#fff" />
      <Text style={[styles.proText, small && { fontSize: 9 }]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { marginLeft: 6, color: Brand.textSoft, fontWeight: '700' },
  pro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: STAR,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  proSmall: { paddingHorizontal: 5, paddingVertical: 1 },
  proText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
});
