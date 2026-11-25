import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import {
  VerificationOutcome,
  VerificationStatus,
} from '../../../common/enums/domain.enums.js';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class CreateVerificationDto {
  /** Hướng dẫn kiểm tra hiện trường gửi Tình nguyện viên */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string;

  /** Hạn hoàn thành xác minh (ISO datetime) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  /** Số giờ SLA xác minh tính từ hiện tại (mặc định 24h nếu không truyền dueAt) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  slaHours?: number;
}

export class QueryVolunteerVerificationsDto extends PaginationQueryDto {
  /** Lọc theo trạng thái nhiệm vụ (OPEN, IN_PROGRESS, COMPLETED, CANCELLED) */
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  /** Chỉ lấy các nhiệm vụ đã được Tình nguyện viên hiện tại nhận */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  mine?: boolean;

  /** Lọc theo publicId phường/xã */
  @IsOptional()
  @IsUUID()
  wardPublicId?: string;

  /** Lọc theo tên phường/xã */
  @IsOptional()
  @IsString()
  ward?: string;

  /** Vĩ độ tâm tìm nhiệm vụ gần tôi */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  /** Kinh độ tâm tìm nhiệm vụ gần tôi */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** Bán kính tìm nhiệm vụ gần tôi (mét, mặc định 5000m khi truyền lat/lng) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(50000)
  radiusMeters?: number;

  /** Tìm kiếm theo mã hồ sơ, tiêu đề hoặc địa chỉ */
  @IsOptional()
  @IsString()
  search?: string;
}

export class SubmitVerificationDto {
  /** Kết quả xác minh thực địa (3 trạng thái chuẩn) */
  @IsEnum(VerificationOutcome, {
    message:
      'outcome phải thuộc STILL_EXISTS, ALREADY_RESOLVED hoặc NOT_FOUND_OR_UNCLEAR',
  })
  outcome: VerificationOutcome;

  /** Vĩ độ check-in GPS tại hiện trường */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  verifiedLatitude?: number;

  /** Kinh độ check-in GPS tại hiện trường */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  verifiedLongitude?: number;

  /** Ghi chú rủi ro an toàn tại hiện trường */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  safetyRiskNote?: string;

  /** Ghi chú kết quả quan sát thực tế của Tình nguyện viên */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resultNote?: string;

  /** Danh sách URL ảnh chụp thực địa (Cloudinary stage=VERIFICATION) */
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}

