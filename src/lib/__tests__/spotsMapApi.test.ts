import { type MapPin, normalizeMapPinsResponse } from '../api/spots';

const pin: MapPin = {
  _id: 'spot-1',
  name: 'Test Spot',
  latitude: 32.7,
  longitude: -117.1,
};

describe('normalizeMapPinsResponse', () => {
  it('reads the viewport v2 envelope', () => {
    expect(
      normalizeMapPinsResponse({ type: 'pins', dataVersion: 'test-version', items: [pin] }),
    ).toEqual([pin]);
  });

  it('keeps legacy array compatibility during rollout', () => {
    expect(normalizeMapPinsResponse([pin])).toEqual([pin]);
  });
});
