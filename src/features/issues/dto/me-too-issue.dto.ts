import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class MeTooIssueDto {
  /** Ghi chú bổ sung của người dân khi bấm "Tôi cũng gặp vấn đề này" */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Vĩ độ tại thời điểm người dân xác nhận */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  /** Kinh độ tại thời điểm người dân xác nhận */
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** Địa chỉ mô tả tại điểm người dân ghi nhận */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  /** Ảnh bổ sung (tùy chọn nếu người dân đã chụp ở Bước 1 trước khi chọn trùng) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imageUrls?: string[];
}

