import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { getRideById, Ride, RideInput, updateRideApi } from '@/api/ridesApi';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { RideForm } from '@/components/kit/ride-form';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function EditRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRideById(id)
      .then(setRide)
      .catch(() => setRide(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: RideInput) => {
    if (!ride) return;
    setSubmitting(true);
    try {
      await updateRideApi(ride.id, data);
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
      <ScreenHeader title="Edit ride" />
      {!ride || ride.creatorId !== user?.id ? (
        <EmptyState icon="lock-closed-outline" title="You can't edit this ride" message="Only the organizer can edit a ride." />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <RideForm initial={ride} submitLabel="Save changes" submitting={submitting} onSubmit={handleSave} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
