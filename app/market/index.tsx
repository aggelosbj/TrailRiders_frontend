import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import {
  getListingsApi,
  getMyListingsApi,
  getSavedListingsApi,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  Listing,
  ListingCategory,
  ListingCondition,
  ListingSort,
  MyListingLimits,
  setFavoriteApi,
  SORT_OPTIONS,
} from '@/api/listingsApi';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { ChipSelect } from '@/components/kit/form';
import { EmptyState, Loading } from '@/components/kit/layout';
import { GOLD, ListingCard, ListingRow } from '@/components/kit/listing-card';
import { Segmented } from '@/components/kit/segmented';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type Tab = 'browse' | 'mine' | 'saved';

interface Filters {
  minPrice: string;
  maxPrice: string;
  condition: ListingCondition | '';
  sort: ListingSort;
  location: string;
}

const EMPTY_FILTERS: Filters = { minPrice: '', maxPrice: '', condition: '', sort: 'new', location: '' };
const PAGE = 20;
const GAP = 12;
const PAD = 16;

const toNumber = (v: string) => {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return v.trim() && Number.isFinite(n) ? n : null;
};

export default function MarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('browse');

  // Browse
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [items, setItems] = useState<Listing[]>([]);
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Mine / saved
  const [mine, setMine] = useState<Listing[] | null>(null);
  const [limits, setLimits] = useState<MyListingLimits | null>(null);
  const [saved, setSaved] = useState<Listing[] | null>(null);

  const contentWidth = Math.min(width, 1200);
  const cols = contentWidth >= 1000 ? 4 : contentWidth >= 680 ? 3 : 2;
  const cardWidth = Math.floor((contentWidth - PAD * 2 - GAP * (cols - 1)) / cols);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const activeFilterCount =
    (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0) + (filters.condition ? 1 : 0) + (filters.location.trim() ? 1 : 0) + (filters.sort !== 'new' ? 1 : 0);
  // The Featured strip shows on the plain browse view; with a search or filters, featured items simply come first in the grid.
  const showFeaturedStrip = !debounced && activeFilterCount === 0;

  const queryFor = useCallback(
    (extra: { cursor?: string | null } = {}) => ({
      q: debounced || undefined,
      category,
      minPrice: toNumber(filters.minPrice),
      maxPrice: toNumber(filters.maxPrice),
      condition: filters.condition,
      location: filters.location.trim() || undefined,
      sort: filters.sort,
      excludeFeatured: showFeaturedStrip,
      limit: PAGE,
      ...extra,
    }),
    [debounced, category, filters, showFeaturedStrip]
  );

  const loadBrowse = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const [page, feat] = await Promise.all([
        getListingsApi(queryFor()),
        showFeaturedStrip ? getListingsApi({ category, featured: true, limit: 20 }).then((p) => p.items) : Promise.resolve([] as Listing[]),
      ]);
      if (id !== requestId.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setTotal(page.total);
      setFeatured(feat);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [queryFor, showFeaturedStrip, category]);

  // Load when the search/filters change. Coming back from a listing keeps the loaded pages and scroll position.
  const loadedFor = useRef<typeof loadBrowse | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (loadedFor.current === loadBrowse) return;
      loadedFor.current = loadBrowse;
      loadBrowse();
    }, [loadBrowse])
  );

  const loadMore = async () => {
    if (!cursor || loadingMore || loading) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await getListingsApi(queryFor({ cursor }));
      if (id !== requestId.current) return;
      setItems((list) => {
        const seen = new Set(list.map((l) => l.id));
        return [...list, ...page.items.filter((l) => !seen.has(l.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      // keep what we have; the user can scroll again to retry
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMine = useCallback(async () => {
    try {
      const res = await getMyListingsApi();
      setMine(res.items);
      setLimits(res.limits);
    } catch (err) {
      setMine((m) => m ?? []);
      showMessage('Could not load your listings', errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      setSaved(await getSavedListingsApi());
    } catch (err) {
      setSaved((s) => s ?? []);
      showMessage('Could not load saved listings', errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // My listings and Saved change from other screens (new listing, heart on the detail page): reload on focus.
  useFocusEffect(
    useCallback(() => {
      if (tab === 'mine') loadMine();
      if (tab === 'saved') loadSaved();
    }, [tab, loadMine, loadSaved])
  );

  const refresh = () => {
    setRefreshing(true);
    if (tab === 'browse') loadBrowse();
    else if (tab === 'mine') loadMine();
    else loadSaved();
  };

  const changeCategory = (c: ListingCategory | '') => {
    setCategory(c);
    setLoading(true);
  };

  const toggleFavorite = async (listing: Listing) => {
    const next = !listing.isFavorite;
    const patch = (list: Listing[]) => list.map((l) => (l.id === listing.id ? { ...l, isFavorite: next } : l));
    setItems(patch);
    setFeatured(patch);
    setSaved((s) => (s ? (next ? patch(s) : s.filter((l) => l.id !== listing.id)) : s));
    try {
      await setFavoriteApi(listing.id, next);
    } catch (err) {
      const undo = (list: Listing[]) => list.map((l) => (l.id === listing.id ? { ...l, isFavorite: !next } : l));
      setItems(undo);
      setFeatured(undo);
      if (!next) setSaved((s) => (s ? [listing, ...s] : s));
      showMessage('Could not update saved listings', errorMessage(err));
    }
  };

  const open = (l: Listing) => router.push(`/market/${l.id}`);
  const canFavorite = (l: Listing) => l.userId !== user?.id;

  const renderCard = (l: Listing, w = cardWidth) => (
    <ListingCard
      listing={l}
      width={w}
      onPress={() => open(l)}
      showFavorite={canFavorite(l)}
      onToggleFavorite={() => toggleFavorite(l)}
    />
  );

  // ---------------- Header pieces ----------------

  const categoryTiles = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
      <CategoryTile label="All" icon="view-grid-outline" color={Brand.primary} active={!category} onPress={() => changeCategory('')} />
      {LISTING_CATEGORIES.map((c) => (
        <CategoryTile
          key={c.key}
          label={c.label}
          icon={c.icon}
          color={c.color}
          active={category === c.key}
          onPress={() => changeCategory(category === c.key ? '' : c.key)}
        />
      ))}
    </ScrollView>
  );

  const activeChips: { label: string; clear: () => void }[] = [];
  if (filters.sort !== 'new') activeChips.push({ label: SORT_OPTIONS.find((s) => s.key === filters.sort)?.label ?? '', clear: () => setFilters((f) => ({ ...f, sort: 'new' })) });
  if (filters.minPrice || filters.maxPrice) {
    const label = filters.minPrice && filters.maxPrice ? `€${filters.minPrice} – €${filters.maxPrice}` : filters.minPrice ? `From €${filters.minPrice}` : `Up to €${filters.maxPrice}`;
    activeChips.push({ label, clear: () => setFilters((f) => ({ ...f, minPrice: '', maxPrice: '' })) });
  }
  if (filters.condition) activeChips.push({ label: filters.condition, clear: () => setFilters((f) => ({ ...f, condition: '' })) });
  if (filters.location.trim()) activeChips.push({ label: filters.location.trim(), clear: () => setFilters((f) => ({ ...f, location: '' })) });

  const browseHeader = (
    <View>
      {categoryTiles}
      {activeChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChips}>
          {activeChips.map((c) => (
            <Pressable key={c.label} style={styles.activeChip} onPress={c.clear}>
              <Text style={styles.activeChipText}>{c.label}</Text>
              <Ionicons name="close" size={14} color={Brand.primaryDark} />
            </Pressable>
          ))}
          <Pressable style={[styles.activeChip, { backgroundColor: 'transparent' }]} onPress={() => setFilters(EMPTY_FILTERS)}>
            <Text style={[styles.activeChipText, { color: Brand.muted }]}>Clear all</Text>
          </Pressable>
        </ScrollView>
      )}

      {showFeaturedStrip && featured.length > 0 && (
        <View style={{ marginBottom: 6 }}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionLeft}>
              <View style={styles.sectionIcon}>
                <Ionicons name="flash" size={14} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>Featured</Text>
            </View>
            {!user?.isPremium && (
              <Pressable onPress={() => router.push('/premium')} hitSlop={8}>
                <Text style={styles.sectionAction}>Get yours featured</Text>
              </Pressable>
            )}
          </View>
          <FlatList
            horizontal
            data={featured}
            keyExtractor={(l) => `f-${l.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, gap: GAP, paddingBottom: 8 }}
            style={{ marginHorizontal: -PAD }}
            renderItem={({ item }) => renderCard(item, Math.min(Math.max(cardWidth, 160), 220))}
          />
        </View>
      )}

      {error ? (
        <Pressable style={styles.errorBox} onPress={loadBrowse}>
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </Pressable>
      ) : (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {debounced ? 'Results' : category ? LISTING_CATEGORIES.find((c) => c.key === category)?.label : showFeaturedStrip ? 'Latest listings' : 'Listings'}
          </Text>
          <Text style={styles.count}>
            {total + (showFeaturedStrip ? featured.length : 0)} {total + (showFeaturedStrip ? featured.length : 0) === 1 ? 'item' : 'items'}
          </Text>
        </View>
      )}
    </View>
  );

  const limitsCard = limits ? (
    limits.isPremium ? (
      <View style={[styles.limitCard, { backgroundColor: '#FFF8E7', borderColor: '#FBE3A6' }]}>
        <View style={[styles.limitIcon, { backgroundColor: GOLD }]}>
          <Ionicons name="star" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.limitTitle}>Premium seller</Text>
          <Text style={styles.limitText}>
            Unlimited listings · {limits.featured}/{limits.maxFeatured} featured right now. Open a listing to feature it for {limits.featureDays} days.
          </Text>
        </View>
      </View>
    ) : (
      <Pressable style={styles.limitCard} onPress={() => router.push('/premium')}>
        <View style={styles.limitIcon}>
          <Ionicons name="pricetags" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.limitTitle}>
            {limits.active} of {limits.maxActive} active listings
          </Text>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (limits.active / (limits.maxActive || 1)) * 100)}%` }]} />
          </View>
          <Text style={styles.limitText}>
            Go <Text style={{ fontWeight: '800', color: '#B7791F' }}>Premium</Text> for unlimited listings and Featured placement at the top.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
      </Pressable>
    )
  ) : undefined;

  // ---------------- Render ----------------

  let content: React.ReactNode;
  if (tab === 'browse') {
    content = loading ? (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: PAD }}>{categoryTiles}</View>
        <Loading />
      </View>
    ) : (
      <FlatList
        key={`grid-${cols}`}
        data={items}
        numColumns={cols}
        keyExtractor={(l) => String(l.id)}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 110 }]}
        ListHeaderComponent={browseHeader}
        renderItem={({ item }) => <View style={{ marginBottom: GAP }}>{renderCard(item)}</View>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Brand.primary} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Brand.primary} style={{ marginVertical: 16 }} /> : undefined}
        ListEmptyComponent={
          error ? undefined : showFeaturedStrip && featured.length > 0 ? (
            <Text style={styles.allFeatured}>That&apos;s everything for now — all listings here are featured.</Text>
          ) : (
            <EmptyState
              icon="pricetags-outline"
              title={debounced || activeFilterCount || category ? 'Nothing matches' : 'The marketplace is empty'}
              message={
                debounced || activeFilterCount || category
                  ? 'Try another search, category or clear the filters.'
                  : 'Be the first to sell a bike, helmet or spare part to other riders.'
              }
              actionLabel={debounced || activeFilterCount ? 'Clear filters' : 'Sell something'}
              onAction={() => {
                if (debounced || activeFilterCount) {
                  setSearch('');
                  setFilters(EMPTY_FILTERS);
                } else router.push('/market/new');
              }}
            />
          )
        }
      />
    );
  } else if (tab === 'mine') {
    content =
      mine === null ? (
        <Loading />
      ) : (
        <FlatList
          data={mine}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 110, maxWidth: 760, width: '100%', alignSelf: 'center' }]}
          ListHeaderComponent={limitsCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Brand.primary} />}
          renderItem={({ item }) => <ListingRow listing={item} onPress={() => open(item)} showStats />}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title="You're not selling anything yet"
              message="Turn the gear you don't use into cash. Listing takes less than a minute."
              actionLabel="Sell something"
              onAction={() => router.push('/market/new')}
            />
          }
        />
      );
  } else {
    content =
      saved === null ? (
        <Loading />
      ) : (
        <FlatList
          key={`saved-${cols}`}
          data={saved}
          numColumns={cols}
          keyExtractor={(l) => String(l.id)}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Brand.primary} />}
          renderItem={({ item }) => <View style={{ marginBottom: GAP }}>{renderCard(item)}</View>}
          ListHeaderComponent={
            saved.length ? (
              <Text style={[styles.count, { marginBottom: 12 }]}>
                {saved.length} saved {saved.length === 1 ? 'listing' : 'listings'}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No saved listings"
              message="Tap the heart on any listing to keep it here and get notified when the price drops."
              actionLabel="Browse the marketplace"
              onAction={() => setTab('browse')}
            />
          }
        />
      );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.top}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            style={styles.roundBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={Brand.navy} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>Marketplace</Text>
            <Text style={styles.subtitle}>Bikes, gear and parts from riders</Text>
          </View>
        </View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: 'browse', label: 'Browse', icon: 'storefront-outline' },
            { key: 'mine', label: 'My listings', icon: 'pricetags-outline', count: limits ? limits.active : undefined },
            { key: 'saved', label: 'Saved', icon: 'heart-outline' },
          ]}
        />

        {tab === 'browse' && (
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Ionicons name="search" size={19} color={Brand.faint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search bikes, helmets, parts…"
                placeholderTextColor={Brand.faint}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={19} color={Brand.faint} />
                </Pressable>
              )}
            </View>
            <Pressable style={[styles.filterBtn, activeFilterCount > 0 && { backgroundColor: Brand.primary }]} onPress={() => setSheet(true)}>
              <Ionicons name="options-outline" size={21} color={activeFilterCount > 0 ? '#fff' : Brand.navy} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {content}

      {tab !== 'saved' && (
        <Pressable
          onPress={() => router.push('/market/new')}
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Sell</Text>
        </Pressable>
      )}

      <FiltersSheet
        visible={sheet}
        initial={filters}
        onClose={() => setSheet(false)}
        onApply={(f) => {
          setSheet(false);
          setLoading(true);
          setFilters(f);
        }}
      />
    </SafeAreaView>
  );
}

function CategoryTile({
  label,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      <View style={[styles.tileIcon, { backgroundColor: active ? color : `${color}18` }, active && Shadow]}>
        <MaterialCommunityIcons name={icon} size={26} color={active ? '#fff' : color} />
      </View>
      <Text style={[styles.tileText, active && { color: Brand.text, fontWeight: '800' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function FiltersSheet({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Filters>(initial);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setDraft(initial);
  }

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const apply = () => {
    let { minPrice, maxPrice } = draft;
    const min = toNumber(minPrice);
    const max = toNumber(maxPrice);
    if (min !== null && max !== null && min > max) [minPrice, maxPrice] = [maxPrice, minPrice];
    onApply({ ...draft, minPrice: min === null ? '' : minPrice.replace(/[^\d.]/g, ''), maxPrice: max === null ? '' : maxPrice.replace(/[^\d.]/g, '') });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Pressable onPress={() => setDraft(EMPTY_FILTERS)} hitSlop={8}>
                <Text style={styles.sectionAction}>Reset</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetLabel}>Sort by</Text>
              <View style={{ gap: 6, marginBottom: 18 }}>
                {SORT_OPTIONS.map((o) => {
                  const active = draft.sort === o.key;
                  return (
                    <Pressable key={o.key} style={[styles.sortRow, active && styles.sortRowActive]} onPress={() => set('sort', o.key)}>
                      <Text style={[styles.sortText, active && { color: Brand.primaryDark }]}>{o.label}</Text>
                      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? Brand.primary : Brand.faint} />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sheetLabel}>Price (€)</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceBox}>
                  <Text style={styles.priceCur}>€</Text>
                  <TextInput
                    value={draft.minPrice}
                    onChangeText={(v) => set('minPrice', v)}
                    placeholder="Min"
                    placeholderTextColor={Brand.faint}
                    keyboardType="numeric"
                    style={styles.priceInput}
                  />
                </View>
                <View style={styles.priceDash} />
                <View style={styles.priceBox}>
                  <Text style={styles.priceCur}>€</Text>
                  <TextInput
                    value={draft.maxPrice}
                    onChangeText={(v) => set('maxPrice', v)}
                    placeholder="Max"
                    placeholderTextColor={Brand.faint}
                    keyboardType="numeric"
                    style={styles.priceInput}
                  />
                </View>
              </View>

              <ChipSelect
                label="Condition"
                options={LISTING_CONDITIONS}
                value={draft.condition}
                onChange={(v) => set('condition', v as ListingCondition | '')}
                allowEmpty
              />

              <Text style={styles.sheetLabel}>Location</Text>
              <View style={[styles.priceBox, { marginBottom: 20 }]}>
                <Ionicons name="location-outline" size={18} color={Brand.faint} />
                <TextInput
                  value={draft.location}
                  onChangeText={(v) => set('location', v)}
                  placeholder="e.g. Athens"
                  placeholderTextColor={Brand.faint}
                  style={styles.priceInput}
                  maxLength={60}
                />
              </View>
            </ScrollView>
            <Button title="Show results" icon="checkmark-circle-outline" onPress={apply} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  top: { paddingHorizontal: PAD, paddingBottom: 4, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 14 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow },
  title: { fontSize: 26, fontWeight: '900', color: Brand.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: Brand.muted, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 50,
    ...Shadow,
  },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 10, fontSize: 15, color: Brand.text, outlineStyle: 'none' } as object,
  filterBtn: { width: 50, height: 50, borderRadius: Radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  listContent: { paddingHorizontal: PAD, paddingTop: 4, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  tiles: { paddingVertical: 14, gap: 6 },
  tile: { width: 74, alignItems: 'center' },
  tileIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 12, fontWeight: '600', color: Brand.textSoft, marginTop: 6 },
  activeChips: { gap: 8, paddingBottom: 10 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  activeChipText: { color: Brand.primaryDark, fontWeight: '700', fontSize: 13 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  sectionAction: { color: Brand.primary, fontWeight: '700', fontSize: 14 },
  count: { color: Brand.muted, fontWeight: '600', fontSize: 13 },
  allFeatured: { color: Brand.muted, textAlign: 'center', marginTop: 10 },
  errorBox: { backgroundColor: Brand.dangerSoft, padding: 12, borderRadius: Radius.md, marginBottom: 12 },
  errorText: { color: Brand.danger, fontWeight: '600', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.primary,
    paddingHorizontal: 22,
    height: 54,
    borderRadius: 27,
    ...Shadow,
    shadowOpacity: 0.25,
  },
  fabText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  limitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  limitIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  limitTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  limitText: { fontSize: 12, color: Brand.muted, marginTop: 4, lineHeight: 17 },
  progress: { height: 6, borderRadius: 3, backgroundColor: Brand.border, marginTop: 7, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Brand.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,20,40,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xl + 4,
    borderTopRightRadius: Radius.xl + 4,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    alignSelf: 'center',
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: Brand.text },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 8, letterSpacing: 0.2 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  sortRowActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  sortText: { fontSize: 15, fontWeight: '700', color: Brand.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  priceBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.input,
    height: 50,
  },
  priceCur: { fontSize: 16, fontWeight: '800', color: Brand.muted },
  priceInput: { flex: 1, minWidth: 0, fontSize: 15, color: Brand.text, outlineStyle: 'none' } as object,
  priceDash: { width: 14, height: 2, backgroundColor: Brand.faint, marginHorizontal: 10, borderRadius: 1 },
});
