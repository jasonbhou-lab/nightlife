import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Picking and preparing a photo for upload (F-MEDIA-01).
 *
 * F-MEDIA-05 asks for location and device metadata to be stripped before
 * upload. Two layers here:
 *  - `exif: false` keeps EXIF out of the picker's own result object.
 *  - The image is always re-encoded through the manipulator, even when no
 *    resize is otherwise needed. Producing a new JPEG drops embedded EXIF
 *    (including GPS tags) as a side effect of how virtually every encoder
 *    works, though neither Expo package documents that as a contractual
 *    guarantee. Good enough for this build; a product with a real
 *    compliance requirement here should verify server-side, not trust this
 *    alone.
 */

export type PickedPhoto = { uri: string; width: number; height: number };

const MAX_DIMENSION = 1600;

async function prepare(uri: string, width: number): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: Math.min(width, MAX_DIMENSION) });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export async function pickPhoto(source: 'library' | 'camera'): Promise<PickedPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return prepare(asset.uri, asset.width);
}
