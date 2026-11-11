import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { getListingApi, ListingDetail, ListingInput, updateListingApi } from '@/api/listingsApi';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { ListingForm } from '@/components/kit/listing-form';
import { Brand } from '@/constants/brand';

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getListingApi(id)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: ListingInput) => {
    if (!listing) return;
    setSubmitting(true);
    try {
      await updateListingApi(listing.id, data);
      if (router.canGoBack()) router.back();
      else router.replace(`/market/${listing.id}`);
    } catch (err) {
      showMessage('Could not save', errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Edit listing" />
      {!listing || !listing.isOwner ? (
        <EmptyState icon="lock-closed-outline" title="You can't edit this listing" message="Only the seller can edit a listing." />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40, width: '100%', maxWidth: 760, alignSelf: 'center' }}
            keyboardShouldPersistTaps="handled"
          >
            <ListingForm initial={listing} submitLabel="Save changes" submitting={submitting} onSubmit={handleSave} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
