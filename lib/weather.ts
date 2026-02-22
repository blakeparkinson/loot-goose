import { Coords } from './types';

// WMO weather interpretation code → [description, emoji]
const WMO: Record<number, [string, string]> = {
  0:  ['Clear sky', '☀️'],
  1:  ['Mainly clear', '🌤️'],
  2:  ['Partly cloudy', '⛅'],
  3:  ['Overcast', '☁️'],
  45: ['Foggy', '🌫️'],
  48: ['Icy fog', '🌫️'],
  51: ['Light drizzle', '🌦️'],
  53: ['Drizzle', '🌧️'],
  55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy rain', '🌧️'],
  71: ['Light snow', '🌨️'],
  73: ['Snow', '❄️'],
  75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '🌨️'],
  80: ['Rain showers', '🌦️'],
  81: ['Rain showers', '🌧️'],
  82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'],
  86: ['Heavy snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm w/ hail', '⛈️'],
  99: ['Thunderstorm w/ hail', '⛈️'],
};

function resolveCode(code: number): [string, string] {
  if (WMO[code]) return WMO[code];
  // Find nearest known code
  const nearest = Object.keys(WMO)
    .map(Number)
    .sort((a, b) => Math.abs(a - code) - Math.abs(b - code))[0];
  return WMO[nearest] ?? ['Unknown', '🌡️'];
}

export interface WeatherInfo {
  description: string;
  emoji: string;
  tempF: number;
  /** Short label for display: "☀️ Clear sky · 72°F" */
  label: string;
  /** Sentence for the AI prompt */
  context: string;
}

export async function fetchWeather(coords: Coords): Promise<WeatherInfo | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
      `&current=temperature_2m,weather_code` +
      `&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.current?.weather_code ?? 0;
    const tempF = Math.round(data.current?.temperature_2m ?? 70);
    const [description, emoji] = resolveCode(code);
    return {
      description,
      emoji,
      tempF,
      label: `${emoji} ${description} · ${tempF}°F`,
      context: `${description}, ${tempF}°F`,
    };
  } catch {
    return null;
  }
}
