import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { timeAgo } from '@/api/ridesApi';
import { Conversation, getConversationsApi } from '@/api/socialApi';
import { Avatar } from '@/components/kit/avatar';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getConversationsApi());
    } catch (err) {
      showMessage('Could not load messages', errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Messages" />
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => String(c.user.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No messages yet"
              message="Open a rider's profile and tap “Message” to start a conversation."
              actionLabel="Find riders"
              onAction={() => router.push('/(tabs)/joinRide')}
            />
          }
          renderItem={({ item }) => {
            const mine = item.lastMessage.senderId === user?.id;
            const unread = item.unread > 0;
            return (
              <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]} onPress={() => router.push(`/chat/${item.user.id}`)}>
                <Avatar name={item.user.fullName || item.user.username} image={item.user.image} size={50} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.name, unread && { fontWeight: '900' }]} numberOfLines={1}>
                      {item.user.fullName || item.user.username}
                    </Text>
                    {!!item.user.subscribed && <ProBadge small />}
                    <Text style={styles.time}>{timeAgo(item.lastMessage.createdAt)}</Text>
                  </View>
                  <Text style={[styles.preview, unread && { color: Brand.text, fontWeight: '700' }]} numberOfLines={1}>
                    {mine ? 'You: ' : ''}
                    {item.lastMessage.text}
                  </Text>
                </View>
                {unread ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow },
  name: { fontSize: 16, fontWeight: '700', color: Brand.text, flexShrink: 1 },
  time: { marginLeft: 'auto', fontSize: 11, color: Brand.faint },
  preview: { fontSize: 14, color: Brand.muted, marginTop: 3 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
