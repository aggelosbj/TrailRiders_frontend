import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageSource, Ride } from '@/api/ridesApi';
import { User } from '@/api/userApi';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { Avatar } from './avatar';
import { RideCard } from './ride-cards';
import { ProBadge, Stars } from './stars';

const SOCIAL: { key: 'instagram' | 'facebook' | 'tiktok'; icon: keyof typeof Ionicons.glyphMap; url: (h: string) => string }[] = [
  { key: 'instagram', icon: 'logo-instagram', url: (h) => `https://instagram.com/${h.replace(/^@/, '')}` },
  { key: 'facebook', icon: 'logo-facebook', url: (h) => (h.startsWith('http') ? h : `https://facebook.com/${h}`) },
  { key: 'tiktok', icon: 'logo-tiktok', url: (h) => `https://tiktok.com/@${h.replace(/^@/, '')}` },
];

export function ProfileView({
  user,
  rides,
  headerLeft,
  headerRight,
  actions,
}: {
  user: User;
  rides: Ride[];
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stats = user.stats ?? { created: 0, joined: 0, completed: 0, km: 0 };
  const socials = SOCIAL.filter((s) => !!user[s.key]);

  return (
    <View>
      <View style={styles.cover}>
        {user.cover ? (
          <Image source={imageSource(user.cover)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[Brand.navy, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <View style={[styles.coverBar, { top: insets.top + 10 }]}>
          <View>{headerLeft}</View>
          <View style={{ flexDirection: 'row', gap: 10 }}>{headerRight}</View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <Avatar name={user.fullName || user.username} image={user.image} size={104} ring />
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.fullName || user.username}</Text>
          {user.isPremium && <ProBadge />}
        </View>
        <Text style={styles.username}>
          @{user.username}
          {user.followsYou ? '  ·  Follows you' : ''}
        </Text>
        <View style={styles.followRow}>
          <Pressable onPress={() => router.push({ pathname: '/follows/[userId]', params: { userId: String(user.id), tab: 'followers' } })} hitSlop={6}>
            <Text style={styles.followText}>
              <Text style={styles.followNum}>{user.followers ?? 0}</Text> {user.followers === 1 ? 'follower' : 'followers'}
            </Text>
          </Pressable>
          <Text style={styles.followDot}>·</Text>
          <Pressable onPress={() => router.push({ pathname: '/follows/[userId]', params: { userId: String(user.id), tab: 'following' } })} hitSlop={6}>
            <Text style={styles.followText}>
              <Text style={styles.followNum}>{user.following ?? 0}</Text> following
            </Text>
          </Pressable>
        </View>
        {user.rating && (
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <Stars value={user.rating.avg} showValue count={user.rating.count} />
          </View>
        )}

        <View style={styles.metaRow}>
          {!!user.bike && <Meta icon="bicycle" text={user.bike} />}
          {!!user.location && <Meta icon="location" text={user.location} />}
        </View>

        {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        {!!user.tags?.length && (
          <View style={styles.tags}>
            {user.tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {socials.length > 0 && (
          <View style={styles.socials}>
            {socials.map((s) => (
              <Pressable key={s.key} style={styles.social} onPress={() => Linking.openURL(s.url(String(user[s.key])))}>
                <Ionicons name={s.icon} size={20} color={Brand.navy} />
              </Pressable>
            ))}
          </View>
        )}

        {actions}

        <View style={styles.stats}>
          <Stat value={stats.created} label="Organized" />
          <View style={styles.divider} />
          <Stat value={stats.joined} label="Joined" />
          <View style={styles.divider} />
          <Stat value={stats.completed} label="Completed" />
          <View style={styles.divider} />
          <Stat value={stats.km} label="km ridden" />
        </View>

        <Text style={styles.section}>Upcoming rides</Text>
        {rides.length === 0 ? (
          <Text style={styles.none}>No upcoming rides.</Text>
        ) : (
          rides.map((r) => <RideCard key={r.id} ride={r} onPress={() => router.push(`/rideDetails/${r.id}`)} />)
        )}
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={Brand.primary} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 190, backgroundColor: Brand.navy },
  coverBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  body: { paddingHorizontal: 20, alignItems: 'stretch' },
  avatarWrap: { alignSelf: 'center', marginTop: -52, ...Shadow, borderRadius: 60 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  name: { fontSize: 24, fontWeight: '900', color: Brand.text, textAlign: 'center' },
  username: { fontSize: 14, color: Brand.muted, textAlign: 'center', marginTop: 2 },
  followRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  followText: { color: Brand.muted, fontSize: 14 },
  followNum: { color: Brand.text, fontWeight: '900' },
  followDot: { color: Brand.faint },
  metaRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Brand.textSoft, fontWeight: '600', fontSize: 13 },
  bio: { color: Brand.textSoft, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
  tag: { backgroundColor: Brand.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  tagText: { color: Brand.primaryDark, fontWeight: '700', fontSize: 12 },
  socials: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 },
  social: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow },
  stats: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 16, marginTop: 18, ...Shadow },
  divider: { width: 1, backgroundColor: Brand.border, marginVertical: 4 },
  statValue: { fontSize: 20, fontWeight: '900', color: Brand.navy },
  statLabel: { fontSize: 11, color: Brand.muted, fontWeight: '600', marginTop: 2 },
  section: { fontSize: 18, fontWeight: '800', color: Brand.text, marginTop: 24, marginBottom: 12 },
  none: { color: Brand.muted, marginBottom: 20 },
});
