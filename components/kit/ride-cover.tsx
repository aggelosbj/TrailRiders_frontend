import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { imageSource } from '@/api/ridesApi';
import { Brand, RIDE_TYPE_ICONS } from '@/constants/brand';

/** Full-bleed cover for a ride: its photo, or a branded gradient with the vehicle icon */
export function RideCover({ image, rideType, iconSize = 120, compact }: { image?: string | null; rideType?: string; iconSize?: number; compact?: boolean }) {
  if (image) {
    return <Image source={imageSource(image)} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }
  const icon = (RIDE_TYPE_ICONS[rideType ?? ''] ?? 'bicycle') as keyof typeof Ionicons.glyphMap;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[Brand.navy, '#0A5A9E', Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {compact ? (
        <View style={styles.center}>
          <Ionicons name={icon} size={iconSize} color="rgba(255,255,255,0.9)" />
        </View>
      ) : (
        <Ionicons name={icon} size={iconSize} color="rgba(255,255,255,0.14)" style={styles.icon} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: -10, top: 10, transform: [{ rotate: '-12deg' }] },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
