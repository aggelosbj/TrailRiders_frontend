import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import {
  categoryMeta,
  deleteListingApi,
  errorCode,
  featureListingApi,
  formatKm,
  formatPrice,
  getListingApi,
  isVehicle,
  Listing,
  ListingDetail,
  ListingStatus,
  monthYear,
  setFavoriteApi,
  setListingStatusApi,
  STATUS_META,
  unfeatureListingApi,
} from '@/api/listingsApi';
import { timeAgo } from '@/api/ridesApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import { FeaturedBadge, GOLD, ListingCard, ListingPhoto } from '@/components/kit/listing-card';
import { Segmented } from '@/components/kit/segmented';
import { ActionSheet, ReportSheet } from '@/components/kit/sheets';
import { ProBadge } from '@/components/kit/stars';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setListing(await getListingApi(id));
    } catch {
      setListing(null);
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

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: Brand.background, justifyContent: 'center' }}>
        <EmptyState
          icon="pricetag-outline"
          title="Listing not found"
          message="It may have been removed by the seller."
          actionLabel="Back to Marketplace"
          onAction={() => router.replace('/market')}
        />
      </View>
    );
  }

  const l = listing;
  const isOwner = l.isOwner;
  const seller = l.seller;
  const sellerName = seller.fullName || seller.username;
  const meta = categoryMeta(l.category);
  const galleryH = Math.round(Math.min(width * 0.82, 480));
  const featuredDays = Math.max(1, Math.ceil(l.featuredHoursLeft / 24));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/market'));

  const goPremium = async (title: string, message: string) => {
    if (await confirmAction(title, message, 'See Premium')) router.push('/premium');
  };

  const toggleFavorite = async () => {
    const next = !l.isFavorite;
    setListing({ ...l, isFavorite: next, favoritesCount: l.favoritesCount + (next ? 1 : -1) });
    try {
      await setFavoriteApi(l.id, next);
    } catch (err) {
      setListing(l);
      showMessage('Could not update saved listings', errorMessage(err));
    }
  };

  const handleShare = async () => {
    const text = `${l.title} — ${formatPrice(l.price)}${l.negotiable && l.price !== null ? ' (negotiable)' : ''}${l.location ? `\n📍 ${l.location}` : ''}\n\nFor sale on the TrailRiders Marketplace 🏍️`;
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          showMessage('Copied!', 'Listing details copied to the clipboard.');
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // user cancelled
    }
  };

  const changeStatus = async (status: ListingStatus) => {
    if (status === l.status) return;
    if (status === 'sold' && !(await confirmAction('Mark as sold?', l.isFeatured ? 'The listing will be hidden from the Marketplace and its Featured spot ends.' : 'The listing will be hidden from the Marketplace. You can re-activate it later.', 'Mark sold'))) return;
    setBusy('status');
    try {
      const updated = await setListingStatusApi(l.id, status);
      setListing({ ...l, ...updated, seller: l.seller });
    } catch (err) {
      if (errorCode(err) === 'PREMIUM_LIMIT') goPremium('Listing limit reached', errorMessage(err));
      else showMessage('Could not change status', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const feature = async () => {
    setBusy('feature');
    try {
      const updated = await featureListingApi(l.id);
      setListing({ ...l, ...updated, seller: l.seller });
      showMessage('Your listing is featured ⚡', 'It now appears at the top of the Marketplace for 7 days.');
    } catch (err) {
      if (errorCode(err) === 'PREMIUM_REQUIRED') goPremium('Premium feature', errorMessage(err));
      else showMessage('Could not feature listing', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const unfeature = async () => {
    if (!(await confirmAction('Stop featuring?', 'The listing goes back to the normal order and frees one Featured spot.', 'Stop featuring'))) return;
    setBusy('feature');
    try {
      const updated = await unfeatureListingApi(l.id);
      setListing({ ...l, ...updated, seller: l.seller });
    } catch (err) {
      showMessage('Something went wrong', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Delete listing?', 'This removes the listing and all its photos. This cannot be undone.', 'Delete', true))) return;
    setBusy('delete');
    try {
      await deleteListingApi(l.id);
      back();
    } catch (err) {
      showMessage('Could not delete', errorMessage(err));
      setBusy(null);
    }
  };

  // Specs table (only filled values)
  const specRows: { icon: IconName; label: string; value: string }[] = [
    { icon: 'pricetag-outline', label: 'Category', value: l.category },
    { icon: 'sparkles-outline', label: 'Condition', value: l.condition ?? '' },
    { icon: 'ribbon-outline', label: 'Brand', value: l.brand ?? '' },
    { icon: 'construct-outline', label: 'Model', value: l.model ?? '' },
    { icon: 'calendar-outline', label: 'Year', value: l.year ? String(l.year) : '' },
    { icon: 'speedometer-outline', label: 'Mileage', value: formatKm(l.km) },
  ];
  const specs = specRows.filter((s) => s.value);

  const facts: { icon: IconName; label: string; value: string }[] = isVehicle(l.category)
    ? [
        { icon: 'calendar', label: 'Year', value: l.year ? String(l.year) : '—' },
        { icon: 'speedometer', label: 'Mileage', value: l.km !== null ? formatKm(l.km) : '—' },
        { icon: 'sparkles', label: 'Condition', value: l.condition || '—' },
      ]
    : [
        { icon: 'sparkles', label: 'Condition', value: l.condition || '—' },
        { icon: 'ribbon', label: 'Brand', value: l.brand || '—' },
        { icon: 'eye', label: 'Views', value: String(l.views) },
      ];

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* Gallery */}
        <View style={{ height: galleryH, backgroundColor: Brand.navy }}>
          {l.images.length ? (
            <Gallery images={l.images} width={width} height={galleryH} onOpen={setViewer} />
          ) : (
            <ListingPhoto image={null} category={l.category} style={{ height: galleryH }} iconSize={110} />
          )}
          <LinearGradient
            colors={['rgba(0,20,40,0.45)', 'rgba(0,20,40,0)']}
            style={[styles.topShade, { height: insets.top + 80 }]}
            pointerEvents="none"
          />
          <View style={[styles.heroBar, { top: insets.top + 10 }]}>
            <RoundBtn icon="chevron-back" onPress={back} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <RoundBtn icon="share-social-outline" onPress={handleShare} />
              {isOwner ? (
                <RoundBtn icon="create-outline" onPress={() => router.push(`/market/edit/${l.id}`)} />
              ) : (
                <>
                  <RoundBtn icon={l.isFavorite ? 'heart' : 'heart-outline'} color={l.isFavorite ? '#FF6B6F' : '#fff'} onPress={toggleFavorite} />
                  <RoundBtn icon="ellipsis-horizontal" onPress={() => setMenu(true)} />
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Price + title */}
          <View style={styles.mainCard}>
            {l.status !== 'active' && (
              <View style={[styles.statusBanner, { backgroundColor: STATUS_META[l.status].bg }]}>
                <Ionicons name={l.status === 'sold' ? 'checkmark-done-circle' : 'time'} size={18} color={STATUS_META[l.status].fg} />
                <Text style={[styles.statusBannerText, { color: STATUS_META[l.status].fg }]}>
                  {l.status === 'sold' ? 'This item has been sold' : 'Reserved — the seller is talking to a buyer'}
                </Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={[styles.price, l.price === null && styles.priceAsk]}>{formatPrice(l.price)}</Text>
              {l.negotiable && l.price !== null && (
                <View style={styles.negTag}>
                  <Ionicons name="swap-horizontal" size={13} color={Brand.success} />
                  <Text style={styles.negText}>Negotiable</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              {l.isFeatured && <FeaturedBadge />}
            </View>
            <Text style={styles.title}>{l.title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.catTag, { backgroundColor: `${meta.color}16` }]}>
                <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
                <Text style={[styles.catTagText, { color: meta.color }]}>{l.category}</Text>
              </View>
              {!!l.location && <MetaItem icon="location-outline" text={l.location} />}
              <MetaItem icon="time-outline" text={timeAgo(l.createdAt)} />
            </View>
          </View>

          {/* Quick facts */}
          <View style={styles.facts}>
            {facts.map((f) => (
              <View key={f.label} style={styles.fact}>
                <Ionicons name={f.icon} size={18} color={Brand.primary} />
                <Text style={styles.factValue} numberOfLines={1}>
                  {f.value}
                </Text>
                <Text style={styles.factLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Owner panel */}
          {isOwner && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Manage your listing</Text>
              <View style={styles.ownerStats}>
                <OwnerStat icon="eye-outline" value={l.views} label="views" />
                <OwnerStat icon="heart-outline" value={l.favoritesCount} label="saves" />
                <OwnerStat icon="images-outline" value={l.images.length} label="photos" />
              </View>
              <Text style={styles.label}>Status</Text>
              <View style={{ opacity: busy === 'status' ? 0.6 : 1 }} pointerEvents={busy === 'status' ? 'none' : 'auto'}>
                <Segmented<ListingStatus>
                  value={l.status}
                  onChange={changeStatus}
                  options={[
                    { key: 'active', label: 'Active', icon: 'radio-button-on' },
                    { key: 'reserved', label: 'Reserved', icon: 'time-outline' },
                    { key: 'sold', label: 'Sold', icon: 'checkmark-done' },
                  ]}
                />
              </View>

              {l.status !== 'sold' && (
                <View style={[styles.featureBox, l.isFeatured && styles.featureBoxOn]}>
                  <View style={styles.featureHead}>
                    <View style={styles.featureIcon}>
                      <Ionicons name="flash" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.featureTitle}>{l.isFeatured ? 'Featured' : 'Feature this listing'}</Text>
                        {!user?.isPremium && !l.isFeatured && <ProBadge small />}
                      </View>
                      <Text style={styles.featureText}>
                        {l.isFeatured
                          ? `${featuredDays} ${featuredDays === 1 ? 'day' : 'days'} left at the top of the Marketplace.`
                          : 'Show it first in the Marketplace with a gold Featured badge for 7 days. Featured listings get far more views.'}
                      </Text>
                    </View>
                  </View>
                  {l.isFeatured ? (
                    <Button title="Stop featuring" variant="ghost" small onPress={unfeature} loading={busy === 'feature'} />
                  ) : user?.isPremium ? (
                    <Button title="Feature for 7 days" icon="flash" small onPress={feature} loading={busy === 'feature'} style={{ backgroundColor: GOLD }} />
                  ) : (
                    <>
                      <Text style={styles.featureNote}>Included with Premium · up to 2 featured listings at a time.</Text>
                      <Button title="Get Premium" icon="star" small onPress={() => router.push('/premium')} style={{ backgroundColor: GOLD }} />
                    </>
                  )}
                </View>
              )}

              <Button title="Delete listing" icon="trash-outline" variant="dangerOutline" small onPress={remove} loading={busy === 'delete'} style={{ marginTop: 14 }} />
            </View>
          )}

          {/* Specs */}
          {specs.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Details</Text>
              {specs.map((s, i) => (
                <View key={s.label} style={[styles.specRow, i === specs.length - 1 && { borderBottomWidth: 0 }]}>
                  <Ionicons name={s.icon} size={17} color={Brand.faint} />
                  <Text style={styles.specLabel}>{s.label}</Text>
                  <Text style={styles.specValue} numberOfLines={1}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.description}>{l.description || 'The seller did not add a description. Send them a message to ask for more details.'}</Text>
          </View>

          {/* Seller */}
          <Pressable style={styles.card} onPress={() => router.push(`/user/${seller.id}`)}>
            <Text style={styles.cardTitle}>{isOwner ? 'Seller (you)' : 'Seller'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={sellerName} image={seller.image} size={52} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {sellerName}
                  </Text>
                  {seller.isPremium && <ProBadge small />}
                </View>
                <Text style={styles.small}>@{seller.username}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
            </View>
            <View style={styles.sellerStats}>
              {!!seller.memberSince && <SellerStat icon="person-outline" text={`Member since ${monthYear(seller.memberSince)}`} />}
              <SellerStat icon="pricetags-outline" text={`${seller.activeListings ?? 0} active ${seller.activeListings === 1 ? 'listing' : 'listings'}`} />
              {!!seller.soldListings && <SellerStat icon="checkmark-done-outline" text={`${seller.soldListings} sold`} />}
              {!!seller.location && <SellerStat icon="location-outline" text={seller.location} />}
            </View>
          </Pressable>

          {/* Safety */}
          {!isOwner && (
            <View style={styles.safety}>
              <Ionicons name="shield-checkmark" size={20} color={Brand.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyTitle}>Buy safely</Text>
                <Text style={styles.safetyText}>
                  Meet in a public place, check the item (and the papers for vehicles) before paying, and never send money in advance.
                </Text>
              </View>
            </View>
          )}

          {/* More from seller */}
          {l.moreFromSeller.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.cardTitle, { marginBottom: 12 }]}>More from {isOwner ? 'you' : sellerName}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
                {l.moreFromSeller.map((m: Listing) => (
                  <ListingCard key={m.id} listing={m} width={170} onPress={() => router.push(`/market/${m.id}`)} showFavorite={false} />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isOwner ? (
          <Button title="Edit listing" icon="create-outline" onPress={() => router.push(`/market/edit/${l.id}`)} style={{ flex: 1 }} />
        ) : (
          <>
            <Pressable style={[styles.saveBtn, l.isFavorite && styles.saveBtnOn]} onPress={toggleFavorite}>
              <Ionicons name={l.isFavorite ? 'heart' : 'heart-outline'} size={24} color={l.isFavorite ? Brand.danger : Brand.navy} />
            </Pressable>
            <Button title="Message seller" icon="chatbubble-ellipses-outline" onPress={() => router.push(`/chat/${seller.id}`)} style={{ flex: 1 }} />
          </>
        )}
      </View>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={l.title}
        actions={[
          { label: 'Message seller', icon: 'chatbubble-outline', onPress: () => router.push(`/chat/${seller.id}`) },
          { label: l.isFavorite ? 'Remove from saved' : 'Save listing', icon: l.isFavorite ? 'heart-dislike-outline' : 'heart-outline', onPress: toggleFavorite },
          { label: 'View seller profile', icon: 'person-outline', onPress: () => router.push(`/user/${seller.id}`) },
          { label: 'Report listing', icon: 'flag-outline', destructive: true, onPress: () => setReport(true) },
        ]}
      />
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="listing" targetId={l.id} subject="listing" />
      {viewer !== null && <PhotoViewer images={l.images} start={viewer} onClose={() => setViewer(null)} />}
    </View>
  );
}

/** Swipeable photos with dots and a counter */
function Gallery({ images, width, height, onOpen }: { images: string[]; width: number; height: number; onOpen: (i: number) => void }) {
  const [index, setIndex] = useState(0);
  const contain = width > 700; // wide screens: show the whole photo instead of cropping

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(Math.max(0, Math.min(images.length - 1, i)));
  };

  return (
    <View style={{ width, height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        {images.map((img, i) => (
          <Pressable key={i} onPress={() => onOpen(i)}>
            <Image source={{ uri: img }} style={{ width, height }} resizeMode={contain ? 'contain' : 'cover'} />
          </Pressable>
        ))}
      </ScrollView>
      {images.length > 1 && (
        <>
          <View style={styles.dots} pointerEvents="none">
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.counter} pointerEvents="none">
            <Ionicons name="images" size={12} color="#fff" />
            <Text style={styles.counterText}>
              {index + 1}/{images.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

/** Full-screen photo viewer */
function PhotoViewer({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  const ref = useRef<ScrollViewInstance>(null);

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={() => ref.current?.scrollTo({ x: start * width, animated: false })}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
        >
          {images.map((img, i) => (
            <Image key={i} source={{ uri: img }} style={{ width, height }} resizeMode="contain" />
          ))}
        </ScrollView>
        <View style={[styles.viewerBar, { top: insets.top + 10 }]}>
          <Text style={styles.viewerCount}>
            {index + 1} / {images.length}
          </Text>
          <Pressable onPress={onClose} style={styles.roundBtn} hitSlop={8}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RoundBtn({ icon, onPress, color = '#fff' }: { icon: IconName; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.roundBtn} hitSlop={6}>
      <Ionicons name={icon} size={21} color={color} />
    </Pressable>
  );
}

function MetaItem({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={Brand.muted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function OwnerStat({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={styles.ownerStat}>
      <Ionicons name={icon} size={18} color={Brand.primary} />
      <Text style={styles.ownerStatValue}>{value}</Text>
      <Text style={styles.ownerStatLabel}>{label}</Text>
    </View>
  );
}

function SellerStat({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.sellerStat}>
      <Ionicons name={icon} size={13} color={Brand.navy} />
      <Text style={styles.sellerStatText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 34, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  counter: {
    position: 'absolute',
    right: 16,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,20,40,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  body: { paddingHorizontal: 16, marginTop: -20, width: '100%', maxWidth: 820, alignSelf: 'center' },
  mainCard: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 18, ...Shadow },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10, marginBottom: 12 },
  statusBannerText: { fontWeight: '800', fontSize: 13, flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  price: { fontSize: 32, fontWeight: '900', color: Brand.navy, letterSpacing: -0.6 },
  priceAsk: { fontSize: 24, color: Brand.primaryDark },
  negTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.successSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  negText: { color: Brand.success, fontWeight: '800', fontSize: 12 },
  title: { fontSize: 20, fontWeight: '800', color: Brand.text, marginTop: 6, lineHeight: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  catTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  catTagText: { fontWeight: '800', fontSize: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { color: Brand.muted, fontSize: 13, fontWeight: '600' },
  facts: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 14, marginVertical: 14, ...Shadow },
  fact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  factValue: { fontSize: 14, fontWeight: '800', color: Brand.text, marginTop: 6 },
  factLabel: { fontSize: 11, color: Brand.muted, marginTop: 2, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 8 },
  small: { fontSize: 12, color: Brand.muted, marginTop: 1 },
  specRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Brand.border, gap: 10 },
  specLabel: { fontSize: 14, color: Brand.muted, fontWeight: '600', width: 90 },
  specValue: { flex: 1, fontSize: 14, color: Brand.text, fontWeight: '800', textAlign: 'right' },
  description: { fontSize: 15, lineHeight: 23, color: Brand.textSoft },
  sellerName: { fontSize: 16, fontWeight: '800', color: Brand.text, flexShrink: 1 },
  sellerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  sellerStat: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.navySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  sellerStatText: { color: Brand.navy, fontWeight: '700', fontSize: 12 },
  safety: { flexDirection: 'row', gap: 12, backgroundColor: Brand.primarySoft, borderRadius: Radius.lg, padding: 14, marginBottom: 14 },
  safetyTitle: { fontWeight: '800', color: Brand.primaryDark, fontSize: 14 },
  safetyText: { color: Brand.textSoft, fontSize: 13, lineHeight: 19, marginTop: 2 },
  ownerStats: { flexDirection: 'row', backgroundColor: Brand.input, borderRadius: Radius.md, paddingVertical: 12, marginBottom: 16 },
  ownerStat: { flex: 1, alignItems: 'center' },
  ownerStatValue: { fontSize: 18, fontWeight: '900', color: Brand.text, marginTop: 4 },
  ownerStatLabel: { fontSize: 11, color: Brand.muted, fontWeight: '600' },
  featureBox: { marginTop: 16, borderRadius: Radius.lg, padding: 14, backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#FBE3A6', gap: 12 },
  featureBoxOn: { backgroundColor: '#FFF3D6', borderColor: GOLD },
  featureHead: { flexDirection: 'row', gap: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 15, fontWeight: '900', color: Brand.text },
  featureText: { fontSize: 13, color: Brand.textSoft, marginTop: 3, lineHeight: 19 },
  featureNote: { fontSize: 12, color: '#B7791F', fontWeight: '700' },
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
  saveBtn: { width: 52, height: 52, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
  saveBtnOn: { borderColor: '#F8C4C6', backgroundColor: Brand.dangerSoft },
  viewerBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewerCount: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
