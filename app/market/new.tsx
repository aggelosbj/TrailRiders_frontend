import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { createListingApi, errorCode, getMyListingsApi, ListingInput, MyListingLimits } from '@/api/listingsApi';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { ScreenHeader } from '@/components/kit/layout';
import { ListingForm } from '@/components/kit/listing-form';
import { Brand, Radius } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function NewListingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [limits, setLimits] = useState<MyListingLimits | null>(null);

  useEffect(() => {
    getMyListingsApi()
      .then((r) => setLimits(r.limits))
      .catch(() => setLimits(null));
  }, []);

  const atLimit = !!limits && !limits.isPremium && limits.maxActive !== null && limits.active >= limits.maxActive;

  const handleCreate = async (data: ListingInput) => {
    setSubmitting(true);
    try {
      const res = await createListingApi(data);
      router.replace(`/market/${res.listingId}`);
    } catch (err) {
      if (errorCode(err) === 'PREMIUM_LIMIT') {
        if (await confirmAction('Listing limit reached', errorMessage(err), 'See Premium')) router.push('/premium');
      } else {
        showMessage('Could not publish', errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Sell an item" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {atLimit ? (
            <Pressable style={styles.limit} onPress={() => router.push('/premium')}>
              <Ionicons name="star" size={18} color="#B45309" />
              <Text style={styles.limitText}>
                You have {limits?.active} of {limits?.maxActive} active listings (free plan). Mark one as sold or tap to get Premium for unlimited listings.
              </Text>
            </Pressable>
          ) : (
            <View style={styles.intro}>
              <Ionicons name="sparkles" size={18} color={Brand.primaryDark} />
              <Text style={styles.introText}>
                Riders buy from riders. Add clear photos, an honest description and a fair price — most items sell within days.
              </Text>
            </View>
          )}
          <ListingForm submitLabel="Publish listing" submitting={submitting} onSubmit={handleCreate} defaultLocation={user?.location} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 8, paddingBottom: 40, width: '100%', maxWidth: 760, alignSelf: 'center' },
  intro: { flexDirection: 'row', gap: 10, backgroundColor: Brand.primarySoft, borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  introText: { flex: 1, color: Brand.textSoft, fontSize: 13, lineHeight: 19 },
  limit: { flexDirection: 'row', gap: 10, backgroundColor: '#FEF3C7', borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  limitText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600', lineHeight: 19 },
});
