import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getAllRidesApi, isPastRide, Ride } from '@/api/ridesApi';
import { blockUserApi, followApi, unblockUserApi, unfollowApi } from '@/api/socialApi';
import { getUserApi, User } from '@/api/userApi';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, IconButton, Loading, ScreenHeader } from '@/components/kit/layout';
import { ProfileView } from '@/components/kit/profile-view';
import { ActionSheet, ReportSheet } from '@/components/kit/sheets';
import { Brand, Radius } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    if (me && String(me.id) === String(id)) {
      router.replace('/(tabs)/profile');
      return;
    }
    try {
      const [u, all] = await Promise.all([getUserApi(id), getAllRidesApi({ upcoming: true })]);
      setUser(u);
      setRides(all.filter((r) => !isPastRide(r) && (r.creatorId === Number(id) || r.participants.includes(String(id)))));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id, me, router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading />;

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: Brand.background }}>
        <ScreenHeader title="Profile" />
        <EmptyState icon="person-outline" title="User not found" />
      </View>
    );
  }

  const name = user.fullName || user.username;

  const toggleFollow = async () => {
    setBusy(true);
    try {
      if (user.isFollowing) await unfollowApi(user.id);
      else await followApi(user.id);
      setUser({ ...user, isFollowing: !user.isFollowing, followers: (user.followers ?? 0) + (user.isFollowing ? -1 : 1) });
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!user.isBlocked && !(await confirmAction(`Block ${name}?`, "You won't see each other's messages and they won't be able to follow you.", 'Block', true))) return;
    try {
      if (user.isBlocked) await unblockUserApi(user.id);
      else await blockUserApi(user.id);
      await load();
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    }
  };

  const hidden = user.isBlocked || user.blockedYou;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Brand.background }} contentContainerStyle={{ paddingBottom: 30 }}>
      <ProfileView
        user={user}
        rides={hidden ? [] : rides}
        headerLeft={<IconButton name="chevron-back" dark onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))} />}
        headerRight={<IconButton name="ellipsis-horizontal" dark onPress={() => setMenu(true)} />}
        actions={
          hidden ? (
            <View style={styles.blocked}>
              <Text style={styles.blockedText}>{user.isBlocked ? 'You blocked this rider.' : 'You can’t interact with this rider.'}</Text>
              {user.isBlocked && <Button title="Unblock" variant="outline" small onPress={toggleBlock} style={{ marginTop: 8 }} />}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                title={user.isFollowing ? 'Following' : 'Follow'}
                icon={user.isFollowing ? 'checkmark' : 'person-add-outline'}
                variant={user.isFollowing ? 'outline' : 'primary'}
                onPress={toggleFollow}
                loading={busy}
                small
                style={{ flex: 1 }}
              />
              <Button title="Message" icon="chatbubble-outline" variant="navy" small onPress={() => router.push(`/chat/${user.id}`)} style={{ flex: 1 }} />
            </View>
          )
        }
      />

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={name}
        actions={[
          ...(!hidden ? [{ label: 'Send message', icon: 'chatbubble-outline' as const, onPress: () => router.push(`/chat/${user.id}`) }] : []),
          { label: 'Report profile', icon: 'flag-outline', onPress: () => setReport(true), destructive: true },
          { label: user.isBlocked ? 'Unblock' : 'Block', icon: 'ban-outline', onPress: toggleBlock, destructive: !user.isBlocked },
        ]}
      />
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="user" targetId={user.id} subject={name} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  blocked: { marginTop: 16, backgroundColor: Brand.dangerSoft, borderRadius: Radius.md, padding: 14, alignItems: 'center' },
  blockedText: { color: Brand.danger, fontWeight: '700' },
});
