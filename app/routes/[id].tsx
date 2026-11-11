// ROUTE DETAIL — map, stats, description, ratings & reviews, favourite, navigate / ride it.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { timeAgo } from '@/api/ridesApi';
import {
  deleteRouteApi,
  estimatedDurationSec,
  getRouteApi,
  LibRouteDetail,
  rateRouteApi,
  removeRouteRatingApi,
  setRouteFavoriteApi,
} from '@/api/routesLibApi';
import { AppMap } from '@/components/kit/app-map';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import type { LatLng, MapMarker } from '@/components/kit/map-types';
import { DifficultyChip, HeartToggle, StyleChip } from '@/components/kit/route-ui';
import { ActionSheet, ReportSheet } from '@/components/kit/sheets';
import { ProBadge, StarInput, Stars } from '@/components/kit/stars';
import { AltitudeChart } from '@/components/kit/track-ui';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { formatDistance, formatDuration, googleMapsRouteUrl } from '@/utils/geo';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [route, setRoute] = useState<LibRouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getRouteApi(id);
      setRoute(r);
      setMyRating(r.myRating?.rating ?? 0);
      setReview(r.myRating?.review ?? '');
    } catch {
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const points = route?.points;
  const path = useMemo<LatLng[]>(() => (points ?? []).map((p) => ({ latitude: p[0], longitude: p[1] })), [points]);
  const lines = useMemo(() => (path.length > 1 ? [{ id: 'route', coordinates: path, color: Brand.primary, width: 5 }] : []), [path]);
  const markers = useMemo<MapMarker[]>(() => {
    if (path.length < 2) return [];
    return [
      { id: 'start', coordinate: path[0], color: Brand.success, label: 'S', title: route?.startName || 'Start' },
      { id: 'finish', coordinate: path[path.length - 1], color: Brand.danger, label: 'F', title: route?.endName || 'Finish' },
    ];
  }, [path, route?.startName, route?.endName]);
  const altitude = useMemo(() => {
    const alts = (points ?? []).map((p) => p[2]).filter((a): a is number => a !== null && a !== undefined);
    if (alts.length < 2) return null;
    const step = (alts.length - 1) / 47;
    return Array.from({ length: 48 }, (_, i) => alts[Math.round(i * step)]);
  }, [points]);

  if (loading) return <Loading />;
  if (!route) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: Brand.background }}>
        <EmptyState icon="map-outline" title="Route not found" message="It may have been removed by its author." actionLabel="Route library" onAction={() => router.replace('/routes')} />
      </View>
    );
  }

  const isOwner = route.isOwner || route.userId === user?.id;
  const navUrl = googleMapsRouteUrl(path);

  const navigate = () => {
    if (!navUrl) return;
    Linking.openURL(navUrl).catch(() => showMessage('Could not open maps', 'Install Google Maps or open the link in a browser.'));
  };

  const toggleFavorite = async () => {
    const next = !route.isFavorite;
    setRoute({ ...route, isFavorite: next, favoritesCount: route.favoritesCount + (next ? 1 : -1) });
    try {
      const res = await setRouteFavoriteApi(route.id, next);
      setRoute((r) => (r ? { ...r, isFavorite: res.isFavorite, favoritesCount: res.favoritesCount } : r));
    } catch (err) {
      showMessage('Could not update favourites', errorMessage(err));
      load();
    }
  };

  const submitRating = async () => {
    if (!myRating) {
      showMessage('Pick a rating', 'Tap the stars to rate this route.');
      return;
    }
    setRating(true);
    try {
      await rateRouteApi(route.id, myRating, review.trim() || undefined);
      await load();
      showMessage('Thanks for your rating! ⭐');
    } catch (err) {
      showMessage('Could not rate', errorMessage(err));
    } finally {
      setRating(false);
    }
  };

  const removeRating = async () => {
    if (!(await confirmAction('Remove your rating?', 'Your stars and review will be removed.', 'Remove', true))) return;
    try {
      await removeRouteRatingApi(route.id);
      await load();
    } catch (err) {
      showMessage('Could not remove', errorMessage(err));
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Delete route?', `"${route.name}" and all its ratings will be removed from the library.`, 'Delete', true))) return;
    setBusy(true);
    try {
      await deleteRouteApi(route.id);
      router.replace('/routes');
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
      setBusy(false);
    }
  };

  const share = async () => {
    const text = [
      `🛣️ ${route.name}${route.region ? ` (${route.region})` : ''}`,
      `📏 ${formatDistance(route.distanceM)} · ⏱️ ~${formatDuration(estimatedDurationSec(route))}${route.elevationGainM ? ` · ⛰️ ${route.elevationGainM} m` : ''}`,
      route.ratingsCount ? `⭐ ${route.avgRating.toFixed(1)} from ${route.ratingsCount} riders` : '',
      navUrl ? `\n🧭 ${navUrl}` : '',
      '\nFound on TrailRiders',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied!', 'Route details copied to the clipboard.');
        }
      } else await Share.share({ message: text });
    } catch {
      // cancelled
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/routes'));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Brand.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <AppMap lines={lines} markers={markers} height={340} style={{ borderRadius: 0 }} />
          <LinearGradient colors={['rgba(0,20,40,0.55)', 'rgba(0,20,40,0)']} style={styles.heroShade} pointerEvents="none" />
          <View style={[styles.heroBar, { top: insets.top + 10 }]} pointerEvents="box-none">
            <RoundBtn icon="chevron-back" onPress={back} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <RoundBtn icon="share-social-outline" onPress={share} />
              <RoundBtn icon="ellipsis-horizontal" onPress={() => setMenu(true)} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title card */}
          <View style={styles.titleCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{route.name}</Text>
                <Text style={styles.region}>
                  <Ionicons name="location" size={13} color={Brand.primary} /> {route.region || route.startName || 'Greece'}
                </Text>
              </View>
              {!isOwner && <HeartToggle active={route.isFavorite} onPress={toggleFavorite} size={42} />}
            </View>
            <View style={styles.chips}>
              <DifficultyChip difficulty={route.difficulty} />
              <StyleChip style={route.style} />
              {!!route.surface && (
                <View style={styles.surface}>
                  <Ionicons name="layers-outline" size={12} color={Brand.navy} />
                  <Text style={styles.surfaceText}>{route.surface}</Text>
                </View>
              )}
            </View>
            <View style={styles.ratingRow}>
              {route.ratingsCount ? (
                <Stars value={route.avgRating} size={15} showValue count={route.ratingsCount} />
              ) : (
                <Text style={styles.muted}>No ratings yet</Text>
              )}
              <Text style={styles.muted}>
                <Ionicons name="heart" size={12} color={Brand.danger} /> {route.favoritesCount}
              </Text>
            </View>

            <View style={styles.facts}>
              <Fact icon="navigate" label="Distance" value={formatDistance(route.distanceM)} />
              <Fact icon="time" label={route.durationSec ? 'Riding time' : 'Est. time'} value={formatDuration(estimatedDurationSec(route))} />
              <Fact icon="trending-up" label="Climb" value={route.elevationGainM !== null ? `${route.elevationGainM} m` : '—'} />
            </View>
          </View>

          {/* Author */}
          <Pressable style={styles.card} onPress={() => router.push(`/user/${route.author.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={route.author.fullName || route.author.username} image={route.author.image} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.small}>Shared by</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.author}>{route.author.fullName || route.author.username}</Text>
                  {!!route.author.subscribed && <ProBadge small />}
                </View>
                <Text style={styles.small}>
                  @{route.author.username} · {timeAgo(route.createdAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
            </View>
          </Pressable>

          {!!route.image && (
            <View style={styles.photo}>
              <Image source={{ uri: route.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          )}

          {/* Description + start/finish */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About this road</Text>
            {route.description ? <Text style={styles.description}>{route.description}</Text> : <Text style={styles.muted}>No description.</Text>}
            {(route.startName || route.endName) && (
              <View style={{ marginTop: 14 }}>
                <Step color={Brand.success} label="Start" value={route.startName || '—'} />
                <Step color={Brand.danger} label="Finish" value={route.endName || '—'} last />
              </View>
            )}
            <Button title="Navigate with Google Maps" icon="navigate-outline" variant="soft" small onPress={navigate} style={{ marginTop: 14 }} disabled={!navUrl} />
          </View>

          {altitude && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Elevation profile</Text>
              <AltitudeChart values={altitude} />
            </View>
          )}

          {/* Ratings */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Reviews</Text>
              {route.ratingsCount ? <Stars value={route.avgRating} showValue count={route.ratingsCount} /> : null}
            </View>
            {!isOwner && (
              <View style={styles.rateBox}>
                <Text style={styles.rateTitle}>{route.myRating ? 'Your rating' : 'Ridden it? Rate this road'}</Text>
                <StarInput value={myRating} onChange={setMyRating} />
                <TextInput
                  value={review}
                  onChangeText={setReview}
                  placeholder="Road condition, traffic, best time to ride… (optional)"
                  placeholderTextColor={Brand.faint}
                  style={styles.reviewInput}
                  maxLength={500}
                  multiline
                />
                <Button title={route.myRating ? 'Update rating' : 'Submit rating'} small onPress={submitRating} loading={rating} style={{ marginTop: 10, alignSelf: 'stretch' }} />
                {!!route.myRating && (
                  <Pressable onPress={removeRating} hitSlop={6} style={{ marginTop: 10 }}>
                    <Text style={{ color: Brand.faint, fontWeight: '700', fontSize: 12 }}>Remove my rating</Text>
                  </Pressable>
                )}
              </View>
            )}
            {route.ratings.length === 0 && <Text style={styles.muted}>No reviews yet{isOwner ? '' : ' — be the first!'}</Text>}
            {route.ratings.map((r) => (
              <Pressable key={r.userId} style={styles.review} onPress={() => router.push(`/user/${r.userId}`)}>
                <Avatar name={r.user.fullName || r.user.username} image={r.user.image} size={34} />
                <View style={styles.bubble}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.reviewAuthor}>
                      {r.user.fullName || r.user.username}
                      {r.userId === user?.id ? ' (you)' : ''}
                    </Text>
                    <Stars value={r.rating} size={12} />
                  </View>
                  {!!r.review && <Text style={styles.reviewText}>{r.review}</Text>}
                  <Text style={styles.reviewTime}>{timeAgo(r.createdAt)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Button title="Navigate" variant="outline" icon="navigate-outline" onPress={navigate} disabled={!navUrl || busy} style={{ flex: 1 }} />
        <Button title="Ride it" icon="radio-button-on" onPress={() => router.push('/track/record')} disabled={busy} style={{ flex: 1.3 }} />
      </View>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={route.name}
        actions={
          isOwner
            ? [
                { label: 'Edit route', icon: 'create-outline', onPress: () => router.push({ pathname: '/routes/new', params: { id: String(route.id) } }) },
                { label: 'Share', icon: 'share-social-outline', onPress: share },
                { label: 'Delete route', icon: 'trash-outline', destructive: true, onPress: remove },
              ]
            : [
                { label: route.isFavorite ? 'Remove from favourites' : 'Add to favourites', icon: route.isFavorite ? 'heart-dislike-outline' : 'heart-outline', onPress: toggleFavorite },
                { label: 'View rider profile', icon: 'person-outline', onPress: () => router.push(`/user/${route.author.id}`) },
                { label: 'Share', icon: 'share-social-outline', onPress: share },
                { label: 'Report route', icon: 'flag-outline', destructive: true, onPress: () => setReport(true) },
              ]
        }
      />
      {report && <ReportSheet visible onClose={() => setReport(false)} targetType="route" targetId={route.id} subject="route" />}
    </KeyboardAvoidingView>
  );
}

function RoundBtn({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.roundBtn} hitSlop={6}>
      <Ionicons name={icon} size={21} color="#fff" />
    </Pressable>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={Brand.primary} />
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

function Step({ color, label, value, last }: { color: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <View style={[styles.stepDot, { backgroundColor: color }]} />
        {!last && <View style={styles.stepLine} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <Text style={styles.small}>{label}</Text>
        <Text style={styles.stepText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 340, backgroundColor: Brand.navy },
  heroShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 120 },
  heroBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, marginTop: -28 },
  titleCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  title: { fontSize: 23, fontWeight: '900', color: Brand.text, lineHeight: 29 },
  region: { fontSize: 14, color: Brand.textSoft, fontWeight: '600', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  surface: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.navySoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  surfaceText: { fontSize: 11, fontWeight: '800', color: Brand.navy },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  facts: { flexDirection: 'row', backgroundColor: Brand.background, borderRadius: Radius.md, paddingVertical: 12, marginTop: 14 },
  fact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  factValue: { fontSize: 15, fontWeight: '900', color: Brand.text, marginTop: 5 },
  factLabel: { fontSize: 11, color: Brand.muted, marginTop: 2, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 10 },
  small: { fontSize: 12, color: Brand.muted },
  muted: { fontSize: 13, color: Brand.muted, fontWeight: '600' },
  author: { fontSize: 16, fontWeight: '800', color: Brand.text, marginVertical: 1 },
  photo: { height: 200, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 14, backgroundColor: Brand.border },
  description: { fontSize: 15, lineHeight: 23, color: Brand.textSoft },
  stepDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  stepLine: { flex: 1, width: 2, backgroundColor: Brand.border, marginTop: 2 },
  stepText: { fontSize: 15, fontWeight: '700', color: Brand.text, marginTop: 1 },
  rateBox: { alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: Radius.md, padding: 14, marginBottom: 14 },
  rateTitle: { fontWeight: '800', color: Brand.text, marginBottom: 8, fontSize: 15 },
  reviewInput: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Brand.text,
    backgroundColor: '#fff',
    minHeight: 60,
    maxHeight: 120,
    outlineStyle: 'none',
  } as object,
  review: { flexDirection: 'row', marginBottom: 12 },
  bubble: { flex: 1, marginLeft: 10, backgroundColor: Brand.input, borderRadius: Radius.md, padding: 10 },
  reviewAuthor: { fontWeight: '800', color: Brand.text, fontSize: 13, flexShrink: 1 },
  reviewText: { color: Brand.textSoft, fontSize: 14, marginTop: 3, lineHeight: 20 },
  reviewTime: { color: Brand.faint, fontSize: 11, marginTop: 4 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...Shadow,
  },
});
