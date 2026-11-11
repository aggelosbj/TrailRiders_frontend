import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { EventItem, getEventsApi } from '@/api/eventsApi';
import { getPassengerRidesApi, PassengerRide } from '@/api/passengerRidesApi';
import { formatDate, getAllRidesApi, isPastRide, Ride } from '@/api/ridesApi';
import { Avatar } from '@/components/kit/avatar';
import { EmptyState, IconButton, Loading, SectionTitle } from '@/components/kit/layout';
import { EventCard, ShareCard } from '@/components/kit/more-cards';
import { FeaturedRideCard, RideCard } from '@/components/kit/ride-cards';
import { Brand, Radius, RIDE_TYPE_ICONS, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useUnreadCount, useUnreadMessages } from '@/hooks/use-unread-count';
import { getFeedApi } from '@/api/socialApi';
import { WeatherWidget } from '@/components/kit/weather-widget';

type IconName = keyof typeof Ionicons.glyphMap;

const TOOLS: { label: string; sub: string; icon: IconName; color: string; bg: string; href: string }[] = [
  { label: 'Best roads', sub: 'Top-rated routes', icon: 'map', color: '#0B7FD1', bg: '#E6F4FE', href: '/routes' },
  { label: 'Marketplace', sub: 'Bikes & gear', icon: 'storefront', color: '#B45309', bg: '#FEF3C7', href: '/market' },
  { label: 'Ride share', sub: 'Free seats', icon: 'car', color: '#2E9E44', bg: '#E7F6EA', href: '/joinRide?tab=shares' },
  { label: 'Events', sub: 'Meetups & shows', icon: 'calendar', color: '#8B5CF6', bg: '#F1ECFE', href: '/joinRide?tab=events' },
  { label: 'My rides log', sub: 'Recorded stats', icon: 'stats-chart', color: '#E5484D', bg: '#FDECEC', href: '/track' },
  { label: 'Feed', sub: 'Share moments', icon: 'images', color: '#003366', bg: '#E8EEF5', href: '/feed' },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const unread = useUnreadCount();
  const unreadMessages = useUnreadMessages();

  const [rides, setRides] = useState<Ride[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [shares, setShares] = useState<PassengerRide[]>([]);
  const [feed, setFeed] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRides = useCallback(async () => {
    try {
      const [r, e, s, fd] = await Promise.all([
        getAllRidesApi(),
        getEventsApi({ upcoming: true }).catch(() => []),
        getPassengerRidesApi({ upcoming: true }).catch(() => []),
        getFeedApi().then((f) => f.rides).catch(() => [] as Ride[]),
      ]);
      setRides(r);
      setEvents(e);
      setShares(s);
      setFeed(fd);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRides();
    }, [fetchRides])
  );

  // Android back on Home exits the app instead of going back to login
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const me = String(user?.id ?? '');
  const upcoming = useMemo(() => rides.filter((r) => !isPastRide(r)), [rides]);
  const featured = useMemo(
    // Premium organizers are boosted to the front, then the most popular rides
    () => [...upcoming].sort((a, b) => Number(!!b.creatorPremium) - Number(!!a.creatorPremium) || b.participantsCount - a.participantsCount).slice(0, 6),
    [upcoming]
  );
  const nextRide = useMemo(() => upcoming.find((r) => r.participants.includes(me)), [upcoming, me]);
  const openRides = useMemo(() => upcoming.filter((r) => !r.participants.includes(me)).slice(0, 5), [upcoming, me]);

  const firstName = (user?.fullName || user?.username || '').split(' ')[0];

  if (loading) return <Loading />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Brand.background }}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRides(); }} tintColor={Brand.primary} />}
    >
      {/* Header */}
      <LinearGradient colors={[Brand.navy, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroTop}>
          <Pressable style={styles.userRow} onPress={() => router.push('/(tabs)/profile')}>
            <Avatar name={user?.fullName || user?.username} image={user?.image} size={46} ring />
            <View style={{ marginLeft: 10, flexShrink: 1, minWidth: 0 }}>
              <Text style={styles.hello} numberOfLines={1}>{greeting()},</Text>
              <Text style={styles.name} numberOfLines={1}>{firstName} 👋</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.sos} onPress={() => router.push('/sos')} hitSlop={6} accessibilityLabel="Emergency SOS">
              <Text style={styles.sosText}>SOS</Text>
            </Pressable>
            <IconButton name="chatbubbles-outline" dark badge={unreadMessages} onPress={() => router.push('/messages')} />
            <IconButton name="notifications-outline" dark badge={unread} onPress={() => router.push('/HeaderScreens/notifications')} />
            <IconButton name="menu" dark onPress={() => router.push('/HeaderScreens/menu')} />
          </View>
        </View>

        <Text style={styles.heroTitle}>Where are we riding next?</Text>

        <Pressable style={styles.search} onPress={() => router.push('/(tabs)/joinRide')}>
          <Ionicons name="search" size={19} color={Brand.faint} />
          <Text style={styles.searchText}>Search rides, places, organizers…</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.body}>
        {/* Quick filters */}
        <View style={styles.quickRow}>
          {(['Motorcycle', 'Car', 'Both'] as const).map((type) => (
            <Pressable
              key={type}
              style={styles.quick}
              onPress={() => router.push({ pathname: '/(tabs)/joinRide', params: { rideType: type } })}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={RIDE_TYPE_ICONS[type] as keyof typeof Ionicons.glyphMap} size={22} color={Brand.primary} />
              </View>
              <Text style={styles.quickText}>{type === 'Both' ? 'Mixed' : type === 'Motorcycle' ? 'Moto' : 'Cars'}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.quick} onPress={() => router.push('/(tabs)/createRide')}>
            <View style={[styles.quickIcon, { backgroundColor: Brand.navy }]}>
              <Ionicons name="add" size={24} color="#fff" />
            </View>
            <Text style={styles.quickText}>New ride</Text>
          </Pressable>
        </View>

        <WeatherWidget style={{ marginTop: 18 }} />

        {/* Ride tools */}
        <Pressable style={styles.recordCard} onPress={() => router.push('/track/record')}>
          <LinearGradient colors={['#E5484D', '#FA881D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.recordIcon}>
            <Ionicons name="radio-button-on" size={26} color="#E5484D" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.recordTitle}>Record a ride</Text>
            <Text style={styles.recordSub}>Live speed, distance, lean & G-force — with full stats after.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>

        <View style={styles.tools}>
          {TOOLS.map((t) => (
            <Pressable key={t.label} style={({ pressed }) => [styles.tool, pressed && { opacity: 0.85 }]} onPress={() => router.push(t.href as never)}>
              <View style={[styles.toolIcon, { backgroundColor: t.bg }]}>
                <Ionicons name={t.icon} size={22} color={t.color} />
              </View>
              <Text style={styles.toolLabel}>{t.label}</Text>
              <Text style={styles.toolSub} numberOfLines={1}>{t.sub}</Text>
            </Pressable>
          ))}
        </View>

        {error && (
          <Pressable style={styles.errorBox} onPress={fetchRides}>
            <Ionicons name="cloud-offline-outline" size={18} color={Brand.danger} />
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </Pressable>
        )}

        {/* Next ride for the user */}
        {nextRide && (
          <>
            <SectionTitle title="Your next ride" />
            <Pressable style={styles.nextCard} onPress={() => router.push(`/rideDetails/${nextRide.id}`)}>
              <View style={styles.nextIcon}>
                <Ionicons name="flag" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nextTitle} numberOfLines={1}>{nextRide.title}</Text>
                <Text style={styles.nextSub}>
                  {formatDate(nextRide.date)}
                  {nextRide.rideTime ? ` · ${nextRide.rideTime}` : ''}
                </Text>
                <Text style={styles.nextSub} numberOfLines={1}>
                  {nextRide.startLocation} → {nextRide.finishLocation}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </Pressable>
          </>
        )}

        {/* From riders you follow */}
        {feed.length > 0 && (
          <>
            <SectionTitle title="From riders you follow" />
            {feed.slice(0, 3).map((ride) => (
              <RideCard key={`f${ride.id}`} ride={ride} onPress={() => router.push(`/rideDetails/${ride.id}`)} />
            ))}
          </>
        )}

        {/* Featured */}
        <SectionTitle title="Featured rides" action="See all" onAction={() => router.push('/(tabs)/joinRide')} />
        {featured.length === 0 ? (
          <EmptyState
            icon="bicycle"
            title="No upcoming rides yet"
            message="Be the first to organise one!"
            actionLabel="Create a ride"
            onAction={() => router.push('/(tabs)/createRide')}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {featured.map((ride) => (
              <FeaturedRideCard key={ride.id} ride={ride} onPress={() => router.push(`/rideDetails/${ride.id}`)} />
            ))}
          </ScrollView>
        )}

        {/* Events */}
        {events.length > 0 && (
          <>
            <SectionTitle title="Upcoming events" action="All events" onAction={() => router.push({ pathname: '/(tabs)/joinRide', params: { tab: 'events' } })} />
            {events.slice(0, 2).map((e) => (
              <EventCard key={e.id} event={e} onPress={() => router.push(`/event/${e.id}`)} />
            ))}
          </>
        )}

        {/* Ride share */}
        <SectionTitle title="Ride share" action={shares.length ? 'See all' : 'Offer seats'} onAction={() => shares.length ? router.push({ pathname: '/(tabs)/joinRide', params: { tab: 'shares' } }) : router.push({ pathname: '/(tabs)/createRide', params: { type: 'share' } })} />
        {shares.length === 0 ? (
          <Pressable style={styles.shareTeaser} onPress={() => router.push({ pathname: '/(tabs)/createRide', params: { type: 'share' } })}>
            <Ionicons name="car-sport" size={26} color={Brand.primary} />
            <Text style={styles.shareTeaserText}>Have a free seat on your next trip? Offer it to another rider.</Text>
            <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
          </Pressable>
        ) : (
          shares.slice(0, 3).map((r) => <ShareCard key={r.id} ride={r} onPress={() => router.push(`/passengerRide/${r.id}`)} />)
        )}

        {/* Open rides */}
        {openRides.length > 0 && (
          <>
            <SectionTitle title="Upcoming — join in" action="Explore" onAction={() => router.push('/(tabs)/joinRide')} />
            {openRides.map((ride) => (
              <RideCard key={ride.id} ride={ride} onPress={() => router.push(`/rideDetails/${ride.id}`)} />
            ))}
          </>
        )}

        {/* Advertising slot (revenue) */}
        <Pressable
          style={styles.ad}
          onPress={() => Linking.openURL('mailto:ads@trailriders.gr?subject=Advertise%20on%20TrailRiders')}
        >
          <LinearGradient colors={['#1F2937', Brand.navy]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.adTag}>SPONSORED</Text>
          <Text style={styles.adTitle}>Your brand here 🚀</Text>
          <Text style={styles.adSub}>Reach thousands of riders across Greece — shops, workshops, gear and events.</Text>
          <View style={styles.adBtn}>
            <Text style={styles.adBtnText}>Advertise with us</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 },
  hello: { color: '#DCEFFF', fontSize: 13, fontWeight: '600' },
  name: { color: '#fff', fontSize: 19, fontWeight: '900' },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 22, marginBottom: 16, lineHeight: 32 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 50,
    ...Shadow,
  },
  searchText: { color: Brand.faint, marginLeft: 10, fontSize: 15 },
  body: { paddingHorizontal: 20 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  quick: { alignItems: 'center', flex: 1 },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...Shadow,
  },
  quickText: { fontSize: 12, fontWeight: '700', color: Brand.textSoft },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.dangerSoft,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: 18,
  },
  errorText: { color: Brand.danger, flex: 1, fontSize: 13, fontWeight: '600' },
  shareTeaser: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  shareTeaserText: { flex: 1, color: Brand.textSoft, fontSize: 14, lineHeight: 20 },
  sos: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)' },
  sosText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 },
  recordCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: 16, marginTop: 16, overflow: 'hidden', ...Shadow },
  recordIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recordTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  recordSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2, lineHeight: 18 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, rowGap: 12 },
  tool: { width: '31.5%', backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', ...Shadow },
  toolIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  toolLabel: { fontSize: 13, fontWeight: '800', color: Brand.text, textAlign: 'center' },
  toolSub: { fontSize: 11, color: Brand.muted, marginTop: 2, textAlign: 'center' },
  ad: { borderRadius: Radius.lg, padding: 18, marginTop: 24, overflow: 'hidden', ...Shadow },
  adTag: { color: '#FCD34D', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  adTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 6 },
  adSub: { color: '#D1D5DB', fontSize: 13, marginTop: 4, lineHeight: 19 },
  adBtn: { alignSelf: 'flex-start', backgroundColor: '#FCD34D', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, marginTop: 12 },
  adBtnText: { color: '#1F2937', fontWeight: '900', fontSize: 13 },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.navy,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow,
  },
  nextIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  nextSub: { color: '#B9D7F0', fontSize: 13, marginTop: 2 },
});
