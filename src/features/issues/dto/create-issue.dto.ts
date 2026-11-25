import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateIssueDto {
  /** publicId (UUID) của loại sự cố (từ GET /categories hoặc AI gợi ý) */
  @IsOptional()
  @IsUUID()
  categoryPublicId?: string;

  /** Mã loại sự cố (VD: ROAD_SURFACE, WASTE) — dùng thay thế nếu không truyền categoryPublicId */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryCode?: string;

  /** Tiêu đề ngắn gọn mô tả sự cố */
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề sự cố không được để trống' })
  @MaxLength(255)
  title: string;

  /** Mô tả chi tiết bổ sung của người dân (tùy chọn) */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Vĩ độ vị trí hiện trường */
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  /** Kinh độ vị trí hiện trường */
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  /** Địa chỉ mô tả vị trí sự cố */
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ hiện trường không được để trống' })
  @MaxLength(500)
  addressText: string;

  /** Phường/xã (mặc định Phường Trấn Biên) */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ward?: string;

  /** Danh sách URL ảnh minh chứng BEFORE đã upload lên Cloudinary */
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng đính kèm ít nhất 1 ảnh hiện trường' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imageUrls: string[];

  /** publicId loại sự cố do AI gợi ý ở Bước 1 (tùy chọn, dùng để đối chiếu) */
  @IsOptional()
  @IsUUID()
  aiSuggestedCategoryPublicId?: string;

  /** Mã loại sự cố do AI gợi ý ở Bước 1 (tùy chọn) */
  @IsOptional()
  @IsString()
  aiSuggestedCategoryCode?: string;

  /** Độ tin cậy AI trả về ở Bước 1 (0..1) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidence?: number;
}

