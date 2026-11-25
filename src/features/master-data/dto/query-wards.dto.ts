import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { AdministrativeUnitType } from '../../../common/enums/domain.enums.js';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class QueryWardsDto {
  /** Lọc theo loại đơn vị hành chính (WARD | COMMUNE) */
  @IsOptional()
  @IsEnum(AdministrativeUnitType)
  unitType?: AdministrativeUnitType;

  /** Bao gồm ranh giới polygon GeoJSON để vẽ viền trên bản đồ */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeBoundary?: boolean;

  /** Bao gồm các đơn vị hành chính đang tạm tắt kích hoạt */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}

export class ResolveWardQueryDto {
  /** Vĩ độ cần xác định phường/xã (WGS84) */
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  /** Kinh độ cần xác định phường/xã (WGS84) */
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

