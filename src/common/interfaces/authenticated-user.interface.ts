import type { RoleName } from '../enums/domain.enums.js';

export interface AuthenticatedUser {
  id: number;
  publicId: string;
  role: RoleName;
  fullName: string;
  phone: string;
  ward: string;
  departmentId: number | null;
}

export interface JwtPayload {
  sub: number;
  publicId: string;
  role: RoleName;
  fullName: string;
  phone: string;
  ward: string;
  departmentId: number | null;
}

