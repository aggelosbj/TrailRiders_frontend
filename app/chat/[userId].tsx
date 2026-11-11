import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { RideUser, timeAgo } from '@/api/ridesApi';
import { blockUserApi, getMessagesApi, Message, sendMessageApi, unblockUserApi } from '@/api/socialApi';
import { Avatar } from '@/components/kit/avatar';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { Loading } from '@/components/kit/layout';
import { ActionSheet, ReportSheet } from '@/components/kit/sheets';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const POLL_MS = 3000;

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [other, setOther] = useState<RideUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const lastId = useRef(0);

  const fetchNew = useCallback(
    async (initial = false) => {
      try {
        const res = await getMessagesApi(userId, initial ? undefined : lastId.current);
        setOther(res.user);
        setBlocked(res.blocked);
        if (res.messages.length) {
          lastId.current = res.messages[res.messages.length - 1].id;
          setMessages((list) => {
            const known = new Set(list.map((m) => m.id));
            return [...list, ...res.messages.filter((m) => !known.has(m.id))];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: !initial }), 50);
        }
      } catch (err) {
        if (initial) showMessage('Could not load chat', errorMessage(err));
      } finally {
        if (initial) setLoading(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      lastId.current = 0;
      setMessages([]);
      fetchNew(true);
      const t = setInterval(() => fetchNew(false), POLL_MS);
      return () => clearInterval(t);
    }, [fetchNew])
  );

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      const m = await sendMessageApi(userId, value);
      setText('');
      lastId.current = Math.max(lastId.current, m.id);
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      showMessage('Message not sent', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const toggleBlock = async () => {
    if (!other) return;
    if (!blocked && !(await confirmAction(`Block ${other.username}?`, 'You will not receive messages from each other and they will not see your rides.', 'Block', true))) return;
    try {
      if (blocked) await unblockUserApi(other.id);
      else await blockUserApi(other.id);
      setBlocked(!blocked);
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    }
  };

  if (loading) return <Loading />;

  const name = other?.fullName || other?.username || 'Rider';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Brand.navy} />
        </Pressable>
        <Pressable style={styles.who} onPress={() => other && router.push(`/user/${other.id}`)}>
          <Avatar name={name} image={other?.image} size={38} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {!!other && <Text style={styles.small}>@{other.username}</Text>}
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Brand.navy} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={Brand.primary} />
              <Text style={styles.emptyText}>Say hi to {name} 👋{'\n'}Plan a ride together!</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === me?.id;
            const prev = messages[index - 1];
            const showTime = !prev || new Date(item.createdAt.replace(' ', 'T')).getTime() - new Date(prev.createdAt.replace(' ', 'T')).getTime() > 15 * 60 * 1000;
            return (
              <View>
                {showTime && <Text style={styles.timeSep}>{timeAgo(item.createdAt)}</Text>}
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.text, mine && { color: '#fff' }]}>{item.text}</Text>
                </View>
                {mine && index === messages.length - 1 && <Text style={styles.seen}>{item.readAt ? 'Seen' : 'Sent'}</Text>}
              </View>
            );
          }}
        />

        {blocked ? (
          <View style={styles.blockedBar}>
            <Text style={styles.blockedText}>You can&apos;t message this user.</Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={Brand.faint}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <Pressable onPress={send} disabled={sending || !text.trim()} style={[styles.send, !text.trim() && { opacity: 0.5 }]}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={name}
        actions={[
          { label: 'View profile', icon: 'person-outline', onPress: () => other && router.push(`/user/${other.id}`) },
          { label: 'Report', icon: 'flag-outline', onPress: () => setReport(true), destructive: true },
          { label: blocked ? 'Unblock' : 'Block', icon: 'ban-outline', onPress: toggleBlock, destructive: !blocked },
        ]}
      />
      {!!other && <ReportSheet visible={report} onClose={() => setReport(false)} targetType="user" targetId={other.id} subject={name} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', ...Shadow },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  name: { fontSize: 16, fontWeight: '800', color: Brand.text },
  small: { fontSize: 12, color: Brand.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: Brand.muted, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  timeSep: { alignSelf: 'center', fontSize: 11, color: Brand.faint, marginVertical: 10 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, marginVertical: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: Brand.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 6, ...Shadow },
  text: { fontSize: 15, color: Brand.text, lineHeight: 21 },
  seen: { alignSelf: 'flex-end', fontSize: 11, color: Brand.faint, marginTop: 2, marginRight: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Brand.border },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: 120,
    borderRadius: Radius.lg,
    backgroundColor: Brand.input,
    borderWidth: 1.5,
    borderColor: Brand.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Brand.text,
    outlineStyle: 'none',
  } as object,
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  blockedBar: { padding: 16, alignItems: 'center', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Brand.border },
  blockedText: { color: Brand.muted, fontWeight: '600' },
});
