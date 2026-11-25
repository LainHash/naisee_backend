import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryDashboardDto {
  /** Lọc thống kê theo publicId phường/xã */
  @IsOptional()
  @IsUUID()
  wardPublicId?: string;

  /** Lọc thống kê theo tên phường/xã */
  @IsOptional()
  @IsString()
  ward?: string;
}

