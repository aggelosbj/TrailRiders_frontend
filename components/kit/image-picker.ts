import * as ImagePicker from 'expo-image-picker';

import { showMessage } from './dialogs';

/**
 * Lets the user pick a photo from the gallery and returns it as a base64 data URI
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
    quality: 0.5,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  if (asset.base64) {
    return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  }
  // Web returns a data URI in `uri`
  return asset.uri.startsWith('data:') ? asset.uri : null;
}
