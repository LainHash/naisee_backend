import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Priority } from '../../../common/enums/domain.enums.js';

export class ClassifyImageDto {
  /** URL ảnh đã upload (VD: secure_url từ Cloudinary) */
  @IsString()
  @IsNotEmpty({ message: 'imageUrl không được để trống' })
  imageUrl: string;

  /** Ghi chú hoặc tên file gợi ý thêm ngữ cảnh (tùy chọn) */
  @IsOptional()
  @IsString()
  hint?: string;
}

export class ClassifyImageResultDto {
  categoryPublicId: string;
  categoryCode: string;
  categoryName: string;
  confidence: number;
  suggestedTitle: string;
  suggestedPriority: Priority;
  isMocked: boolean;
}

