import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Brand, Radius } from '@/constants/brand';

interface FieldProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  hint?: string;
  password?: boolean;
}

export function FormField({ label, icon, error, hint, password, style, multiline, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputBox,
          multiline && styles.multilineBox,
          focused && styles.focused,
          !!error && styles.errorBox,
        ]}
      >
        {icon && <Ionicons name={icon} size={19} color={focused ? Brand.primary : Brand.faint} style={styles.icon} />}
        <TextInput
          placeholderTextColor={Brand.faint}
          style={[styles.input, multiline && styles.multiline, style]}
          secureTextEntry={password && hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {password && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={Brand.faint} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Row of selectable chips (single choice) */
export function ChipSelect({
  label,
  options,
  value,
  onChange,
  allowEmpty,
}: {
  label?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(active && allowEmpty ? '' : opt)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 7, letterSpacing: 0.2 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.input,
    minHeight: 52,
  },
  multilineBox: { alignItems: 'flex-start', paddingTop: 4 },
  focused: { borderColor: Brand.primary, backgroundColor: '#fff' },
  errorBox: { borderColor: Brand.danger },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: Brand.text,
    paddingVertical: 13,
    outlineStyle: 'none',
  } as object,
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: Brand.danger, fontSize: 12, marginTop: 5, fontWeight: '500' },
  hint: { color: Brand.muted, fontSize: 12, marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: '#fff',
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { color: Brand.textSoft, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
});
