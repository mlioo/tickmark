import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { captureRef, type ViewShotRef } from "react-native-view-shot";

import { STORY_HEIGHT, STORY_WIDTH } from "./recapStats";

export async function captureRecapSlide(view: ViewShotRef): Promise<string> {
  return captureRef(view, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: STORY_WIDTH,
    height: STORY_HEIGHT
  });
}

/** Ensure a .png path media-library will accept. */
export async function materializeRecapPng(uri: string, filename: string): Promise<string> {
  const dest = new File(Paths.cache, filename);
  if (dest.exists) dest.delete();
  const source = new File(uri);
  await source.copy(dest);
  return dest.uri;
}

export async function shareRecapImage(uri: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(uri, {
    dialogTitle,
    mimeType: "image/png",
    UTI: "public.png"
  });
}

export async function shareRecapSlide(view: ViewShotRef, dialogTitle: string): Promise<string> {
  const uri = await captureRecapSlide(view);
  await shareRecapImage(uri, dialogTitle);
  return uri;
}

export async function ensurePhotoLibraryWriteAccess(): Promise<boolean> {
  const { granted } = await requestPermissionsAsync(true);
  return granted;
}

export async function saveRecapSlideToLibrary(
  view: ViewShotRef,
  filename: string
): Promise<void> {
  const captured = await captureRecapSlide(view);
  const pngUri = await materializeRecapPng(captured, filename);
  await Asset.create(pngUri);
}
