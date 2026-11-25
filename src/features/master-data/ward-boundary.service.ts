import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Ward } from './entities/ward.entity.js';
import { isPointInPolygonGeometry } from './ward-geojson.utils.js';

/**
 * In-memory spatial resolver for Dong Nai wards using bounding-box pre-filter
 * and GeoJSON Point-in-Polygon matching.
 */
@Injectable()
export class WardBoundaryService {
  private cachedWards: Ward[] | null = null;

  constructor(
    @InjectRepository(Ward)
    private readonly wardRepo: Repository<Ward>,
  ) {}

  async reloadCache(): Promise<Ward[]> {
    this.cachedWards = await this.wardRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return this.cachedWards;
  }

  async getActiveWards(): Promise<Ward[]> {
    if (!this.cachedWards) {
      return this.reloadCache();
    }
    return this.cachedWards;
  }

  /**
   * Resolves the active Ward/Commune containing (lat, lng).
   * Prioritizes exact polygon containment, then falls back to smallest-area bbox match.
   */
  async resolveByCoordinates(lat: number, lng: number): Promise<Ward | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    const wards = await this.getActiveWards();
    const bboxMatches = wards.filter(
      (ward) =>
        lat >= ward.minLat &&
        lat <= ward.maxLat &&
        lng >= ward.minLng &&
        lng <= ward.maxLng,
    );

    if (bboxMatches.length === 0) {
      return null;
    }

    for (const ward of bboxMatches) {
      if (
        ward.boundaryGeoJson &&
        isPointInPolygonGeometry(lat, lng, ward.boundaryGeoJson)
      ) {
        return ward;
      }
    }

    // Only fall back to bbox when a ward lacks polygon geometry (e.g. pre-import baseline).
    const withoutPolygon = bboxMatches.filter((w) => !w.boundaryGeoJson);
    if (withoutPolygon.length === 0) {
      return null;
    }

    return withoutPolygon.sort((a, b) => {
      const areaA = (a.maxLat - a.minLat) * (a.maxLng - a.minLng);
      const areaB = (b.maxLat - b.minLat) * (b.maxLng - b.minLng);
      return areaA - areaB;
    })[0];
  }

  /**
   * Finds an active Ward/Commune by publicId (UUID), code, or normalized Vietnamese name.
   */
  async findActiveWard(params: {
    wardPublicId?: string;
    wardName?: string;
  }): Promise<Ward | null> {
    const wards = await this.getActiveWards();

    if (params.wardPublicId?.trim()) {
      const targetId = params.wardPublicId.trim().toLowerCase();
      const byId = wards.find((w) => w.publicId.toLowerCase() === targetId);
      if (byId) return byId;
    }

    if (params.wardName?.trim()) {
      const target = params.wardName.trim().toLowerCase();
      const exact = wards.find(
        (w) =>
          w.name.trim().toLowerCase() === target ||
          w.code.trim().toLowerCase() === target,
      );
      if (exact) return exact;

      const withoutPrefixMatches = wards.filter((w) => {
        const stripped = w.name
          .trim()
          .toLowerCase()
          .replace(/^(phường|xã|thị trấn)\s+/, '');
        return stripped === target;
      });
      if (withoutPrefixMatches.length === 1) {
        return withoutPrefixMatches[0];
      }
    }

    return null;
  }
}

