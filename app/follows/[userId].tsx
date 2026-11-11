import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { FollowUser, followApi, getFollowsApi, unfollowApi } from '@/api/socialApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { Segmented } from '@/components/kit/segmented';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type Tab = 'followers' | 'following';

export default function FollowsScreen() {
  const { userId, tab: initialTab } = useLocalSearchParams<{ userId: string; tab?: Tab }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab === 'following' ? 'following' : 'followers');
  const [list, setList] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await getFollowsApi(userId, tab));
    } catch (err) {
      showMessage('Could not load', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId, tab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = async (u: FollowUser) => {
    setBusy(u.id);
    try {
      if (u.isFollowing) await unfollowApi(u.id);
      else await followApi(u.id);
      setList((l) => l.map((x) => (x.id === u.id ? { ...x, isFollowing: !x.isFollowing } : x)));
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Riders" />
      <View style={{ paddingHorizontal: 16 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: 'followers', label: 'Followers' },
            { key: 'following', label: 'Following' },
          ]}
        />
      </View>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState icon="people-outline" title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/user/${item.id}`)}>
              <Avatar name={item.fullName || item.username} image={item.image} size={46} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.fullName || item.username}</Text>
                  {!!item.subscribed && <ProBadge small />}
                </View>
                <Text style={styles.small}>@{item.username}{item.bike ? ` · ${item.bike}` : ''}</Text>
              </View>
              {item.id !== me?.id && (
                <Button
                  title={item.isFollowing ? 'Following' : 'Follow'}
                  variant={item.isFollowing ? 'outline' : 'primary'}
                  small
                  loading={busy === item.id}
                  onPress={() => toggle(item)}
                />
              )}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 12, marginBottom: 10, ...Shadow },
  name: { fontSize: 15, fontWeight: '800', color: Brand.text, flexShrink: 1 },
  small: { fontSize: 12, color: Brand.muted, marginTop: 2 },
});
