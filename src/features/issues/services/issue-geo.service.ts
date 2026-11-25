import { Injectable } from '@nestjs/common';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface GeoBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

@Injectable()
export class IssueGeoService {
  /**
   * Calculates great-circle distance in meters using the Haversine formula.
   */
  calculateDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(EARTH_RADIUS_METERS * c);
  }

  /**
   * Computes a lat/lng bounding box enclosing a circle of radiusMeters (with small safety margin)
   * so SQL queries can pre-filter candidates before exact Haversine checks.
   */
  calculateBoundingBox(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): GeoBoundingBox {
    const safeRadius = Math.max(0, radiusMeters) * 1.02 + 10;
    const dLat = (safeRadius / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const cosLat = Math.max(0.01, Math.cos(toRadians(lat)));
    const dLng = (safeRadius / (EARTH_RADIUS_METERS * cosLat)) * (180 / Math.PI);

    return {
      minLat: Math.max(-90, lat - dLat),
      maxLat: Math.min(90, lat + dLat),
      minLng: Math.max(-180, lng - dLng),
      maxLng: Math.min(180, lng + dLng),
    };
  }
}

