import { Platform } from 'react-native';

// TrailRiders design tokens — keep every screen on the same palette
export const Brand = {
  primary: '#1DA1FA',
  primaryDark: '#0B7FD1',
  primarySoft: '#E6F4FE',
  navy: '#003366',
  navySoft: '#E8EEF5',
  accent: '#FA881D',
  background: '#F4F6FA',
  card: '#FFFFFF',
  text: '#111827',
  textSoft: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  input: '#F9FAFB',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  success: '#2E9E44',
  successSoft: '#E7F6EA',
  warning: '#F59E0B',
};

export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const Shadow = Platform.select({
  web: { boxShadow: '0 4px 16px rgba(0, 51, 102, 0.08)' } as object,
  default: {
    shadowColor: '#003366',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}) as object;

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const RIDE_TYPES = ['Motorcycle', 'Car', 'Both'];
export const CATEGORIES = ['Ride', 'Meetup', 'Tour', 'Track Day'];

export const DIFFICULTY_COLORS: Record<string, { bg: string; fg: string }> = {
  Easy: { bg: Brand.successSoft, fg: Brand.success },
  Medium: { bg: '#FEF3C7', fg: '#B45309' },
  Hard: { bg: Brand.dangerSoft, fg: Brand.danger },
};

export const RIDE_TYPE_ICONS: Record<string, string> = {
  Motorcycle: 'bicycle',
  Car: 'car-sport',
  Both: 'speedometer',
};
