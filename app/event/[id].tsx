import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { deleteEventApi, EventItem, getEventApi, rsvpEventApi } from '@/api/eventsApi';
import { formatDate, todayISO } from '@/api/ridesApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import { RideCover } from '@/components/kit/ride-cover';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvent(await getEventApi(id));
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading />;
  if (!event) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: Brand.background }}>
        <EmptyState icon="calendar-outline" title="Event not found" message="It may have been cancelled." actionLabel="Back" onAction={() => router.back()} />
      </View>
    );
  }

  const me = String(user?.id ?? '');
  const isOwner = !!event.ownerId && event.ownerId === user?.id;
  const going = event.attendees.includes(me);
  const past = !!event.eventDate && event.eventDate < todayISO();
  const full = !!event.maxAttendees && event.attendeesCount >= event.maxAttendees;

  const rsvp = async (attend: boolean) => {
    if (!attend && !(await confirmAction('Not going?', 'You will be removed from the attendee list.', 'Remove', true))) return;
    setBusy(true);
    try {
      await rsvpEventApi(event.id, attend);
      await load();
      if (attend) showMessage("You're going! 🎉", `See you at "${event.name}".`);
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Cancel event?', 'All attendees will be notified.', 'Cancel event', true))) return;
    setBusy(true);
    try {
      await deleteEventApi(event.id);
      router.replace({ pathname: '/(tabs)/myRides', params: { tab: 'events' } });
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `📅 ${event.name}\n${formatDate(event.eventDate)}${event.eventTime ? ' · ' + event.eventTime : ''}\n📍 ${event.location}\n\nJoin on TrailRiders!`;
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied!', 'Event details copied to the clipboard.');
        }
      } else await Share.share({ message: text });
    } catch {
      // cancelled
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <RideCover image={event.image} rideType="Both" iconSize={220} />
          <LinearGradient colors={['rgba(0,20,40,0.45)', 'rgba(0,20,40,0)', 'rgba(0,20,40,0.85)']} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroBar, { top: insets.top + 10 }]}>
            <Pressable style={styles.roundBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}>
              <Ionicons name="chevron-back" size={21} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={styles.roundBtn} onPress={share}>
                <Ionicons name="share-social-outline" size={21} color="#fff" />
              </Pressable>
              {isOwner && (
                <Pressable style={styles.roundBtn} onPress={() => router.push(`/editEvent/${event.id}`)}>
                  <Ionicons name="create-outline" size={21} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.heroBottom}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {event.isCompany && (
                <View style={[styles.tag, { backgroundColor: Brand.accent }]}>
                  <Ionicons name="megaphone" size={11} color="#fff" />
                  <Text style={styles.tagText}>Sponsored</Text>
                </View>
              )}
              {!!event.category && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{event.category}</Text>
                </View>
              )}
              {past && (
                <View style={[styles.tag, { backgroundColor: 'rgba(17,24,39,0.7)' }]}>
                  <Text style={styles.tagText}>Ended</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroTitle}>{event.name}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <Row icon="calendar" title={formatDate(event.eventDate)} sub={event.eventTime ? `Starts at ${event.eventTime}` : 'Time TBA'} />
            <View style={styles.sep} />
            <Row
              icon="location"
              title={event.location}
              sub="Open in Google Maps"
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`)}
            />
            <View style={styles.sep} />
            <Row
              icon="people"
              title={`${event.attendeesCount} going`}
              sub={event.maxAttendees ? `${Math.max(event.maxAttendees - event.attendeesCount, 0)} of ${event.maxAttendees} spots left` : 'No attendee limit'}
            />
          </View>

          <View style={styles.card}>
            {event.isCompany ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.companyIcon}>
                  <Ionicons name="business" size={22} color="#fff" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.small}>Hosted by partner</Text>
                  <Text style={styles.name}>{event.companyName}</Text>
                </View>
              </View>
            ) : (
              <Pressable style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => event.ownerId && router.push(`/user/${event.ownerId}`)}>
                <Avatar name={event.owner?.fullName || event.owner?.username} image={event.owner?.image} size={46} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.small}>Organized by</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.name}>{event.owner?.fullName || event.owner?.username || 'TrailRiders member'}</Text>
                    {!!event.owner?.subscribed && <ProBadge small />}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
              </Pressable>
            )}
          </View>

          {!!event.description && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.text}>{event.description}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Who&apos;s going ({event.attendeesCount})</Text>
            {(event.attendeesInfo ?? []).length === 0 && <Text style={styles.small}>Be the first to join!</Text>}
            <View style={styles.attendees}>
              {(event.attendeesInfo ?? []).map((a) => (
                <Pressable key={a.id} style={styles.attendee} onPress={() => router.push(`/user/${a.id}`)}>
                  <Avatar name={a.fullName || a.username} image={a.image} size={46} />
                  <Text style={styles.attendeeName} numberOfLines={1}>
                    {a.id === user?.id ? 'You' : (a.fullName || a.username).split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isOwner ? (
          <>
            <Button title="Cancel event" variant="dangerOutline" icon="trash-outline" onPress={remove} disabled={busy} style={{ flex: 1 }} />
            <Button title="Edit" icon="create-outline" onPress={() => router.push(`/editEvent/${event.id}`)} style={{ flex: 1 }} />
          </>
        ) : going ? (
          <>
            <View style={styles.goingBox}>
              <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
              <Text style={styles.goingText}>You&apos;re going</Text>
            </View>
            {!past && <Button title="Not going" variant="outline" onPress={() => rsvp(false)} loading={busy} style={{ flex: 1 }} />}
          </>
        ) : past || full ? (
          <View style={[styles.goingBox, { backgroundColor: Brand.background, justifyContent: 'center' }]}>
            <Text style={{ color: Brand.muted, fontWeight: '700' }}>{past ? 'This event has ended' : 'This event is full'}</Text>
          </View>
        ) : (
          <Button title="I'm going" icon="checkmark-circle-outline" onPress={() => rsvp(true)} loading={busy} style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}

function Row({ icon, title, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; onPress?: () => void }) {
  return (
    <Pressable style={{ flexDirection: 'row', alignItems: 'center' }} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={Brand.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sub && <Text style={[styles.small, onPress && { color: Brand.primary, fontWeight: '700' }]}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, backgroundColor: Brand.navy, justifyContent: 'flex-end', overflow: 'hidden' },
  heroBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { padding: 20, paddingBottom: 40 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 34 },
  body: { paddingHorizontal: 16, marginTop: -24 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 10 },
  sep: { height: 1, backgroundColor: Brand.border, marginVertical: 12, marginLeft: 52 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  small: { fontSize: 12, color: Brand.muted, marginTop: 1 },
  name: { fontSize: 16, fontWeight: '800', color: Brand.text },
  text: { fontSize: 15, lineHeight: 22, color: Brand.textSoft },
  companyIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center' },
  attendees: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  attendee: { alignItems: 'center', width: 60 },
  attendeeName: { fontSize: 11, color: Brand.textSoft, marginTop: 4, fontWeight: '600' },
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
  goingBox: { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.successSoft, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 52 },
  goingText: { color: Brand.success, fontWeight: '800', fontSize: 15 },
});
