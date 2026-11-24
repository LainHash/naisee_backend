import { RoleName } from '../../../common/enums/domain.enums.js';

export class AuthUserDto {
  publicId: string;
  fullName: string;
  phone: string;
  role: RoleName;
  departmentId: number | null;
  ward: string;
  largeTextMode: boolean;
  isActive: boolean;
}

export class AuthResponseDto {
  accessToken: string;
  user: AuthUserDto;
}

export class RoleDto {
  publicId: string;
  name: RoleName;
  description: string | null;
}

