import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { CATEGORY_META, createPostApi, MAX_POST_IMAGES, MAX_POST_TEXT, POST_CATEGORIES, PostCategory } from '@/api/postsApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { FormField } from '@/components/kit/form';
import { pickImage } from '@/components/kit/image-picker';
import { ScreenHeader } from '@/components/kit/layout';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const MAX_SIDE = 1280;

/** On web the picker returns the original photo: scale it down so posts stay light. */
function shrinkOnWeb(uri: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(uri);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(uri);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', 0.75);
      resolve(out.length < uri.length ? out : uri);
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState<PostCategory | ''>('');
  const [location, setLocation] = useState('');
  const [picking, setPicking] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const dirty = !!text.trim() || images.length > 0 || !!location.trim() || !!category;
  const canPublish = (!!text.trim() || images.length > 0) && !publishing;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  const handleBack = async () => {
    if (dirty && !publishing && !(await confirmAction('Discard post?', 'Your text and photos will be lost.', 'Discard', true))) return;
    leave();
  };

  const addPhoto = async () => {
    if (images.length >= MAX_POST_IMAGES) return;
    setPicking(true);
    try {
      const uri = await pickImage([4, 3]);
      if (uri) {
        const small = await shrinkOnWeb(uri);
        setImages((list) => (list.length >= MAX_POST_IMAGES ? list : [...list, small]));
      }
    } finally {
      setPicking(false);
    }
  };

  const removePhoto = (i: number) => setImages((list) => list.filter((_, idx) => idx !== i));

  const makeCover = (i: number) =>
    setImages((list) => {
      if (i === 0) return list;
      const next = [...list];
      const [moved] = next.splice(i, 1);
      return [moved, ...next];
    });

  const publish = async () => {
    if (!canPublish) {
      showMessage('Nothing to share yet', 'Write something or add at least one photo.');
      return;
    }
    setPublishing(true);
    try {
      await createPostApi({
        text: text.trim(),
        images,
        category: category || null,
        location: location.trim() || undefined,
      });
      leave();
    } catch (err) {
      showMessage('Could not publish', errorMessage(err));
      setPublishing(false);
    }
  };

  const remaining = MAX_POST_TEXT - text.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="New post" onBack={handleBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Text */}
          <View style={styles.card}>
            <View style={styles.authorRow}>
              <Avatar name={user?.fullName || user?.username} image={user?.image} size={44} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {user?.fullName || user?.username}
                  </Text>
                  {!!user?.isPremium && <ProBadge small />}
                </View>
                <View style={styles.publicRow}>
                  <Ionicons name="globe-outline" size={12} color={Brand.muted} />
                  <Text style={styles.publicText}>Public · visible to all riders</Text>
                </View>
              </View>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="How was the ride? Share a story, a tip or a great road…"
              placeholderTextColor={Brand.faint}
              style={styles.textInput}
              multiline
              maxLength={MAX_POST_TEXT}
              autoFocus={Platform.OS !== 'web'}
            />
            <Text style={[styles.counter, remaining < 100 && { color: remaining < 20 ? Brand.danger : Brand.warning }]}>
              {text.length}/{MAX_POST_TEXT}
            </Text>
          </View>

          {/* Photos */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.sectionHint}>
              {images.length}/{MAX_POST_IMAGES}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {images.map((img, i) => (
              <Pressable key={`${i}-${img.length}`} style={styles.thumb} onPress={() => makeCover(i)}>
                <Image source={{ uri: img }} style={styles.thumbImg} />
                {i === 0 && images.length > 1 && (
                  <View style={styles.coverTag}>
                    <Text style={styles.coverText}>Cover</Text>
                  </View>
                )}
                <Pressable style={styles.removeBtn} onPress={() => removePhoto(i)} hitSlop={8} accessibilityLabel="Remove photo">
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </Pressable>
            ))}
            {images.length < MAX_POST_IMAGES && (
              <Pressable style={({ pressed }) => [styles.thumb, styles.addTile, pressed && { opacity: 0.8 }]} onPress={addPhoto} disabled={picking}>
                {picking ? (
                  <ActivityIndicator color={Brand.primary} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={26} color={Brand.primary} />
                    <Text style={styles.addText}>{images.length ? 'Add more' : 'Add photo'}</Text>
                  </>
                )}
              </Pressable>
            )}
          </ScrollView>
          {images.length > 1 && <Text style={styles.tip}>Tap a photo to make it the cover.</Text>}

          {/* Category */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Category</Text>
            <Text style={styles.sectionHint}>optional</Text>
          </View>
          <View style={styles.chips}>
            {POST_CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(active ? '' : c)}
                  style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                >
                  <Ionicons name={meta.icon} size={14} color={active ? '#fff' : meta.color} style={{ marginRight: 5 }} />
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Location */}
          <View style={{ marginTop: 18 }}>
            <FormField
              label="Location (optional)"
              icon="location-outline"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Stelvio Pass, Italy"
              maxLength={120}
              returnKeyType="done"
            />
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button title="Publish" icon="paper-plane" onPress={publish} loading={publishing} disabled={!canPublish} style={{ flex: 1 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const THUMB = 104;

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30, width: '100%', maxWidth: 672, alignSelf: 'center' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: Brand.text, flexShrink: 1 },
  publicRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  publicText: { fontSize: 12, color: Brand.muted, fontWeight: '600' },
  textInput: {
    minHeight: 130,
    maxHeight: 320,
    fontSize: 17,
    lineHeight: 24,
    color: Brand.text,
    textAlignVertical: 'top',
    paddingVertical: 6,
    outlineStyle: 'none',
  } as object,
  counter: { alignSelf: 'flex-end', fontSize: 12, color: Brand.faint, fontWeight: '600', marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  sectionHint: { fontSize: 12, color: Brand.muted, fontWeight: '700' },
  photos: { gap: 10, paddingVertical: 2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Brand.navySoft },
  thumbImg: { width: '100%', height: '100%' },
  coverTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,20,40,0.7)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
  coverText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primarySoft,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderStyle: 'dashed',
  },
  addText: { color: Brand.primaryDark, fontWeight: '700', fontSize: 12, marginTop: 4 },
  tip: { fontSize: 12, color: Brand.muted, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  chipText: { fontWeight: '700', fontSize: 13, color: Brand.textSoft },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...Shadow,
  },
});
