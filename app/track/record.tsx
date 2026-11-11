// LIVE RIDE RECORDING — full-screen map that follows the rider, stopwatch, speed gauge, lean angle and G-force.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Accelerometer, DeviceMotion } from 'expo-sensors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { createTrackApi, defaultRideTitle } from '@/api/tracksApi';
import { AppMap } from '@/components/kit/app-map';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import type { LatLng, MapLine, MapMarker } from '@/components/kit/map-types';
import { Brand, Radius } from '@/constants/brand';
import { formatClock, formatDistance, formatDuration, simplify } from '@/utils/geo';
import {
  addFix,
  addSensors,
  clearRecording,
  elapsedMs,
  fixSpeedKmh,
  gForce,
  leanAngle,
  loadRecording,
  newRecording,
  pause,
  RecState,
  restore,
  resume,
  saveRecording,
  speedColor,
  trackSegments,
} from '@/utils/track-recorder';

type Phase = 'loading' | 'restore' | 'denied' | 'ready' | 'active';
type Vec = { x: number; y: number; z: number };

interface Snap {
  status: 'idle' | 'recording' | 'paused';
  elapsedSec: number;
  distanceM: number;
  speed: number;
  maxSpeed: number;
  avgSpeed: number;
  movingSec: number;
  lean: number | null;
  g: number | null;
  maxLeanL: number;
  maxLeanR: number;
  maxG: number;
  accuracy: number | null;
  gpsAgeSec: number | null;
}

const EMPTY_SNAP: Snap = {
  status: 'idle',
  elapsedSec: 0,
  distanceM: 0,
  speed: 0,
  maxSpeed: 0,
  avgSpeed: 0,
  movingSec: 0,
  lean: null,
  g: null,
  maxLeanL: 0,
  maxLeanR: 0,
  maxG: 0,
  accuracy: null,
  gpsAgeSec: null,
};

const IS_WEB = Platform.OS === 'web';
const DARK = '#0B1220';

function haptic(kind: 'light' | 'heavy' | 'success' = 'light') {
  if (IS_WEB) return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // haptics unavailable
  }
}

/** Town / area name for a point (phones only — the browser has no reverse geocoder) */
async function placeName(lat: number, lng: number): Promise<string | null> {
  if (IS_WEB) return null;
  try {
    const res = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    const a = res?.[0];
    return (a && (a.city || a.district || a.subregion || a.region || a.name)) || null;
  } catch {
    return null;
  }
}

export default function RecordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();

  // --- live data lives in refs (updated by GPS/sensor callbacks without re-rendering) ---
  const rec = useRef<RecState | null>(null);
  const finished = useRef(false);
  const live = useRef({ speed: 0, lastFixAt: 0, accuracy: null as number | null, lean: null as number | null, g: null as number | null });
  const accSmooth = useRef<Vec | null>(null);
  const gravity = useRef<Vec | null>(null);
  const calib = useRef<{ ref: Vec | null; samples: Vec[] }>({ ref: null, samples: [] });
  const lastPathCount = useRef(-1);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  // --- UI state (refreshed by a ticker) ---
  const [phase, setPhase] = useState<Phase>('loading');
  const [snap, setSnap] = useState<Snap>(EMPTY_SNAP);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [path, setPath] = useState<MapLine[]>([]);
  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [follow, setFollow] = useState(true);
  const [sensors, setSensors] = useState({ lean: false, g: false });
  const [restoreInfo, setRestoreInfo] = useState<{ distanceM: number; elapsedSec: number; startedAt: number } | null>(null);
  const restored = useRef<RecState | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [permMsg, setPermMsg] = useState('');
  const [panelH, setPanelH] = useState(380);

  // ---------- GPS ----------
  const stopWatch = () => {
    watchSub.current?.remove();
    watchSub.current = null;
  };

  const startWatch = useCallback(async () => {
    try {
      if (!IS_WEB && !(await Location.hasServicesEnabledAsync())) {
        setPermMsg('Location services are turned off. Turn on GPS / Location in your phone settings.');
        setPhase('denied');
        return false;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setPermMsg(
          IS_WEB
            ? 'Your browser blocked location access. Allow location for this site and try again.'
            : 'TrailRiders needs your location to record your ride. Allow location access in Settings.'
        );
        setPhase('denied');
        return false;
      }
      stopWatch();
      watchSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 1000 },
        (loc) => {
          const c = loc.coords;
          const fix = {
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy: c.accuracy ?? null,
            altitude: c.altitude ?? null,
            altitudeAccuracy: c.altitudeAccuracy ?? null,
            speed: c.speed ?? null,
            timestamp: loc.timestamp || Date.now(),
          };
          const L = live.current;
          L.accuracy = fix.accuracy;
          L.lastFixAt = Date.now();
          const gps = fixSpeedKmh(fix);
          if (gps !== null) L.speed = gps;
          const s = rec.current;
          if (s) {
            const before = s.points[s.points.length - 1];
            const result = addFix(s, fix);
            if (gps === null && result === 'added' && before) {
              // no GPS speed (some browsers): speed from the last two fixes
              const p = s.points[s.points.length - 1];
              const dt = (p[2] - before[2]) / 1000;
              if (dt > 0 && p[5] !== 1) {
                const dLat = (p[0] - before[0]) * 111320;
                const dLng = (p[1] - before[1]) * 111320 * Math.cos((p[0] * Math.PI) / 180);
                L.speed = (Math.hypot(dLat, dLng) / dt) * 3.6;
              }
            }
            if (result === 'added' && s.points.length === 1) setStartPoint({ latitude: fix.latitude, longitude: fix.longitude });
          }
          if (fix.accuracy !== null && fix.accuracy <= 100) setPos({ latitude: fix.latitude, longitude: fix.longitude });
        },
        () => {
          // location errors are transient while riding — the GPS badge shows "searching"
        }
      );
      return true;
    } catch {
      setPermMsg('Could not start the GPS. Check that location is enabled and try again.');
      setPhase('denied');
      return false;
    }
  }, []);

  // ---------- first load: unfinished recording? then permissions ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadRecording();
      if (cancelled) return;
      if (saved && saved.points.length) {
        const s = restore(saved);
        restored.current = s;
        setRestoreInfo({ distanceM: s.distanceM, elapsedSec: Math.round(s.activeMs / 1000), startedAt: s.startedAt });
        setPhase('restore');
        return;
      }
      if (saved) await clearRecording();
      if (await startWatch()) setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [startWatch]);

  // ---------- sensors (phones only) ----------
  useEffect(() => {
    if (IS_WEB) return;
    const subs: { remove: () => void }[] = [];
    let alive = true;
    (async () => {
      const [accOk, motionOk] = await Promise.all([
        Accelerometer.isAvailableAsync().catch(() => false),
        DeviceMotion.isAvailableAsync().catch(() => false),
      ]);
      if (!alive) return;
      if (accOk) {
        Accelerometer.setUpdateInterval(100);
        subs.push(
          Accelerometer.addListener((a) => {
            // accelerometer is in g; smooth the vector (engine vibration) then remove the 1 g of gravity
            const prev = accSmooth.current ?? a;
            const k = 0.2;
            const sm = { x: prev.x + (a.x - prev.x) * k, y: prev.y + (a.y - prev.y) * k, z: prev.z + (a.z - prev.z) * k };
            accSmooth.current = sm;
            const g = gForce(sm);
            live.current.g = g;
            if (rec.current) addSensors(rec.current, live.current.speed, null, g);
          })
        );
      }
      if (motionOk) {
        DeviceMotion.setUpdateInterval(100);
        subs.push(
          DeviceMotion.addListener((m) => {
            const a = m.accelerationIncludingGravity;
            if (!a) return;
            const u = m.acceleration;
            const raw = u ? { x: a.x - u.x, y: a.y - u.y, z: a.z - u.z } : a;
            const prev = gravity.current ?? raw;
            const k = u ? 0.5 : 0.1; // fused gravity is already clean; raw needs heavier smoothing
            const gv = { x: prev.x + (raw.x - prev.x) * k, y: prev.y + (raw.y - prev.y) * k, z: prev.z + (raw.z - prev.z) * k };
            gravity.current = gv;
            const c = calib.current;
            if (!c.ref) {
              c.samples.push(gv);
              if (c.samples.length >= 10) {
                const n = c.samples.length;
                c.ref = c.samples.reduce((s, v) => ({ x: s.x + v.x / n, y: s.y + v.y / n, z: s.z + v.z / n }), { x: 0, y: 0, z: 0 });
                c.samples = [];
              }
              return;
            }
            const lean = leanAngle(gv, c.ref);
            live.current.lean = lean;
            if (rec.current) addSensors(rec.current, live.current.speed, lean, null);
          })
        );
      }
      setSensors({ lean: motionOk, g: accOk });
    })();
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
    };
  }, []);

  const recalibrate = () => {
    calib.current = { ref: null, samples: [] };
    live.current.lean = null;
    haptic();
  };

  // ---------- ticker: copy refs into UI state ----------
  useEffect(() => {
    const id = setInterval(() => {
      const L = live.current;
      const now = Date.now();
      const age = L.lastFixAt ? (now - L.lastFixAt) / 1000 : null;
      if (age !== null && age > 6) L.speed = 0; // no fresh fix: we're probably stopped
      const s = rec.current;
      setSnap({
        status: s ? s.status : 'idle',
        elapsedSec: s ? Math.floor(elapsedMs(s, now) / 1000) : 0,
        distanceM: s?.distanceM ?? 0,
        speed: L.speed,
        maxSpeed: s?.maxSpeedKmh ?? 0,
        avgSpeed: s && s.movingMs > 0 ? (s.distanceM / (s.movingMs / 1000)) * 3.6 : 0,
        movingSec: s ? Math.round(s.movingMs / 1000) : 0,
        lean: L.lean,
        g: L.g,
        maxLeanL: s?.maxLeanLeft ?? 0,
        maxLeanR: s?.maxLeanRight ?? 0,
        maxG: s?.maxG ?? 0,
        accuracy: L.accuracy,
        gpsAgeSec: age,
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // path on the map: refresh every 2 s (not on every fix)
  useEffect(() => {
    const id = setInterval(() => {
      const s = rec.current;
      const n = s?.points.length ?? 0;
      if (n === lastPathCount.current) return;
      lastPathCount.current = n;
      if (!s || n < 2) {
        setPath([]);
        return;
      }
      const segs = trackSegments(s.points);
      const budget = 1500;
      setPath(
        segs
          .filter((c) => c.length > 1)
          .map((c, i) => ({
            id: `seg${i}`,
            coordinates: n > budget ? simplify(c, Math.max(2, Math.round((budget * c.length) / n))) : c,
            color: '#38BDF8',
            width: 6,
          }))
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // autosave every 10 s while recording + when the app goes to the background
  useEffect(() => {
    const id = setInterval(() => {
      if (rec.current && rec.current.status === 'recording') saveRecording(rec.current);
    }, 10000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && rec.current) saveRecording(rec.current);
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // keep the screen on while a recording exists (foreground GPS only)
  const recording = phase === 'active';
  useEffect(() => {
    if (!recording) return;
    activateKeepAwakeAsync('tr-record').catch(() => {});
    return () => {
      try {
        deactivateKeepAwake('tr-record');
      } catch {
        // not available (e.g. some browsers)
      }
    };
  }, [recording]);

  // leaving the screen: stop GPS, keep the unfinished ride on the phone (paused)
  useEffect(() => {
    const watch = watchSub;
    return () => {
      watch.current?.remove();
      if (rec.current && !finished.current) {
        pause(rec.current);
        saveRecording(rec.current);
      }
    };
  }, []);

  // ---------- actions ----------
  const start = () => {
    const s = newRecording();
    rec.current = s;
    lastPathCount.current = -1;
    setStartPoint(null);
    recalibrate();
    setPhase('active');
    setFollow(true);
    haptic('heavy');
    saveRecording(s);
  };

  const togglePause = () => {
    const s = rec.current;
    if (!s) return;
    if (s.status === 'recording') pause(s);
    else resume(s);
    haptic('heavy');
    saveRecording(s);
    setSnap((p) => ({ ...p, status: s.status }));
  };

  const openFinish = () => {
    const s = rec.current;
    if (!s) return;
    pause(s);
    saveRecording(s);
    setSnap((p) => ({ ...p, status: 'paused' }));
    setTitle(defaultRideTitle(new Date(s.startedAt)));
    setFinishOpen(true);
    haptic();
  };

  const discard = async () => {
    if (!(await confirmAction('Discard this ride?', 'The recording will be deleted from this phone. This cannot be undone.', 'Discard', true))) return;
    finished.current = true;
    rec.current = null;
    await clearRecording();
    setFinishOpen(false);
    router.back();
  };

  const save = async () => {
    const s = rec.current;
    if (!s) return;
    if (s.points.length < 2 || s.distanceM < 20) {
      showMessage('Ride too short', 'Ride at least a few dozen metres with GPS before saving — or discard this recording.');
      return;
    }
    setSaving(true);
    try {
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      const [startName, endName] = await Promise.all([placeName(first[0], first[1]), placeName(last[0], last[1])]);
      const moving = s.gCount > 0;
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const track = await createTrackApi({
        title: title.trim() || defaultRideTitle(new Date(s.startedAt)),
        startedAt: new Date(s.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationSec: Math.round(elapsedMs(s) / 1000),
        points: s.points,
        maxLeanLeft: sensors.lean && moving ? r2(s.maxLeanLeft) : null,
        maxLeanRight: sensors.lean && moving ? r2(s.maxLeanRight) : null,
        maxGForce: sensors.g && moving ? r2(s.maxG) : null,
        avgGForce: sensors.g && moving ? r2(s.gSum / s.gCount) : null,
        startName,
        endName,
        rideId: rideId ? Number(rideId) || null : null,
      });
      finished.current = true;
      rec.current = null;
      await clearRecording();
      haptic('success');
      setFinishOpen(false);
      router.replace({ pathname: '/track/[id]', params: { id: String(track.id), fresh: '1' } });
    } catch (err) {
      showMessage('Could not save the ride', `${errorMessage(err)}\n\nYour recording is kept on this phone — try again when you have signal.`);
    } finally {
      setSaving(false);
    }
  };

  const leave = useCallback(async () => {
    if (rec.current && !finished.current) {
      const ok = await confirmAction(
        'Leave recording?',
        'Recording stops while you are away. Your ride is kept on this phone — open the recorder again to resume or save it.',
        'Leave'
      );
      if (!ok) return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/track');
  }, [router]);

  // Android back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (rec.current && !finished.current) {
        leave();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [leave]);

  // restore choices
  const resumeRestored = async () => {
    const s = restored.current;
    if (!s) return;
    rec.current = s;
    lastPathCount.current = -1;
    const p = s.points[0];
    if (p) setStartPoint({ latitude: p[0], longitude: p[1] });
    recalibrate();
    if (await startWatch()) setPhase('active'); // otherwise the "location needed" screen offers a retry
  };

  const saveRestored = async () => {
    await resumeRestored();
    openFinish();
  };

  const discardRestored = async () => {
    if (!(await confirmAction('Discard unfinished ride?', 'It will be deleted from this phone.', 'Discard', true))) return;
    restored.current = null;
    await clearRecording();
    setRestoreInfo(null);
    if (await startWatch()) setPhase('ready');
  };

  const retryPermission = async () => {
    setPhase('loading');
    if (await startWatch()) setPhase(rec.current ? 'active' : 'ready');
  };

  // ---------- map data (memoised so the map only updates when they change) ----------
  const markers = useMemo<MapMarker[]>(
    () => (startPoint ? [{ id: 'start', coordinate: startPoint, color: Brand.success, label: 'S' }] : []),
    [startPoint]
  );
  const followPos = follow ? pos : null;

  // ---------- render ----------
  const gpsState =
    snap.accuracy === null || snap.gpsAgeSec === null || snap.gpsAgeSec > 15
      ? { label: 'Searching GPS…', color: Brand.warning }
      : snap.accuracy <= 12
        ? { label: `GPS ±${Math.round(snap.accuracy)} m`, color: '#22C55E' }
        : snap.accuracy <= 35
          ? { label: `GPS ±${Math.round(snap.accuracy)} m`, color: Brand.warning }
          : { label: 'Weak GPS', color: Brand.danger };

  if (phase === 'loading') {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.loadingText}>Starting GPS…</Text>
      </View>
    );
  }

  if (phase === 'denied') {
    return (
      <View style={[styles.fill, styles.center, { paddingHorizontal: 28 }]}>
        <View style={styles.deniedIcon}>
          <Ionicons name="location-outline" size={40} color="#fff" />
        </View>
        <Text style={styles.deniedTitle}>Location needed</Text>
        <Text style={styles.deniedText}>{permMsg}</Text>
        <Button title="Try again" icon="refresh" onPress={retryPermission} style={{ alignSelf: 'stretch', marginTop: 24 }} />
        {!IS_WEB && (
          <Button title="Open settings" variant="outlineLight" icon="settings-outline" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        )}
        <Button title="Back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/track'))} style={{ marginTop: 6 }} />
      </View>
    );
  }

  const active = phase === 'active';
  const paused = snap.status === 'paused';

  return (
    <View style={styles.fill}>
      {/* map fills the screen above the panel (the panel's rounded top overlaps it a little) */}
      <View style={[styles.mapBox, { bottom: Math.max(0, panelH - 28) }]}>
        <AppMap
          lines={path}
          markers={markers}
          follow={followPos}
          fit={false}
          center={pos ?? undefined}
          zoom={15}
          showsUserLocation
          dark
          height="100%"
          style={styles.map}
        />
      </View>

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable style={styles.roundBtn} onPress={leave} hitSlop={6}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.clockBox}>
            {active ? (
              <View style={[styles.liveBadge, paused && { backgroundColor: Brand.warning }]}>
                {!paused && <View style={styles.liveDot} />}
                <Text style={styles.liveText}>{paused ? 'PAUSED' : 'LIVE'}</Text>
              </View>
            ) : (
              <View style={[styles.liveBadge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Text style={styles.liveText}>READY</Text>
              </View>
            )}
            <Text style={styles.clock}>{formatClock(snap.elapsedSec)}</Text>
          </View>
          <Pressable
            style={[styles.roundBtn, follow && { backgroundColor: Brand.primary }]}
            onPress={() => setFollow((f) => !f)}
            hitSlop={6}
          >
            <Ionicons name={follow ? 'navigate' : 'navigate-outline'} size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={[styles.gpsPill, { borderColor: gpsState.color }]}>
          <View style={[styles.gpsDot, { backgroundColor: gpsState.color }]} />
          <Text style={styles.gpsText}>{gpsState.label}</Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 14) }]} onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}>
        <View style={styles.gaugeRow}>
          <SpeedGauge speed={snap.speed} max={snap.maxSpeed} />
          <View style={styles.sideStats}>
            <SideStat label="Distance" value={formatDistance(snap.distanceM)} />
            <SideStat label="Avg speed" value={snap.avgSpeed ? `${Math.round(snap.avgSpeed)} km/h` : '—'} />
            <SideStat label="Moving" value={formatDuration(snap.movingSec)} />
          </View>
        </View>

        <View style={styles.sensorRow}>
          <Pressable style={styles.sensorTile} onPress={sensors.lean ? recalibrate : undefined} disabled={!sensors.lean}>
            <View style={styles.sensorHead}>
              <Ionicons name="sync" size={14} color="#93C5FD" />
              <Text style={styles.sensorLabel}>LEAN</Text>
              {sensors.lean && <Text style={styles.sensorHint}>tap to zero</Text>}
            </View>
            <Text style={styles.sensorValue}>
              {sensors.lean && snap.lean !== null ? `${snap.lean < -1 ? 'L ' : snap.lean > 1 ? 'R ' : ''}${Math.abs(Math.round(snap.lean))}°` : '—'}
            </Text>
            <Text style={styles.sensorSub}>
              {sensors.lean ? `max L ${Math.round(snap.maxLeanL)}° · R ${Math.round(snap.maxLeanR)}°` : IS_WEB ? 'Not in browser' : 'No motion sensor'}
            </Text>
          </Pressable>
          <View style={styles.sensorTile}>
            <View style={styles.sensorHead}>
              <Ionicons name="pulse" size={14} color="#FCA5A5" />
              <Text style={styles.sensorLabel}>G-FORCE</Text>
            </View>
            <Text style={styles.sensorValue}>{sensors.g && snap.g !== null ? `${snap.g.toFixed(2)} g` : '—'}</Text>
            <Text style={styles.sensorSub}>{sensors.g ? `max ${snap.maxG.toFixed(2)} g` : IS_WEB ? 'Not in browser' : 'No accelerometer'}</Text>
          </View>
        </View>

        {!active ? (
          <>
            <Text style={styles.tip}>
              {IS_WEB
                ? 'Recording with your browser’s location. Lean angle and G-force need the TrailRiders phone app.'
                : 'Mount your phone on the bars (screen facing you) for lean angle — it is an estimate. Keep the app open while riding.'}
            </Text>
            <Pressable style={({ pressed }) => [styles.startBtn, pressed && { transform: [{ scale: 0.97 }] }]} onPress={start}>
              <Ionicons name="radio-button-on" size={22} color="#fff" />
              <Text style={styles.startText}>Start recording</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.controls}>
            <Pressable
              style={({ pressed }) => [styles.ctrlBtn, { backgroundColor: paused ? '#22C55E' : Brand.warning }, pressed && { transform: [{ scale: 0.96 }] }]}
              onPress={togglePause}
            >
              <Ionicons name={paused ? 'play' : 'pause'} size={22} color="#fff" />
              <Text style={styles.ctrlText}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ctrlBtn, { backgroundColor: Brand.danger }, pressed && { transform: [{ scale: 0.96 }] }]}
              onPress={openFinish}
            >
              <Ionicons name="stop" size={20} color="#fff" />
              <Text style={styles.ctrlText}>Finish</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Unfinished ride found */}
      <Modal visible={phase === 'restore'} transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={[styles.sheetIcon, { backgroundColor: Brand.primarySoft }]}>
              <Ionicons name="time-outline" size={28} color={Brand.primary} />
            </View>
            <Text style={styles.sheetTitle}>Unfinished ride found</Text>
            <Text style={styles.sheetText}>
              {restoreInfo
                ? `Started ${new Date(restoreInfo.startedAt).toLocaleString()} · ${formatDistance(restoreInfo.distanceM)} · ${formatClock(restoreInfo.elapsedSec)}`
                : ''}
            </Text>
            <Button title="Resume recording" icon="play" onPress={resumeRestored} style={{ alignSelf: 'stretch', marginTop: 18 }} />
            <Button title="Save it now" icon="checkmark" variant="soft" onPress={saveRestored} style={{ alignSelf: 'stretch', marginTop: 10 }} />
            <Button title="Discard" variant="ghost" onPress={discardRestored} style={{ alignSelf: 'stretch', marginTop: 4 }} />
          </View>
        </View>
      </Modal>

      {/* Finish */}
      <Modal visible={finishOpen} transparent animationType="slide" onRequestClose={() => setFinishOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdropBottom} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, styles.sheetBottom, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Finish ride?</Text>
            <View style={styles.summary}>
              <SummaryItem label="Distance" value={formatDistance(snap.distanceM)} />
              <SummaryItem label="Time" value={formatClock(snap.elapsedSec)} />
              <SummaryItem label="Top speed" value={`${Math.round(snap.maxSpeed)} km/h`} />
            </View>
            <Text style={styles.inputLabel}>Name your ride</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Sunday twisties"
              placeholderTextColor={Brand.faint}
              style={styles.input}
              maxLength={120}
            />
            <Button title="Save ride" icon="checkmark-circle" onPress={save} loading={saving} style={{ marginTop: 16 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button title="Keep riding" variant="outline" onPress={() => {
                setFinishOpen(false);
                togglePause();
              }} disabled={saving} style={{ flex: 1 }} />
              <Button title="Discard" variant="dangerOutline" onPress={discard} disabled={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** Arc of ticks that light up with speed + big number in the middle */
function SpeedGauge({ speed, max }: { speed: number; max: number }) {
  const TICKS = 31;
  const SCALE = 200;
  const lit = Math.round((Math.min(speed, SCALE) / SCALE) * (TICKS - 1));
  const size = 168;
  return (
    <View style={{ width: size, height: size * 0.82, alignItems: 'center' }}>
      {Array.from({ length: TICKS }, (_, i) => {
        const angle = -125 + (250 * i) / (TICKS - 1);
        const on = i <= lit && speed >= 1;
        const kmh = (i / (TICKS - 1)) * SCALE;
        return (
          <View
            key={i}
            style={[
              styles.tick,
              {
                left: size / 2 - 2,
                top: size / 2 - 7,
                backgroundColor: on ? speedColor(kmh) : 'rgba(255,255,255,0.14)',
                height: i % 5 === 0 ? 14 : 10,
                transform: [{ rotate: `${angle}deg` }, { translateY: -(size / 2 - 10) }],
              },
            ]}
          />
        );
      })}
      <View style={[styles.gaugeCenter, { top: size / 2 - 42 }]}>
        <Text style={styles.speed}>{Math.round(speed)}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
        <Text style={styles.speedMax}>max {Math.round(max)}</Text>
      </View>
    </View>
  );
}

function SideStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sideStat}>
      <Text style={styles.sideValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.sideLabel}>{label}</Text>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const glass = 'rgba(11,18,32,0.92)';

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: DARK },
  center: { alignItems: 'center', justifyContent: 'center' },
  mapBox: { position: 'absolute', left: 0, right: 0, top: 0 },
  map: { flex: 1, borderRadius: 0 },
  loadingText: { color: 'rgba(255,255,255,0.8)', marginTop: 14, fontWeight: '700' },
  deniedIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  deniedTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 18 },
  deniedText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },

  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 14, alignItems: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: glass, alignItems: 'center', justifyContent: 'center' },
  clockBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: glass, borderRadius: Radius.pill, paddingLeft: 8, paddingRight: 16, paddingVertical: 7 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.danger, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  clock: { color: '#fff', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  gpsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: glass, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  gpsDot: { width: 7, height: 7, borderRadius: 4 },
  gpsText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: glass,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  gaugeRow: { flexDirection: 'row', alignItems: 'center' },
  tick: { position: 'absolute', width: 4, borderRadius: 2 },
  gaugeCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  speed: { color: '#fff', fontSize: 50, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 56 },
  speedUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', marginTop: -4 },
  speedMax: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  sideStats: { flex: 1, marginLeft: 10, gap: 8 },
  sideStat: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.md, paddingVertical: 7, paddingHorizontal: 12 },
  sideValue: { color: '#fff', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sideLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  sensorRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sensorTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.md, padding: 10 },
  sensorHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sensorLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  sensorHint: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', marginLeft: 'auto' },
  sensorValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  sensorSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },

  tip: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.danger,
    borderRadius: Radius.pill,
    minHeight: 58,
    marginTop: 12,
  },
  startText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 14 },
  ctrlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, minHeight: 56 },
  ctrlText: { color: '#fff', fontSize: 17, fontWeight: '900' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,10,25,0.6)', justifyContent: 'center', padding: 22 },
  modalBackdropBottom: { flex: 1, backgroundColor: 'rgba(0,10,25,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 22, alignItems: 'stretch', width: '100%', maxWidth: 520, alignSelf: 'center' },
  sheetBottom: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingTop: 10 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 14 },
  sheetIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: Brand.text, textAlign: 'center' },
  sheetText: { fontSize: 14, color: Brand.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  summary: { flexDirection: 'row', backgroundColor: Brand.background, borderRadius: Radius.md, paddingVertical: 14, marginTop: 14 },
  summaryValue: { fontSize: 18, fontWeight: '900', color: Brand.text },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginTop: 16, marginBottom: 7 },
  input: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.input,
    outlineStyle: 'none',
  } as object,
});
