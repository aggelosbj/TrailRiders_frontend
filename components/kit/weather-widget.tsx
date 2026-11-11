// Compact "riding weather" card: current conditions from Open-Meteo (free, no API key) + a riding verdict.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Brand, Radius, Shadow } from '@/constants/brand';

const ATHENS = { lat: 37.98, lng: 23.73, name: 'Athens' };
const CACHE_MS = 15 * 60 * 1000;
const HOURS_AHEAD = 6;

type IconName = keyof typeof Ionicons.glyphMap;
type Level = 'great' | 'ok' | 'meh' | 'home';

export interface RidingWeather {
  place: string;
  /** true when location was unavailable and we used Athens */
  fallback: boolean;
  temp: number;
  feelsLike: number;
  precipitation: number;
  code: number;
  isDay: boolean;
  wind: number;
  gusts: number;
  /** precipitation probability (%) for the next hours, starting with the current hour */
  rainChance: { hour: string; p: number }[];
  fetchedAt: number;
}

// ---------- WMO weather codes ----------

function describe(code: number, isDay: boolean): { label: string; icon: IconName } {
  if (code === 0) return { label: 'Clear', icon: isDay ? 'sunny' : 'moon' };
  if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'partly-sunny' : 'cloudy-night' };
  if (code === 2) return { label: 'Partly cloudy', icon: isDay ? 'partly-sunny' : 'cloudy-night' };
  if (code === 3) return { label: 'Overcast', icon: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'cloudy-outline' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'rainy-outline' };
  if (code === 56 || code === 57) return { label: 'Freezing drizzle', icon: 'snow-outline' };
  if (code >= 61 && code <= 65) return { label: code === 65 ? 'Heavy rain' : 'Rain', icon: 'rainy' };
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'snow-outline' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rainy' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'thunderstorm' };
  return { label: 'Weather', icon: 'partly-sunny' };
}

const isStorm = (c: number) => c >= 95;
const isIce = (c: number) => [56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(c);
const isRain = (c: number) => (c >= 61 && c <= 65) || (c >= 80 && c <= 82);
const isDrizzleOrFog = (c: number) => (c >= 51 && c <= 55) || c === 45 || c === 48;

// ---------- riding verdict ----------

const LEVELS: Record<Level, { label: string; color: string; bg: string; icon: IconName }> = {
  great: { label: 'Great', color: Brand.success, bg: Brand.successSoft, icon: 'checkmark-circle' },
  ok: { label: 'OK', color: Brand.primaryDark, bg: Brand.primarySoft, icon: 'thumbs-up' },
  meh: { label: 'Not ideal', color: '#B45309', bg: '#FEF3C7', icon: 'alert-circle' },
  home: { label: 'Stay home', color: Brand.danger, bg: Brand.dangerSoft, icon: 'home' },
};

export function ridingVerdict(w: RidingWeather): { level: Level; reason: string } {
  const rainMax = Math.max(0, ...w.rainChance.map((h) => h.p));
  const t = Math.round(w.temp);
  const reasons: [number, string][] = [];

  if (isStorm(w.code)) reasons.push([3, 'Thunderstorm']);
  if (isIce(w.code)) reasons.push([3, 'Snow or ice on the roads']);
  if (w.gusts >= 70) reasons.push([3, `Dangerous gusts of ${Math.round(w.gusts)} km/h`]);
  if (w.temp <= 0) reasons.push([3, `Freezing (${t}°C) — risk of ice`]);

  if (isRain(w.code) || w.precipitation >= 0.5) reasons.push([2, 'Raining now — wet, slippery roads']);
  if (w.gusts > 50 && w.gusts < 70) reasons.push([2, `Strong gusts of ${Math.round(w.gusts)} km/h`]);
  if (w.temp > 0 && w.temp < 5) reasons.push([2, `Cold (${t}°C)`]);
  if (w.temp > 38) reasons.push([2, `Very hot (${t}°C)`]);
  if (rainMax >= 60) reasons.push([2, `${rainMax}% chance of rain in the next hours`]);

  if (isDrizzleOrFog(w.code)) reasons.push([1, w.code === 45 || w.code === 48 ? 'Fog — ride with lights on' : 'Light drizzle']);
  if (rainMax >= 30 && rainMax < 60) reasons.push([1, `${rainMax}% chance of rain — pack a rain suit`]);
  if (w.gusts > 35 && w.gusts <= 50) reasons.push([1, `Gusty (${Math.round(w.gusts)} km/h)`]);
  if (w.temp >= 5 && w.temp < 12) reasons.push([1, `Chilly (${t}°C) — layer up`]);
  if (w.temp > 33 && w.temp <= 38) reasons.push([1, `Hot (${t}°C) — stay hydrated`]);

  const worst = Math.max(0, ...reasons.map(([s]) => s));
  if (worst === 0) return { level: 'great', reason: `Dry, calm and ${t}°C — perfect for a ride` };
  const top = reasons.filter(([s]) => s === worst).map(([, r]) => r);
  const level: Level = worst === 3 ? 'home' : worst === 2 ? 'meh' : 'ok';
  return { level, reason: top.slice(0, 2).join(' · ') };
}

// ---------- data (cached 15 min in memory) ----------

let cache: RidingWeather | null = null;
let pending: Promise<RidingWeather> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function devicePlace(): Promise<{ lat: number; lng: number; name: string; fallback: boolean }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ...ATHENS, fallback: true };
    let pos = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 }).catch(() => null);
    if (!pos) pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), 10000);
    if (!pos) return { ...ATHENS, fallback: true };
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let name = 'Your location';
    if (Platform.OS !== 'web') {
      try {
        const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        name = a?.city || a?.district || a?.subregion || a?.region || name;
      } catch {
        // keep generic name
      }
    }
    return { lat, lng, name, fallback: false };
  } catch {
    return { ...ATHENS, fallback: true };
  }
}

interface OpenMeteo {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    is_day?: number;
  };
  hourly: { time: string[]; precipitation_probability: (number | null)[] };
}

async function fetchWeather(): Promise<RidingWeather> {
  const place = await devicePlace();
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${place.lat.toFixed(4)}&longitude=${place.lng.toFixed(4)}` +
    '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day' +
    '&hourly=precipitation_probability&forecast_days=2&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d: OpenMeteo = await res.json();

  // hourly times are local ("2026-11-12T14:00"); start from the current hour
  const hourKey = d.current.time.slice(0, 13);
  let start = d.hourly.time.findIndex((t) => t.slice(0, 13) === hourKey);
  if (start < 0) start = 0;
  const rainChance = d.hourly.time.slice(start, start + HOURS_AHEAD).map((t, i) => ({
    hour: t.slice(11, 13),
    p: Math.round(d.hourly.precipitation_probability[start + i] ?? 0),
  }));

  return {
    place: place.name,
    fallback: place.fallback,
    temp: d.current.temperature_2m,
    feelsLike: d.current.apparent_temperature,
    precipitation: d.current.precipitation ?? 0,
    code: d.current.weather_code,
    isDay: d.current.is_day !== 0,
    wind: d.current.wind_speed_10m,
    gusts: d.current.wind_gusts_10m,
    rainChance,
    fetchedAt: Date.now(),
  };
}

/** Riding weather with a 15-minute in-memory cache (shared by every widget instance) */
export function getRidingWeather(force = false): Promise<RidingWeather> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_MS) return Promise.resolve(cache);
  if (!pending) {
    pending = fetchWeather()
      .then((w) => (cache = w))
      .finally(() => (pending = null));
  }
  return pending;
}

// ---------- UI ----------

export function WeatherWidget({ style }: { style?: StyleProp<ViewStyle> }) {
  const [weather, setWeather] = useState<RidingWeather | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    try {
      setWeather(await getRidingWeather(force));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getRidingWeather()
      .then((w) => alive && setWeather(w))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (!weather) {
    return (
      <View style={[styles.card, styles.center, style]}>
        {loading ? (
          <View style={styles.row}>
            <ActivityIndicator color={Brand.primary} />
            <Text style={[styles.muted, { marginLeft: 10 }]}>Checking the riding weather…</Text>
          </View>
        ) : (
          <Pressable onPress={() => load(true)} style={styles.row} hitSlop={6}>
            <Ionicons name="cloud-offline-outline" size={20} color={Brand.muted} />
            <Text style={[styles.muted, { marginLeft: 8 }]}>{error ? 'Weather unavailable — tap to retry' : 'No weather data'}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { label, icon } = describe(weather.code, weather.isDay);
  const verdict = ridingVerdict(weather);
  const v = LEVELS[verdict.level];
  const rainMax = Math.max(0, ...weather.rainChance.map((h) => h.p));

  return (
    <View style={[styles.card, style]} accessibilityLabel={`Riding weather: ${v.label}. ${verdict.reason}`}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={28} color={weather.isDay ? Brand.accent : Brand.navy} />
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <View style={styles.row}>
            <Text style={styles.temp}>{Math.round(weather.temp)}°</Text>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
              <Text style={styles.cond} numberOfLines={1}>
                {label}
              </Text>
              <View style={styles.row}>
                <Ionicons name={weather.fallback ? 'location-outline' : 'navigate'} size={11} color={Brand.muted} />
                <Text style={styles.place} numberOfLines={1}>
                  {' '}
                  {weather.place}
                  {weather.fallback ? ' (location off)' : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Pressable onPress={() => load(true)} hitSlop={8} disabled={loading} accessibilityLabel="Refresh weather" style={{ marginLeft: 8 }}>
          {loading ? <ActivityIndicator size="small" color={Brand.faint} /> : <Ionicons name="refresh" size={17} color={Brand.faint} />}
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <Meta icon="thermometer-outline" text={`Feels ${Math.round(weather.feelsLike)}°`} />
        <Meta icon="flag-outline" text={`${Math.round(weather.wind)} km/h · gusts ${Math.round(weather.gusts)}`} />
        <Meta icon="umbrella-outline" text={`${rainMax}% rain ${HOURS_AHEAD}h`} />
      </View>

      {weather.rainChance.length > 0 && (
        <View style={styles.bars} accessibilityLabel={`Rain chance next hours: ${weather.rainChance.map((h) => `${h.hour}:00 ${h.p}%`).join(', ')}`}>
          {weather.rainChance.map((h) => (
            <View key={h.hour} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max(4, h.p)}%`, backgroundColor: h.p >= 60 ? Brand.primaryDark : Brand.primary, opacity: h.p ? 1 : 0.25 }]} />
              </View>
              <Text style={styles.barLabel}>{h.hour}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.verdict, { backgroundColor: v.bg }]}>
        <Ionicons name={v.icon} size={18} color={v.color} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.verdictTitle, { color: v.color }]}>Riding: {v.label}</Text>
          <Text style={styles.verdictReason}>{verdict.reason}</Text>
        </View>
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={13} color={Brand.muted} />
      <Text style={styles.meta}> {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Brand.card, borderRadius: Radius.lg, padding: 14, ...Shadow },
  center: { minHeight: 70, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  muted: { color: Brand.muted, fontSize: 13, fontWeight: '600' },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  temp: { fontSize: 30, fontWeight: '900', color: Brand.text, lineHeight: 34 },
  cond: { fontSize: 15, fontWeight: '800', color: Brand.text },
  place: { fontSize: 12, color: Brand.muted, flexShrink: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  meta: { fontSize: 12, color: Brand.muted, fontWeight: '600' },
  bars: { flexDirection: 'row', gap: 6, marginTop: 10, height: 40 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '70%', maxWidth: 18, backgroundColor: Brand.background, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 9, color: Brand.faint, fontWeight: '700', marginTop: 2 },
  verdict: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, padding: 10, marginTop: 10 },
  verdictTitle: { fontSize: 14, fontWeight: '900' },
  verdictReason: { fontSize: 12, color: Brand.textSoft, marginTop: 1 },
});
