// Geo + formatting helpers shared by tracking, routes, maps and stats screens.
import type { LatLng } from '@/components/kit/map-types';

const R = 6371000; // earth radius (m)
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in metres between two points */
export function haversine(a: LatLng, b: LatLng) {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total length of a path in metres */
export function pathLength(points: LatLng[]) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

/** 12345 m -> "12.3 km", 850 -> "850 m" */
export function formatDistance(m: number) {
  if (!Number.isFinite(m)) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 100000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}

/** 3725 s -> "1h 02m", 125 -> "2m 05s" */
export function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** 3725 -> "01:02:05" (stopwatch) */
export function formatClock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export const msToKmh = (ms: number | null | undefined) => (ms && ms > 0 ? ms * 3.6 : 0);

/** Reduce a long path to at most `max` points (keeps first & last) — for previews */
export function simplify<T>(points: T[], max = 400): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/** Google Maps directions link through a list of points (max ~10 waypoints) */
export function googleMapsRouteUrl(points: LatLng[]) {
  if (points.length < 2) return '';
  const s = simplify(points, 10);
  const fmt = (p: LatLng) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
  const way = s.slice(1, -1).map(fmt).join('|');
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${fmt(s[0])}&destination=${fmt(s[s.length - 1])}` +
    (way ? `&waypoints=${encodeURIComponent(way)}` : '') +
    '&travelmode=driving'
  );
}
