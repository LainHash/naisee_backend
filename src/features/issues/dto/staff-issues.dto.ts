import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import {
  IssueStatus,
  Priority,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class QueryStaffIssuesDto extends PaginationQueryDto {
  /** Lọc theo trạng thái tổng quát */
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  /** Lọc theo bước nghiệp vụ chi tiết */
  @IsOptional()
  @IsEnum(WorkflowStage)
  stage?: WorkflowStage;

  /** Lọc theo mức độ ưu tiên */
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** Lọc theo publicId danh mục */
  @IsOptional()
  @IsUUID()
  categoryPublicId?: string;

  /** Lọc theo mã danh mục */
  @IsOptional()
  @IsString()
  categoryCode?: string;

  /** Lọc theo publicId bộ phận phụ trách */
  @IsOptional()
  @IsUUID()
  departmentPublicId?: string;

  /** Lọc theo id nội bộ hoặc publicId bộ phận phụ trách */
  @IsOptional()
  @IsString()
  departmentId?: string;

  /** Chỉ lấy các hồ sơ đang quá hạn */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  overdue?: boolean;

  /** Chỉ lấy các hồ sơ bị dân đánh giá chưa hài lòng cần xem xét mở lại */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  needsReopenReview?: boolean;

  /** Bao gồm cả hồ sơ đã đánh dấu trùng lặp */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDuplicates?: boolean;

  /** Tìm kiếm theo mã hồ sơ, tiêu đề hoặc địa chỉ */
  @IsOptional()
  @IsString()
  search?: string;
}

export class TriageIssueDto {
  /** Cập nhật publicId danh mục (tùy chọn) */
  @IsOptional()
  @IsUUID()
  categoryPublicId?: string;

  /** Cập nhật mã danh mục (tùy chọn) */
  @IsOptional()
  @IsString()
  categoryCode?: string;

  /** Chốt mức ưu tiên (tùy chọn) */
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** Bật true để chuyển sang bước yêu cầu người dân bổ sung thông tin */
  @IsOptional()
  @IsBoolean()
  needsInformation?: boolean;

  /** Ghi chú tiếp nhận / nội dung yêu cầu bổ sung gửi người dân */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  intakeNote?: string;
}

export class RejectIssueDto {
  /** Lý do không tiếp nhận hồ sơ */
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối tiếp nhận' })
  @MaxLength(1000)
  rejectionReason: string;
}

export class AssignIssueDto {
  /** publicId bộ phận phụ trách */
  @IsOptional()
  @IsUUID()
  departmentPublicId?: string;

  /** Mã bộ phận phụ trách (thay thế departmentPublicId) */
  @IsOptional()
  @IsString()
  departmentCode?: string;

  /** Hạn xử lý cụ thể (ISO date) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  /** Số giờ SLA tính từ hiện tại nếu không truyền dueAt */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  slaHours?: number;

  /** Chốt lại mức ưu tiên khi giao việc */
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** Bước chi tiết sau khi giao (department_assigned hoặc work_accepted) */
  @IsOptional()
  @IsIn([WorkflowStage.DEPARTMENT_ASSIGNED, WorkflowStage.WORK_ACCEPTED])
  stage?: WorkflowStage.DEPARTMENT_ASSIGNED | WorkflowStage.WORK_ACCEPTED;

  /** Ghi chú chỉ đạo của cán bộ */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** Tùy chọn duyệt hiển thị công khai ngay khi giao xử lý */
  @IsOptional()
  @IsBoolean()
  publicReviewVerified?: boolean;
}

export class UpdatePublicReviewDto {
  /** Phê chuẩn (true) hoặc gỡ duyệt công khai (false) */
  @IsBoolean()
  verified: boolean;

  /** Ghi chú nội bộ khi duyệt công khai */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MergeIssuesDto {
  /** Danh sách publicId hoặc code các hồ sơ trùng cần gộp vào hồ sơ chính */
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 hồ sơ nguồn để gộp' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  sourceIssuePublicIds: string[];

  /** Ghi chú lý do gộp trùng */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SupplementIssueDto {
  /** Thông tin người dân bổ sung theo yêu cầu của cán bộ */
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung bổ sung' })
  @MaxLength(1500)
  content: string;
}

