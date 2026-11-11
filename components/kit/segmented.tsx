import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Shadow } from '@/constants/brand';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
}

/** Pill-style segmented control. `scroll` makes it horizontally scrollable for many options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const buttons = options.map((o) => {
    const active = o.key === value;
    return (
      <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.btn, scroll && styles.btnScroll, active && styles.active]}>
        {o.icon && <Ionicons name={o.icon} size={15} color={active ? '#fff' : Brand.muted} style={{ marginRight: 5 }} />}
        <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
          {o.label}
        </Text>
        {o.count !== undefined && (
          <View style={[styles.count, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={[styles.countText, active && { color: '#fff' }]}>{o.count}</Text>
          </View>
        )}
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.wrap, { gap: 4 }]} style={styles.scrollWrap}>
        {buttons}
      </ScrollView>
    );
  }
  return <View style={styles.wrap}>{buttons}</View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.md, padding: 4, ...Shadow },
  scrollWrap: { flexGrow: 0, borderRadius: Radius.md },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radius.sm + 2,
  },
  btnScroll: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', paddingHorizontal: 14 },
  active: { backgroundColor: Brand.primary },
  text: { fontWeight: '700', color: Brand.muted, fontSize: 13 },
  textActive: { color: '#fff' },
  count: {
    minWidth: 20,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  countText: { fontSize: 11, fontWeight: '800', color: Brand.muted },
});
