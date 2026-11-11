import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EventItem } from '@/api/eventsApi';
import { PassengerRide } from '@/api/passengerRidesApi';
import { dateParts, formatDate, todayISO } from '@/api/ridesApi';
import { Brand, Radius, RIDE_TYPE_ICONS, Shadow } from '@/constants/brand';
import { RideCover } from './ride-cover';

/** List card for a ride share (seat offer) */
export function ShareCard({ ride, onPress, tag }: { ride: PassengerRide; onPress: () => void; tag?: string }) {
  const { day, month } = dateParts(ride.date);
  const past = !!ride.date && ride.date < todayISO();
  const typeIcon = (RIDE_TYPE_ICONS[ride.rideType ?? ''] ?? 'car-sport') as keyof typeof Ionicons.glyphMap;
  const full = ride.seatsLeft <= 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.dateBox, past && { backgroundColor: Brand.border }]}>
        <Text style={[styles.dateDay, past && { color: Brand.muted }]}>{day}</Text>
        <Text style={[styles.dateMonth, past && { color: Brand.muted }]}>{month}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.title} numberOfLines={1}>
          {ride.title}
        </Text>
        <View style={styles.routeRow}>
          <Text style={styles.place} numberOfLines={1}>
            {ride.startLocation}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={Brand.primary} style={{ marginHorizontal: 4 }} />
          <Text style={styles.place} numberOfLines={1}>
            {ride.finishLocation}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 6, gap: 10 }]}>
          <Ionicons name={typeIcon} size={14} color={Brand.muted} />
          {!!ride.rideTime && <Text style={styles.meta}>{ride.rideTime}</Text>}
          <Text style={styles.meta}>by @{ride.organizer}</Text>
          {tag && (
            <View style={[styles.badge, { backgroundColor: Brand.primarySoft }]}>
              <Text style={[styles.badgeText, { color: Brand.primaryDark }]}>{tag}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.seats, full && { backgroundColor: Brand.dangerSoft }]}>
        <Ionicons name="person" size={14} color={full ? Brand.danger : Brand.success} />
        <Text style={[styles.seatsText, { color: full ? Brand.danger : Brand.success }]}>{full ? 'Full' : `${ride.seatsLeft}/${ride.seats}`}</Text>
      </View>
    </Pressable>
  );
}

/** List card for an event */
export function EventCard({ event, onPress, tag }: { event: EventItem; onPress: () => void; tag?: string }) {
  const past = !!event.eventDate && event.eventDate < todayISO();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
      <View style={styles.eventCover}>
        <RideCover image={event.image} rideType="Both" iconSize={110} />
        {event.isCompany && (
          <View style={styles.sponsored}>
            <Ionicons name="megaphone" size={11} color="#fff" />
            <Text style={styles.sponsoredText}>Sponsored · {event.companyName}</Text>
          </View>
        )}
        {past && (
          <View style={styles.pastTag}>
            <Text style={styles.sponsoredText}>Ended</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 14 }}>
        <View style={styles.row}>
          {!!event.category && (
            <View style={[styles.badge, { backgroundColor: Brand.navySoft, marginRight: 6 }]}>
              <Text style={[styles.badgeText, { color: Brand.navy }]}>{event.category}</Text>
            </View>
          )}
          {tag && (
            <View style={[styles.badge, { backgroundColor: Brand.primarySoft }]}>
              <Text style={[styles.badgeText, { color: Brand.primaryDark }]}>{tag}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, { fontSize: 17, marginTop: 6 }]} numberOfLines={2}>
          {event.name}
        </Text>
        <View style={[styles.row, { marginTop: 6 }]}>
          <Ionicons name="calendar-outline" size={13} color={Brand.muted} />
          <Text style={styles.meta}>
            {' '}
            {formatDate(event.eventDate)}
            {event.eventTime ? ` · ${event.eventTime}` : ''}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 3 }]}>
          <Ionicons name="location-outline" size={13} color={Brand.muted} />
          <Text style={styles.meta} numberOfLines={1}>
            {' '}
            {event.location}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Ionicons name="people" size={14} color={Brand.primary} />
          <Text style={[styles.meta, { color: Brand.primaryDark, fontWeight: '700' }]}>
            {' '}
            {event.attendeesCount} going{event.maxAttendees ? ` · ${Math.max(event.maxAttendees - event.attendeesCount, 0)} spots left` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 12, marginBottom: 12, ...Shadow },
  dateBox: { width: 56, height: 62, borderRadius: Radius.md, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 22, fontWeight: '900', color: Brand.navy, lineHeight: 24 },
  dateMonth: { fontSize: 11, fontWeight: '800', color: Brand.primary, letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: '800', color: Brand.text },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  place: { fontSize: 13, color: Brand.textSoft, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: 12, color: Brand.muted },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.successSoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radius.pill, marginLeft: 8 },
  seatsText: { fontWeight: '800', fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
  eventCard: { backgroundColor: '#fff', borderRadius: Radius.lg, marginBottom: 14, overflow: 'hidden', ...Shadow },
  eventCover: { height: 120, backgroundColor: Brand.navy },
  sponsored: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.accent,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  sponsoredText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  pastTag: { position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(17,24,39,0.7)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
});
