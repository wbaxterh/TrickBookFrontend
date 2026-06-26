/**
 * Minimal ambient types for `supercluster` (the package ships no bundled types
 * and we don't depend on @types/supercluster). Covers only the surface we use.
 */
declare module 'supercluster' {
  export interface SuperclusterOptions {
    radius?: number;
    maxZoom?: number;
    minZoom?: number;
    minPoints?: number;
    extent?: number;
    nodeSize?: number;
  }

  export interface PointFeature {
    type: 'Feature';
    // Cluster/point properties are dynamic (cluster_id, point_count, or our pin).
    // biome-ignore lint/suspicious/noExplicitAny: heterogeneous feature properties
    properties: any;
    geometry: { type: 'Point'; coordinates: [number, number] };
  }

  export default class Supercluster {
    constructor(options?: SuperclusterOptions);
    load(points: PointFeature[]): this;
    getClusters(bbox: [number, number, number, number], zoom: number): PointFeature[];
    getClusterExpansionZoom(clusterId: number): number;
    getLeaves(clusterId: number, limit?: number, offset?: number): PointFeature[];
  }
}
