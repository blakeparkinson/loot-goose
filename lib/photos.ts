import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { Hunt } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// Older builds uploaded verified photos to this public bucket and stored the URL.
const LEGACY_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/hunt-photos/`;

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'hunt-photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function photoFileName(huntId: string, itemId: string): string {
  return `${huntId}_${itemId}_${Date.now()}.jpg`.replace(/[^A-Za-z0-9_.-]/g, '');
}

/**
 * Copy a captured photo out of the camera's temp folder into the app's documents
 * folder so it survives cache clears. Photos never leave the device (apart from the
 * verification call). Falls back to the original URI if the copy fails.
 */
export function persistHuntPhoto(tempUri: string, huntId: string, itemId: string): string {
  if (Platform.OS === 'web') return tempUri;
  try {
    const dest = new File(photoDir(), photoFileName(huntId, itemId));
    new File(tempUri).copy(dest);
    return dest.uri;
  } catch (e) {
    if (__DEV__) console.warn('[persistHuntPhoto] copy failed, using temp URI', e);
    return tempUri;
  }
}

/** Delete the on-device photos for a hunt (called when the hunt is deleted). */
export function deleteHuntPhotos(hunt: Hunt): void {
  if (Platform.OS === 'web') return;
  const dirUri = new Directory(Paths.document, 'hunt-photos').uri;
  for (const item of hunt.items) {
    if (!item.photoUri?.startsWith(dirUri)) continue;
    try {
      const file = new File(item.photoUri);
      if (file.exists) file.delete();
    } catch {
      // Already gone; nothing to do.
    }
  }
}

/** Storage path for a photo URL saved by an older build, or null if it isn't one. */
export function legacyPhotoPath(uri: string | undefined): string | null {
  if (!SUPABASE_URL || !uri?.startsWith(LEGACY_PUBLIC_PREFIX)) return null;
  return uri.slice(LEGACY_PUBLIC_PREFIX.length) || null;
}

/**
 * Download one legacy photo from a signed URL into the documents folder.
 * Returns the local URI, or null if the download fails (we retry next launch).
 */
export async function downloadLegacyPhoto(signedUrl: string, path: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const dest = new File(photoDir(), path.replace(/[^A-Za-z0-9_.-]/g, '_'));
    if (dest.exists) return dest.uri;
    const file = await File.downloadFileAsync(signedUrl, dest);
    return file.uri;
  } catch (e) {
    if (__DEV__) console.warn('[downloadLegacyPhoto] failed', e);
    return null;
  }
}
