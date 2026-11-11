import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_URL } from '@/api/client';
import { Avatar } from '@/components/kit/avatar';
import { confirmAction } from '@/components/kit/dialogs';
import { ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

export default function MenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (await confirmAction('Log out?', 'You will need to log in again to use TrailRiders.', 'Log out')) {
      await logout();
      router.replace('/loginRegister/loginRegisterScreen');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Pressable style={styles.profile} onPress={() => router.push('/(tabs)/profile')}>
          <Avatar name={user?.fullName || user?.username} image={user?.image} size={56} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.profileName}>{user?.fullName || user?.username}</Text>
            <Text style={styles.profileSub}>@{user?.username}{user?.email ? ` · ${user.email}` : ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Brand.faint} />
        </Pressable>

        <Group title="Account">
          <Item icon="person-outline" label="Edit profile" onPress={() => router.push('/HeaderScreens/editProfile')} />
          <Item icon="key-outline" label="Change password" onPress={() => router.push('/HeaderScreens/changePassword')} />
          <Item icon="notifications-outline" label="Notifications" onPress={() => router.push('/HeaderScreens/notifications')} />
          <Item icon="star-outline" label="TrailRiders Premium" value={user?.isPremium ? 'Active' : undefined} onPress={() => router.push('/premium')} />
        </Group>

        <Group title="Riding">
          <Item icon="bicycle-outline" label="My activity" onPress={() => router.push('/(tabs)/myRides')} />
          <Item icon="add-circle-outline" label="Create a ride" onPress={() => router.push('/(tabs)/createRide')} />
          <Item icon="car-outline" label="Ride share" onPress={() => router.push({ pathname: '/(tabs)/joinRide', params: { tab: 'shares' } })} />
          <Item icon="calendar-outline" label="Events" onPress={() => router.push({ pathname: '/(tabs)/joinRide', params: { tab: 'events' } })} />
        </Group>

        <Group title="About">
          <Item icon="information-circle-outline" label="About TrailRiders" onPress={() => router.push('/about')} />
          <Item icon="server-outline" label="Server" value={BASE_URL.replace(/^https?:\/\//, '')} />
          <Item icon="phone-portrait-outline" label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        </Group>

        <Group title="Danger zone">
          <Item icon="log-out-outline" label="Log out" onPress={handleLogout} color={Brand.navy} />
          <Item icon="trash-outline" label="Delete account" onPress={() => router.push('/HeaderScreens/deleteAccount')} color={Brand.danger} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 && <View style={styles.sep} />}
          </View>
        ))}
      </View>
    </View>
  );
}

function Item({ icon, label, onPress, value, color }: { icon: IconName; label: string; onPress?: () => void; value?: string; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: Brand.input }]}>
      <View style={[styles.itemIcon, color === Brand.danger && { backgroundColor: Brand.dangerSoft }]}>
        <Ionicons name={icon} size={19} color={color ?? Brand.primary} />
      </View>
      <Text style={[styles.itemLabel, color ? { color } : null]}>{label}</Text>
      {value ? (
        <Text style={styles.itemValue} numberOfLines={1}>{value}</Text>
      ) : (
        onPress && <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  profileName: { fontSize: 17, fontWeight: '800', color: Brand.text },
  profileSub: { fontSize: 13, color: Brand.muted, marginTop: 2 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },
  itemValue: { color: Brand.muted, fontSize: 13, maxWidth: '45%' },
  sep: { height: 1, backgroundColor: Brand.border, marginLeft: 62 },
});
