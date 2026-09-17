/**
 * Kaori's 3D model is lazy-loaded from the CDN on first stage-open (instead of
 * bundling ~13MB in the app) and cached to the device, so subsequent opens are
 * local and instant.
 *
 * The cache filename is versioned — bump the version (here AND the hosted file
 * name on the website) to ship a new model without a stale cache.
 */

import { cacheDirectory, createDownloadResumable, getInfoAsync } from 'expo-file-system/legacy';

const VRM_VERSION = 'v1';
const VRM_URL = `https://thetrickbook.com/kaori/kaori-mobile-${VRM_VERSION}.vrm`;
const CACHE_PATH = `${cacheDirectory}kaori-mobile-${VRM_VERSION}.vrm`;
// A valid VRM is multiple MB; anything smaller is a truncated/failed download.
const MIN_VALID_BYTES = 1_000_000;

/**
 * Ensure the model is on disk and return its local file URI. Downloads it the
 * first time (reporting 0→1 progress); returns the cached path thereafter.
 */
export async function ensureKaoriVrm(onProgress?: (fraction: number) => void): Promise<string> {
  const info = await getInfoAsync(CACHE_PATH);
  if (info.exists && (info.size ?? 0) >= MIN_VALID_BYTES) {
    onProgress?.(1);
    return CACHE_PATH;
  }

  const resumable = createDownloadResumable(VRM_URL, CACHE_PATH, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress?.(Math.min(1, p.totalBytesWritten / p.totalBytesExpectedToWrite));
    }
  });

  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error('Kaori model download failed');

  // Guard against a partial/HTML-error download slipping through.
  const after = await getInfoAsync(result.uri);
  if (!after.exists || (after.size ?? 0) < MIN_VALID_BYTES) {
    throw new Error('Kaori model download was incomplete');
  }
  return result.uri;
}
