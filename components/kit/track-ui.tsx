// UI pieces for ride recordings: stat tiles, speed chart, route outline, list rows.
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTrackDate, TrackSummary } from '@/api/tracksApi';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { formatDistance, formatDuration } from '@/utils/geo';
import { speedColor } from '@/utils/track-recorder';

type IconName = keyof typeof Ionicons.glyphMap;

/** One statistic: icon, big value, small unit + label */
export function StatTile({
  icon,
  label,
  value,
  unit,
  color = Brand.primary,
  style,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  style?: object;
}) {
  return (
    <View style={[styles.tile, style]}>
      <View style={[styles.tileIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {!!unit && <Text style={styles.tileUnit}> {unit}</Text>}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** 2- or 3-column grid of StatTiles */
export function StatGrid({ children, columns = 3 }: { children: React.ReactNode; columns?: 2 | 3 }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const basis = columns === 3 ? '31.5%' : '48.5%';
  return (
    <View style={styles.grid}>
      {items.map((c, i) => (
        <View key={i} style={{ flexBasis: basis, flexGrow: 1 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

/** Speed (km/h) over distance as coloured bars — plain Views, no chart library */
export function SpeedChart({ values, totalM, height = 130 }: { values: number[]; totalM: number; height?: number }) {
  const max = Math.max(20, ...values);
  const top = Math.ceil(max / 20) * 20;
  if (!values.length) {
    return <Text style={styles.chartEmpty}>Not enough data for a chart.</Text>;
  }
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={[styles.axisY, { height }]}>
          <Text style={styles.axisText}>{top}</Text>
          <Text style={styles.axisText}>{top / 2}</Text>
          <Text style={styles.axisText}>0</Text>
        </View>
        <View style={[styles.chartArea, { height }]}>
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: height / 2 }]} />
          <View style={styles.bars}>
            {values.map((v, i) => (
              <View key={i} style={styles.barSlot}>
                <View style={[styles.bar, { height: Math.max(2, (v / top) * height), backgroundColor: speedColor(v) }]} />
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.axisX}>
        <Text style={styles.axisText}>0</Text>
        <Text style={styles.axisText}>{formatDistance(totalM / 2)}</Text>
        <Text style={styles.axisText}>{formatDistance(totalM)}</Text>
      </View>
      <View style={styles.legend}>
        {[
          ['< 40', 20],
          ['40–70', 50],
          ['70–100', 80],
          ['100–130', 110],
          ['130+', 140],
        ].map(([label, v]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: speedColor(v as number) }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
        <Text style={styles.legendText}>km/h</Text>
      </View>
    </View>
  );
}

/** Small elevation profile (area-like bars) */
export function AltitudeChart({ values, height = 70 }: { values: number[]; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(20, max - min);
  return (
    <View>
      <View style={[styles.bars, { height, alignItems: 'flex-end' }]}>
        {values.map((v, i) => (
          <View key={i} style={styles.barSlot}>
            <View style={{ height: 4 + ((v - min) / span) * (height - 4), backgroundColor: '#8B5CF6', opacity: 0.75, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          </View>
        ))}
      </View>
      <View style={styles.axisX}>
        <Text style={styles.axisText}>{Math.round(min)} m</Text>
        <Text style={styles.axisText}>max {Math.round(max)} m</Text>
      </View>
    </View>
  );
}

/**
 * Outline of a path drawn with rotated Views (thumbnail, no map needed).
 * `points` are [lat, lng].
 */
export function RouteShape({
  points,
  color = '#fff',
  strokeWidth = 3,
  padding = 12,
  style,
}: {
  points: [number, number][];
  color?: string;
  strokeWidth?: number;
  padding?: number;
  style?: object;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const segments = useMemo(() => {
    if (points.length < 2 || !size.w || !size.h) return null;
    const lat0 = (points[0][0] * Math.PI) / 180;
    const xs = points.map((p) => p[1] * Math.cos(lat0));
    const ys = points.map((p) => -p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = size.w - padding * 2;
    const h = size.h - padding * 2;
    const scale = Math.min(w / (maxX - minX || 1e-6), h / (maxY - minY || 1e-6));
    const offX = padding + (w - (maxX - minX) * scale) / 2;
    const offY = padding + (h - (maxY - minY) * scale) / 2;
    const pts = xs.map((x, i) => ({ x: offX + (x - minX) * scale, y: offY + (ys[i] - minY) * scale }));
    const segs: { left: number; top: number; width: number; angle: number }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.5) continue;
      segs.push({ left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - strokeWidth / 2, width: len + strokeWidth * 0.6, angle: Math.atan2(b.y - a.y, b.x - a.x) });
    }
    return { segs, start: pts[0], end: pts[pts.length - 1] };
  }, [points, size, padding, strokeWidth]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout} pointerEvents="none">
      {segments && (
        <>
          {segments.segs.map((s, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: s.left,
                top: s.top,
                width: s.width,
                height: strokeWidth,
                borderRadius: strokeWidth / 2,
                backgroundColor: color,
                transform: [{ rotate: `${s.angle}rad` }],
              }}
            />
          ))}
          <View style={[styles.shapeDot, { left: segments.start.x - 5, top: segments.start.y - 5, backgroundColor: Brand.success }]} />
          <View style={[styles.shapeDot, { left: segments.end.x - 5, top: segments.end.y - 5, backgroundColor: Brand.danger }]} />
        </>
      )}
    </View>
  );
}

/** A recording in "My recordings" */
export function TrackRow({ track, onPress }: { track: TrackSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
      <View style={styles.rowTop}>
        <View style={styles.rowIcon}>
          <Ionicons name="analytics" size={20} color={Brand.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {track.title || 'My ride'}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {formatTrackDate(track.startedAt)}
            {track.startName ? ` · ${track.startName}${track.endName && track.endName !== track.startName ? ' → ' + track.endName : ''}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
      </View>
      <View style={styles.rowStats}>
        <MiniStat icon="navigate" value={formatDistance(track.distanceM)} />
        <MiniStat icon="time" value={formatDuration(track.movingSec || track.durationSec)} />
        <MiniStat icon="speedometer" value={`${Math.round(track.maxSpeedKmh)} km/h`} />
        {track.maxLeanLeft || track.maxLeanRight ? (
          <MiniStat icon="sync" value={`${Math.round(Math.max(track.maxLeanLeft ?? 0, track.maxLeanRight ?? 0))}°`} />
        ) : (
          <MiniStat icon="trending-up" value={track.elevationGainM !== null ? `${track.elevationGainM} m` : '—'} />
        )}
      </View>
    </Pressable>
  );
}

function MiniStat({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View style={styles.mini}>
      <Ionicons name={icon} size={13} color={Brand.muted} />
      <Text style={styles.miniText} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: '#fff', borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Brand.border },
  tileIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileValue: { fontSize: 19, fontWeight: '900', color: Brand.text },
  tileUnit: { fontSize: 12, fontWeight: '700', color: Brand.muted },
  tileLabel: { fontSize: 11, color: Brand.muted, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chartEmpty: { color: Brand.muted, fontSize: 13 },
  axisY: { width: 30, justifyContent: 'space-between', paddingRight: 4 },
  axisText: { fontSize: 10, color: Brand.faint, fontWeight: '700' },
  chartArea: { flex: 1, justifyContent: 'flex-end' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Brand.border },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
  barSlot: { flex: 1, paddingHorizontal: 0.75, justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axisX: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginLeft: 30 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 11, color: Brand.muted, fontWeight: '600' },
  shapeDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  row: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, marginBottom: 12, ...Shadow },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  rowSub: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  rowStats: { flexDirection: 'row', marginTop: 12, backgroundColor: Brand.input, borderRadius: Radius.md, paddingVertical: 9, paddingHorizontal: 6 },
  mini: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  miniText: { fontSize: 13, fontWeight: '800', color: Brand.textSoft },
});
