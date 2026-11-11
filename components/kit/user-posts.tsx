import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getUserPostsApi, Post, POSTS_PAGE } from '@/api/postsApi';
import { Brand, Radius } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { Button } from './button';
import { SectionTitle } from './layout';
import { PostCard } from './post-card';

/**
 * A user's posts as a plain section (no FlatList, so it can live inside a profile ScrollView).
 * Reloads the first page whenever the screen gets focus; "Load more" pages with the `before` cursor.
 */
export function UserPosts({ userId, title = 'Posts' }: { userId: number; title?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isMe = user?.id === userId;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const first = await getUserPostsApi(userId);
      setPosts(first);
      setHasMore(first.length === POSTS_PAGE);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = async () => {
    if (loadingMore || !posts.length) return;
    setLoadingMore(true);
    try {
      const more = await getUserPostsApi(userId, posts[posts.length - 1].id);
      setPosts((list) => [...list, ...more.filter((p) => !list.some((x) => x.id === p.id))]);
      setHasMore(more.length === POSTS_PAGE);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const update = (p: Post) => setPosts((list) => list.map((x) => (x.id === p.id ? p : x)));
  const removed = (id: number) => setPosts((list) => list.filter((x) => x.id !== id));

  return (
    <View>
      <SectionTitle title={title} action={isMe ? 'New post' : undefined} onAction={() => router.push('/post/new')} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : error && !posts.length ? (
        <Pressable style={styles.errorBox} onPress={load}>
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </Pressable>
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="images-outline" size={26} color={Brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>{isMe ? 'Share your first post' : 'No posts yet'}</Text>
          <Text style={styles.emptyMsg}>
            {isMe ? 'Photos from your rides, your bike, a great road — show the community.' : 'When this rider shares photos and stories, they will show up here.'}
          </Text>
          {isMe && <Button title="Create a post" icon="add" small onPress={() => router.push('/post/new')} style={{ marginTop: 14 }} />}
        </View>
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={update} onDeleted={removed} />
          ))}
          {hasMore && <Button title="Load more posts" variant="soft" small loading={loadingMore} onPress={loadMore} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 30, alignItems: 'center' },
  empty: { alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 26, paddingHorizontal: 20, borderWidth: 1.5, borderColor: Brand.border, borderStyle: 'dashed' },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  emptyMsg: { fontSize: 13, color: Brand.muted, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  errorBox: { backgroundColor: Brand.dangerSoft, padding: 12, borderRadius: Radius.md },
  errorText: { color: Brand.danger, fontWeight: '600', fontSize: 13 },
});
