import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import {
  cancelSeatRequestApi,
  deletePassengerRideApi,
  getPassengerRideApi,
  PassengerRide,
  requestSeatApi,
  selectPassengerApi,
} from '@/api/passengerRidesApi';
import { formatDate, todayISO } from '@/api/ridesApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import { ReportSheet } from '@/components/kit/sheets';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, RIDE_TYPE_ICONS, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function PassengerRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [ride, setRide] = useState<PassengerRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    try {
      setRide(await getPassengerRideApi(id));
    } catch {
      setRide(null);
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
  if (!ride) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: Brand.background }}>
        <EmptyState icon="car-outline" title="Trip not found" message="It may have been cancelled by the driver." actionLabel="Back" onAction={() => router.back()} />
      </View>
    );
  }

  const me = String(user?.id ?? '');
  const isOwner = ride.creatorId === user?.id;
  const requested = ride.requests.includes(me);
  const confirmed = ride.selected.includes(me);
  const past = !!ride.date && ride.date < todayISO();
  const typeIcon = (RIDE_TYPE_ICONS[ride.rideType ?? ''] ?? 'car-sport') as keyof typeof Ionicons.glyphMap;

  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      await load();
      if (success) showMessage(success);
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmAction('Cancel this trip?', 'Everyone who requested a seat will be notified.', 'Cancel trip', true))) return;
    setBusy('delete');
    try {
      await deletePassengerRideApi(ride.id);
      router.replace({ pathname: '/(tabs)/myRides', params: { tab: 'shares' } });
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (await confirmAction('Withdraw?', confirmed ? 'You will give up your confirmed seat.' : 'Your seat request will be removed.', 'Withdraw', true)) {
      run('withdraw', () => cancelSeatRequestApi(ride.id));
    }
  };

  const mapsUrl =
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(ride.startLocation)}&destination=${encodeURIComponent(ride.finishLocation)}&travelmode=driving`;

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <LinearGradient colors={[Brand.navy, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 10 }]}>
          <View style={styles.heroBar}>
            <Pressable style={styles.roundBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}>
              <Ionicons name="chevron-back" size={21} color="#fff" />
            </Pressable>
            {isOwner ? (
              <Pressable style={styles.roundBtn} onPress={() => router.push(`/editPassengerRide/${ride.id}`)}>
                <Ionicons name="create-outline" size={21} color="#fff" />
              </Pressable>
            ) : (
              <Pressable style={styles.roundBtn} onPress={() => setReport(true)}>
                <Ionicons name="flag-outline" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
          <View style={styles.heroTag}>
            <Ionicons name="car" size={12} color="#fff" />
            <Text style={styles.heroTagText}>Ride share</Text>
          </View>
          <Text style={styles.heroTitle}>{ride.title}</Text>
          <View style={styles.routeBig}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routePlace} numberOfLines={2}>{ride.startLocation}</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={30} color="#fff" />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={[styles.routePlace, { textAlign: 'right' }]} numberOfLines={2}>{ride.finishLocation}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.facts}>
            <Fact icon="calendar" label={ride.date ? ride.date.slice(0, 4) : 'Date'} value={formatDate(ride.date, false).replace(/ \d{4}$/, '')} />
            <Fact icon="time" label="Departure" value={ride.rideTime || '—'} />
            <Fact icon={typeIcon} label="Vehicle" value={ride.rideType || '—'} />
            <Fact icon="person" label="Seats left" value={`${ride.seatsLeft}/${ride.seats}`} />
          </View>

          {/* My status */}
          {!isOwner && requested && (
            <View style={[styles.status, confirmed ? { backgroundColor: Brand.successSoft } : { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name={confirmed ? 'checkmark-circle' : 'hourglass'} size={22} color={confirmed ? Brand.success : '#B45309'} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.statusTitle, { color: confirmed ? Brand.success : '#B45309' }]}>
                  {confirmed ? 'Your seat is confirmed' : 'Request sent'}
                </Text>
                <Text style={styles.statusText}>
                  {confirmed ? 'Coordinate the meeting point in the trip notes or contact the driver.' : 'The driver will review your request. You will get a notification.'}
                </Text>
              </View>
            </View>
          )}

          {/* Driver */}
          <Pressable style={styles.card} onPress={() => router.push(`/user/${ride.creatorId}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={ride.creator?.fullName || ride.organizer} image={ride.creator?.image} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.small}>Driver</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.name}>{ride.creator?.fullName || ride.organizer}</Text>
                  {!!ride.creator?.subscribed && <ProBadge small />}
                </View>
                <Text style={styles.small}>@{ride.creator?.username || ride.organizer}{ride.creator?.bike ? ` · ${ride.creator.bike}` : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
            </View>
            {!isOwner && (
              <Button title="Message driver" icon="chatbubble-outline" variant="soft" small onPress={() => router.push(`/chat/${ride.creatorId}`)} style={{ marginTop: 12 }} />
            )}
          </Pressable>

          {!!ride.description && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes</Text>
              <Text style={styles.text}>{ride.description}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Button title="Open route in Google Maps" icon="navigate-outline" variant="soft" small onPress={() => Linking.openURL(mapsUrl)} />
          </View>

          {/* Requests (owner) */}
          {isOwner && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Seat requests ({ride.requestsInfo?.length ?? 0})</Text>
              {(ride.requestsInfo ?? []).length === 0 && <Text style={styles.small}>No requests yet. Share the trip with friends!</Text>}
              {(ride.requestsInfo ?? []).map((p) => (
                <View key={p.id} style={styles.person}>
                  <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => router.push(`/user/${p.id}`)}>
                    <Avatar name={p.fullName || p.username} image={p.image} size={40} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.personName}>{p.fullName || p.username}</Text>
                      <Text style={styles.small}>@{p.username}</Text>
                    </View>
                  </Pressable>
                  {p.accepted ? (
                    <Button title="Remove" variant="dangerOutline" small loading={busy === `rm${p.id}`} onPress={() => run(`rm${p.id}`, () => selectPassengerApi(ride.id, p.id, false))} />
                  ) : (
                    <Button
                      title="Accept"
                      small
                      disabled={ride.seatsLeft <= 0}
                      loading={busy === `ok${p.id}`}
                      onPress={() => run(`ok${p.id}`, () => selectPassengerApi(ride.id, p.id, true))}
                    />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isOwner ? (
          <>
            <Button title="Cancel trip" variant="dangerOutline" icon="trash-outline" onPress={handleDelete} loading={busy === 'delete'} style={{ flex: 1 }} />
            <Button title="Edit" icon="create-outline" onPress={() => router.push(`/editPassengerRide/${ride.id}`)} style={{ flex: 1 }} />
          </>
        ) : requested ? (
          <Button title={confirmed ? 'Give up my seat' : 'Withdraw request'} variant="dangerOutline" onPress={withdraw} loading={busy === 'withdraw'} style={{ flex: 1 }} />
        ) : past ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>This trip has already taken place</Text>
          </View>
        ) : (
          <Button
            title={ride.seatsLeft > 0 ? 'Request a seat' : 'Join the waiting list'}
            icon="hand-right-outline"
            onPress={() => run('request', () => requestSeatApi(ride.id), 'Request sent! The driver will let you know.')}
            loading={busy === 'request'}
            style={{ flex: 1 }}
          />
        )}
      </View>
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="passengerRide" targetId={ride.id} subject="trip" />
    </View>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
      <Ionicons name={icon} size={18} color={Brand.primary} />
      <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 44 },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  heroTagText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 10 },
  routeBig: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 },
  routeLabel: { color: '#B9D7F0', fontSize: 12, fontWeight: '700' },
  routePlace: { color: '#fff', fontSize: 17, fontWeight: '800' },
  body: { paddingHorizontal: 16, marginTop: -24 },
  facts: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 14, marginBottom: 14, ...Shadow },
  factValue: { fontSize: 14, fontWeight: '800', color: Brand.text, marginTop: 6 },
  factLabel: { fontSize: 11, color: Brand.muted, marginTop: 2, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: 14, marginBottom: 14 },
  statusTitle: { fontWeight: '800', fontSize: 15 },
  statusText: { color: Brand.textSoft, fontSize: 13, marginTop: 2, lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 10 },
  small: { fontSize: 12, color: Brand.muted },
  name: { fontSize: 16, fontWeight: '800', color: Brand.text, marginVertical: 1 },
  text: { fontSize: 15, lineHeight: 22, color: Brand.textSoft },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  personName: { fontSize: 15, fontWeight: '700', color: Brand.text },
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
  doneBox: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.background, borderRadius: Radius.md },
  doneText: { color: Brand.muted, fontWeight: '700' },
});
