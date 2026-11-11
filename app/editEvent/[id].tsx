import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { EventInput, EventItem, getEventApi, updateEventApi } from '@/api/eventsApi';
import { showMessage } from '@/components/kit/dialogs';
import { EventForm } from '@/components/kit/event-form';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getEventApi(id)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (data: EventInput) => {
    if (!event) return;
    setSubmitting(true);
    try {
      await updateEventApi(event.id, data);
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
      <ScreenHeader title="Edit event" />
      {!event || event.ownerId !== user?.id ? (
        <EmptyState icon="lock-closed-outline" title="You can't edit this event" />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <EventForm initial={event} submitLabel="Save changes" submitting={submitting} onSubmit={save} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
