import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

const PALETTE = ['#1DA1FA', '#003366', '#FA881D', '#2E9E44', '#8B5CF6', '#E5484D', '#0EA5A4'];

export function Avatar({
  name,
  image,
  size = 44,
  ring,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const label = (name || '?').trim();
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const color = PALETTE[[...label].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PALETTE.length];

  const ringStyle = ring ? { borderWidth: 3, borderColor: '#fff' } : null;
  const dims = { width: size, height: size, borderRadius: size / 2 };

  if (image && (image.startsWith('data:') || image.startsWith('http') || image.startsWith('file:') || image.startsWith('blob:'))) {
    return <Image source={{ uri: image }} style={[dims, styles.image, ringStyle]} />;
  }

  return (
    <View style={[dims, styles.fallback, { backgroundColor: color }, ringStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: Brand.border },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '800' },
});
