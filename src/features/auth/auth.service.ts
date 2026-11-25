import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import type { Repository } from 'typeorm';
import { RoleName } from '../../common/enums/domain.enums.js';
import type { JwtPayload } from '../../common/interfaces/authenticated-user.interface.js';
import type {
  AuthResponseDto,
  AuthUserDto,
  RoleDto,
} from './dto/auth-response.dto.js';
import type { DemoSwitchDto } from './dto/demo-switch.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { Role } from './entities/role.entity.js';
import { User } from './entities/user.entity.js';

const DEMO_PHONE_BY_ROLE: Partial<Record<RoleName, string>> = {
  [RoleName.CITIZEN]: '0901000001',
  [RoleName.STAFF]: '0901000002',
  [RoleName.VOLUNTEER]: '0901000003',
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly jwtService: JwtService,
  ) {}

  private normalizePhone(phone: string): string {
    const cleaned = phone.replaceAll(/[\s-]/g, '');
    return cleaned.startsWith('+84') ? `0${cleaned.slice(3)}` : cleaned;
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const normalizedPhone = this.normalizePhone(dto.phone);
    const user = await this.userRepo.findOne({
      where: { phone: normalizedPhone },
      relations: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    if (user.passwordHash) {
      if (!dto.password || !this.verifyPassword(dto.password, user.passwordHash)) {
        throw new UnauthorizedException('Số điện thoại hoặc mật khẩu không đúng');
      }
    }

    return this.buildAuthResponse(user);
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const normalizedPhone = this.normalizePhone(dto.phone);
    const existing = await this.userRepo.findOne({
      where: { phone: normalizedPhone },
    });
    if (existing) {
      throw new ConflictException(
        'Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.',
      );
    }

    const citizenRole = await this.roleRepo.findOne({
      where: { name: RoleName.CITIZEN },
    });
    if (!citizenRole) {
      throw new NotFoundException(
        'Chưa khởi tạo vai trò CITIZEN trong hệ thống. Hãy chạy seed trước.',
      );
    }

    const created = this.userRepo.create({
      roleId: citizenRole.id,
      role: citizenRole,
      departmentId: null,
      fullName: dto.fullName?.trim() || 'Người dân Đồng Nai',
      phone: normalizedPhone,
      passwordHash: null,
      ward: dto.ward?.trim() || 'Phường Trấn Biên',
      wardId: null,
      largeTextMode: false,
      isActive: true,
    });
    const saved = await this.userRepo.save(created);
    saved.role = citizenRole;

    return this.buildAuthResponse(saved);
  }

  async demoSwitch(dto: DemoSwitchDto): Promise<AuthResponseDto> {
    const demoPhone = DEMO_PHONE_BY_ROLE[dto.role];
    if (!demoPhone) {
      throw new BadRequestException(
        'Demo switcher chỉ hỗ trợ các vai trò CITIZEN, STAFF, VOLUNTEER',
      );
    }

    const user = await this.userRepo.findOne({
      where: { phone: demoPhone },
      relations: { role: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản demo cho vai trò ${dto.role}. Hãy chạy npm run seed trước.`,
      );
    }

    return this.buildAuthResponse(user);
  }

  async getMe(userId: number): Promise<AuthUserDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return this.toUserDto(user);
  }

  async updatePreferences(
    userId: number,
    dto: UpdatePreferencesDto,
  ): Promise<AuthUserDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    user.largeTextMode = dto.largeTextMode;
    const saved = await this.userRepo.save(user);
    return this.toUserDto(saved);
  }

  async getRoles(): Promise<RoleDto[]> {
    const roles = await this.roleRepo.find({ order: { id: 'ASC' } });
    return roles.map((role) => ({
      publicId: role.publicId,
      name: role.name,
      description: role.description,
    }));
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      publicId: user.publicId,
      role: user.role.name,
      fullName: user.fullName,
      phone: user.phone,
      ward: user.ward,
      departmentId: user.departmentId,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      user: this.toUserDto(user),
    };
  }

  private toUserDto(user: User): AuthUserDto {
    return {
      publicId: user.publicId,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role.name,
      departmentId: user.departmentId,
      ward: user.ward,
      largeTextMode: user.largeTextMode,
      isActive: user.isActive,
    };
  }

  private verifyPassword(plain: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, expectedHex] = parts;
    const derived = scryptSync(plain, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }
}

