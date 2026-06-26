/**
 * JS-side marker clustering for react-native-maps, backed by supercluster.
 *
 * Replaces react-native-map-clustering (unmaintained; crashes under the new
 * architecture with `AIRGoogleMap insertReactSubview: object cannot be nil`).
 * Clusters are computed in JS from the current viewport region, so the number
 * of native <Marker> views actually rendered stays bounded — which is what
 * keeps memory in check on dense maps.
 */

import { useMemo } from 'react';
import type { Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import type { MapPin } from '@/lib/api/spots';

export interface ClusterItem {
  type: 'cluster' | 'pin';
  /** Stable React key. */
  id: string;
  latitude: number;
  longitude: number;
  /** Set when type === 'cluster'. */
  count?: number;
  /** Set when type === 'cluster'; feed to getClusterExpansionRegion. */
  clusterId?: number;
  /** Set when type === 'pin'. */
  pin?: MapPin;
}

/** Web-mercator zoom level implied by the visible longitude span. */
function regionToZoom(region: Region): number {
  const angle = region.longitudeDelta <= 0 ? 360 : region.longitudeDelta;
  return Math.round(Math.log2(360 / angle));
}

export function useMapClusters(pins: MapPin[], region: Region | null) {
  const index = useMemo(() => {
    const sc = new Supercluster({ radius: 50, maxZoom: 18, minPoints: 3 });
    sc.load(
      pins
        .filter((p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map((p) => ({
          type: 'Feature' as const,
          properties: { pin: p },
          geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
        })),
    );
    return sc;
  }, [pins]);

  const clusters = useMemo<ClusterItem[]>(() => {
    if (!region) return [];
    const zoom = regionToZoom(region);
    const bbox: [number, number, number, number] = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude + region.latitudeDelta / 2,
    ];
    return index.getClusters(bbox, zoom).map((f) => {
      const [longitude, latitude] = f.geometry.coordinates;
      const props = f.properties;
      if (props.cluster) {
        return {
          type: 'cluster' as const,
          id: `cluster-${props.cluster_id}`,
          latitude,
          longitude,
          count: props.point_count as number,
          clusterId: props.cluster_id as number,
        };
      }
      const pin = props.pin as MapPin;
      return { type: 'pin' as const, id: pin._id, latitude, longitude, pin };
    });
  }, [index, region]);

  /** Region the map should animate to when a cluster bubble is tapped. */
  function getClusterExpansionRegion(
    clusterId: number,
    latitude: number,
    longitude: number,
  ): Region {
    let zoom = 14;
    try {
      zoom = index.getClusterExpansionZoom(clusterId);
    } catch {
      // Fall back to a reasonable zoom-in if the cluster id is stale.
    }
    const delta = 360 / 2 ** Math.min(zoom, 20);
    return { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta };
  }

  return { clusters, getClusterExpansionRegion };
}
