import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDate, todayISO } from '@/api/ridesApi';
import { Brand, Radius } from '@/constants/brand';
import { Button } from './button';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');

function FieldShell({
  label,
  icon,
  value,
  placeholder,
  onPress,
  error,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
}) {
  return (
    <View style={{ marginBottom: 16, flex: 1, minWidth: 0 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={[styles.field, !!error && { borderColor: Brand.danger }]}>
        <Ionicons name={icon} size={19} color={Brand.faint} style={{ marginRight: 10 }} />
        <Text style={[styles.fieldText, !value && { color: Brand.faint }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Date field with a calendar modal. Value format: YYYY-MM-DD */
export function DateField({
  label,
  value,
  onChange,
  minDate = todayISO(),
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initial = value || minDate;
  const [year, setYear] = useState(Number(initial.slice(0, 4)));
  const [month, setMonth] = useState(Number(initial.slice(5, 7)) - 1);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(year, month + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [year, month]);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <>
      <FieldShell
        label={label}
        icon="calendar-outline"
        value={value ? formatDate(value, false) : ''}
        placeholder="Select date"
        onPress={() => setOpen(true)}
        error={error}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.calHeader}>
              <Pressable onPress={() => shift(-1)} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={Brand.navy} />
              </Pressable>
              <Text style={styles.calTitle}>
                {MONTHS[month]} {year}
              </Text>
              <Pressable onPress={() => shift(1)} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={Brand.navy} />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {WEEK.map((w) => (
                <Text key={w} style={styles.weekDay}>
                  {w}
                </Text>
              ))}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={styles.cell} />;
                const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
                const disabled = iso < minDate;
                const selected = iso === value;
                const today = iso === todayISO();
                return (
                  <Pressable
                    key={iso}
                    disabled={disabled}
                    onPress={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    style={styles.cell}
                  >
                    <View style={[styles.day, selected && styles.daySelected, today && !selected && styles.dayToday]}>
                      <Text style={[styles.dayText, disabled && { color: '#D1D5DB' }, selected && { color: '#fff' }]}>{d}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Close" variant="ghost" onPress={() => setOpen(false)} small />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/** Time field with an hour/minute picker. Value format: HH:MM */
export function TimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(value ? value.slice(0, 2) : '09');
  const [m, setM] = useState(value ? value.slice(3, 5) : '00');

  return (
    <>
      <FieldShell label={label} icon="time-outline" value={value} placeholder="Select time" onPress={() => setOpen(true)} error={error} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={[styles.calTitle, { textAlign: 'center', marginBottom: 12 }]}>
              {h}:{m}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, height: 240 }}>
              <PickerColumn title="Hour" items={HOURS} value={h} onChange={setH} />
              <PickerColumn title="Minute" items={MINUTES} value={m} onChange={setM} />
            </View>
            <Button
              title="Done"
              onPress={() => {
                onChange(`${h}:${m}`);
                setOpen(false);
              }}
              style={{ marginTop: 14 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function PickerColumn({ title, items, value, onChange }: { title: string; items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.colTitle}>{title}</Text>
      <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
        {items.map((it) => (
          <Pressable key={it} onPress={() => onChange(it)} style={[styles.option, it === value && styles.optionActive]}>
            <Text style={[styles.optionText, it === value && { color: '#fff' }]}>{it}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 7 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.input,
    minHeight: 52,
  },
  fieldText: { fontSize: 15, color: Brand.text, flex: 1 },
  error: { color: Brand.danger, fontSize: 12, marginTop: 5, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,20,40,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 18, width: '100%', maxWidth: 380, alignSelf: 'center' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calTitle: { fontSize: 17, fontWeight: '800', color: Brand.text },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Brand.faint, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: Brand.primary },
  dayToday: { borderWidth: 1.5, borderColor: Brand.primary },
  dayText: { fontSize: 15, fontWeight: '600', color: Brand.text },
  colTitle: { fontSize: 12, fontWeight: '700', color: Brand.muted, textAlign: 'center', marginBottom: 6 },
  column: { flex: 1, backgroundColor: Brand.input, borderRadius: Radius.md },
  option: { paddingVertical: 10, alignItems: 'center', marginHorizontal: 6, marginVertical: 2, borderRadius: Radius.sm },
  optionActive: { backgroundColor: Brand.primary },
  optionText: { fontSize: 16, fontWeight: '700', color: Brand.text },
});
