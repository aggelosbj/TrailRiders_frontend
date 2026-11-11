import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { addPostCommentApi, deletePostCommentApi, getPostApi, getPostCommentsApi, Post, PostComment } from '@/api/postsApi';
import { timeAgo } from '@/api/ridesApi';
import { Avatar } from '@/components/kit/avatar';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { PostCard } from '@/components/kit/post-card';
import { ReportSheet } from '@/components/kit/sheets';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function PostScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getPostApi(id), getPostCommentsApi(id).catch(() => [] as PostComment[])]);
      setPost(p);
      setComments(c);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  if (loading) return <Loading />;

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
        <ScreenHeader title="Post" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon="images-outline" title="Post not found" message="It may have been deleted by its author." actionLabel="Go back" onAction={goBack} />
        </View>
      </SafeAreaView>
    );
  }

  const isPostOwner = post.author.id === user?.id;

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const c = await addPostCommentApi(post.id, body);
      setComments((list) => [...list, c]);
      setPost((p) => (p ? { ...p, commentsCount: p.commentsCount + 1 } : p));
      setText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (err) {
      showMessage('Could not post comment', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (c: PostComment) => {
    if (!(await confirmAction('Delete comment?', 'This comment will be removed.', 'Delete', true))) return;
    try {
      await deletePostCommentApi(c.id);
      setComments((list) => list.filter((x) => x.id !== c.id));
      setPost((p) => (p ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p));
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
    }
  };

  const openUser = (userId: number) => (userId === user?.id ? router.push('/(tabs)/profile') : router.push(`/user/${userId}`));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title={`${post.author.fullName || post.author.username}'s post`} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PostCard post={post} detail onChange={setPost} onDeleted={goBack} onCommentPress={() => inputRef.current?.focus()} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Comments ({comments.length})</Text>
            {comments.length === 0 && (
              <View style={styles.noComments}>
                <Ionicons name="chatbubbles-outline" size={26} color={Brand.faint} />
                <Text style={styles.noCommentsText}>No comments yet — be the first to say something nice 👋</Text>
              </View>
            )}
            {comments.map((c) => {
              const mine = c.author.id === user?.id;
              const name = c.author.fullName || c.author.username;
              return (
                <View key={c.id} style={styles.comment}>
                  <Pressable onPress={() => openUser(c.author.id)} hitSlop={4}>
                    <Avatar name={name} image={c.author.image} size={34} />
                  </Pressable>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={[styles.bubble, c.author.id === post.author.id && styles.bubbleAuthor]}>
                      <View style={styles.commentHead}>
                        <Pressable onPress={() => openUser(c.author.id)} style={styles.commentNameRow}>
                          <Text style={styles.commentAuthor} numberOfLines={1}>
                            {name}
                          </Text>
                          {!!c.author.subscribed && <ProBadge small />}
                          {c.author.id === post.author.id && (
                            <View style={styles.authorTag}>
                              <Text style={styles.authorTagText}>Author</Text>
                            </View>
                          )}
                        </Pressable>
                        <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText}>{c.text}</Text>
                    </View>
                    <View style={styles.commentActions}>
                      {!mine && (
                        <Pressable onPress={() => setReportId(c.id)} hitSlop={6}>
                          <Text style={styles.commentAction}>Report</Text>
                        </Pressable>
                      )}
                      {(mine || isPostOwner) && (
                        <Pressable onPress={() => removeComment(c)} hitSlop={6}>
                          <Text style={styles.commentAction}>Delete</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Comment composer */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Avatar name={user?.fullName || user?.username} image={user?.image} size={36} />
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={isPostOwner ? 'Reply to your riders…' : `Comment as ${user?.username ?? 'rider'}…`}
            placeholderTextColor={Brand.faint}
            style={styles.input}
            multiline
            maxLength={1000}
            autoFocus={focus === '1'}
          />
          <Pressable
            onPress={send}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, !text.trim() && { opacity: 0.45 }]}
            accessibilityLabel="Send comment"
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {reportId !== null && <ReportSheet visible onClose={() => setReportId(null)} targetType="postComment" targetId={reportId} subject="comment" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30, width: '100%', maxWidth: 672, alignSelf: 'center' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 12 },
  noComments: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  noCommentsText: { color: Brand.muted, fontSize: 13, textAlign: 'center' },
  comment: { flexDirection: 'row', marginBottom: 12 },
  bubble: { backgroundColor: Brand.input, borderRadius: Radius.md, borderTopLeftRadius: 4, padding: 10 },
  bubbleAuthor: { backgroundColor: Brand.primarySoft },
  commentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  commentAuthor: { fontWeight: '800', color: Brand.text, fontSize: 13, flexShrink: 1 },
  authorTag: { backgroundColor: Brand.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill },
  authorTagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  commentTime: { color: Brand.faint, fontSize: 11 },
  commentText: { color: Brand.textSoft, fontSize: 14, marginTop: 3, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 14, marginTop: 4, marginLeft: 4 },
  commentAction: { color: Brand.faint, fontSize: 12, fontWeight: '700' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...Shadow,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 14,
    color: Brand.text,
    backgroundColor: Brand.input,
    minHeight: 40,
    maxHeight: 110,
    outlineStyle: 'none',
  } as object,
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
});
