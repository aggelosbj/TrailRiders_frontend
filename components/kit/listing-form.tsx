import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  isVehicle,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  ListingCategory,
  ListingCondition,
  ListingDetail,
  ListingInput,
  MAX_LISTING_IMAGES,
} from '@/api/listingsApi';
import { Brand, Radius } from '@/constants/brand';
import { Button } from './button';
import { showMessage } from './dialogs';
import { ChipSelect, FormField } from './form';
import { pickImage } from './image-picker';
import { Section } from './ride-form';

type Errors = Partial<Record<'title' | 'price' | 'year' | 'km' | 'condition', string>>;

const digits = (v: string) => v.replace(/[^\d]/g, '');

export function ListingForm({
  initial,
  defaultLocation,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: Partial<ListingDetail>;
  defaultLocation?: string | null;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (data: ListingInput) => void;
}) {
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<ListingCategory>(initial?.category ?? 'Motorcycle');
  const [askPrice, setAskPrice] = useState(initial ? initial.price === null : false);
  const [price, setPrice] = useState(initial?.price !== null && initial?.price !== undefined ? String(initial.price) : '');
  const [negotiable, setNegotiable] = useState(initial?.negotiable ?? false);
  const [condition, setCondition] = useState<ListingCondition | ''>(initial?.condition ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [km, setKm] = useState(initial?.km !== null && initial?.km !== undefined ? String(initial.km) : '');
  const [location, setLocation] = useState(initial?.location ?? defaultLocation ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [gridWidth, setGridWidth] = useState(0);

  const vehicle = isVehicle(category);
  const maxYear = new Date().getFullYear() + 1;
  const tile = gridWidth ? Math.floor((gridWidth - 10 * 3) / 4) : 76;

  const addPhoto = async () => {
    if (images.length >= MAX_LISTING_IMAGES) {
      showMessage('Photo limit reached', `You can add up to ${MAX_LISTING_IMAGES} photos. Remove one to add another.`);
      return;
    }
    const img = await pickImage([4, 3]);
    if (img) setImages((list) => [...list, img].slice(0, MAX_LISTING_IMAGES));
  };

  const makeCover = (i: number) => {
    if (i === 0) return;
    setImages((list) => [list[i], ...list.filter((_, j) => j !== i)]);
  };

  const submit = () => {
    const e: Errors = {};
    if (title.trim().length < 3) e.title = 'Give your listing a title (at least 3 characters)';
    const priceNum = Number(price.replace(',', '.'));
    if (!askPrice && (!price.trim() || !Number.isFinite(priceNum) || priceNum < 0)) e.price = 'Enter a price or choose "Ask for price"';
    if (!condition) e.condition = 'Pick the condition';
    if (vehicle && year && (Number(year) < 1900 || Number(year) > maxYear)) e.year = `1900 – ${maxYear}`;
    if (vehicle && km && Number(digits(km)) > 2000000) e.km = 'Too high';
    setErrors(e);
    if (Object.keys(e).length) return;

    onSubmit({
      title: title.trim(),
      category,
      price: askPrice ? null : Math.round(priceNum * 100) / 100,
      negotiable: askPrice ? false : negotiable,
      condition: (condition || null) as ListingCondition | null,
      brand: brand.trim() || null,
      model: vehicle ? model.trim() || null : null,
      year: vehicle && year ? Number(year) : null,
      km: vehicle && km ? Number(digits(km)) : null,
      location: location.trim() || null,
      description: description.trim(),
      images,
    });
  };

  return (
    <View>
      {/* Photos */}
      <Section title={`Photos · ${images.length}/${MAX_LISTING_IMAGES}`} icon="images-outline">
        <Text style={styles.hint}>Good photos sell faster. The first photo is the cover — tap another photo to make it the cover.</Text>
        <View style={styles.photoGrid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {images.map((img, i) => (
            <Pressable key={`${i}-${img.length}`} onPress={() => makeCover(i)} style={[styles.photo, { width: tile, height: tile }]}>
              <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {i === 0 && (
                <View style={styles.coverTag}>
                  <Text style={styles.coverTagText}>Cover</Text>
                </View>
              )}
              <Pressable onPress={() => setImages((list) => list.filter((_, j) => j !== i))} style={styles.removeBtn} hitSlop={8}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </Pressable>
          ))}
          {images.length < MAX_LISTING_IMAGES && (
            <Pressable onPress={addPhoto} style={[styles.addPhoto, { width: tile, height: tile }]}>
              <Ionicons name="camera-outline" size={24} color={Brand.primary} />
              <Text style={styles.addPhotoText}>{images.length ? 'Add' : 'Add photo'}</Text>
            </Pressable>
          )}
        </View>
      </Section>

      {/* Basics */}
      <Section title="What are you selling?" icon="pricetag-outline">
        <Text style={styles.label}>Category</Text>
        <View style={styles.catGrid}>
          {LISTING_CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[styles.catChip, active && { backgroundColor: c.color, borderColor: c.color }]}
              >
                <MaterialCommunityIcons name={c.icon} size={18} color={active ? '#fff' : c.color} />
                <Text style={[styles.catText, active && { color: '#fff' }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <FormField
          label="Title"
          icon="create-outline"
          placeholder={vehicle ? (category === 'Car' ? 'e.g. Toyota Hilux 2.4 4x4' : 'e.g. Yamaha Ténéré 700, low km') : 'e.g. Shoei GT-Air II, size M'}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          error={errors.title}
        />
        <ChipSelect label="Condition" options={LISTING_CONDITIONS} value={condition} onChange={(v) => setCondition(v as ListingCondition)} />
        {!!errors.condition && <Text style={[styles.error, { marginTop: -10 }]}>{errors.condition}</Text>}
      </Section>

      {/* Price */}
      <Section title="Price" icon="cash-outline">
        {!askPrice && (
          <FormField
            label="Price (€)"
            icon="pricetag-outline"
            placeholder="e.g. 4500"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^\d.,]/g, ''))}
            maxLength={11}
            error={errors.price}
          />
        )}
        <ToggleRow
          icon="chatbubbles-outline"
          title="Ask for price"
          text="Buyers will message you for the price"
          value={askPrice}
          onChange={(v) => {
            setAskPrice(v);
            if (v) setErrors((e) => ({ ...e, price: undefined }));
          }}
        />
        {!askPrice && (
          <ToggleRow icon="swap-horizontal-outline" title="Negotiable" text="Show buyers you're open to offers" value={negotiable} onChange={setNegotiable} />
        )}
      </Section>

      {/* Details */}
      <Section title={vehicle ? `${category === 'Car' ? 'Car' : 'Bike'} details` : 'Details'} icon={vehicle ? 'speedometer-outline' : 'list-outline'}>
        {vehicle ? (
          <>
            <View style={styles.row2}>
              <View style={styles.col}>
                <FormField label="Brand" placeholder={category === 'Car' ? 'Toyota' : 'Yamaha'} value={brand} onChangeText={setBrand} maxLength={60} />
              </View>
              <View style={styles.col}>
                <FormField label="Model" placeholder={category === 'Car' ? 'Hilux' : 'Ténéré 700'} value={model} onChangeText={setModel} maxLength={60} />
              </View>
            </View>
            <View style={styles.row2}>
              <View style={styles.col}>
                <FormField label="Year" icon="calendar-outline" placeholder="2021" keyboardType="number-pad" value={year} onChangeText={(v) => setYear(digits(v))} maxLength={4} error={errors.year} />
              </View>
              <View style={styles.col}>
                <FormField label="Mileage (km)" icon="speedometer-outline" placeholder="18500" keyboardType="number-pad" value={km} onChangeText={(v) => setKm(digits(v))} maxLength={7} error={errors.km} />
              </View>
            </View>
          </>
        ) : (
          <FormField label="Brand (optional)" icon="ribbon-outline" placeholder="e.g. Shoei, Alpinestars, Akrapovič" value={brand} onChangeText={setBrand} maxLength={60} />
        )}
        <FormField label="Location" icon="location-outline" placeholder="e.g. Athens" value={location} onChangeText={setLocation} maxLength={120} />
        <FormField
          label="Description"
          placeholder={vehicle ? 'Service history, extras, reason for selling, papers…' : 'Size, fit, how much it was used, what is included…'}
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={3000}
          hint={`${description.length}/3000`}
        />
      </Section>

      {Object.keys(errors).some((k) => errors[k as keyof Errors]) && <Text style={styles.formError}>Please fix the highlighted fields.</Text>}
      <Button title={submitLabel} onPress={submit} loading={submitting} icon="checkmark-circle-outline" />
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  text,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={styles.toggleIcon}>
        <Ionicons name={icon} size={18} color={Brand.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleText}>{text}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Brand.primary, false: Brand.border }} thumbColor="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: Brand.muted, marginTop: -6, marginBottom: 12, lineHeight: 17 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  photo: { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Brand.border },
  coverTag: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,51,102,0.75)', paddingVertical: 3, alignItems: 'center' },
  coverTagText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  removeBtn: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  addPhoto: {
    borderRadius: Radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#BFE3FB',
    backgroundColor: '#F2F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: { color: Brand.primaryDark, fontWeight: '800', fontSize: 12, marginTop: 3 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 8, letterSpacing: 0.2 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: '#fff',
    borderRadius: Radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  catText: { color: Brand.textSoft, fontWeight: '700', fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, marginBottom: 10 },
  toggleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  toggleText: { fontSize: 12, color: Brand.muted, marginTop: 1 },
  row2: { flexDirection: 'row', gap: 12, width: '100%' },
  col: { flex: 1, minWidth: 0 },
  error: { color: Brand.danger, fontSize: 12, marginBottom: 12, fontWeight: '500' },
  formError: { color: Brand.danger, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
});
