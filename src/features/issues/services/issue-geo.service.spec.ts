import { IssueGeoService } from './issue-geo.service.js';

describe('IssueGeoService', () => {
  const geo = new IssueGeoService();

  it('returns 0 for identical coordinates', () => {
    expect(geo.calculateDistanceMeters(10.9512, 106.8245, 10.9512, 106.8245)).toBe(0);
  });

  it('calculates approximate Haversine distance in meters around Bien Hoa', () => {
    // ~111m per 0.001 degree latitude
    const distance = geo.calculateDistanceMeters(
      10.9512,
      106.8245,
      10.9522,
      106.8245,
    );
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(125);
  });
});

