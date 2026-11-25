import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdministrativeUnitType,
  Priority,
} from '../../../common/enums/domain.enums.js';
import type { GeoJsonPolygonGeometry } from '../entities/ward.entity.js';

export class DepartmentSummaryDto {
  publicId: string;
  code: string;
  name: string;
}

export class CategoryDto {
  publicId: string;
  code: string;
  name: string;
  defaultPriority: Priority;
  slaHours: number;
  icon: string | null;
  defaultDepartment: DepartmentSummaryDto | null;
}

export class DepartmentDto {
  publicId: string;
  code: string;
  name: string;
  contactPhone: string | null;
  description: string | null;
}

export class WardDto {
  publicId: string;
  code: string;
  name: string;
  unitType: AdministrativeUnitType;
  provinceName: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;

  @ApiProperty({
    type: [Number],
    description: 'Bounding box [minLng, minLat, maxLng, maxLat]',
    example: [106.812, 10.93, 106.85, 10.968],
  })
  bbox: [number, number, number, number];

  isActive: boolean;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'GeoJSON Polygon hoặc MultiPolygon ranh giới phường/xã',
  })
  boundaryGeoJson?: GeoJsonPolygonGeometry | null;
}

export class ResolveWardResponseDto {
  inServiceArea: boolean;
  ward: WardDto | null;
}

