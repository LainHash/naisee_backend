import { AdministrativeUnitType } from '../../common/enums/domain.enums.js';
import type { GeoJsonPolygonGeometry } from './entities/ward.entity.js';

export interface ParsedWardSeed {
  code: string;
  name: string;
  unitType: AdministrativeUnitType;
  provinceName: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  boundaryGeoJson: GeoJsonPolygonGeometry | null;
  isActive: boolean;
}

export interface GeometryBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

const DEFAULT_TRAN_BIEN_RING: number[][] = [
  [106.805, 10.935],
  [106.865, 10.935],
  [106.865, 10.975],
  [106.805, 10.975],
  [106.805, 10.935],
];

/**
 * Baseline seed record so single-ward demo data remains valid before full GeoJSON import.
 */
export const FALLBACK_TRAN_BIEN_WARD: ParsedWardSeed = {
  code: 'DN-TRAN-BIEN',
  name: 'Phường Trấn Biên',
  unitType: AdministrativeUnitType.WARD,
  provinceName: 'Tỉnh Đồng Nai',
  centerLat: 10.9574,
  centerLng: 106.8427,
  defaultZoom: 14,
  minLat: 10.935,
  maxLat: 10.975,
  minLng: 106.805,
  maxLng: 106.865,
  boundaryGeoJson: {
    type: 'Polygon',
    coordinates: [DEFAULT_TRAN_BIEN_RING],
  },
  isActive: true,
};

function pickStringProp(
  props: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const val = props[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
  }
  return null;
}

function slugifyCode(input: string): string {
  return input
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D')
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 28);
}

/**
 * Infers WARD vs COMMUNE from GeoJSON properties or administrative name.
 */
export function detectAdministrativeUnitType(
  props: Record<string, unknown>,
  name: string,
): AdministrativeUnitType {
  const rawType = (
    pickStringProp(props, ['unitType', 'unit_type', 'loai', 'cap', 'type', 'TYPE_3', 'ENGTYPE_3']) ??
    name
  ).toLowerCase();

  if (
    rawType.includes('commune') ||
    rawType.startsWith('xã ') ||
    rawType.includes(' xã ') ||
    rawType === 'xã' ||
    rawType.startsWith('thị trấn')
  ) {
    return AdministrativeUnitType.COMMUNE;
  }
  return AdministrativeUnitType.WARD;
}

/**
 * Normalizes unit display name (adds prefix if GeoJSON only carries the short name).
 */
export function normalizeAdministrativeName(
  rawName: string,
  unitType: AdministrativeUnitType,
): string {
  const trimmed = rawName.trim().replaceAll(/\s+/g, ' ');
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('phường ') ||
    lower.startsWith('xã ') ||
    lower.startsWith('thị trấn ')
  ) {
    return trimmed;
  }
  const prefix =
    unitType === AdministrativeUnitType.COMMUNE ? 'Xã' : 'Phường';
  return `${prefix} ${trimmed}`;
}

function isPolygonGeometry(value: unknown): value is GeoJsonPolygonGeometry {
  if (!value || typeof value !== 'object') return false;
  const geom = value as { type?: unknown; coordinates?: unknown };
  return (
    (geom.type === 'Polygon' || geom.type === 'MultiPolygon') &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length > 0
  );
}

/**
 * Computes bounding box and centroid from a Polygon or MultiPolygon GeoJSON geometry.
 */
export function computeGeometryBounds(
  geometry: GeoJsonPolygonGeometry,
): GeometryBounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  for (const polygon of polygons) {
    const outerRing = polygon[0];
    if (!Array.isArray(outerRing)) continue;
    for (const coord of outerRing) {
      if (!Array.isArray(coord) || coord.length < 2) continue;
      const lng = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      sumLat += lat;
      sumLng += lng;
      count += 1;
    }
  }

  if (count === 0 || !Number.isFinite(minLat)) {
    return null;
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centerLat: Number((sumLat / count).toFixed(6)),
    centerLng: Number((sumLng / count).toFixed(6)),
  };
}

function isPointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInSinglePolygon(
  lat: number,
  lng: number,
  rings: number[][][],
): boolean {
  if (rings.length === 0 || !isPointInRing(lat, lng, rings[0])) {
    return false;
  }
  // Exclude points falling inside interior holes.
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(lat, lng, rings[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether (lat, lng) lies inside a GeoJSON Polygon or MultiPolygon.
 */
export function isPointInPolygonGeometry(
  lat: number,
  lng: number,
  geometry: GeoJsonPolygonGeometry,
): boolean {
  if (geometry.type === 'Polygon') {
    return isPointInSinglePolygon(
      lat,
      lng,
      geometry.coordinates as number[][][],
    );
  }
  const polygons = geometry.coordinates as number[][][][];
  return polygons.some((rings) => isPointInSinglePolygon(lat, lng, rings));
}

/**
 * Parses a GeoJSON FeatureCollection into normalized Ward seed records.
 * Supports common Vietnamese administrative GeoJSON property conventions.
 */
export function parseWardsFromGeoJson(
  raw: unknown,
  options: { activateCommunes?: boolean } = {},
): ParsedWardSeed[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('GeoJSON không hợp lệ: dữ liệu gốc phải là object.');
  }
  const collection = raw as { type?: unknown; features?: unknown };
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('GeoJSON phải có dạng FeatureCollection chứa mảng features.');
  }

  const results: ParsedWardSeed[] = [];
  const usedCodes = new Set<string>();

  for (let idx = 0; idx < collection.features.length; idx++) {
    const feature = collection.features[idx] as {
      id?: unknown;
      properties?: Record<string, unknown>;
      geometry?: unknown;
    };
    if (!feature || !isPolygonGeometry(feature.geometry)) continue;

    const bounds = computeGeometryBounds(feature.geometry);
    if (!bounds) continue;

    const props = feature.properties ?? {};
    const rawName =
      pickStringProp(props, [
        'name',
        'ten_xa',
        'ten',
        'TenXa',
        'ten_dv',
        'ward',
        'NAME_3',
        'VARNAME_3',
      ]) ?? `Đơn vị #${idx + 1}`;

    const unitType = detectAdministrativeUnitType(props, rawName);
    const name = normalizeAdministrativeName(rawName, unitType);

    const rawCode =
      pickStringProp(props, [
        'code',
        'ma_xa',
        'ma_dv',
        'MaXa',
        'wardCode',
        'GID_3',
        'CC_3',
      ]) ??
      (typeof feature.id === 'string' || typeof feature.id === 'number'
        ? String(feature.id)
        : null);

    const baseCode = rawCode
      ? rawCode.trim().slice(0, 32)
      : `DN-${slugifyCode(name) || idx + 1}`;
    let code = baseCode;
    let suffix = 1;
    while (usedCodes.has(code)) {
      code = `${baseCode.slice(0, 27)}-${suffix++}`;
    }
    usedCodes.add(code);

    const provinceName =
      pickStringProp(props, ['provinceName', 'province', 'ten_tinh', 'TenTinh', 'NAME_1']) ??
      'Tỉnh Đồng Nai';

    const explicitActive =
      typeof props.isActive === 'boolean' ? props.isActive : undefined;
    const isActive =
      explicitActive ??
      (unitType === AdministrativeUnitType.WARD ||
        Boolean(options.activateCommunes));

    results.push({
      code,
      name,
      unitType,
      provinceName,
      centerLat: bounds.centerLat,
      centerLng: bounds.centerLng,
      defaultZoom: unitType === AdministrativeUnitType.WARD ? 14 : 13,
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
      boundaryGeoJson: feature.geometry,
      isActive,
    });
  }

  return results;
}

