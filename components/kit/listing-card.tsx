import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { categoryMeta, formatPrice, Listing, specLine, STATUS_META } from '@/api/listingsApi';
import { timeAgo } from '@/api/ridesApi';
import { Brand, Radius, Shadow } from '@/constants/brand';

export const GOLD = '#F5A524';

const hasPhoto = (image?: string | null) =>
  !!image && (image.startsWith('data:') || image.startsWith('http') || image.startsWith('file:') || image.startsWith('blob:'));

/** Listing photo, or a soft gradient with the category icon when there is none */
export function ListingPhoto({
  image,
  category,
  style,
  iconSize = 46,
}: {
  image?: string | null;
  category?: string | null;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const meta = categoryMeta(category);
  if (hasPhoto(image)) {
    return (
      <View style={[styles.photoWrap, style]}>
        <Image source={{ uri: image as string }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={[styles.photoWrap, style]}>
      <LinearGradient colors={[`${meta.color}22`, `${meta.color}0D`]} style={StyleSheet.absoluteFill} />
      <View style={styles.placeholder}>
        <MaterialCommunityIcons name={meta.icon} size={iconSize} color={meta.color} style={{ opacity: 0.55 }} />
      </View>
    </View>
  );
}

export function FeaturedBadge({ small }: { small?: boolean }) {
  return (
    <View style={[styles.featured, small && { paddingHorizontal: 7, paddingVertical: 3 }]}>
      <Ionicons name="flash" size={small ? 10 : 12} color="#fff" />
      <Text style={[styles.featuredText, small && { fontSize: 10 }]}>Featured</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: Listing['status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.active;
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: meta.fg }]} />
      <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function HeartButton({ active, onPress, size = 34 }: { active: boolean; onPress: () => void; size?: number }) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.heart,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { transform: [{ scale: 0.9 }] },
      ]}
    >
      <Ionicons name={active ? 'heart' : 'heart-outline'} size={size * 0.55} color={active ? Brand.danger : Brand.navy} />
    </Pressable>
  );
}

/** Grid card: photo, big price, title, specs, location */
export function ListingCard({
  listing,
  width,
  onPress,
  onToggleFavorite,
  showFavorite = true,
}: {
  listing: Listing;
  width: number;
  onPress: () => void;
  onToggleFavorite?: () => void;
  showFavorite?: boolean;
}) {
  const spec = specLine(listing);
  const inactive = listing.status !== 'active';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, listing.isFeatured && styles.cardFeatured, pressed && styles.pressed]}
    >
      <View>
        <ListingPhoto image={listing.image} category={listing.category} style={{ height: Math.round(width * 0.82) }} />
        {inactive && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusOverlayText}>{STATUS_META[listing.status].label.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.topRow}>
          {listing.isFeatured ? <FeaturedBadge small /> : <View />}
          {showFavorite && onToggleFavorite && <HeartButton active={listing.isFavorite} onPress={onToggleFavorite} size={32} />}
        </View>
        {listing.imagesCount > 1 && (
          <View style={styles.photoCount}>
            <Ionicons name="images" size={11} color="#fff" />
            <Text style={styles.photoCountText}>{listing.imagesCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text style={[styles.price, listing.price === null && styles.priceAsk]} numberOfLines={1}>
            {formatPrice(listing.price)}
          </Text>
          {listing.negotiable && listing.price !== null && <Text style={styles.neg}>NEG</Text>}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        {!!spec && (
          <Text style={styles.spec} numberOfLines={1}>
            {spec}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={Brand.faint} />
          <Text style={styles.meta} numberOfLines={1}>
            {listing.location || 'Greece'} · {timeAgo(listing.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Row variant (my listings, compact lists) */
export function ListingRow({
  listing,
  onPress,
  showStats,
  right,
}: {
  listing: Listing;
  onPress: () => void;
  showStats?: boolean;
  right?: React.ReactNode;
}) {
  const spec = specLine(listing);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, listing.isFeatured && styles.cardFeatured, pressed && styles.pressed]}>
      <ListingPhoto image={listing.image} category={listing.category} style={styles.rowPhoto} iconSize={34} />
      <View style={styles.rowBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <StatusPill status={listing.status} />
          {listing.isFeatured && <FeaturedBadge small />}
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={[styles.rowPrice, listing.price === null && styles.priceAsk]} numberOfLines={1}>
          {formatPrice(listing.price)}
          {listing.negotiable && listing.price !== null ? <Text style={styles.rowNeg}>  · Negotiable</Text> : null}
        </Text>
        {showStats ? (
          <View style={styles.stats}>
            <Stat icon="eye-outline" value={listing.views} />
            <Stat icon="heart-outline" value={listing.favoritesCount ?? 0} />
            <Text style={styles.meta}>{timeAgo(listing.createdAt)}</Text>
          </View>
        ) : (
          <Text style={styles.meta} numberOfLines={1}>
            {[spec, listing.location].filter(Boolean).join(' · ') || timeAgo(listing.createdAt)}
          </Text>
        )}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={Brand.faint} style={{ alignSelf: 'center' }} />}
    </Pressable>
  );
}

function Stat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: number }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={13} color={Brand.muted} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photoWrap: { backgroundColor: Brand.navySoft, overflow: 'hidden' },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow },
  cardFeatured: { borderWidth: 1.5, borderColor: GOLD },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  topRow: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heart: { backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: GOLD,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  featuredText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 },
  photoCount: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,20,40,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  photoCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statusOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,20,40,0.45)', alignItems: 'center', justifyContent: 'center' },
  statusOverlayText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 2 },
  body: { padding: 11, paddingTop: 9 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 19, fontWeight: '900', color: Brand.navy, flexShrink: 1, letterSpacing: -0.3 },
  priceAsk: { fontSize: 15, color: Brand.primaryDark },
  neg: { fontSize: 9, fontWeight: '900', color: Brand.success, backgroundColor: Brand.successSoft, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  title: { fontSize: 14, fontWeight: '700', color: Brand.text, marginTop: 3, lineHeight: 19 },
  spec: { fontSize: 12, color: Brand.textSoft, marginTop: 3, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  meta: { fontSize: 11, color: Brand.muted, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 10, gap: 12, marginBottom: 12, ...Shadow },
  rowPhoto: { width: 96, height: 96, borderRadius: Radius.md },
  rowBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  rowPrice: { fontSize: 16, fontWeight: '900', color: Brand.navy, marginTop: 2, marginBottom: 4 },
  rowNeg: { fontSize: 12, fontWeight: '700', color: Brand.success },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 12, fontWeight: '700', color: Brand.muted },
});
