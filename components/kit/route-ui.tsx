// UI pieces for the route library ("best roads")
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { estimatedDurationSec, LibRoute, ROUTE_STYLE_ICONS } from '@/api/routesLibApi';
import { Brand, DIFFICULTY_COLORS, Radius, Shadow } from '@/constants/brand';
import { formatDistance, formatDuration } from '@/utils/geo';
import { Stars } from './stars';
import { RouteShape } from './track-ui';

/** Cover of a route: its photo, or a navy gradient with the route's outline */
export function RouteCover({ route, strokeWidth = 3 }: { route: Pick<LibRoute, 'image' | 'preview'>; strokeWidth?: number }) {
  if (route.image) {
    return <Image source={{ uri: route.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[Brand.navy, '#0A4F8A', '#0B7FD1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {!!route.preview?.length && <RouteShape points={route.preview} color="rgba(255,255,255,0.92)" strokeWidth={strokeWidth} padding={22} />}
    </View>
  );
}

export function StyleChip({ style: routeStyle, light }: { style?: string | null; light?: boolean }) {
  if (!routeStyle) return null;
  return (
    <View style={[styles.chip, light && styles.chipLight]}>
      <Ionicons name={ROUTE_STYLE_ICONS[routeStyle] ?? 'map-outline'} size={12} color={light ? '#fff' : Brand.navy} />
      <Text style={[styles.chipText, light && { color: '#fff' }]}>{routeStyle}</Text>
    </View>
  );
}

export function DifficultyChip({ difficulty }: { difficulty?: string | null }) {
  if (!difficulty) return null;
  const c = DIFFICULTY_COLORS[difficulty] ?? { bg: Brand.navySoft, fg: Brand.navy };
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.chipText, { color: c.fg }]}>{difficulty}</Text>
    </View>
  );
}

export function HeartToggle({ active, onPress, size = 36 }: { active: boolean; onPress: () => void; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.heart, { width: size, height: size, borderRadius: size / 2 }, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Ionicons name={active ? 'heart' : 'heart-outline'} size={size * 0.55} color={active ? Brand.danger : Brand.navy} />
    </Pressable>
  );
}

/** Card in the route library list */
export function RouteCard({ route, onPress, onToggleFavorite }: { route: LibRoute; onPress: () => void; onToggleFavorite?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}>
      <View style={styles.cover}>
        <RouteCover route={route} />
        <LinearGradient colors={['rgba(0,20,40,0)', 'rgba(0,20,40,0.65)']} style={StyleSheet.absoluteFill} />
        <View style={styles.coverTop}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <StyleChip style={route.style} light />
          </View>
          {onToggleFavorite && <HeartToggle active={route.isFavorite} onPress={onToggleFavorite} size={34} />}
        </View>
        <View style={styles.coverBottom}>
          <Text style={styles.name} numberOfLines={1}>
            {route.name}
          </Text>
          <Text style={styles.region} numberOfLines={1}>
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" /> {route.region || route.startName || 'Greece'}
            {route.distanceKm !== undefined ? ` · ${route.distanceKm < 1 ? '<1' : Math.round(route.distanceKm)} km away` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.stats}>
          <Stat icon="navigate" value={formatDistance(route.distanceM)} />
          <Stat icon="time" value={formatDuration(estimatedDurationSec(route))} />
          {route.elevationGainM !== null && <Stat icon="trending-up" value={`${route.elevationGainM} m`} />}
          <DifficultyChip difficulty={route.difficulty} />
        </View>
        <View style={styles.footer}>
          {route.ratingsCount ? (
            <Stars value={route.avgRating} size={13} showValue count={route.ratingsCount} />
          ) : (
            <Text style={styles.muted}>No ratings yet</Text>
          )}
          <Text style={styles.muted} numberOfLines={1}>
            by @{route.author.username}
            {route.favoritesCount ? `  ·  ♥ ${route.favoritesCount}` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={Brand.primary} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, marginBottom: 14, overflow: 'hidden', ...Shadow },
  cover: { height: 150, backgroundColor: Brand.navy, justifyContent: 'space-between' },
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12 },
  coverBottom: { padding: 12, paddingTop: 0 },
  name: { color: '#fff', fontSize: 18, fontWeight: '900' },
  region: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  body: { padding: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, fontWeight: '800', color: Brand.textSoft },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 },
  muted: { fontSize: 12, color: Brand.muted, fontWeight: '600', flexShrink: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.navySoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  chipLight: { backgroundColor: 'rgba(0,0,0,0.35)' },
  chipText: { fontSize: 11, fontWeight: '800', color: Brand.navy },
  heart: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow },
});
