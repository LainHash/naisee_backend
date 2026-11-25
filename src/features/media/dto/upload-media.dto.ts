import { IsEnum, IsOptional } from 'class-validator';
import { MediaStage } from '../../../common/enums/domain.enums.js';

export class UploadMediaDto {
  /** Giai đoạn ảnh minh chứng (BEFORE, VERIFICATION, AFTER) */
  @IsOptional()
  @IsEnum(MediaStage)
  stage?: MediaStage = MediaStage.BEFORE;
}

export class UploadMediaResponseDto {
  url: string;
  stage: MediaStage;
}

