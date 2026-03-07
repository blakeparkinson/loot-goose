import { Linking, Platform } from 'react-native';
import { Coords } from './types';
import { buildRouteExportPreview } from './huntInsights';

export async function openNativeMaps(coords: Coords, label: string): Promise<void> {
  const { latitude, longitude } = coords;
  const encodedLabel = encodeURIComponent(label);

  // iOS: standard Apple Maps URL — pin at coords with label
  // Android: geo URI with query label
  const url = Platform.select({
    ios: `maps://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  })!;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodedLabel}`
    );
  }
}

export async function openNativeMapsDirections(coords: Coords): Promise<void> {
  const { latitude, longitude } = coords;

  const url = Platform.select({
    ios: `maps://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`,
    android: `google.navigation:q=${latitude},${longitude}&mode=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`,
  })!;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`
    );
  }
}

/**
 * Open Google Maps with multiple stops as waypoints.
 * Stops are provided in the desired visit order.
 * Each stop can be either lat/lng coords or a text query string.
 * Uses the Google Maps web URL which opens in the Google Maps app when installed.
 */
export async function openRouteInMaps(
  origin: Coords | null,
  stops: Array<{ coords?: Coords; query?: string }>,
): Promise<void> {
  const preview = buildRouteExportPreview(origin, stops);
  const valid = preview.routeStops;
  if (valid.length === 0) return;

  const toStr = (s: { coords?: Coords; query?: string }) =>
    s.coords
      ? `${s.coords.latitude},${s.coords.longitude}`
      : encodeURIComponent(s.query!);

  const destination = toStr(valid[valid.length - 1]);
  // Use %7C (encoded pipe) as waypoint separator — required by Google Maps URL spec.
  const waypoints = valid.slice(0, -1).map(toStr).join('%7C');

  let url = 'https://www.google.com/maps/dir/?api=1&travelmode=walking';
  if (origin) url += `&origin=${origin.latitude},${origin.longitude}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  url += `&destination=${destination}`;

  await Linking.openURL(url);
}

export async function openMapsSearch(query: string): Promise<void> {
  const encoded = encodeURIComponent(query);
  const url = Platform.select({
    ios: `maps://maps.apple.com/?q=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://maps.google.com/maps?q=${encoded}`,
  })!;

  const canOpen = await Linking.canOpenURL(url);
  await Linking.openURL(canOpen ? url : `https://maps.google.com/maps?q=${encoded}`);
}
