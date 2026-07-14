/**
 * Project a lat/lng to an {x,y} screen point within a map viewport.
 *
 * react-native-maps' <Marker> crashes AIRGoogleMap under the New Architecture
 * ("insertReactSubview: object cannot be nil"), and we can't disable the new
 * arch (reanimated 4 requires it). So we render markers as normal RN Views
 * layered on top of an (empty) MapView, positioned with this projection.
 *
 * Longitude maps linearly across the viewport; latitude uses Web Mercator (what
 * Google Maps uses) so markers don't drift vertically. Returns null for points
 * comfortably off-screen so callers can skip rendering them.
 */

export interface ProjRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export function projectToScreen(
  lat: number,
  lng: number,
  region: ProjRegion | null,
  layout: { width: number; height: number },
): { x: number; y: number } | null {
  if (!region || !layout.width || !layout.height) return null;
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  const west = longitude - longitudeDelta / 2;
  const x = ((lng - west) / longitudeDelta) * layout.width;

  const mercY = (l: number) => Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360));
  const yN = mercY(latitude + latitudeDelta / 2);
  const yS = mercY(latitude - latitudeDelta / 2);
  const y = ((yN - mercY(lat)) / (yN - yS)) * layout.height;

  if (x < -60 || x > layout.width + 60 || y < -80 || y > layout.height + 40) return null;
  return { x, y };
}

/**
 * Like projectToScreen, but NEVER returns null for an off-screen point — instead
 * it returns the coordinates plus an `onScreen` flag. Callers keep the marker
 * view MOUNTED and merely hide it (opacity/pointerEvents) when off-screen.
 *
 * This is critical on the New Architecture: unmounting a touch-target view while
 * a UIKit touch is still active desyncs Fabric's touch registry and hard-crashes
 * ("Inconsistency between local and UIKit touch registries", RN #53303). Keeping
 * markers mounted during pan/zoom removes that trigger.
 */
export function projectToScreenXY(
  lat: number,
  lng: number,
  region: ProjRegion | null,
  layout: { width: number; height: number },
): { x: number; y: number; onScreen: boolean } | null {
  if (!region || !layout.width || !layout.height) return null;
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  const west = longitude - longitudeDelta / 2;
  const x = ((lng - west) / longitudeDelta) * layout.width;

  const mercY = (l: number) => Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360));
  const yN = mercY(latitude + latitudeDelta / 2);
  const yS = mercY(latitude - latitudeDelta / 2);
  const y = ((yN - mercY(lat)) / (yN - yS)) * layout.height;

  const onScreen = !(x < -60 || x > layout.width + 60 || y < -80 || y > layout.height + 40);
  return { x, y, onScreen };
}
