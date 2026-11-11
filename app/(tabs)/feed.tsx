import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { CATEGORY_META, FeedScope, getPostsApi, Post, POST_CATEGORIES, POSTS_PAGE } from '@/api/postsApi';
import { Avatar } from '@/components/kit/avatar';
import { EmptyState, Loading } from '@/components/kit/layout';
import { PostCard } from '@/components/kit/post-card';
import { Segmented } from '@/components/kit/segmented';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const MAX_WIDTH = 640;

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [scope, setScope] = useState<FeedScope>('all');
  const [category, setCategory] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Identifies the current filter so late responses for an old filter are ignored
  const filterKey = useRef('all|');
  const moreBusy = useRef(false);

  /**
   * replace: start over (filter change / pull to refresh)
   * merge: refresh the newest page but keep what was already scrolled (coming back to the tab)
   */
  const load = useCallback(
    async (mode: 'replace' | 'merge') => {
      const key = `${scope}|${category}`;
      try {
        const fresh = await getPostsApi({ scope, category, limit: POSTS_PAGE });
        if (key !== filterKey.current) return;
        const full = fresh.length === POSTS_PAGE;
        setPosts((prev) => {
          if (mode === 'replace' || !full || !prev.length) return fresh;
          const oldest = fresh[fresh.length - 1].id;
          return [...fresh, ...prev.filter((p) => p.id < oldest)];
        });
        if (mode === 'replace' || !full) setHasMore(full);
        setError(null);
      } catch (err) {
        if (key === filterKey.current) setError(errorMessage(err));
      } finally {
        if (key === filterKey.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [scope, category]
  );

  useFocusEffect(
    useCallback(() => {
      load('merge');
    }, [load])
  );

  const changeFilter = (nextScope: FeedScope, nextCategory: string) => {
    if (nextScope === scope && nextCategory === category) return;
    filterKey.current = `${nextScope}|${nextCategory}`;
    setScope(nextScope);
    setCategory(nextCategory);
    setPosts([]);
    setHasMore(true);
    setError(null);
    setLoading(true);
  };

  const loadMore = async () => {
    if (moreBusy.current || loading || !hasMore || !posts.length) return;
    moreBusy.current = true;
    setLoadingMore(true);
    const key = filterKey.current;
    try {
      const more = await getPostsApi({ scope, category, before: posts[posts.length - 1].id, limit: POSTS_PAGE });
      if (key !== filterKey.current) return;
      setPosts((list) => [...list, ...more.filter((p) => !list.some((x) => x.id === p.id))]);
      setHasMore(more.length === POSTS_PAGE);
    } catch (err) {
      if (key === filterKey.current) setError(errorMessage(err));
    } finally {
      moreBusy.current = false;
      setLoadingMore(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    load('replace');
  };

  const update = (p: Post) => setPosts((list) => list.map((x) => (x.id === p.id ? p : x)));
  const removed = (id: number) => setPosts((list) => list.filter((x) => x.id !== id));

  const empty =
    scope === 'following'
      ? {
          icon: 'people-outline' as const,
          title: category ? `No ${category} posts from riders you follow` : 'Your following feed is quiet',
          message: 'Follow riders you meet on group rides to see their photos and stories here.',
          label: 'Explore all posts',
          onAction: () => changeFilter('all', category),
        }
      : category
        ? {
            icon: CATEGORY_META[category as keyof typeof CATEGORY_META]?.icon ?? 'images-outline',
            title: `No ${category} posts yet`,
            message: 'Be the first to share a photo or a story in this category.',
            label: 'Create a post',
            onAction: () => router.push('/post/new'),
          }
        : {
            icon: 'images-outline' as const,
            title: 'No posts yet',
            message: 'Share a photo from your last ride, your bike or a road you love.',
            label: 'Create the first post',
            onAction: () => router.push('/post/new'),
          };

  const header = (
    <View>
      {/* Composer prompt */}
      <Pressable style={({ pressed }) => [styles.composer, pressed && { opacity: 0.92 }]} onPress={() => router.push('/post/new')}>
        <Avatar name={user?.fullName || user?.username} image={user?.image} size={40} />
        <View style={styles.composerInput}>
          <Text style={styles.composerText} numberOfLines={1}>
            Share your latest ride…
          </Text>
        </View>
        <View style={styles.composerIcon}>
          <Ionicons name="images" size={20} color={Brand.primary} />
        </View>
      </Pressable>
      {!!error && (
        <Pressable style={styles.errorBox} onPress={() => load('replace')}>
          <Ionicons name="cloud-offline-outline" size={18} color={Brand.danger} />
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </Pressable>
      )}
    </View>
  );

  const footer = loadingMore ? (
    <View style={styles.footer}>
      <ActivityIndicator color={Brand.primary} />
    </View>
  ) : !hasMore && posts.length > 3 ? (
    <View style={styles.footer}>
      <View style={styles.caughtUp}>
        <Ionicons name="checkmark-circle" size={18} color={Brand.success} />
        <Text style={styles.caughtUpText}>You&apos;re all caught up</Text>
      </View>
    </View>
  ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background, paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Feed</Text>
            <Text style={styles.subtitle}>Photos & stories from the riding community.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={() => router.push('/post/new')}
            accessibilityLabel="New post"
          >
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        </View>

        <Segmented<FeedScope>
          value={scope}
          onChange={(s) => changeFilter(s, category)}
          options={[
            { key: 'all', label: 'All', icon: 'globe-outline' },
            { key: 'following', label: 'Following', icon: 'people-outline' },
          ]}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={{ flexGrow: 0 }}>
          <FilterChip label="All bikes" icon="apps" active={!category} onPress={() => changeFilter(scope, '')} />
          {POST_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              label={c}
              icon={CATEGORY_META[c].icon}
              color={CATEGORY_META[c].color}
              active={category === c}
              onPress={() => changeFilter(scope, category === c ? '' : c)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Brand.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={
            !error ? <EmptyState icon={empty.icon} title={empty.title} message={empty.message} actionLabel={empty.label} onAction={empty.onAction} /> : undefined
          }
          renderItem={({ item }) => <PostCard post={item} onChange={update} onDeleted={removed} />}
        />
      )}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  icon,
  color = Brand.textSoft,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Ionicons name={icon} size={14} color={active ? '#fff' : color} style={{ marginRight: 5 }} />
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, width: '100%', maxWidth: MAX_WIDTH + 40, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 28, fontWeight: '900', color: Brand.text },
  subtitle: { fontSize: 14, color: Brand.muted, marginTop: 2 },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    ...Shadow,
  },
  filters: { paddingVertical: 14, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontWeight: '700', fontSize: 13, color: Brand.textSoft },
  list: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 40, width: '100%', maxWidth: MAX_WIDTH + 32, alignSelf: 'center', flexGrow: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 16,
    ...Shadow,
  },
  composerInput: {
    flex: 1,
    marginHorizontal: 10,
    backgroundColor: Brand.input,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Brand.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composerText: { color: Brand.faint, fontSize: 14, fontWeight: '600' },
  composerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.dangerSoft, padding: 12, borderRadius: Radius.md, marginBottom: 14 },
  errorText: { flex: 1, color: Brand.danger, fontWeight: '600', fontSize: 13 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.successSoft, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  caughtUpText: { color: Brand.success, fontWeight: '700', fontSize: 13 },
});
