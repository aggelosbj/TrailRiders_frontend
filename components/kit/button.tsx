import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/brand';

type Variant = 'primary' | 'navy' | 'outline' | 'ghost' | 'danger' | 'dangerOutline' | 'outlineLight' | 'soft';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const COLORS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: Brand.primary, fg: '#fff' },
  navy: { bg: Brand.navy, fg: '#fff' },
  outline: { bg: 'transparent', fg: Brand.primary, border: Brand.primary },
  ghost: { bg: 'transparent', fg: Brand.primary },
  danger: { bg: Brand.danger, fg: '#fff' },
  dangerOutline: { bg: 'transparent', fg: Brand.danger, border: Brand.danger },
  outlineLight: { bg: 'transparent', fg: '#fff', border: '#fff' },
  soft: { bg: Brand.primarySoft, fg: Brand.primaryDark },
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, small, style }: Props) {
  const c = COLORS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: c.bg, borderColor: c.border ?? 'transparent', borderWidth: c.border ? 1.5 : 0 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 19} color={c.fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.text, small && styles.textSmall, { color: c.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    minHeight: 52,
  },
  small: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 38, borderRadius: Radius.sm + 2 },
  text: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  textSmall: { fontSize: 14 },
});
