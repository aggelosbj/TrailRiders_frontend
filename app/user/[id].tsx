import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { getAllRidesApi, isPastRide, Ride } from '@/api/ridesApi';
import { getUserApi, User } from '@/api/userApi';
import { EmptyState, IconButton, Loading, ScreenHeader } from '@/components/kit/layout';
import { ProfileView } from '@/components/kit/profile-view';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (me && String(me.id) === String(id)) {
      router.replace('/(tabs)/profile');
      return;
    }
    (async () => {
      try {
        const [u, all] = await Promise.all([getUserApi(id), getAllRidesApi({ upcoming: true })]);
        setUser(u);
        setRides(all.filter((r) => !isPastRide(r) && (r.creatorId === Number(id) || r.participants.includes(String(id)))));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, me, router]);

  if (loading) return <Loading />;

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: Brand.background }}>
        <ScreenHeader title="Profile" />
        <EmptyState icon="person-outline" title="User not found" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Brand.background }} contentContainerStyle={{ paddingBottom: 30 }}>
      <ProfileView
        user={user}
        rides={rides}
        headerLeft={<IconButton name="chevron-back" dark onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))} />}
      />
    </ScrollView>
  );
}
