import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RoleName } from '../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { AuthService } from './auth.service.js';
import {
  AuthResponseDto,
  AuthUserDto,
  RoleDto,
} from './dto/auth-response.dto.js';
import { DemoSwitchDto } from './dto/demo-switch.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: 'Đăng nhập bằng SĐT (mật khẩu tùy chọn cho tài khoản demo)' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('auth/demo-switch')
  @ApiOperation({ summary: 'Chuyển nhanh tài khoản demo theo vai trò (CITIZEN/STAFF/VOLUNTEER)' })
  demoSwitch(@Body() dto: DemoSwitchDto): Promise<AuthResponseDto> {
    return this.authService.demoSwitch(dto);
  }

  @ApiBearerAuth()
  @Get('auth/me')
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  getMe(@CurrentUser('id') userId: number): Promise<AuthUserDto> {
    return this.authService.getMe(userId);
  }

  @ApiBearerAuth()
  @Patch('auth/me/preferences')
  @ApiOperation({ summary: 'Cập nhật chế độ chữ lớn (largeTextMode)' })
  updatePreferences(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<AuthUserDto> {
    return this.authService.updatePreferences(userId, dto);
  }

  @Public()
  @Get('roles')
  @ApiOperation({ summary: 'Lấy danh sách vai trò hệ thống' })
  getRoles(): Promise<RoleDto[]> {
    return this.authService.getRoles();
  }

  @ApiBearerAuth()
  @Roles(RoleName.STAFF)
  @Get('auth/staff-check')
  @ApiOperation({ summary: 'Endpoint kiểm tra phân quyền STAFF (trả 403 nếu là CITIZEN/VOLUNTEER)' })
  staffCheck(@CurrentUser() user: AuthenticatedUser): {
    allowed: boolean;
    role: RoleName;
  } {
    return { allowed: true, role: user.role };
  }
}

