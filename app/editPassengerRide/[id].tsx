import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { getPassengerRideApi, PassengerRide, PassengerRideInput, updatePassengerRideApi } from '@/api/passengerRidesApi';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { ShareForm } from '@/components/kit/share-form';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function EditPassengerRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [ride, setRide] = useState<PassengerRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPassengerRideApi(id)
      .then(setRide)
      .catch(() => setRide(null))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (data: PassengerRideInput) => {
    if (!ride) return;
    setSubmitting(true);
    try {
      await updatePassengerRideApi(ride.id, data);
      router.back();
    } catch (err) {
      showMessage('Could not save', errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Edit trip" />
      {!ride || ride.creatorId !== user?.id ? (
        <EmptyState icon="lock-closed-outline" title="You can't edit this trip" />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <ShareForm initial={ride} minSeats={Math.max(1, ride.selected.length)} submitLabel="Save changes" submitting={submitting} onSubmit={save} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
