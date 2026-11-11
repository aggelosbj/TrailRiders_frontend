import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PassengerRide, PassengerRideInput } from '@/api/passengerRidesApi';
import { Brand, Radius } from '@/constants/brand';
import { Button } from './button';
import { DateField, TimeField } from './date-time';
import { ChipSelect, FormField } from './form';
import { Section } from './ride-form';

type Errors = Partial<Record<'title' | 'startLocation' | 'finishLocation' | 'date', string>>;

/** Form to offer free seats on a trip (ride share) */
export function ShareForm({
  initial,
  submitLabel,
  submitting,
  minSeats = 1,
  onSubmit,
}: {
  initial?: Partial<PassengerRide>;
  submitLabel: string;
  submitting?: boolean;
  minSeats?: number;
  onSubmit: (data: PassengerRideInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [rideType, setRideType] = useState(initial?.rideType || 'Motorcycle');
  const [seats, setSeats] = useState(initial?.seats ?? 1);
  const [startLocation, setStart] = useState(initial?.startLocation ?? '');
  const [finishLocation, setFinish] = useState(initial?.finishLocation ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [rideTime, setRideTime] = useState(initial?.rideTime ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const maxSeats = rideType === 'Motorcycle' ? 1 : 6;

  const submit = () => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Give your trip a title';
    if (!startLocation.trim()) e.startLocation = 'Where do you leave from?';
    if (!finishLocation.trim()) e.finishLocation = 'Where are you going?';
    if (!date) e.date = 'Pick a date';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      title: title.trim(),
      rideType,
      seats: Math.min(seats, maxSeats),
      startLocation: startLocation.trim(),
      finishLocation: finishLocation.trim(),
      date,
      rideTime: rideTime || undefined,
      description: description.trim(),
    });
  };

  return (
    <View>
      <View style={styles.info}>
        <Ionicons name="information-circle" size={20} color={Brand.primary} />
        <Text style={styles.infoText}>
          Going somewhere with a free seat? Offer it — riders send a request and you choose who comes along.
        </Text>
      </View>

      <Section title="Trip" icon="navigate-outline">
        <FormField label="Title" icon="flag-outline" placeholder="e.g. Thessaloniki → Volos, Saturday" value={title} onChangeText={setTitle} maxLength={100} error={errors.title} />
        <ChipSelect
          label="Vehicle"
          options={['Motorcycle', 'Car']}
          value={rideType}
          onChange={(v) => {
            setRideType(v);
            if (v === 'Motorcycle') setSeats(1);
          }}
        />
        <FormField label="From" icon="radio-button-on-outline" placeholder="e.g. Thessaloniki" value={startLocation} onChangeText={setStart} maxLength={100} error={errors.startLocation} />
        <FormField label="To" icon="location-outline" placeholder="e.g. Volos" value={finishLocation} onChangeText={setFinish} maxLength={100} error={errors.finishLocation} />
      </Section>

      <Section title="When & seats" icon="calendar-outline">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <DateField label="Date" value={date} onChange={setDate} error={errors.date} />
          <TimeField label="Departure" value={rideTime} onChange={setRideTime} />
        </View>
        <Text style={styles.label}>Free seats {rideType === 'Motorcycle' ? '(pillion)' : ''}</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => setSeats((s) => Math.max(minSeats, s - 1))} disabled={seats <= Math.max(1, minSeats)}>
            <Ionicons name="remove" size={20} color={Brand.navy} />
          </Pressable>
          <Text style={styles.seatValue}>{Math.min(seats, maxSeats)}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setSeats((s) => Math.min(maxSeats, s + 1))} disabled={seats >= maxSeats}>
            <Ionicons name="add" size={20} color={Brand.navy} />
          </Pressable>
        </View>
      </Section>

      <Section title="Details" icon="document-text-outline">
        <FormField
          label="Notes for passengers"
          placeholder="Helmet available? Luggage space? Cost sharing for fuel…"
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
        />
      </Section>

      <Button title={submitLabel} onPress={submit} loading={submitting} icon="checkmark-circle-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  info: { flexDirection: 'row', gap: 10, backgroundColor: Brand.primarySoft, borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  infoText: { flex: 1, color: Brand.navy, fontSize: 13, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 7 },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 16, gap: 18 },
  stepBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  seatValue: { fontSize: 22, fontWeight: '900', color: Brand.text, minWidth: 24, textAlign: 'center' },
});
