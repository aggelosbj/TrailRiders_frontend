import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { createEventApi, EventInput } from '@/api/eventsApi';
import { createPassengerRideApi, PassengerRideInput } from '@/api/passengerRidesApi';
import { createRideApi, RideInput } from '@/api/ridesApi';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EventForm } from '@/components/kit/event-form';
import { RideForm } from '@/components/kit/ride-form';
import { Segmented } from '@/components/kit/segmented';
import { ShareForm } from '@/components/kit/share-form';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type Kind = 'ride' | 'share' | 'event';

const COPY: Record<Kind, { title: string; subtitle: string }> = {
  ride: { title: 'Create a ride', subtitle: 'Plan the route, pick a date and invite riders to join.' },
  share: { title: 'Offer seats', subtitle: 'Share a trip and take a passenger along.' },
  event: { title: 'Create an event', subtitle: 'Meetups, shows, track days — bring the community together.' },
};

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: Kind }>();
  const { user, refreshUser } = useAuth();
  const [kind, setKind] = useState<Kind>(params.type ?? 'ride');
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0); // remount = clear the form after creating

  const [prevType, setPrevType] = useState(params.type);
  if (params.type !== prevType) {
    setPrevType(params.type);
    if (params.type) setKind(params.type);
  }

  const run = async (fn: () => Promise<string>) => {
    setSubmitting(true);
    try {
      const path = await fn();
      setFormKey((k) => k + 1);
      refreshUser();
      router.push(path as never);
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'PREMIUM_LIMIT') {
        if (await confirmAction('Hosting limit reached', errorMessage(err), 'See Premium')) router.push('/premium');
      } else {
        showMessage('Could not create', errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const createRide = (data: RideInput) => run(async () => `/rideDetails/${(await createRideApi(data)).rideId}`);
  const createShare = (data: PassengerRideInput) => run(async () => `/passengerRide/${(await createPassengerRideApi(data)).rideId}`);
  const createEvent = (data: EventInput) => run(async () => `/event/${(await createEventApi(data)).eventId}`);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: Brand.background }}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 8, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{COPY[kind].title}</Text>
        <Text style={styles.subtitle}>{COPY[kind].subtitle}</Text>

        {user && !user.isPremium && user.canHost === false && (
          <Pressable style={styles.limit} onPress={() => router.push('/premium')}>
            <Ionicons name="star" size={18} color="#B45309" />
            <Text style={styles.limitText}>
              You reached the free limit of {user.freeHostingLimit ?? 3} upcoming rides/events. Tap to get Premium for unlimited hosting.
            </Text>
          </Pressable>
        )}

        <View style={{ marginBottom: 18 }}>
          <Segmented<Kind>
            value={kind}
            onChange={setKind}
            options={[
              { key: 'ride', label: 'Group ride', icon: 'bicycle' },
              { key: 'share', label: 'Offer seats', icon: 'car' },
              { key: 'event', label: 'Event', icon: 'calendar' },
            ]}
          />
        </View>

        {kind === 'ride' && <RideForm key={`r${formKey}`} submitLabel="Publish ride" submitting={submitting} onSubmit={createRide} />}
        {kind === 'share' && <ShareForm key={`s${formKey}`} submitLabel="Offer seats" submitting={submitting} onSubmit={createShare} />}
        {kind === 'event' && <EventForm key={`e${formKey}`} submitLabel="Publish event" submitting={submitting} onSubmit={createEvent} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '900', color: Brand.text },
  subtitle: { fontSize: 14, color: Brand.muted, marginTop: 2, marginBottom: 16 },
  limit: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 14 },
  limitText: { flex: 1, color: '#92400E', fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
