import { Linking, Platform } from 'react-native';
import { Coords } from './types';

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
