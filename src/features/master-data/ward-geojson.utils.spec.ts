import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdministrativeUnitType } from '../../common/enums/domain.enums.js';
import {
  computeGeometryBounds,
  isPointInPolygonGeometry,
  parseWardsFromGeoJson,
} from './ward-geojson.utils.js';

describe('ward-geojson.utils', () => {
  it('computes bounds and centroid for Polygon geometry', () => {
    const bounds = computeGeometryBounds({
      type: 'Polygon',
      coordinates: [
        [
          [106.8, 10.9],
          [106.9, 10.9],
          [106.9, 11.0],
          [106.8, 11.0],
          [106.8, 10.9],
        ],
      ],
    });

    expect(bounds).toEqual({
      minLat: 10.9,
      maxLat: 11.0,
      minLng: 106.8,
      maxLng: 106.9,
      centerLat: 10.94,
      centerLng: 106.84,
    });
  });

  it('detects point inside polygon and excludes interior holes', () => {
    const donutPolygon = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [106.8, 10.9],
          [106.9, 10.9],
          [106.9, 11.0],
          [106.8, 11.0],
          [106.8, 10.9],
        ],
        [
          [106.83, 10.93],
          [106.87, 10.93],
          [106.87, 10.97],
          [106.83, 10.97],
          [106.83, 10.93],
        ],
      ],
    };

    expect(isPointInPolygonGeometry(10.91, 106.81, donutPolygon)).toBe(true);
    expect(isPointInPolygonGeometry(10.95, 106.85, donutPolygon)).toBe(false);
    expect(isPointInPolygonGeometry(11.1, 106.85, donutPolygon)).toBe(false);
  });

  it('parses Vietnamese FeatureCollection and activates WARD units by default', () => {
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            ma_xa: '25993',
            ten_xa: 'Trấn Biên',
            loai: 'Phường',
            ten_tinh: 'Tỉnh Đồng Nai',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [106.81, 10.94],
                [106.85, 10.94],
                [106.85, 10.97],
                [106.81, 10.97],
                [106.81, 10.94],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            ma_xa: '26100',
            ten_xa: 'Xã An Viễn',
            loai: 'Xã',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [107.0, 10.85],
                [107.05, 10.85],
                [107.05, 10.9],
                [107.0, 10.9],
                [107.0, 10.85],
              ],
            ],
          },
        },
      ],
    };

    const parsed = parseWardsFromGeoJson(featureCollection);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      code: '25993',
      name: 'Phường Trấn Biên',
      unitType: AdministrativeUnitType.WARD,
      provinceName: 'Tỉnh Đồng Nai',
      isActive: true,
    });
    expect(parsed[1]).toMatchObject({
      code: '26100',
      name: 'Xã An Viễn',
      unitType: AdministrativeUnitType.COMMUNE,
      isActive: false,
    });
  });

  it('loads the bundled 23 Dong Nai wards GeoJSON and resolves sample points', () => {
    const geojsonPath = resolve(
      import.meta.dirname,
      '../../core/database/seeds/data/dong-nai-wards.geojson',
    );
    const raw: unknown = JSON.parse(readFileSync(geojsonPath, 'utf8'));
    const wards = parseWardsFromGeoJson(raw);

    expect(wards).toHaveLength(23);
    expect(wards.every((w) => w.unitType === AdministrativeUnitType.WARD && w.isActive)).toBe(
      true,
    );

    const tranBien = wards.find((w) => w.code === 'DN-TRAN-BIEN');
    expect(tranBien?.boundaryGeoJson).toBeTruthy();
    expect(
      isPointInPolygonGeometry(10.9512, 106.8245, tranBien!.boundaryGeoJson!),
    ).toBe(true);

    const longKhanh = wards.find((w) => w.code === 'DN-LONG-KHANH');
    expect(
      isPointInPolygonGeometry(10.935, 107.238, longKhanh!.boundaryGeoJson!),
    ).toBe(true);
  });
});

