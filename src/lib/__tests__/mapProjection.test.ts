import { type ProjRegion, projectToScreen } from '@/lib/mapProjection';

const region: ProjRegion = {
  latitude: 33.77,
  longitude: -118.19,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};
const layout = { width: 400, height: 800 };

describe('projectToScreen', () => {
  it('maps the region centre to the centre of the layout', () => {
    const point = projectToScreen(region.latitude, region.longitude, region, layout);
    expect(point).not.toBeNull();
    expect(point?.x).toBeCloseTo(200, 5);
    // Mercator is not linear in latitude, so the vertical centre is only
    // approximately the layout centre at this zoom.
    expect(point?.y).toBeCloseTo(400, 0);
  });

  it('maps the north-west corner to the top-left and south-east to bottom-right', () => {
    const nw = projectToScreen(
      region.latitude + region.latitudeDelta / 2,
      region.longitude - region.longitudeDelta / 2,
      region,
      layout,
    );
    expect(nw?.x).toBeCloseTo(0, 5);
    expect(nw?.y).toBeCloseTo(0, 5);

    const se = projectToScreen(
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region,
      layout,
    );
    expect(se?.x).toBeCloseTo(layout.width, 5);
    expect(se?.y).toBeCloseTo(layout.height, 5);
  });

  it('returns null for points comfortably off-screen', () => {
    expect(projectToScreen(region.latitude, region.longitude + 1, region, layout)).toBeNull();
    expect(projectToScreen(region.latitude + 1, region.longitude, region, layout)).toBeNull();
  });

  it('returns null without a region or a measured layout', () => {
    expect(projectToScreen(33.77, -118.19, null, layout)).toBeNull();
    expect(projectToScreen(33.77, -118.19, region, { width: 0, height: 0 })).toBeNull();
  });
});
