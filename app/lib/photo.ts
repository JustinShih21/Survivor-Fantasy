/** Max width for Fandom thumbnails - higher for better quality on cards */
const FANDOM_THUMB_WIDTH = 320;

/** Max width for Fandom images in modal/closeup - full quality */
const FANDOM_MODAL_WIDTH = 800;

/**
 * Returns a smaller Fandom image URL for faster loading.
 * Fandom supports: /revision/latest/scale-to-width-down/{width}
 */
function getFandomThumbUrl(url: string, maxWidth: number = FANDOM_THUMB_WIDTH): string {
  if (
    !url.includes("static.wikia.nocookie.net") &&
    !url.includes("images.wikia.nocookie.net")
  ) {
    return url;
  }
  // Replace /revision/latest with /revision/latest/scale-to-width-down/{width}
  return url.replace(
    /\/revision\/latest\/?$/,
    `/revision/latest/scale-to-width-down/${maxWidth}`
  );
}

/**
 * Returns the URL to use for displaying a contestant photo.
 * Proxies Fandom/Wikia URLs through our API to avoid hotlink blocking.
 * @param maxWidth - For Fandom: scale-to-width-down value. Default 320 for cards. Use 800+ for modal/closeup.
 */
export function getDisplayPhotoUrl(
  photoUrl: string | undefined,
  fallbackId: string,
  maxWidth: number = FANDOM_THUMB_WIDTH
): string {
  const url = photoUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${fallbackId}&size=80`;
  if (
    url.includes("static.wikia.nocookie.net") ||
    url.includes("images.wikia.nocookie.net")
  ) {
    const thumbUrl = getFandomThumbUrl(url, maxWidth);
    return `/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`;
  }
  return url;
}

/** High-res photo URL for modal/closeup (800px width) */
export function getHighResPhotoUrl(photoUrl: string | undefined, fallbackId: string): string {
  return getDisplayPhotoUrl(photoUrl, fallbackId, FANDOM_MODAL_WIDTH);
}
