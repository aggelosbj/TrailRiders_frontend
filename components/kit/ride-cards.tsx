import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dateParts, formatDate, isPastRide, Ride } from '@/api/ridesApi';
import { Brand, DIFFICULTY_COLORS, Radius, RIDE_TYPE_ICONS, Shadow } from '@/constants/brand';
import { Button } from './button';
import { RideCover } from './ride-cover';
import { ProBadge } from './stars';

export function DifficultyBadge({ difficulty }: { difficulty?: string }) {
  if (!difficulty) return null;
  const c = DIFFICULTY_COLORS[difficulty] ?? { bg: Brand.navySoft, fg: Brand.navy };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{difficulty}</Text>
    </View>
  );
}

/** Big card with image background — used in horizontal "Featured" lists */
export function FeaturedRideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  const { day, month } = dateParts(ride.date);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featured, pressed && styles.pressed]}>
      <RideCover image={ride.image} rideType={ride.rideType} iconSize={150} />
      <LinearGradient colors={['rgba(0,20,40,0.05)', 'rgba(0,20,40,0.85)']} style={StyleSheet.absoluteFill} />
      {ride.creatorPremium && (
        <View style={styles.proCorner}>
          <ProBadge />
        </View>
      )}
      <View style={styles.dateChip}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.featuredBody}>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {ride.title}
        </Text>
        <View style={styles.rowCenter}>
          <Ionicons name="navigate" size={13} color="#DCEFFF" />
          <Text style={styles.featuredSub} numberOfLines={1}>
            {' '}
            {ride.startLocation} → {ride.finishLocation}
          </Text>
        </View>
        <View style={[styles.rowCenter, { marginTop: 8, gap: 12 }]}>
          <Meta icon="people" text={`${ride.participantsCount}`} light />
          {!!ride.rideDistance && <Meta icon="speedometer" text={`${ride.rideDistance} km`} light />}
          {!!ride.rideTime && <Meta icon="time" text={ride.rideTime} light />}
        </View>
      </View>
    </Pressable>
  );
}

/** Compact list card */
export function RideCard({
  ride,
  onPress,
  actionLabel,
  actionVariant = 'navy',
  actionLoading,
  actionDisabled,
  onAction,
  tag,
}: {
  ride: Ride;
  onPress: () => void;
  actionLabel?: string;
  actionVariant?: 'navy' | 'outline' | 'soft' | 'primary';
  actionLoading?: boolean;
  actionDisabled?: boolean;
  onAction?: () => void;
  tag?: string;
}) {
  const past = isPastRide(ride);
  const typeIcon = (RIDE_TYPE_ICONS[ride.rideType ?? ''] ?? 'bicycle') as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        <View style={styles.thumb}>
          <RideCover image={ride.image} rideType={ride.rideType} iconSize={34} compact />
        </View>
        {past && (
          <View style={styles.pastOverlay}>
            <Text style={styles.pastText}>DONE</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.rowCenter}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {ride.title}
          </Text>
        </View>
        <View style={[styles.rowCenter, { marginTop: 4 }]}>
          <Ionicons name="calendar-outline" size={13} color={Brand.muted} />
          <Text style={styles.cardSub}>
            {' '}
            {formatDate(ride.date)}
            {ride.rideTime ? ` · ${ride.rideTime}` : ''}
          </Text>
        </View>
        <View style={[styles.rowCenter, { marginTop: 3 }]}>
          <Ionicons name="location-outline" size={13} color={Brand.muted} />
          <Text style={styles.cardSub} numberOfLines={1}>
            {' '}
            {ride.startLocation} → {ride.finishLocation}
          </Text>
        </View>
        <View style={[styles.rowCenter, { marginTop: 8, gap: 10, flexWrap: 'wrap' }]}>
          <Meta icon="people-outline" text={`${ride.participantsCount}`} />
          {!!ride.rideDistance && <Meta icon="speedometer-outline" text={`${ride.rideDistance} km`} />}
          <Ionicons name={typeIcon} size={14} color={Brand.muted} />
          <DifficultyBadge difficulty={ride.difficulty} />
          {tag && (
            <View style={[styles.badge, { backgroundColor: Brand.primarySoft }]}>
              <Text style={[styles.badgeText, { color: Brand.primaryDark }]}>{tag}</Text>
            </View>
          )}
        </View>
        {actionLabel && (
          <Button
            title={actionLabel}
            onPress={onAction}
            variant={actionVariant}
            loading={actionLoading}
            disabled={actionDisabled}
            small
            style={{ alignSelf: 'flex-start', marginTop: 10 }}
          />
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Brand.faint} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}

function Meta({ icon, text, light }: { icon: keyof typeof Ionicons.glyphMap; text: string; light?: boolean }) {
  return (
    <View style={styles.rowCenter}>
      <Ionicons name={icon} size={13} color={light ? '#DCEFFF' : Brand.muted} />
      <Text style={[styles.meta, light && { color: '#fff' }]}> {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  featured: {
    width: 260,
    height: 300,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: Brand.navy,
    ...Shadow,
  },
  proCorner: { position: 'absolute', top: 14, right: 14, zIndex: 2 },
  dateChip: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  dateDay: { fontSize: 18, fontWeight: '900', color: Brand.navy, lineHeight: 20 },
  dateMonth: { fontSize: 10, fontWeight: '800', color: Brand.primary, letterSpacing: 1 },
  featuredBody: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  featuredTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  featuredSub: { color: '#DCEFFF', fontSize: 13, flexShrink: 1 },
  card: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 12,
    ...Shadow,
  },
  thumb: { width: 84, height: 84, borderRadius: Radius.md, backgroundColor: Brand.border, overflow: 'hidden' },
  pastOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(17,24,39,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 4 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, flex: 1 },
  cardSub: { fontSize: 13, color: Brand.muted, flexShrink: 1 },
  meta: { fontSize: 12, color: Brand.muted, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
