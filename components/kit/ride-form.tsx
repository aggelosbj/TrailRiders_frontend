import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { RideFormData, RideVisibility, rideAccessCode } from '@/api/rideAccessApi';
import { imageSource, Ride, RideInput } from '@/api/ridesApi';
import { Brand, CATEGORIES, DIFFICULTIES, Radius, RIDE_TYPES, Shadow } from '@/constants/brand';
import { Button } from './button';
import { DateField, TimeField } from './date-time';
import { showMessage } from './dialogs';
import { ChipSelect, FormField } from './form';
import { pickImage } from './image-picker';

type Coords = { lat: number; lng: number };

/** "Use my location": current position + a readable place name (native only; web gets coordinates) */
async function currentPlace(): Promise<{ coords: Coords; name: string } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    showMessage('Location permission needed', 'Allow location access to use your current position as the start.');
    return null;
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  let name = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
  if (Platform.OS !== 'web') {
    try {
      const [a] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
      if (a) {
        const first = a.name || [a.street, a.streetNumber].filter(Boolean).join(' ');
        const parts = [first, a.city || a.district || a.subregion || a.region].filter(Boolean) as string[];
        const unique = parts.filter((p, i) => parts.indexOf(p) === i);
        if (unique.length) name = unique.join(', ').slice(0, 100);
      }
    } catch {
      // keep the coordinates as the name
    }
  }
  return { coords, name };
}

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
  /** receives RideInput + visibility and optional start coordinates (a RideFormData) */
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
  const initialVisibility = (initial as { visibility?: RideVisibility } | undefined)?.visibility;
  const [visibility, setVisibility] = useState<RideVisibility>(initialVisibility === 'private' ? 'private' : 'public');
  const [startCoords, setStartCoords] = useState<Coords | null>(
    initial?.startLat != null && initial?.startLng != null ? { lat: initial.startLat, lng: initial.startLng } : null
  );
  const [coordsCleared, setCoordsCleared] = useState(false);
  const [locating, setLocating] = useState(false);
  const currentCode = initial ? rideAccessCode(initial) : null;

  const changeStart = (v: string) => {
    setStart(v);
    // typed a different place: let the server look it up again
    if (startCoords) {
      setStartCoords(null);
      setCoordsCleared(true);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const place = await currentPlace();
      if (place) {
        setStart(place.name);
        setStartCoords(place.coords);
        setCoordsCleared(false);
        setErrors((e) => ({ ...e, startLocation: undefined }));
      }
    } catch {
      showMessage('Location unavailable', 'Could not get your position. Check that location services are on.');
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Give your ride a title';
    if (!startLocation.trim()) e.startLocation = 'Where does the ride start?';
    if (!finishLocation.trim()) e.finishLocation = 'Where does the ride finish?';
    if (!date) e.date = 'Pick a date';
    if (rideDistance && !(Number(rideDistance.replace(',', '.')) > 0)) e.rideDistance = 'Enter a number in km';
    setErrors(e);
    if (Object.keys(e).length) return;

    const data: RideFormData = {
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
      visibility,
      ...(startCoords ? { startLat: startCoords.lat, startLng: startCoords.lng } : coordsCleared ? { startLat: null, startLng: null } : {}),
    };
    onSubmit(data);
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
        <FormField label="Start" icon="radio-button-on-outline" placeholder="e.g. Syntagma, Athens" value={startLocation} onChangeText={changeStart} maxLength={100} error={errors.startLocation} />
        <View style={styles.locRow}>
          <Pressable style={styles.locBtn} onPress={useMyLocation} disabled={locating} hitSlop={6}>
            {locating ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="locate" size={16} color={Brand.primary} />}
            <Text style={styles.locBtnText}>{locating ? 'Locating…' : 'Use my location'}</Text>
          </Pressable>
          {startCoords && (
            <View style={styles.coordChip}>
              <Ionicons name="pin" size={12} color={Brand.success} />
              <Text style={styles.coordText}>
                {startCoords.lat.toFixed(4)}, {startCoords.lng.toFixed(4)}
              </Text>
              <Pressable
                onPress={() => {
                  setStartCoords(null);
                  setCoordsCleared(true);
                }}
                hitSlop={8}
                accessibilityLabel="Remove coordinates"
              >
                <Ionicons name="close" size={14} color={Brand.muted} />
              </Pressable>
            </View>
          )}
        </View>

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

      <Section title="Visibility" icon="eye-outline">
        <View style={styles.visRow}>
          <VisibilityOption
            active={visibility === 'public'}
            icon="earth"
            title="Public"
            text="Anyone can see the details and join."
            onPress={() => setVisibility('public')}
          />
          <VisibilityOption
            active={visibility === 'private'}
            icon="lock-closed"
            title="Private"
            text="Riders need your access code to see the details and join."
            onPress={() => setVisibility('private')}
          />
        </View>
        {visibility === 'private' && (
          <View style={styles.visNote}>
            <Ionicons name="key-outline" size={16} color={Brand.navy} />
            <Text style={styles.visNoteText}>
              {currentCode
                ? `Current access code: ${currentCode}. You can copy, share or change it on the ride page.`
                : 'A 6-character access code is created when you save. Share it with the riders you invite.'}
            </Text>
          </View>
        )}
      </Section>

      {Object.values(errors).some(Boolean) && <Text style={styles.formError}>Please fix the highlighted fields.</Text>}
      <Button title={submitLabel} onPress={submit} loading={submitting} icon="checkmark-circle-outline" />
    </View>
  );
}

function VisibilityOption({
  active,
  icon,
  title,
  text,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.visOpt, active && styles.visOptActive]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
      <View style={styles.visHead}>
        <Ionicons name={icon} size={18} color={active ? Brand.primary : Brand.muted} />
        <Text style={[styles.visTitle, active && { color: Brand.primaryDark }]}>{title}</Text>
        <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? Brand.primary : Brand.faint} style={{ marginLeft: 'auto' }} />
      </View>
      <Text style={styles.visText}>{text}</Text>
    </Pressable>
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
  locRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: -8, marginBottom: 16 },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  locBtnText: { color: Brand.primary, fontWeight: '700', fontSize: 13 },
  coordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Brand.successSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coordText: { color: Brand.success, fontWeight: '700', fontSize: 12 },
  visRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  visOpt: { flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: Brand.border, borderRadius: Radius.md, padding: 12, backgroundColor: Brand.input },
  visOptActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  visHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  visTitle: { fontWeight: '800', fontSize: 15, color: Brand.text },
  visText: { color: Brand.muted, fontSize: 12, lineHeight: 17 },
  visNote: { flexDirection: 'row', gap: 8, backgroundColor: Brand.navySoft, borderRadius: Radius.md, padding: 12, marginBottom: 14 },
  visNoteText: { flex: 1, color: Brand.navy, fontSize: 13, lineHeight: 18 },
});
