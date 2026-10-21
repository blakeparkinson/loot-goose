// Brand colours from BRAND.md. Bill orange (#E8611A) is for illustration only, so it isn't here.
export const Brand = {
  lootGold: '#F5A623', // primary actions and rewards
  deepGold: '#D4880F', // pressed states, gold on light backgrounds
  badgeNavy: '#0E2047', // the icon field and the splash
  gooseWhite: '#FFFDF7', // the bird
  ink: '#0D1117', // dark surfaces and the app background
} as const;

export type AppTheme = {
  bg: string;
  card: string;
  surface: string;
  border: string;

  gold: string;
  goldLight: string;
  // Text that would be gold. Deep gold on white is about 2.9:1, too faint for text (BRAND.md),
  // so in light mode this is the text colour; gold stays for fills, borders and icons.
  goldText: string;
  green: string;
  greenLight: string;
  red: string;
  redLight: string;
  // Blue and purple are GitHub Primer colours, not brand colours. Use them only
  // where the hue carries meaning (the map route line, the info toast, rank tiers);
  // decorative accents use gold.
  blue: string;
  blueLight: string;
  purple: string;
  purpleLight: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  shadow: string;
};

export type ThemeMode = 'system' | 'light' | 'dark';

export const DarkTheme: AppTheme = {
  bg: Brand.ink,
  card: '#161B22',
  surface: '#1C2128',
  border: '#30363D',

  gold: Brand.lootGold,
  goldLight: 'rgba(245,166,35,0.15)',
  goldText: Brand.lootGold,
  green: '#3FB950',
  greenLight: 'rgba(63,185,80,0.15)',
  red: '#F85149',
  redLight: 'rgba(248,81,73,0.15)',
  blue: '#58A6FF',
  blueLight: 'rgba(88,166,255,0.15)',
  purple: '#BC8CFF',
  purpleLight: 'rgba(188,140,255,0.15)',

  text: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',

  shadow: '#000',
};

export const LightTheme: AppTheme = {
  bg: '#FFFFFF',
  card: '#F6F8FA',
  surface: '#EFF1F3',
  border: '#D0D7DE',

  gold: Brand.deepGold,
  goldLight: 'rgba(212,136,15,0.12)',
  goldText: '#1F2328',
  green: '#1A7F37',
  greenLight: 'rgba(26,127,55,0.12)',
  red: '#CF222E',
  redLight: 'rgba(207,34,46,0.12)',
  blue: '#0969DA',
  blueLight: 'rgba(9,105,218,0.12)',
  purple: '#8250DF',
  purpleLight: 'rgba(130,80,223,0.12)',

  text: '#1F2328',
  textSecondary: '#656D76',
  textMuted: '#8C959F',

  shadow: 'rgba(0,0,0,0.1)',
};
