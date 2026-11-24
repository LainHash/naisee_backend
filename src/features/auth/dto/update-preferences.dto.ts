import { IsBoolean } from 'class-validator';

/**
 * Updates user accessibility preferences such as large text mode.
 */
export class UpdatePreferencesDto {
  /** Bật/tắt chế độ chữ lớn cho người cao tuổi */
  @IsBoolean()
  largeTextMode: boolean;
}

