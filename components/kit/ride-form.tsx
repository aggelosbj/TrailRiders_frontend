import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { imageSource, Ride, RideInput } from '@/api/ridesApi';
import { Brand, CATEGORIES, DIFFICULTIES, Radius, RIDE_TYPES, Shadow } from '@/constants/brand';
import { Button } from './button';
import { DateField, TimeField } from './date-time';
import { ChipSelect, FormField } from './form';
import { pickImage } from './image-picker';

type Errors = Partial<Record<'title' | 'startLocation' | 'finishLocation' | 'date' | 'rideDistance', string>>;

export function RideForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: Partial<Ride>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (data: RideInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [category, setCategory] = useState(initial?.category || 'Ride');
  const [rideType, setRideType] = useState(initial?.rideType || 'Motorcycle');
  const [difficulty, setDifficulty] = useState(initial?.difficulty || 'Medium');
  const [startLocation, setStart] = useState(initial?.startLocation ?? '');
  const [finishLocation, setFinish] = useState(initial?.finishLocation ?? '');
  const [stops, setStops] = useState<string[]>(initial?.stops?.length ? initial.stops : []);
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? '');
  const [rideTime, setRideTime] = useState(initial?.rideTime ?? '');
  const [rideDistance, setDistance] = useState(initial?.rideDistance ? String(initial.rideDistance) : '');
  const [expectedTime, setExpectedTime] = useState(initial?.expectedTime ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const submit = () => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Give your ride a title';
    if (!startLocation.trim()) e.startLocation = 'Where does the ride start?';
    if (!finishLocation.trim()) e.finishLocation = 'Where does the ride finish?';
    if (!date) e.date = 'Pick a date';
    if (rideDistance && !(Number(rideDistance.replace(',', '.')) > 0)) e.rideDistance = 'Enter a number in km';
    setErrors(e);
    if (Object.keys(e).length) return;

    onSubmit({
      title: title.trim(),
      image,
      category,
      rideType,
      difficulty,
      startLocation: startLocation.trim(),
      finishLocation: finishLocation.trim(),
      stops: stops.map((s) => s.trim()).filter(Boolean),
      date,
      rideTime: rideTime || undefined,
      rideDistance: rideDistance ? Number(rideDistance.replace(',', '.')) : null,
      expectedTime: expectedTime.trim() || undefined,
      description: description.trim(),
    });
  };

  return (
    <View>
      {/* Cover */}
      <Pressable style={styles.cover} onPress={async () => setImage((await pickImage([16, 9])) ?? image)}>
        {image ? (
          <>
            <Image source={imageSource(image)} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.coverEdit}>
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.coverEditText}>Change</Text>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View style={styles.coverIcon}>
              <Ionicons name="image-outline" size={28} color={Brand.primary} />
            </View>
            <Text style={styles.coverTitle}>Add a cover photo</Text>
            <Text style={styles.coverSub}>Optional · makes your ride stand out</Text>
          </View>
        )}
      </Pressable>
      {image && (
        <Pressable onPress={() => setImage(null)} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 12 }}>
          <Text style={{ color: Brand.danger, fontWeight: '700', fontSize: 13 }}>Remove photo</Text>
        </Pressable>
      )}

      <Section title="Basics" icon="information-circle-outline">
        <FormField label="Title" icon="flag-outline" placeholder="e.g. Sunday ride to Sounio" value={title} onChangeText={setTitle} maxLength={100} error={errors.title} />
        <ChipSelect label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
        <ChipSelect label="Vehicle" options={RIDE_TYPES} value={rideType} onChange={setRideType} />
        <ChipSelect label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
      </Section>

      <Section title="Route" icon="map-outline">
        <FormField label="Start" icon="radio-button-on-outline" placeholder="e.g. Syntagma, Athens" value={startLocation} onChangeText={setStart} maxLength={100} error={errors.startLocation} />

        <Text style={styles.label}>Stops</Text>
        {stops.map((stop, i) => (
          <View key={i} style={styles.stopRow}>
            <View style={styles.stopDot}>
              <Text style={styles.stopNum}>{i + 1}</Text>
            </View>
            <TextInput
              value={stop}
              onChangeText={(v) => setStops((s) => s.map((x, j) => (j === i ? v : x)))}
              placeholder={`Stop ${i + 1}`}
              placeholderTextColor={Brand.faint}
              style={styles.stopInput}
            />
            <Pressable onPress={() => setStops((s) => s.filter((_, j) => j !== i))} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={Brand.faint} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addStop} onPress={() => setStops((s) => [...s, ''])}>
          <Ionicons name="add-circle-outline" size={19} color={Brand.primary} />
          <Text style={styles.addStopText}>Add a stop</Text>
        </Pressable>

        <FormField label="Finish" icon="location-outline" placeholder="e.g. Temple of Poseidon, Sounio" value={finishLocation} onChangeText={setFinish} maxLength={100} error={errors.finishLocation} />
        <View style={styles.row2}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <FormField label="Distance (km)" icon="speedometer-outline" placeholder="70" keyboardType="decimal-pad" value={rideDistance} onChangeText={setDistance} error={errors.rideDistance} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <FormField label="Duration" icon="hourglass-outline" placeholder="e.g. 2h 30m" value={expectedTime} onChangeText={setExpectedTime} maxLength={50} />
          </View>
        </View>
      </Section>

      <Section title="When" icon="calendar-outline">
        <View style={styles.row2}>
          <DateField label="Date" value={date} onChange={setDate} error={errors.date} />
          <TimeField label="Meeting time" value={rideTime} onChange={setRideTime} />
        </View>
      </Section>

      <Section title="Details" icon="document-text-outline">
        <FormField
          label="Description"
          placeholder="Meeting point, pace, what to bring, coffee stop…"
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          hint={`${description.length}/1000`}
        />
      </Section>

      {Object.keys(errors).length > 0 && <Text style={styles.formError}>Please fix the highlighted fields.</Text>}
      <Button title={submitLabel} onPress={submit} loading={submitting} icon="checkmark-circle-outline" />
    </View>
  );
}

export function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={18} color={Brand.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 170,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#BFE3FB',
    backgroundColor: '#F2F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  coverTitle: { fontWeight: '800', color: Brand.navy, fontSize: 15 },
  coverSub: { color: Brand.muted, fontSize: 12, marginTop: 2 },
  coverEdit: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  coverEditText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  section: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, paddingBottom: 2, marginBottom: 16, ...Shadow },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginLeft: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 7 },
  stopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stopDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  stopNum: { color: Brand.primaryDark, fontWeight: '800', fontSize: 12 },
  stopInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.input,
    marginRight: 8,
    outlineStyle: 'none',
  } as object,
  addStop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 4 },
  addStopText: { color: Brand.primary, fontWeight: '700', marginLeft: 6 },
  row2: { flexDirection: 'row', gap: 12, width: '100%' },
  formError: { color: Brand.danger, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
});
