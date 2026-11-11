// RIDE STATS — one recorded ride: coloured path on the map, stats grid, speed chart and actions.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { deleteTrackApi, formatTrackDate, getTrackApi, renameTrackApi, Track } from '@/api/tracksApi';
import { AppMap } from '@/components/kit/app-map';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import type { MapMarker } from '@/components/kit/map-types';
import { ActionSheet } from '@/components/kit/sheets';
import { AltitudeChart, SpeedChart, StatGrid, StatTile } from '@/components/kit/track-ui';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { formatDistance, formatDuration } from '@/utils/geo';
import { altitudeProfile, speedLines, speedProfile } from '@/utils/track-recorder';

const dash = (v: number | null | undefined, fmt: (n: number) => string) => (v === null || v === undefined ? '—' : fmt(v));

export default function TrackStatsScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTrack(await getTrackApi(id));
    } catch {
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const points = track?.points;
  const lines = useMemo(() => (points ? speedLines(points, 5) : []), [points]);
  const markers = useMemo<MapMarker[]>(() => {
    if (!points?.length) return [];
    const a = points[0];
    const b = points[points.length - 1];
    return [
      { id: 'start', coordinate: { latitude: a[0], longitude: a[1] }, color: Brand.success, label: 'S', title: 'Start' },
      { id: 'finish', coordinate: { latitude: b[0], longitude: b[1] }, color: Brand.danger, label: 'F', title: 'Finish' },
    ];
  }, [points]);
  const profile = useMemo(() => (points ? speedProfile(points, 48) : { values: [], totalM: 0 }), [points]);
  const altitude = useMemo(() => (points ? altitudeProfile(points, 48) : null), [points]);

  if (loading) return <Loading />;
  if (!track) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: Brand.background }}>
        <EmptyState icon="analytics-outline" title="Recording not found" message="It may have been deleted." actionLabel="My recordings" onAction={() => router.replace('/track')} />
      </View>
    );
  }

  const title = track.title || 'My ride';
  const hasLean = track.maxLeanLeft !== null || track.maxLeanRight !== null;
  const hasG = track.maxGForce !== null;

  const share = async () => {
    const rows = [
      `🏍️ ${title}`,
      `📅 ${formatTrackDate(track.startedAt)}`,
      track.startName ? `📍 ${track.startName}${track.endName && track.endName !== track.startName ? ' → ' + track.endName : ''}` : '',
      `📏 ${formatDistance(track.distanceM)} in ${formatDuration(track.movingSec || track.durationSec)}`,
      `⚡ Top speed ${Math.round(track.maxSpeedKmh)} km/h · avg ${Math.round(track.avgSpeedKmh)} km/h`,
      hasLean ? `↔️ Max lean L ${Math.round(track.maxLeanLeft ?? 0)}° / R ${Math.round(track.maxLeanRight ?? 0)}°` : '',
      track.elevationGainM ? `⛰️ ${track.elevationGainM} m climbed` : '',
    ].filter(Boolean);
    const text = `${rows.join('\n')}\n\nRecorded with TrailRiders`;
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied!', 'Ride summary copied to the clipboard.');
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // cancelled
    }
  };

  const openRename = () => {
    setNewTitle(title);
    setRenaming(true);
  };

  const rename = async () => {
    const t = newTitle.trim();
    if (!t) return;
    setBusy(true);
    try {
      await renameTrackApi(track.id, t);
      setTrack({ ...track, title: t });
      setRenaming(false);
    } catch (err) {
      showMessage('Could not rename', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const extra = track.routeId ? ' The route you published from it stays in the library.' : '';
    if (!(await confirmAction('Delete recording?', `"${title}" will be deleted permanently.${extra}`, 'Delete', true))) return;
    setBusy(true);
    try {
      await deleteTrackApi(track.id);
      router.replace('/track');
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
      setBusy(false);
    }
  };

  const publish = () => {
    if (track.routeId) router.push(`/routes/${track.routeId}`);
    else router.push({ pathname: '/routes/new', params: { trackId: String(track.id) } });
  };

  const back = () => (router.canGoBack() && !fresh ? router.back() : router.replace('/track'));

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Map hero */}
        <View style={styles.hero}>
          <AppMap lines={lines} markers={markers} height={360} style={{ borderRadius: 0 }} />
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
          {fresh === '1' && (
            <View style={styles.savedBanner}>
              <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
              <Text style={styles.savedText}>Ride saved! Nice one 🏁</Text>
            </View>
          )}

          {/* Title + headline numbers */}
          <View style={styles.titleCard}>
            <Pressable onPress={openRename} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Ionicons name="pencil" size={15} color={Brand.faint} />
            </Pressable>
            <Text style={styles.date}>{formatTrackDate(track.startedAt)}</Text>
            {!!track.startName && (
              <View style={styles.placeRow}>
                <View style={[styles.placeDot, { backgroundColor: Brand.success }]} />
                <Text style={styles.place} numberOfLines={1}>
                  {track.startName}
                </Text>
                {!!track.endName && (
                  <>
                    <Ionicons name="arrow-forward" size={14} color={Brand.faint} />
                    <View style={[styles.placeDot, { backgroundColor: Brand.danger }]} />
                    <Text style={styles.place} numberOfLines={1}>
                      {track.endName}
                    </Text>
                  </>
                )}
              </View>
            )}
            <View style={styles.headline}>
              <Headline value={formatDistance(track.distanceM)} label="Distance" />
              <View style={styles.vline} />
              <Headline value={formatDuration(track.movingSec || track.durationSec)} label="Riding time" />
              <View style={styles.vline} />
              <Headline value={`${Math.round(track.maxSpeedKmh)}`} unit="km/h" label="Top speed" />
            </View>
          </View>

          {/* Stats */}
          <Text style={styles.section}>Speed & time</Text>
          <StatGrid>
            <StatTile icon="speedometer" label="Max speed" value={`${Math.round(track.maxSpeedKmh)}`} unit="km/h" color={Brand.danger} />
            <StatTile icon="speedometer-outline" label="Avg speed" value={`${Math.round(track.avgSpeedKmh)}`} unit="km/h" />
            <StatTile icon="navigate" label="Distance" value={formatDistance(track.distanceM)} color={Brand.navy} />
            <StatTile icon="stopwatch" label="Duration" value={formatDuration(track.durationSec)} color={Brand.accent} />
            <StatTile icon="time" label="Moving" value={formatDuration(track.movingSec)} color={Brand.success} />
            <StatTile icon="pause-circle" label="Stopped" value={formatDuration(Math.max(0, track.durationSec - track.movingSec))} color={Brand.muted} />
          </StatGrid>

          <Text style={styles.section}>Riding dynamics</Text>
          <StatGrid columns={2}>
            <StatTile icon="return-up-back" label="Max lean left" value={dash(track.maxLeanLeft, (v) => `${Math.round(v)}°`)} color="#0EA5A4" />
            <StatTile icon="return-up-forward" label="Max lean right" value={dash(track.maxLeanRight, (v) => `${Math.round(v)}°`)} color="#0EA5A4" />
            <StatTile icon="pulse" label="Max G-force" value={dash(track.maxGForce, (v) => v.toFixed(2))} unit={hasG ? 'g' : undefined} color={Brand.danger} />
            <StatTile icon="pulse-outline" label="Avg G-force" value={dash(track.avgGForce, (v) => v.toFixed(2))} unit={hasG ? 'g' : undefined} color="#8B5CF6" />
          </StatGrid>
          {!hasLean && !hasG && <Text style={styles.note}>Lean angle and G-force are measured by the phone app&apos;s motion sensors (not available in the browser).</Text>}
          {hasLean && <Text style={styles.note}>Lean angle is an estimate from the phone&apos;s sensors — most accurate with the phone mounted firmly on the bike.</Text>}

          <Text style={styles.section}>Elevation</Text>
          <StatGrid>
            <StatTile icon="trending-up" label="Climb" value={dash(track.elevationGainM, (v) => `${v}`)} unit={track.elevationGainM !== null ? 'm' : undefined} color="#8B5CF6" />
            <StatTile icon="arrow-up-circle" label="Highest" value={dash(track.maxAltitudeM, (v) => `${v}`)} unit={track.maxAltitudeM !== null ? 'm' : undefined} color="#8B5CF6" />
            <StatTile icon="arrow-down-circle" label="Lowest" value={dash(track.minAltitudeM, (v) => `${v}`)} unit={track.minAltitudeM !== null ? 'm' : undefined} color="#8B5CF6" />
          </StatGrid>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Speed over distance</Text>
            <SpeedChart values={profile.values} totalM={profile.totalM} />
          </View>

          {altitude && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Elevation profile</Text>
              <AltitudeChart values={altitude} />
            </View>
          )}

          {/* Publish */}
          <Pressable style={styles.publishCard} onPress={publish}>
            <LinearGradient colors={[Brand.navy, '#0A5A9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.publishIcon}>
              <Ionicons name={track.routeId ? 'map' : 'cloud-upload-outline'} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.publishTitle}>{track.routeId ? 'Published in the route library' : 'Was this a great road?'}</Text>
              <Text style={styles.publishText}>
                {track.routeId ? 'See ratings and reviews from other riders.' : 'Share it in the route library so other riders can enjoy it too.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Button title="Share" variant="outline" icon="share-social-outline" onPress={share} style={{ flex: 1 }} disabled={busy} />
        <Button
          title={track.routeId ? 'View route' : 'Publish as route'}
          icon={track.routeId ? 'map-outline' : 'cloud-upload-outline'}
          onPress={publish}
          style={{ flex: 1.5 }}
          disabled={busy}
        />
      </View>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={title}
        actions={[
          { label: 'Rename', icon: 'pencil-outline', onPress: openRename },
          { label: track.routeId ? 'View published route' : 'Publish as route', icon: 'map-outline', onPress: publish },
          { label: 'Share summary', icon: 'share-social-outline', onPress: share },
          { label: 'Delete recording', icon: 'trash-outline', destructive: true, onPress: remove },
        ]}
      />

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Rename ride</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              maxLength={120}
              placeholder="Ride name"
              placeholderTextColor={Brand.faint}
              style={styles.input}
              onSubmitEditing={rename}
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="ghost" onPress={() => setRenaming(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={rename} loading={busy} disabled={!newTitle.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function RoundBtn({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.roundBtn} hitSlop={6}>
      <Ionicons name={icon} size={21} color="#fff" />
    </Pressable>
  );
}

function Headline({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.hValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {!!unit && <Text style={styles.hUnit}> {unit}</Text>}
      </Text>
      <Text style={styles.hLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 360, backgroundColor: Brand.navy },
  heroShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 120 },
  heroBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, marginTop: -28 },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.successSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    ...Shadow,
  },
  savedText: { color: Brand.success, fontWeight: '800', fontSize: 14 },
  titleCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  title: { fontSize: 22, fontWeight: '900', color: Brand.text, flexShrink: 1 },
  date: { fontSize: 13, color: Brand.muted, marginTop: 4, fontWeight: '600' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  placeDot: { width: 8, height: 8, borderRadius: 4 },
  place: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, flexShrink: 1 },
  headline: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: Brand.background, borderRadius: Radius.md, paddingVertical: 14 },
  vline: { width: 1, height: 30, backgroundColor: Brand.border },
  hValue: { fontSize: 20, fontWeight: '900', color: Brand.navy },
  hUnit: { fontSize: 12, fontWeight: '800', color: Brand.muted },
  hLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  section: { fontSize: 17, fontWeight: '800', color: Brand.text, marginTop: 22, marginBottom: 10 },
  note: { fontSize: 12, color: Brand.muted, marginTop: 8, lineHeight: 17 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginTop: 16, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 14 },
  publishCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: 16, marginTop: 16, overflow: 'hidden' },
  publishIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  publishTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  publishText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2, lineHeight: 18 },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,20,40,0.45)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 20, width: '100%', maxWidth: 460, alignSelf: 'center' },
  dialogTitle: { fontSize: 18, fontWeight: '900', color: Brand.text, marginBottom: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.input,
    outlineStyle: 'none',
  } as object,
});
