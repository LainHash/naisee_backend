import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Citizen registration payload using phone number (passwordless OTP onboarding).
 */
export class RegisterDto {
  /** Họ và tên công dân */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  /** Số điện thoại đăng ký (VD: 0901000099) */
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;

  /** Mật khẩu tùy chọn */
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  /** Phường/xã cư trú mặc định */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ward?: string;
}

