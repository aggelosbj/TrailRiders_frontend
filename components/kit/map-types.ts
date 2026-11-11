// Shared types for <AppMap> (native: react-native-maps, web: Leaflet/OpenStreetMap)

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapMarker {
  id: string | number;
  coordinate: LatLng;
  title?: string;
  subtitle?: string;
  /** pin colour, defaults to the brand blue */
  color?: string;
  /** small text shown inside the pin on web / as label (e.g. "S", "F") */
  label?: string;
}

export interface MapLine {
  id: string | number;
  coordinates: LatLng[];
  color?: string;
  width?: number;
}

export interface AppMapProps {
  markers?: MapMarker[];
  lines?: MapLine[];
  /** Fit the view to markers + lines (default true). If nothing to fit, uses `center` or Greece. */
  fit?: boolean;
  center?: LatLng;
  /** zoom-ish level when using `center` (1 = world, 16 = street). Default 12 */
  zoom?: number;
  /** follow this position (e.g. live tracking); re-centres when it changes */
  follow?: LatLng | null;
  showsUserLocation?: boolean;
  dark?: boolean;
  onMarkerPress?: (id: string | number) => void;
  /** height of the map; defaults to 220 */
  height?: number | `${number}%`;
  style?: object;
  /** disable gestures (for small previews) */
  interactive?: boolean;
}

/** Centre of Greece — default view */
export const GREECE: LatLng = { latitude: 38.6, longitude: 23.2 };
