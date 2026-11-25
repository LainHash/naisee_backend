import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { IssueStatus, WorkflowStage } from '../../../common/enums/domain.enums.js';

export class QueryIssuesDto extends PaginationQueryDto {
  /** Lọc theo publicId danh mục */
  @IsOptional()
  @IsUUID()
  categoryPublicId?: string;

  /** Lọc theo mã danh mục (ROAD_SURFACE, WASTE, ...) */
  @IsOptional()
  @IsString()
  categoryCode?: string;

  /** Lọc theo trạng thái sự cố */
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  /** Lọc theo phường/xã */
  @IsOptional()
  @IsString()
  ward?: string;

  /** Từ khóa tìm kiếm theo mã hồ sơ, tiêu đề hoặc địa chỉ */
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryMyIssuesDto extends PaginationQueryDto {
  /** Lọc theo trạng thái tổng quát */
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  /** Lọc theo bước nghiệp vụ chi tiết */
  @IsOptional()
  @IsEnum(WorkflowStage)
  stage?: WorkflowStage;
}

export class QueryMapPointsDto {
  /** Lọc theo publicId danh mục */
  @IsOptional()
  @IsUUID()
  categoryPublicId?: string;

  /** Lọc theo mã danh mục (ROAD_SURFACE, WASTE, ...) */
  @IsOptional()
  @IsString()
  categoryCode?: string;

  /** Lọc theo trạng thái sự cố */
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  /** Lọc theo phường/xã */
  @IsOptional()
  @IsString()
  ward?: string;

  /** Từ khóa tìm kiếm theo mã hồ sơ, tiêu đề hoặc địa chỉ */
  @IsOptional()
  @IsString()
  search?: string;

  /** Bounding box dạng minLng,minLat,maxLng,maxLat */
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'bbox phải có dạng minLng,minLat,maxLng,maxLat',
  })
  bbox?: string;

  /** Số điểm tối đa trả về (mặc định 5000, tối đa 10000) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}
