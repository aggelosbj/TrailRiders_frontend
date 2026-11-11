import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { getMyRidesApi, isPastRide, Ride } from '@/api/ridesApi';
import { Button } from '@/components/kit/button';
import { IconButton, Loading } from '@/components/kit/layout';
import { ProfileView } from '@/components/kit/profile-view';
import { UserPosts } from '@/components/kit/user-posts';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [, mine] = await Promise.all([refreshUser(), getMyRidesApi()]);
      setRides([...mine.created, ...mine.joined].filter((r) => !isPastRide(r)).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    } catch {
      // keep what we have
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return <Loading />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Brand.background }}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.primary} />}
    >
      <ProfileView
        user={user}
        rides={rides}
        headerRight={
          <>
            <IconButton name="notifications-outline" dark onPress={() => router.push('/HeaderScreens/notifications')} />
            <IconButton name="settings-outline" dark onPress={() => router.push('/HeaderScreens/menu')} />
          </>
        }
        actions={
          <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Edit profile" icon="create-outline" onPress={() => router.push('/HeaderScreens/editProfile')} style={{ flex: 1 }} small />
            <Button title="Settings" icon="settings-outline" variant="outline" onPress={() => router.push('/HeaderScreens/menu')} style={{ flex: 1 }} small />
          </View>
          {!user.isPremium && (
            <Button title="Get Premium · PRO badge" icon="star" small onPress={() => router.push('/premium')} style={{ marginTop: 10, backgroundColor: '#F5A524' }} />
          )}
          </View>
        }
      />
      <View style={{ paddingHorizontal: 20 }}>
        <UserPosts userId={user.id} />
      </View>
    </ScrollView>
  );
}
