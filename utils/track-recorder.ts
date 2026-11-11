// Ride-recording engine: pure functions used by app/track/record.tsx (state lives in refs there),
// plus helpers for drawing / charting recorded tracks.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrackPoint } from '@/api/tracksApi';
import type { LatLng } from '@/components/kit/map-types';
import { haversine } from './geo';

export const MAX_ACCURACY_M = 35; // ignore fixes worse than this
export const MOVING_KMH = 3; // "moving time" threshold
const MAX_JUMP_KMH = 300; // faster than this between two fixes = GPS jump
const STILL_JITTER_M = 4; // ignore tiny moves while stopped
export const MAX_POINTS = 20000;
const STORAGE_KEY = 'tr.recording.v1';

export interface RecState {
  v: 1;
  /** epoch ms of the first Start */
  startedAt: number;
  status: 'recording' | 'paused';
  /** active (un-paused) time accumulated before the current run */
  activeMs: number;
  /** epoch ms when the current run started; null while paused */
  runStartedAt: number | null;
  points: TrackPoint[];
  distanceM: number;
  movingMs: number;
  maxSpeedKmh: number;
  elevationGainM: number;
  altRef: number | null;
  maxAlt: number | null;
  minAlt: number | null;
  maxLeanLeft: number;
  maxLeanRight: number;
  maxG: number;
  gSum: number;
  gCount: number;
  /** the next accepted fix starts a new segment (after a pause / resume) */
  newSegment: boolean;
  /** consecutive rejected "jumps" — after a few we accept the new position as a fresh segment */
  jumps: number;
  recentSpeeds: number[];
}

export function newRecording(now = Date.now()): RecState {
  return {
    v: 1,
    startedAt: now,
    status: 'recording',
    activeMs: 0,
    runStartedAt: now,
    points: [],
    distanceM: 0,
    movingMs: 0,
    maxSpeedKmh: 0,
    elevationGainM: 0,
    altRef: null,
    maxAlt: null,
    minAlt: null,
    maxLeanLeft: 0,
    maxLeanRight: 0,
    maxG: 0,
    gSum: 0,
    gCount: 0,
    newSegment: false,
    jumps: 0,
    recentSpeeds: [],
  };
}

export const elapsedMs = (s: RecState, now = Date.now()) => s.activeMs + (s.runStartedAt ? Math.max(0, now - s.runStartedAt) : 0);

export function pause(s: RecState, now = Date.now()) {
  if (s.status !== 'recording') return;
  s.activeMs = elapsedMs(s, now);
  s.runStartedAt = null;
  s.status = 'paused';
}

export function resume(s: RecState, now = Date.now()) {
  if (s.status !== 'paused') return;
  s.runStartedAt = now;
  s.status = 'recording';
  s.newSegment = s.points.length > 0;
}

export interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  /** m/s, negative/null when unknown */
  speed: number | null;
  timestamp: number;
}

export type FixResult = 'added' | 'still' | 'inaccurate' | 'jump' | 'paused' | 'full';

/** Live speed of a fix in km/h (GPS speed when available) */
export const fixSpeedKmh = (f: Fix) => (f.speed !== null && f.speed >= 0 ? f.speed * 3.6 : null);

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Feeds one GPS fix into the recording. Mutates `s`. */
export function addFix(s: RecState, f: Fix): FixResult {
  if (s.status !== 'recording') return 'paused';
  if (f.accuracy === null || f.accuracy > MAX_ACCURACY_M) return 'inaccurate';
  if (s.points.length >= MAX_POINTS) return 'full';

  const t = Math.max(0, f.timestamp - s.startedAt);
  const gps = fixSpeedKmh(f);
  const alt = f.altitude !== null && (f.altitudeAccuracy === null || f.altitudeAccuracy <= 30) ? r1(f.altitude) : null;
  const last = s.points[s.points.length - 1];
  let seg = false;

  if (last && !s.newSegment) {
    const d = haversine({ latitude: last[0], longitude: last[1] }, f);
    const dt = t - last[2];
    if (dt <= 0) return 'still';
    const kmh = (d / (dt / 1000)) * 3.6;
    if (kmh > MAX_JUMP_KMH && d > 50) {
      s.jumps += 1;
      if (s.jumps < 5) return 'jump';
      seg = true; // the "jump" persisted: we really are over there now
    } else if (d < STILL_JITTER_M && (gps ?? kmh) < MOVING_KMH) {
      return 'still';
    } else {
      s.distanceM += d;
      if (kmh > MOVING_KMH) s.movingMs += dt;
      // without GPS speed, use the segment speed when the interval is long enough
      if (gps === null && dt >= 2000 && kmh <= MAX_JUMP_KMH) s.maxSpeedKmh = Math.max(s.maxSpeedKmh, kmh);
    }
  } else if (last) {
    seg = true;
  }
  s.jumps = 0;
  s.newSegment = false;

  // max speed = median of the last 3 GPS speeds (one noisy spike can't set a record)
  if (gps !== null) {
    s.recentSpeeds = [...s.recentSpeeds.slice(-2), gps];
    if (s.recentSpeeds.length >= 2) {
      const sorted = [...s.recentSpeeds].sort((a, b) => a - b);
      s.maxSpeedKmh = Math.max(s.maxSpeedKmh, sorted[Math.floor(sorted.length / 2)]);
    }
  }

  if (alt !== null) {
    s.maxAlt = s.maxAlt === null ? alt : Math.max(s.maxAlt, alt);
    s.minAlt = s.minAlt === null ? alt : Math.min(s.minAlt, alt);
    if (s.altRef === null) s.altRef = alt;
    else if (alt - s.altRef >= 3) {
      s.elevationGainM += alt - s.altRef;
      s.altRef = alt;
    } else if (alt < s.altRef - 3) s.altRef = alt;
  }

  const p: TrackPoint = [Math.round(f.latitude * 1e6) / 1e6, Math.round(f.longitude * 1e6) / 1e6, t, gps === null ? null : r1(gps), alt];
  if (seg) p.push(1);
  s.points.push(p);
  return 'added';
}

/** Records sensor readings (only while riding, so handling the phone at a stop doesn't count) */
export function addSensors(s: RecState, speedKmh: number, leanDeg: number | null, g: number | null) {
  if (s.status !== 'recording' || speedKmh < 10) return;
  if (leanDeg !== null && Math.abs(leanDeg) <= 65) {
    if (leanDeg > 0) s.maxLeanRight = Math.max(s.maxLeanRight, leanDeg);
    else s.maxLeanLeft = Math.max(s.maxLeanLeft, -leanDeg);
  }
  if (g !== null && g <= 2.5) {
    s.maxG = Math.max(s.maxG, g);
    s.gSum += g;
    s.gCount += 1;
  }
}

// ---------------- persistence (survives an app reload) ----------------

export async function saveRecording(s: RecState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    // storage full / unavailable: keep recording in memory
  }
}

export async function loadRecording(): Promise<(RecState & { savedAt?: number }) | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !Array.isArray(s.points)) return null;
    return s;
  } catch {
    return null;
  }
}

export async function clearRecording() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** A restored recording continues paused: we don't know what happened while the app was closed */
export function restore(saved: RecState & { savedAt?: number }): RecState {
  const s: RecState = { ...newRecording(saved.startedAt), ...saved };
  if (s.status === 'recording') {
    const until = saved.savedAt ?? Date.now();
    s.activeMs = s.activeMs + (s.runStartedAt ? Math.max(0, until - s.runStartedAt) : 0);
  }
  s.status = 'paused';
  s.runStartedAt = null;
  s.newSegment = s.points.length > 0;
  return s;
}

// ---------------- sensors ----------------

type Vec = { x: number; y: number; z: number };
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec, b: Vec): Vec => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a: Vec) => Math.sqrt(dot(a, a));
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/**
 * Approximate lean angle from the gravity direction in the phone's frame.
 * `ref` = gravity measured while the bike was upright (calibration). The phone is assumed to be mounted
 * with the screen facing the rider (forward = out of the back of the phone) or lying flat with the top forward.
 * Returns degrees, positive = right, negative = left. Same result whatever the platform's sign convention.
 */
export function leanAngle(gravity: Vec, ref: Vec): number {
  const up = norm(ref);
  const g = norm(gravity);
  // forward axis: out of the phone's back (-z) projected onto the horizontal plane, or the phone's top (+y) if lying flat
  let fwd: Vec = { x: 0, y: 0, z: -1 };
  let proj = { x: fwd.x - dot(fwd, up) * up.x, y: fwd.y - dot(fwd, up) * up.y, z: fwd.z - dot(fwd, up) * up.z };
  if (len(proj) < 0.35) {
    fwd = { x: 0, y: 1, z: 0 };
    proj = { x: fwd.x - dot(fwd, up) * up.x, y: fwd.y - dot(fwd, up) * up.y, z: fwd.z - dot(fwd, up) * up.z };
  }
  const side = norm(cross(up, norm(proj)));
  const s = Math.max(-1, Math.min(1, dot(g, side)));
  return (Math.asin(s) * 180) / Math.PI;
}

/** Lateral/longitudinal G from an accelerometer vector in g (gravity's 1 g removed) */
export function gForce(a: Vec): number {
  const m2 = dot(a, a);
  const g = Math.sqrt(Math.max(0, m2 - 1));
  return g < 0.04 ? 0 : g;
}

// ---------------- drawing / charts ----------------

/** Splits points into drawable segments (breaks at pauses) */
export function trackSegments(points: TrackPoint[]): LatLng[][] {
  const out: LatLng[][] = [];
  let cur: LatLng[] = [];
  points.forEach((p, i) => {
    if (i > 0 && p[5] === 1 && cur.length) {
      out.push(cur);
      cur = [];
    }
    cur.push({ latitude: p[0], longitude: p[1] });
  });
  if (cur.length) out.push(cur);
  return out;
}

/** Colour for a speed (km/h): green → yellow → orange → red */
export function speedColor(kmh: number) {
  if (kmh < 40) return '#2E9E44';
  if (kmh < 70) return '#1DA1FA';
  if (kmh < 100) return '#F59E0B';
  if (kmh < 130) return '#FA881D';
  return '#E5484D';
}

/**
 * Speed-coloured lines for the map: consecutive points with the same colour band are merged,
 * so a long ride becomes a few dozen polylines instead of thousands.
 */
export function speedLines(points: TrackPoint[], width = 5) {
  const lines: { id: string; coordinates: LatLng[]; color: string; width: number }[] = [];
  let cur: { color: string; coords: LatLng[] } | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const ll = { latitude: p[0], longitude: p[1] };
    if (i > 0 && p[5] === 1) {
      if (cur && cur.coords.length > 1) lines.push({ id: `l${lines.length}`, coordinates: cur.coords, color: cur.color, width });
      cur = null;
    }
    const color = speedColor(p[3] ?? 0);
    if (!cur) cur = { color, coords: [ll] };
    else if (color === cur.color) cur.coords.push(ll);
    else {
      cur.coords.push(ll);
      lines.push({ id: `l${lines.length}`, coordinates: cur.coords, color: cur.color, width });
      cur = { color, coords: [ll] };
    }
  }
  if (cur && cur.coords.length > 1) lines.push({ id: `l${lines.length}`, coordinates: cur.coords, color: cur.color, width });
  return lines;
}

/**
 * Speed over distance, resampled into `bins` buckets (for the bar chart).
 * Uses GPS speed when available, otherwise the speed between fixes.
 */
export function speedProfile(points: TrackPoint[], bins = 48) {
  if (points.length < 2) return { values: [] as number[], totalM: 0 };
  const dist: number[] = [0];
  const speed: number[] = [points[0][3] ?? 0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = b[5] === 1 ? 0 : haversine({ latitude: a[0], longitude: a[1] }, { latitude: b[0], longitude: b[1] });
    dist.push(dist[i - 1] + d);
    const dt = (b[2] - a[2]) / 1000;
    speed.push(b[3] ?? (dt > 0 && b[5] !== 1 ? (d / dt) * 3.6 : 0));
  }
  const totalM = dist[dist.length - 1];
  if (totalM <= 0) return { values: [], totalM: 0 };
  const sums = new Array(bins).fill(0);
  const counts = new Array(bins).fill(0);
  for (let i = 0; i < points.length; i++) {
    const b = Math.min(bins - 1, Math.floor((dist[i] / totalM) * bins));
    sums[b] += speed[i];
    counts[b] += 1;
  }
  // fill empty buckets with the previous value so the chart has no holes
  const values: number[] = [];
  for (let b = 0; b < bins; b++) values.push(counts[b] ? sums[b] / counts[b] : values[b - 1] ?? 0);
  return { values, totalM };
}

/** Altitude over distance, resampled (null when the track has no altitude) */
export function altitudeProfile(points: TrackPoint[], bins = 48): number[] | null {
  const withAlt = points.filter((p) => p[4] !== null);
  if (withAlt.length < 2) return null;
  const step = (withAlt.length - 1) / (bins - 1);
  return Array.from({ length: bins }, (_, i) => withAlt[Math.round(i * step)][4] as number);
}
