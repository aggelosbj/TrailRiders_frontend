// Native map (iOS: Apple Maps, Android: Google Maps) — the web version is app-map.web.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Brand, Radius } from '@/constants/brand';
import { AppMapProps, GREECE, LatLng } from './map-types';

const zoomToDelta = (zoom: number) => 360 / Math.pow(2, zoom);

export function AppMap({
  markers = [],
  lines = [],
  fit = true,
  center,
  zoom = 12,
  follow,
  showsUserLocation,
  dark,
  onMarkerPress,
  height = 220,
  style,
  interactive = true,
}: AppMapProps) {
  const ref = useRef<MapView>(null);

  const allPoints: LatLng[] = useMemo(
    () => [...markers.map((m) => m.coordinate), ...lines.flatMap((l) => l.coordinates)],
    [markers, lines]
  );

  const initialRegion = useMemo(() => {
    const c = center ?? allPoints[0] ?? GREECE;
    const d = center || allPoints.length ? zoomToDelta(zoom) : 6;
    return { latitude: c.latitude, longitude: c.longitude, latitudeDelta: d, longitudeDelta: d };
    // only on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit to content
  useEffect(() => {
    if (!fit || follow || allPoints.length < 2) return;
    const t = setTimeout(() => {
      ref.current?.fitToCoordinates(allPoints, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [fit, follow, allPoints]);

  // Follow a moving position
  useEffect(() => {
    if (!follow) return;
    ref.current?.animateCamera({ center: follow, zoom: 16 }, { duration: 500 });
  }, [follow]);

  return (
    <View style={[styles.wrap, { height }, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
      >
        {lines.map((l) => (
          <Polyline key={l.id} coordinates={l.coordinates} strokeColor={l.color ?? Brand.primary} strokeWidth={l.width ?? 4} />
        ))}
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={m.coordinate}
            title={m.title}
            description={m.subtitle}
            pinColor={m.color ?? Brand.primary}
            onCalloutPress={() => onMarkerPress?.(m.id)}
            onPress={() => !m.title && onMarkerPress?.(m.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Brand.border },
});
