import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FeedbackReviewStatus } from '../../../common/enums/domain.enums.js';

export class CreateFeedbackDto {
  /** Người dân đánh giá hài lòng (true) hay chưa hài lòng (false) */
  @IsBoolean()
  isSatisfied: boolean;

  /** Điểm đánh giá 1-5 sao (tùy chọn) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  /** Lý do nếu chưa hài lòng hoặc yêu cầu mở lại */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  /** Nhận xét thêm của người dân */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReviewFeedbackDto {
  /** Quyết định của cán bộ: ACKNOWLEDGED (ghi nhận) hoặc REOPENED (mở lại hồ sơ) */
  @IsIn([FeedbackReviewStatus.ACKNOWLEDGED, FeedbackReviewStatus.REOPENED], {
    message: 'reviewStatus phải là ACKNOWLEDGED hoặc REOPENED',
  })
  reviewStatus: FeedbackReviewStatus.ACKNOWLEDGED | FeedbackReviewStatus.REOPENED;

  /** Ghi chú xử lý phản hồi của cán bộ */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;

  /** Nếu mở lại và cần phân công lại bộ phận khác (đưa về RECEIVED/received) */
  @IsOptional()
  @IsBoolean()
  reassignToDepartment?: boolean;

  /** Hạn SLA mới khi mở lại hồ sơ */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  /** Hoặc gia hạn thêm theo số giờ SLA */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  slaHours?: number;
}

