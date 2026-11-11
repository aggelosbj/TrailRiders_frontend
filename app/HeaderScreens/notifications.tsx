import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import {
  deleteNotificationsApi,
  getNotificationsApi,
  markAllReadApi,
  markNotificationsApi,
  NotificationItem,
} from '@/api/notificationsApi';
import { timeAgo } from '@/api/ridesApi';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';

type IconName = keyof typeof Ionicons.glyphMap;

const iconFor = (subject: string): { icon: IconName; color: string; bg: string } => {
  const s = subject.toLowerCase();
  if (s.includes('premium')) return { icon: 'star', color: '#F5A524', bg: '#FEF3C7' };
  if (s.includes('rating')) return { icon: 'star-half', color: '#F5A524', bg: '#FEF3C7' };
  if (s.includes('seat confirmed')) return { icon: 'checkmark-circle', color: Brand.success, bg: Brand.successSoft };
  if (s.includes('seat') || s.includes('passenger')) return { icon: 'car', color: Brand.primary, bg: Brand.primarySoft };
  if (s.includes('attendee') || s.includes('event')) return { icon: 'calendar', color: Brand.navy, bg: Brand.navySoft };
  if (s.includes('joined')) return { icon: 'person-add', color: Brand.success, bg: Brand.successSoft };
  if (s.includes('left')) return { icon: 'person-remove', color: Brand.warning, bg: '#FEF3C7' };
  if (s.includes('comment')) return { icon: 'chatbubble-ellipses', color: Brand.primary, bg: Brand.primarySoft };
  if (s.includes('cancel')) return { icon: 'close-circle', color: Brand.danger, bg: Brand.dangerSoft };
  if (s.includes('updated')) return { icon: 'refresh-circle', color: Brand.navy, bg: Brand.navySoft };
  return { icon: 'notifications', color: Brand.primary, bg: Brand.primarySoft };
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [viewing, setViewing] = useState<NotificationItem | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getNotificationsApi());
    } catch (err) {
      showMessage('Could not load notifications', errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleSelection = (id: number) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const markAs = async (isRead: boolean) => {
    const ids = selectedIds;
    setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, isRead } : n)));
    setSelectedIds([]);
    try {
      await markNotificationsApi(ids, isRead);
    } catch (err) {
      showMessage('Error', errorMessage(err));
      load();
    }
  };

  const remove = async (ids: number[]) => {
    if (!(await confirmAction('Delete', ids.length > 1 ? `Delete ${ids.length} notifications?` : 'Delete this notification?', 'Delete', true))) return;
    setItems((list) => list.filter((n) => !ids.includes(n.id)));
    setSelectedIds([]);
    setViewing(null);
    try {
      await deleteNotificationsApi(ids);
    } catch (err) {
      showMessage('Error', errorMessage(err));
      load();
    }
  };

  const markAll = async () => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllReadApi();
    } catch {
      load();
    }
  };

  const open = (item: NotificationItem) => {
    if (selectedIds.length > 0) {
      toggleSelection(item.id);
      return;
    }
    if (!item.isRead) {
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      markNotificationsApi([item.id], true).catch(() => {});
    }
    setViewing({ ...item, isRead: true });
  };

  const unread = items.filter((n) => !n.isRead).length;

  // ---- Detail view ----
  if (viewing) {
    const ic = iconFor(viewing.subject);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
        <ScreenHeader
          title="Notification"
          onBack={() => setViewing(null)}
          right={
            <Pressable onPress={() => remove([viewing.id])} style={styles.headerIcon} hitSlop={8}>
              <Ionicons name="trash-outline" size={21} color={Brand.danger} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.detailCard}>
            <View style={[styles.iconCircle, { backgroundColor: ic.bg, width: 56, height: 56, borderRadius: 28 }]}>
              <Ionicons name={ic.icon} size={28} color={ic.color} />
            </View>
            <Text style={styles.detailSubject}>{viewing.subject}</Text>
            <Text style={styles.detailMeta}>
              From {viewing.senderName || 'TrailRiders'} · {timeAgo(viewing.createdAt)}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.detailText}>{viewing.description}</Text>
            {!!(viewing.link || viewing.rideId) && (
              <Button
                title="Open"
                icon="arrow-forward"
                onPress={() => router.push((viewing.link || `/rideDetails/${viewing.rideId}`) as never)}
                style={{ marginTop: 20 }}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      {selectedIds.length > 0 ? (
        <View style={[styles.selHeader]}>
          <Pressable onPress={() => setSelectedIds([])} hitSlop={8}>
            <Ionicons name="close" size={24} color={Brand.navy} />
          </Pressable>
          <Text style={styles.selTitle}>{selectedIds.length} selected</Text>
          <Pressable onPress={() => markAs(true)} style={styles.headerIcon} hitSlop={6}>
            <Ionicons name="mail-open-outline" size={21} color={Brand.navy} />
          </Pressable>
          <Pressable onPress={() => markAs(false)} style={styles.headerIcon} hitSlop={6}>
            <Ionicons name="mail-unread-outline" size={21} color={Brand.navy} />
          </Pressable>
          <Pressable onPress={() => remove(selectedIds)} style={styles.headerIcon} hitSlop={6}>
            <Ionicons name="trash-outline" size={21} color={Brand.danger} />
          </Pressable>
        </View>
      ) : (
        <ScreenHeader
          title="Notifications"
          right={
            unread > 0 ? (
              <Pressable onPress={markAll} hitSlop={8}>
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.primary} />}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={styles.hint}>
                {unread > 0 ? `${unread} unread · ` : ''}Long-press to select
              </Text>
            ) : undefined
          }
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="You're all caught up" message="When riders join your rides or comment, you'll see it here." />}
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            const ic = iconFor(item.subject);
            return (
              <Pressable
                onPress={() => open(item)}
                onLongPress={() => toggleSelection(item.id)}
                style={[styles.item, !item.isRead && styles.unread, selected && styles.selected]}
              >
                <Pressable onPress={() => toggleSelection(item.id)} hitSlop={6} style={{ marginRight: 12 }}>
                  {selected ? (
                    <View style={[styles.iconCircle, { backgroundColor: Brand.primary }]}>
                      <Ionicons name="checkmark" size={22} color="#fff" />
                    </View>
                  ) : (
                    <View style={[styles.iconCircle, { backgroundColor: ic.bg }]}>
                      <Ionicons name={ic.icon} size={20} color={ic.color} />
                    </View>
                  )}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.subject, !item.isRead && { fontWeight: '900' }]} numberOfLines={1}>
                      {item.subject}
                    </Text>
                    <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                {!item.isRead && <View style={styles.dot} />}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  selHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Brand.primarySoft, gap: 4 },
  selTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Brand.navy, marginLeft: 12 },
  markAll: { color: Brand.primary, fontWeight: '700', fontSize: 13 },
  hint: { color: Brand.faint, fontSize: 12, marginBottom: 10, marginLeft: 4 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow },
  unread: { backgroundColor: '#F5FBFF', borderLeftWidth: 4, borderLeftColor: Brand.primary },
  selected: { backgroundColor: Brand.primarySoft },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  subject: { flex: 1, fontSize: 15, fontWeight: '700', color: Brand.text },
  time: { fontSize: 11, color: Brand.faint, marginLeft: 8 },
  desc: { fontSize: 13, color: Brand.muted, marginTop: 3, lineHeight: 18 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.primary, marginLeft: 8 },
  detailCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 20, ...Shadow },
  detailSubject: { fontSize: 22, fontWeight: '900', color: Brand.text, marginTop: 14 },
  detailMeta: { color: Brand.muted, fontSize: 13, marginTop: 4 },
  divider: { height: 1, backgroundColor: Brand.border, marginVertical: 16 },
  detailText: { fontSize: 15, lineHeight: 23, color: Brand.textSoft },
});
