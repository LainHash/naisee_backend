import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * Login payload using phone number (password optional for demo accounts).
 */
export class LoginDto {
  /** Số điện thoại đăng nhập (VD: 0901000001) */
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;

  /** Mật khẩu (tùy chọn với tài khoản demo không đặt passwordHash) */
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}

