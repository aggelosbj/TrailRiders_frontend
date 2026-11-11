import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { EVENT_CATEGORIES, EventInput, EventItem } from '@/api/eventsApi';
import { imageSource } from '@/api/ridesApi';
import { Brand, Radius } from '@/constants/brand';
import { Button } from './button';
import { DateField, TimeField } from './date-time';
import { ChipSelect, FormField } from './form';
import { pickImage } from './image-picker';
import { Section } from './ride-form';

type Errors = Partial<Record<'name' | 'location' | 'eventDate' | 'maxAttendees', string>>;

export function EventForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: Partial<EventItem>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (data: EventInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [category, setCategory] = useState(initial?.category || 'Meetup');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [eventDate, setDate] = useState(initial?.eventDate ?? '');
  const [eventTime, setTime] = useState(initial?.eventTime ?? '');
  const [maxAttendees, setMax] = useState(initial?.maxAttendees ? String(initial.maxAttendees) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const submit = () => {
    const e: Errors = {};
    if (!name.trim()) e.name = 'Give your event a name';
    if (!location.trim()) e.location = 'Where is it?';
    if (!eventDate) e.eventDate = 'Pick a date';
    if (maxAttendees && !(Number(maxAttendees) >= 2)) e.maxAttendees = 'At least 2 people';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      name: name.trim(),
      image,
      category,
      location: location.trim(),
      eventDate,
      eventTime: eventTime || undefined,
      maxAttendees: maxAttendees ? Number(maxAttendees) : null,
      description: description.trim(),
    });
  };

  return (
    <View>
      <Pressable style={styles.cover} onPress={async () => setImage((await pickImage([16, 9])) ?? image)}>
        {image ? (
          <Image source={imageSource(image)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="image-outline" size={28} color={Brand.primary} />
            <Text style={styles.coverTitle}>Add an event photo</Text>
          </View>
        )}
      </Pressable>

      <Section title="Event" icon="sparkles-outline">
        <FormField label="Name" icon="flag-outline" placeholder="e.g. Sunday coffee meetup" value={name} onChangeText={setName} maxLength={150} error={errors.name} />
        <ChipSelect label="Type" options={EVENT_CATEGORIES} value={category} onChange={setCategory} />
        <FormField label="Location" icon="location-outline" placeholder="e.g. Kalamaria seafront" value={location} onChangeText={setLocation} maxLength={150} error={errors.location} />
      </Section>

      <Section title="When" icon="calendar-outline">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <DateField label="Date" value={eventDate} onChange={setDate} error={errors.eventDate} />
          <TimeField label="Start time" value={eventTime} onChange={setTime} />
        </View>
        <FormField
          label="Max people (optional)"
          icon="people-outline"
          placeholder="No limit"
          keyboardType="number-pad"
          value={maxAttendees}
          onChangeText={(v) => setMax(v.replace(/[^0-9]/g, ''))}
          error={errors.maxAttendees}
        />
      </Section>

      <Section title="Details" icon="document-text-outline">
        <FormField label="Description" placeholder="What's planned, what to bring…" multiline value={description} onChangeText={setDescription} />
      </Section>

      <Button title={submitLabel} onPress={submit} loading={submitting} icon="checkmark-circle-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 150,
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
  coverTitle: { fontWeight: '800', color: Brand.navy, fontSize: 14, marginTop: 6 },
});
