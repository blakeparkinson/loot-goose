import { Linking, Platform } from 'react-native';
import { Coords } from './types';

export async function openNativeMaps(coords: Coords, label: string): Promise<void> {
  const { latitude, longitude } = coords;
  const encodedLabel = encodeURIComponent(label);

  const url = Platform.select({
    ios: `maps://app?daddr=${latitude},${longitude}&q=${encodedLabel}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  })!;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    );
  }
}

export async function openMapsSearch(query: string): Promise<void> {
  const encoded = encodeURIComponent(query);
  const url = Platform.select({
    ios: `maps://app?q=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://maps.google.com/maps?q=${encoded}`,
  })!;

  const canOpen = await Linking.canOpenURL(url);
  await Linking.openURL(canOpen ? url : `https://maps.google.com/maps?q=${encoded}`);
}
