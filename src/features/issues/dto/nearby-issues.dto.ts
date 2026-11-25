import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { IssueStatus } from '../../../common/enums/domain.enums.js';

export class NearbyIssuesQueryDto {
  /** Vĩ độ tâm tìm kiếm (VD: 10.9512) */
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  /** Kinh độ tâm tìm kiếm (VD: 106.8245) */
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  /** Bán kính tìm kiếm tính bằng mét (mặc định 500m) */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(20000)
  radiusMeters: number = 500;

  /** Lọc theo publicId danh mục */
  @IsOptional()
  @IsUUID()
  categoryPublicId?: string;

  /** Lọc theo mã danh mục (ROAD_SURFACE, WASTE, ...) */
  @IsOptional()
  @IsString()
  categoryCode?: string;

  /** Lọc theo trạng thái xử lý */
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  /** Số lượng kết quả tối đa (mặc định 30) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}

