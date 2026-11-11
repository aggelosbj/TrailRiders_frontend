import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, ScrollViewInstance, Share, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { categoryMeta, compactCount, deletePostApi, likePostApi, Post, postShareText, unlikePostApi } from '@/api/postsApi';
import { timeAgo } from '@/api/ridesApi';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from './avatar';
import { confirmAction, showMessage } from './dialogs';
import { ActionSheet, ReportSheet, SheetAction } from './sheets';
import { ProBadge } from './stars';

const DOUBLE_TAP_MS = 280;
const LONG_TEXT = 280;
const useNative = Platform.OS !== 'web';

/** Small coloured category pill (also used by the feed filters and composer) */
export function CategoryChip({ category, small }: { category?: string | null; small?: boolean }) {
  const meta = categoryMeta(category);
  if (!meta || !category) return null;
  return (
    <View style={[styles.catChip, { backgroundColor: meta.bg }, small && styles.catChipSmall]}>
      <Ionicons name={meta.icon} size={small ? 11 : 13} color={meta.color} />
      <Text style={[styles.catText, { color: meta.color }, small && { fontSize: 11 }]}>{category}</Text>
    </View>
  );
}

/**
 * A post in the feed / on a profile / on the post screen.
 * The parent owns the post: like/unlike calls `onChange` with the updated post, delete calls `onDeleted`.
 */
export function PostCard({
  post,
  onChange,
  onDeleted,
  detail,
  onCommentPress,
}: {
  post: Post;
  onChange?: (post: Post) => void;
  onDeleted?: (id: number) => void;
  /** full text, no navigation to itself */
  detail?: boolean;
  onCommentPress?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const isMine = post.author.id === user?.id;

  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [liking, setLiking] = useState(false);
  const [pop] = useState(() => new Animated.Value(1));

  const name = post.author.fullName || post.author.username;
  const isLong = post.text.length > LONG_TEXT || post.text.split('\n').length > 6;
  const showFull = detail || expanded || !isLong;

  const openPost = (focus?: boolean) => {
    if (detail) return;
    router.push({ pathname: '/post/[id]', params: focus ? { id: String(post.id), focus: '1' } : { id: String(post.id) } });
  };

  const openAuthor = () => {
    if (isMine) router.push('/(tabs)/profile');
    else router.push(`/user/${post.author.id}`);
  };

  const animateLike = () => {
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: useNative }).start();
    if (useNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const setLike = async (liked: boolean) => {
    if (!user) {
      showMessage('Log in to like posts');
      return;
    }
    if (liking || liked === post.likedByMe) return;
    if (liked) animateLike();
    const optimistic = { ...post, likedByMe: liked, likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)) };
    onChange?.(optimistic);
    setLiking(true);
    try {
      const res = liked ? await likePostApi(post.id) : await unlikePostApi(post.id);
      onChange?.({ ...optimistic, likedByMe: res.liked, likesCount: res.likesCount });
    } catch (err) {
      onChange?.(post);
      showMessage('Could not update like', errorMessage(err));
    } finally {
      setLiking(false);
    }
  };

  const share = async () => {
    const text = postShareText(post);
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied!', 'Post copied to the clipboard.');
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // cancelled
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Delete post?', 'Your post, its likes and comments will be removed. This cannot be undone.', 'Delete', true))) return;
    try {
      await deletePostApi(post.id);
      onDeleted?.(post.id);
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
    }
  };

  const actions: SheetAction[] = isMine
    ? [
        ...(!detail ? [{ label: 'Open post', icon: 'open-outline' as const, onPress: () => openPost() }] : []),
        { label: 'Share', icon: 'share-social-outline', onPress: share },
        { label: 'Delete post', icon: 'trash-outline', destructive: true, onPress: remove },
      ]
    : [
        { label: `View ${post.author.username}'s profile`, icon: 'person-outline', onPress: openAuthor },
        { label: 'Send a message', icon: 'chatbubble-outline', onPress: () => router.push(`/chat/${post.author.id}`) },
        { label: 'Report post', icon: 'flag-outline', destructive: true, onPress: () => setReport(true) },
      ];

  return (
    <View style={styles.card}>
      {/* Author */}
      <View style={styles.header}>
        <Pressable onPress={openAuthor} style={styles.authorRow} hitSlop={4}>
          <Avatar name={name} image={post.author.image} size={42} />
          <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              {!!post.author.subscribed && <ProBadge small />}
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              @{post.author.username} · {timeAgo(post.createdAt)}
            </Text>
          </View>
        </Pressable>
        <CategoryChip category={post.category} small />
        <Pressable onPress={() => setMenu(true)} style={styles.moreBtn} hitSlop={8} accessibilityLabel="Post options">
          <Ionicons name="ellipsis-horizontal" size={20} color={Brand.muted} />
        </Pressable>
      </View>

      {/* Text */}
      {!!post.text && (
        <Pressable onPress={() => (isLong && !showFull ? setExpanded(true) : openPost())} disabled={detail}>
          <Text style={[styles.text, detail && styles.textDetail]} numberOfLines={showFull ? undefined : 5}>
            {post.text}
          </Text>
          {!showFull && <Text style={styles.more}>Show more</Text>}
        </Pressable>
      )}

      {!!post.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={Brand.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {post.location}
          </Text>
        </View>
      )}

      {/* Photos */}
      {post.images.length > 0 && (
        <PostImages images={post.images} onDoubleTap={() => setLike(true)} onSingleTap={detail ? undefined : () => openPost()} />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => setLike(!post.likedByMe)} hitSlop={6} accessibilityLabel={post.likedByMe ? 'Unlike' : 'Like'}>
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={24} color={post.likedByMe ? Brand.danger : Brand.textSoft} />
          </Animated.View>
          <Text style={[styles.actionText, post.likedByMe && { color: Brand.danger }]}>{post.likesCount > 0 ? compactCount(post.likesCount) : 'Like'}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onCommentPress ?? (() => openPost(true))} hitSlop={6} accessibilityLabel="Comments">
          <Ionicons name="chatbubble-outline" size={22} color={Brand.textSoft} />
          <Text style={styles.actionText}>{post.commentsCount > 0 ? compactCount(post.commentsCount) : 'Comment'}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.action} onPress={share} hitSlop={6} accessibilityLabel="Share">
          <Ionicons name="paper-plane-outline" size={22} color={Brand.textSoft} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>

      <ActionSheet visible={menu} onClose={() => setMenu(false)} title={isMine ? 'Your post' : `Post by ${post.author.username}`} actions={actions} />
      {report && <ReportSheet visible onClose={() => setReport(false)} targetType="post" targetId={post.id} subject="post" />}
    </View>
  );
}

/** One photo full width, 2–4 photos as a swipeable carousel. Double-tap likes. */
function PostImages({ images, onDoubleTap, onSingleTap }: { images: string[]; onDoubleTap: () => void; onSingleTap?: () => void }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [heart] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollViewInstance>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    []
  );

  const burst = () => {
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, friction: 4, tension: 120, useNativeDriver: useNative }),
      Animated.delay(380),
      Animated.timing(heart, { toValue: 0, duration: 220, useNativeDriver: useNative }),
    ]).start();
  };

  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      burst();
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    if (onSingleTap) {
      tapTimer.current = setTimeout(onSingleTap, DOUBLE_TAP_MS);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(images.length - 1, i)));
  };

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(images.length - 1, i));
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const heartStyle = {
    opacity: heart,
    transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  };

  const multi = images.length > 1;

  return (
    <View style={styles.media} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {multi ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={StyleSheet.absoluteFill}
        >
          {images.map((img, i) => (
            <Pressable key={i} onPress={onPress} style={{ width: width || 1, height: '100%' }}>
              <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
          <Image source={{ uri: images[0] }} style={styles.img} resizeMode="cover" />
        </Pressable>
      )}

      <Animated.View pointerEvents="none" style={[styles.heartBurst, heartStyle]}>
        <Ionicons name="heart" size={96} color="#fff" style={styles.heartShadow} />
      </Animated.View>

      {multi && (
        <>
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {index + 1}/{images.length}
            </Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          {Platform.OS === 'web' && index > 0 && (
            <Pressable style={[styles.arrow, { left: 10 }]} onPress={() => goTo(index - 1)} accessibilityLabel="Previous photo">
              <Ionicons name="chevron-back" size={18} color={Brand.text} />
            </Pressable>
          )}
          {Platform.OS === 'web' && index < images.length - 1 && (
            <Pressable style={[styles.arrow, { right: 10 }]} onPress={() => goTo(index + 1)} accessibilityLabel="Next photo">
              <Ionicons name="chevron-forward" size={18} color={Brand.text} />
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Brand.card, borderRadius: Radius.lg, marginBottom: 16, ...Shadow },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, gap: 8 },
  authorRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800', color: Brand.text, flexShrink: 1 },
  meta: { fontSize: 12, color: Brand.muted, marginTop: 1 },
  moreBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  catChipSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontWeight: '800', fontSize: 12 },
  text: { fontSize: 15, lineHeight: 22, color: Brand.text, paddingHorizontal: 14, paddingBottom: 10 },
  textDetail: { fontSize: 16, lineHeight: 24 },
  more: { color: Brand.primary, fontWeight: '700', fontSize: 14, paddingHorizontal: 14, marginTop: -6, paddingBottom: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 10 },
  locationText: { fontSize: 13, color: Brand.textSoft, fontWeight: '600', flexShrink: 1 },
  media: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Brand.navySoft, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  heartBurst: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  heartShadow: Platform.select({
    web: { textShadow: '0 4px 18px rgba(0,0,0,0.35)' } as object,
    default: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 4 } },
  }) as object,
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,20,40,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  counterText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 16, backgroundColor: '#fff' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderRadius: Radius.sm },
  actionText: { fontSize: 14, fontWeight: '700', color: Brand.textSoft },
});
