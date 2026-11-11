import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import {
  cleanAccessCode,
  isLockedRide,
  isPrivateRide,
  joinRideWithCodeApi,
  regenerateRideCodeApi,
  rideAccessCode,
} from '@/api/rideAccessApi';
import {
  addCommentApi,
  Comment,
  deleteCommentApi,
  deleteRideApi,
  formatDate,
  getCommentsApi,
  getRideById,
  isPastRide,
  joinRideApi,
  leaveRideApi,
  mapsUrl,
  rateRideApi,
  Ride,
  timeAgo,
  todayISO,
} from '@/api/ridesApi';
import { AppMap } from '@/components/kit/app-map';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import type { MapLine, MapMarker } from '@/components/kit/map-types';
import { DifficultyBadge, PRIVATE_COLOR, PRIVATE_SOFT, PrivateBadge } from '@/components/kit/ride-cards';
import { ProBadge, StarInput, Stars } from '@/components/kit/stars';
import { ActionSheet, ReportSheet } from '@/components/kit/sheets';
import { RideCover } from '@/components/kit/ride-cover';
import { Brand, Radius, RIDE_TYPE_ICONS, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function RideDetailsScreen() {
  // `code=1` (from Explore's "Enter code" button) focuses the access-code field
  const { id, code: focusCode } = useLocalSearchParams<{ id: string; code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'ride' | 'comment'; id: number; subject: string } | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Map: start / finish pins + a faint straight connection (memoised so typing doesn't re-fit the map)
  const startLat = ride?.startLat;
  const startLng = ride?.startLng;
  const endLat = ride?.endLat;
  const endLng = ride?.endLng;
  const startName = ride?.startLocation;
  const finishName = ride?.finishLocation;
  const mapData = useMemo(() => {
    const markers: MapMarker[] = [];
    const lines: MapLine[] = [];
    const start = startLat != null && startLng != null ? { latitude: Number(startLat), longitude: Number(startLng) } : null;
    const end = endLat != null && endLng != null ? { latitude: Number(endLat), longitude: Number(endLng) } : null;
    if (start) markers.push({ id: 'start', coordinate: start, title: 'Start', subtitle: startName, color: Brand.success, label: 'S' });
    if (end) markers.push({ id: 'finish', coordinate: end, title: 'Finish', subtitle: finishName, color: Brand.danger, label: 'F' });
    if (start && end) lines.push({ id: 'link', coordinates: [start, end], color: 'rgba(29,161,250,0.45)', width: 3 });
    return markers.length ? { markers, lines } : null;
  }, [startLat, startLng, endLat, endLng, startName, finishName]);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([getRideById(id), getCommentsApi(Number(id)).catch(() => [])]);
      setRide(r);
      setComments(c);
    } catch {
      setRide(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading />;

  if (!ride) {
    return (
      <View style={{ flex: 1, backgroundColor: Brand.background, justifyContent: 'center' }}>
        <EmptyState icon="alert-circle-outline" title="Ride not found" message="It may have been cancelled by the organizer." actionLabel="Back to home" onAction={() => router.replace('/(tabs)/home')} />
      </View>
    );
  }

  const me = String(user?.id ?? '');
  const isOwner = ride.creatorId === user?.id;
  const joined = ride.participants.includes(me);
  const past = isPastRide(ride);
  const priv = isPrivateRide(ride);
  // private ride you are not part of: details hidden until you join with the code
  const locked = isLockedRide(ride) && !isOwner && !joined;
  const ownerCode = isOwner && priv ? rideAccessCode(ride) : null;
  const typeIcon = (RIDE_TYPE_ICONS[ride.rideType ?? ''] ?? 'bicycle') as keyof typeof Ionicons.glyphMap;

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      refreshUser();
      if (success) showMessage(success);
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const joinWithCode = async () => {
    const code = cleanAccessCode(codeInput);
    if (code.length < 4) {
      setCodeError('Enter the 6-character code you got from the organizer.');
      return;
    }
    setCodeError(null);
    setBusy(true);
    try {
      await joinRideWithCodeApi(ride.id, code);
      setCodeInput('');
      await load();
      refreshUser();
      showMessage(`You joined "${ride.title}" 🏍️`);
    } catch (err) {
      setCodeError(errorMessage(err, 'Could not join this ride.'));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = () => (locked ? joinWithCode() : run(() => joinRideApi(ride.id), `You joined "${ride.title}" 🏍️`));

  const handleLeave = async () => {
    if (await confirmAction('Leave ride?', `You will be removed from "${ride.title}".`, 'Leave', true)) {
      run(() => leaveRideApi(ride.id));
    }
  };

  const handleDelete = async () => {
    if (await confirmAction('Delete ride?', 'This cannot be undone. All participants will be notified.', 'Delete', true)) {
      setBusy(true);
      try {
        await deleteRideApi(ride.id);
        refreshUser();
        router.replace('/(tabs)/myRides');
      } catch (err) {
        showMessage('Could not delete', errorMessage(err));
        setBusy(false);
      }
    }
  };

  const shareText = async (text: string, copiedMessage = 'Ride details copied to the clipboard.') => {
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied!', copiedMessage);
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // user cancelled
    }
  };

  const handleShare = () =>
    shareText(
      `🏍️ ${ride.title}\n📅 ${formatDate(ride.date)}${ride.rideTime ? ' · ' + ride.rideTime : ''}\n📍 ${ride.startLocation} → ${ride.finishLocation}\n\n` +
        (priv ? 'Private ride — ask the organizer for the access code.' : 'Join me on TrailRiders!')
    );

  const copyCode = async () => {
    if (!ownerCode) return;
    if (Platform.OS === 'web' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(ownerCode);
        showMessage('Copied!', `Access code ${ownerCode} copied to the clipboard.`);
        return;
      } catch {
        // fall through to the share sheet
      }
    }
    // no clipboard module on native: the share sheet has a "Copy" action
    shareText(ownerCode, `Access code ${ownerCode} copied to the clipboard.`);
  };

  const shareCode = () => {
    if (!ownerCode) return;
    shareText(
      `🔒 You're invited to a private ride on TrailRiders: "${ride.title}"\n📅 ${formatDate(ride.date)}${ride.rideTime ? ' · ' + ride.rideTime : ''}\n\n` +
        `Access code: ${ownerCode}\nOpen the ride in the app (Explore → Rides) and enter the code to join.`,
      'Invitation with the access code copied to the clipboard.'
    );
  };

  const regenerateCode = async () => {
    if (
      !(await confirmAction(
        'Create a new code?',
        'The current code will stop working. Riders who already joined stay in the ride.',
        'New code'
      ))
    )
      return;
    setRegenerating(true);
    try {
      const { accessCode } = await regenerateRideCodeApi(ride.id);
      setRide((r) => (r ? ({ ...r, accessCode } as Ride) : r));
      showMessage('New access code', `Share ${accessCode} with the riders you invite.`);
    } catch (err) {
      showMessage('Could not change the code', errorMessage(err));
    } finally {
      setRegenerating(false);
    }
  };

  const submitRating = async () => {
    if (!myRating) {
      showMessage('Pick a rating', 'Tap the stars to rate this ride.');
      return;
    }
    setRating(true);
    try {
      await rateRideApi(ride.id, myRating, review.trim() || undefined);
      await load();
      showMessage('Thanks for your rating! ⭐');
    } catch (err) {
      showMessage('Could not rate', errorMessage(err));
    } finally {
      setRating(false);
    }
  };

  const mine = (ride.ratings ?? []).find((r) => r.userId === user?.id);
  const canRate = !!ride.date && ride.date <= todayISO() && joined && !isOwner;

  const postComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      const c = await addCommentApi(ride.id, text);
      setComments((list) => [...list, c]);
      setCommentText('');
    } catch (err) {
      showMessage('Could not post comment', errorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async (c: Comment) => {
    if (!(await confirmAction('Delete comment?', 'This comment will be removed.', 'Delete', true))) return;
    try {
      await deleteCommentApi(c.id);
      setComments((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
    }
  };

  const route = [ride.startLocation, ...(ride.stops || []).filter(Boolean), ride.finishLocation];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Brand.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <RideCover image={ride.image} rideType={ride.rideType} iconSize={220} />
          <LinearGradient colors={['rgba(0,20,40,0.45)', 'rgba(0,20,40,0)', 'rgba(0,20,40,0.85)']} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroBar, { top: insets.top + 10 }]}>
            <RoundBtn icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <RoundBtn icon="share-social-outline" onPress={handleShare} />
              {!isOwner && <RoundBtn icon="ellipsis-horizontal" onPress={() => setMenu(true)} />}
              {isOwner && <RoundBtn icon="create-outline" onPress={() => router.push(`/editRide/${ride.id}`)} />}
            </View>
          </View>
          <View style={styles.heroBottom}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {!!ride.category && (
                <View style={styles.heroTag}>
                  <Text style={styles.heroTagText}>{ride.category}</Text>
                </View>
              )}
              {past && (
                <View style={[styles.heroTag, { backgroundColor: 'rgba(17,24,39,0.7)' }]}>
                  <Text style={styles.heroTagText}>Completed</Text>
                </View>
              )}
              {priv && <PrivateBadge locked={locked} light />}
            </View>
            <Text style={styles.heroTitle}>{ride.title}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Quick facts */}
          <View style={styles.facts}>
            <Fact icon="calendar" label={ride.date ? ride.date.slice(0, 4) : 'Date'} value={formatDate(ride.date, false).replace(/ \d{4}$/, '')} />
            <Fact icon="time" label="Meet at" value={locked ? 'Hidden' : ride.rideTime || '—'} />
            <Fact icon="speedometer" label="Distance" value={ride.rideDistance ? `${ride.rideDistance} km` : '—'} />
            <Fact icon="hourglass" label="Duration" value={ride.expectedTime || '—'} />
          </View>

          <View style={styles.tagsRow}>
            <DifficultyBadge difficulty={ride.difficulty} />
            <View style={styles.typeTag}>
              <Ionicons name={typeIcon} size={14} color={Brand.navy} />
              <Text style={styles.typeTagText}>{ride.rideType || 'Motorcycle'}</Text>
            </View>
            <View style={styles.typeTag}>
              <Ionicons name="people" size={14} color={Brand.navy} />
              <Text style={styles.typeTagText}>{ride.participantsCount} {ride.participantsCount === 1 ? 'rider' : 'riders'}</Text>
            </View>
          </View>

          {/* Access code (organizer of a private ride) */}
          {isOwner && priv && (
            <View style={[styles.card, styles.codeCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="key" size={18} color={PRIVATE_COLOR} />
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Access code</Text>
              </View>
              <Text style={styles.small}>Riders need this code to see the details and join your private ride.</Text>
              <Text style={styles.codeText} selectable accessibilityLabel={`Access code ${ownerCode ?? ''}`}>
                {ownerCode ?? '— — —'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Copy" icon="copy-outline" variant="soft" small onPress={copyCode} disabled={!ownerCode} style={{ flex: 1 }} />
                <Button title="Share" icon="share-social-outline" variant="soft" small onPress={shareCode} disabled={!ownerCode} style={{ flex: 1 }} />
                <Button title="New code" icon="refresh" variant="outline" small onPress={regenerateCode} loading={regenerating} style={{ flex: 1.1 }} />
              </View>
            </View>
          )}

          {/* Locked private ride: enter the code */}
          {locked && (
            <View style={[styles.card, styles.lockCard]}>
              <View style={styles.lockIcon}>
                <Ionicons name="lock-closed" size={26} color={PRIVATE_COLOR} />
              </View>
              <Text style={styles.lockTitle}>Private ride — code required</Text>
              <Text style={styles.lockText}>
                The organizer shares an access code with invited riders. Enter it to join and see the meeting time, stops, riders and discussion.
              </Text>
              {past ? (
                <Text style={[styles.lockText, { fontWeight: '700', marginTop: 4 }]}>This ride has already taken place.</Text>
              ) : (
                <>
                  <TextInput
                    value={codeInput}
                    onChangeText={(v) => {
                      setCodeInput(v.toUpperCase());
                      if (codeError) setCodeError(null);
                    }}
                    placeholder="ABC123"
                    placeholderTextColor={Brand.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus={focusCode === '1'}
                    maxLength={12}
                    style={[styles.codeInput, !!codeError && { borderColor: Brand.danger }]}
                    onSubmitEditing={joinWithCode}
                    returnKeyType="go"
                    accessibilityLabel="Access code"
                  />
                  {!!codeError && <Text style={styles.codeError}>{codeError}</Text>}
                  <Button title="Join with code" icon="key-outline" onPress={joinWithCode} loading={busy} style={{ alignSelf: 'stretch', marginTop: 12 }} />
                  <Pressable onPress={() => router.push(`/chat/${ride.creatorId}`)} hitSlop={6} style={{ marginTop: 12 }}>
                    <Text style={styles.lockLink}>No code? Message the organizer</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Organizer */}
          <Pressable style={styles.card} onPress={() => router.push(`/user/${ride.creatorId}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={ride.creator?.fullName || ride.organizer} image={ride.creator?.image} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.small}>Organized by</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.organizer}>{ride.creator?.fullName || ride.organizer}</Text>
                  {!!ride.creator?.subscribed && <ProBadge small />}
                </View>
                <Text style={styles.small}>@{ride.creator?.username || ride.organizer}{ride.creator?.bike ? ` · ${ride.creator.bike}` : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
            </View>
          </Pressable>

          {/* Route */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Route</Text>
            {mapData && (
              <AppMap markers={mapData.markers} lines={mapData.lines} height={180} interactive={false} style={{ marginBottom: 14 }} />
            )}
            {route.map((place, i) => {
              const first = i === 0;
              const last = i === route.length - 1;
              return (
                <View key={`${place}-${i}`} style={styles.stepRow}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepDot, first && { backgroundColor: Brand.success }, last && { backgroundColor: Brand.danger }]} />
                    {!last && <View style={styles.stepLine} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
                    <Text style={styles.small}>{first ? 'Start' : last ? 'Finish' : `Stop ${i}`}</Text>
                    <Text style={styles.stepText}>{place}</Text>
                  </View>
                </View>
              );
            })}
            {locked && <Text style={[styles.small, { marginTop: 10 }]}>🔒 Stops and the meeting time are visible after you join.</Text>}
            <Button title="Open in Google Maps" icon="navigate-outline" variant="soft" small onPress={() => Linking.openURL(mapsUrl(ride))} style={{ marginTop: 14 }} />
          </View>

          {/* Description */}
          {!!ride.description && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About this ride</Text>
              <Text style={styles.description}>{ride.description}</Text>
            </View>
          )}

          {/* Participants */}
          {!locked && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Riders ({ride.participantsCount})</Text>
            {(ride.participantsInfo ?? []).map((p) => (
              <Pressable key={p.id} style={styles.person} onPress={() => router.push(`/user/${p.id}`)}>
                <Avatar name={p.fullName || p.username} image={p.image} size={38} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.personName}>
                    {p.fullName || p.username}
                    {p.id === user?.id ? ' (you)' : ''}
                  </Text>
                  <Text style={styles.small}>@{p.username}{p.bike ? ` · ${p.bike}` : ''}</Text>
                </View>
                {p.id === ride.creatorId && (
                  <View style={styles.hostTag}>
                    <Text style={styles.hostText}>Host</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
          )}

          {/* Ratings */}
          {!locked && (canRate || past || (ride.ratingsCount ?? 0) > 0) && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Ratings</Text>
                {ride.avgRating ? <Stars value={ride.avgRating} showValue count={ride.ratingsCount} /> : null}
              </View>
              {canRate && (
                <View style={styles.rateBox}>
                  <Text style={styles.rateTitle}>{mine ? 'Update your rating' : 'How was this ride?'}</Text>
                  <StarInput value={myRating || mine?.rating || 0} onChange={setMyRating} />
                  <TextInput
                    value={review}
                    onChangeText={setReview}
                    placeholder={mine?.review || 'Write a short review (optional)'}
                    placeholderTextColor={Brand.faint}
                    style={[styles.commentInput, { marginTop: 12, alignSelf: 'stretch' }]}
                    maxLength={500}
                    multiline
                  />
                  <Button title={mine ? 'Update rating' : 'Submit rating'} small onPress={submitRating} loading={rating} style={{ marginTop: 10, alignSelf: 'stretch' }} />
                </View>
              )}
              {(ride.ratings ?? []).length === 0 && !canRate && <Text style={styles.small}>No ratings yet.</Text>}
              {(ride.ratings ?? []).map((r) => (
                <View key={r.id} style={styles.comment}>
                  <Avatar name={r.fullName || r.username} image={r.image} size={34} />
                  <View style={styles.bubble}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.commentAuthor}>{r.fullName || r.username}</Text>
                      <Stars value={r.rating} size={12} />
                    </View>
                    {!!r.review && <Text style={styles.commentText}>{r.review}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Comments */}
          {!locked && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Discussion ({comments.length})</Text>
            {comments.length === 0 && <Text style={styles.small}>No comments yet — ask a question or say hi 👋</Text>}
            {comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Avatar name={c.fullName || c.username} image={c.image} size={34} />
                <View style={styles.bubble}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.commentAuthor}>{c.fullName || c.username || 'Rider'}</Text>
                    <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 4 }}>
                    {c.userId !== user?.id && (
                      <Pressable onPress={() => setReportTarget({ type: 'comment', id: c.id, subject: 'comment' })} hitSlop={6}>
                        <Text style={{ color: Brand.faint, fontSize: 12, fontWeight: '600' }}>Report</Text>
                      </Pressable>
                    )}
                    {(c.userId === user?.id || isOwner) && (
                      <Pressable onPress={() => removeComment(c)} hitSlop={6}>
                        <Text style={{ color: Brand.faint, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            ))}
            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment…"
                placeholderTextColor={Brand.faint}
                style={styles.commentInput}
                multiline
                maxLength={1000}
              />
              <Pressable onPress={postComment} disabled={posting || !commentText.trim()} style={[styles.sendBtn, !commentText.trim() && { opacity: 0.5 }]}>
                {posting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
              </Pressable>
            </View>
          </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isOwner ? (
          <>
            <Button title="Delete" variant="dangerOutline" icon="trash-outline" onPress={handleDelete} disabled={busy} style={{ flex: 1 }} />
            <Button title="Edit ride" icon="create-outline" onPress={() => router.push(`/editRide/${ride.id}`)} disabled={busy} style={{ flex: 1.4 }} />
          </>
        ) : joined ? (
          <>
            <View style={styles.joinedBox}>
              <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
              <Text style={styles.joinedText}>You&apos;re riding</Text>
            </View>
            {!past && <Button title="Leave" variant="outline" onPress={handleLeave} loading={busy} style={{ flex: 1 }} />}
          </>
        ) : past ? (
          <View style={[styles.joinedBox, { justifyContent: 'center' }]}>
            <Text style={styles.joinedText}>This ride has finished</Text>
          </View>
        ) : locked ? (
          <Button title="Join with code" icon="lock-closed-outline" onPress={handleJoin} loading={busy} style={{ flex: 1 }} />
        ) : (
          <Button title="Join this ride" icon="add-circle-outline" onPress={handleJoin} loading={busy} style={{ flex: 1 }} />
        )}
      </View>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={ride.title}
        actions={[
          { label: 'Message organizer', icon: 'chatbubble-outline', onPress: () => router.push(`/chat/${ride.creatorId}`) },
          { label: 'Report ride', icon: 'flag-outline', destructive: true, onPress: () => setReportTarget({ type: 'ride', id: ride.id, subject: 'ride' }) },
        ]}
      />
      {reportTarget && (
        <ReportSheet visible onClose={() => setReportTarget(null)} targetType={reportTarget.type} targetId={reportTarget.id} subject={reportTarget.subject} />
      )}
    </KeyboardAvoidingView>
  );
}

function RoundBtn({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.roundBtn} hitSlop={6}>
      <Ionicons name={icon} size={21} color="#fff" />
    </Pressable>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={Brand.primary} />
      <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 320, backgroundColor: Brand.navy, justifyContent: 'flex-end', overflow: 'hidden' },
  heroBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { padding: 20, paddingBottom: 40 },
  heroTag: { backgroundColor: Brand.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  heroTagText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 34 },
  body: { paddingHorizontal: 16, marginTop: -24 },
  facts: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 14, ...Shadow },
  fact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  factValue: { fontSize: 14, fontWeight: '800', color: Brand.text, marginTop: 6 },
  factLabel: { fontSize: 11, color: Brand.muted, marginTop: 2, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', gap: 8, marginVertical: 14, flexWrap: 'wrap', alignItems: 'center' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.navySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  typeTagText: { color: Brand.navy, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 12 },
  small: { fontSize: 12, color: Brand.muted },
  organizer: { fontSize: 16, fontWeight: '800', color: Brand.text, marginVertical: 1 },
  stepRow: { flexDirection: 'row' },
  stepRail: { width: 22, alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Brand.primary, marginTop: 4 },
  stepLine: { flex: 1, width: 2, backgroundColor: Brand.border, marginTop: 2 },
  stepText: { fontSize: 15, fontWeight: '700', color: Brand.text, marginTop: 1 },
  description: { fontSize: 15, lineHeight: 23, color: Brand.textSoft },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  personName: { fontSize: 15, fontWeight: '700', color: Brand.text },
  hostTag: { backgroundColor: Brand.primarySoft, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  hostText: { color: Brand.primaryDark, fontWeight: '800', fontSize: 11 },
  comment: { flexDirection: 'row', marginBottom: 12 },
  bubble: { flex: 1, marginLeft: 10, backgroundColor: Brand.input, borderRadius: Radius.md, padding: 10 },
  commentAuthor: { fontWeight: '800', color: Brand.text, fontSize: 13 },
  commentTime: { color: Brand.faint, fontSize: 11 },
  commentText: { color: Brand.textSoft, fontSize: 14, marginTop: 3, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  commentInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Brand.text,
    backgroundColor: Brand.input,
    maxHeight: 100,
    outlineStyle: 'none',
  } as object,
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...Shadow,
  },
  joinedBox: { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.successSoft, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 52 },
  joinedText: { color: Brand.success, fontWeight: '800', fontSize: 15 },
  rateBox: { alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: Radius.md, padding: 14, marginBottom: 14 },
  rateTitle: { fontWeight: '800', color: Brand.text, marginBottom: 8, fontSize: 15 },
  codeCard: { borderWidth: 1.5, borderColor: PRIVATE_SOFT },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    color: PRIVATE_COLOR,
    textAlign: 'center',
    marginVertical: 14,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  lockCard: { alignItems: 'center', borderWidth: 1.5, borderColor: PRIVATE_SOFT },
  lockIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIVATE_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  lockTitle: { fontSize: 17, fontWeight: '900', color: Brand.text, textAlign: 'center' },
  lockText: { fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  codeInput: {
    alignSelf: 'stretch',
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    backgroundColor: Brand.input,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: Brand.text,
    outlineStyle: 'none',
  } as object,
  codeError: { color: Brand.danger, fontWeight: '600', fontSize: 13, marginTop: 8, textAlign: 'center' },
  lockLink: { color: Brand.primary, fontWeight: '700', fontSize: 13 },
});
