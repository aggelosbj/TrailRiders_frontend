import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { showMessage } from './dialogs';

/** Longest side of uploaded photos (px) and JPEG quality — keeps uploads small (~150-400 KB) */
const MAX_SIDE = 1280;
const QUALITY = 0.7;

/**
 * Lets the user pick a photo from the gallery and returns it as a compressed base64 JPEG data URI
 * (stored directly in the database, like the existing rides).
 */
export async function pickImage(aspect: [number, number] = [16, 9]): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showMessage('Permission needed', 'Allow access to your photos to add a picture.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  try {
    return await compress(asset.uri, asset.width, asset.height);
  } catch {
    // Fallback: ask the picker for base64 directly (lower quality)
    const retry = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.4, base64: true });
    if (retry.canceled || !retry.assets?.[0]?.base64) return null;
    return `data:${retry.assets[0].mimeType ?? 'image/jpeg'};base64,${retry.assets[0].base64}`;
  }
}

/** Resize so the longest side is at most MAX_SIDE and re-encode as JPEG */
export async function compress(uri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('No image data');
  return `data:image/jpeg;base64,${saved.base64}`;
}
