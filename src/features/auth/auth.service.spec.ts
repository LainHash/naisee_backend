import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '../../common/enums/domain.enums.js';
import { AuthService } from './auth.service.js';
import type { Role } from './entities/role.entity.js';
import type { User } from './entities/user.entity.js';

describe('AuthService', () => {
  const citizenRole = {
    id: 1,
    publicId: 'role-uuid-1',
    name: RoleName.CITIZEN,
    description: 'Citizen',
  } as Role;

  const citizenUser = {
    id: 10,
    publicId: 'user-uuid-10',
    roleId: 1,
    role: citizenRole,
    departmentId: null,
    fullName: 'Cô/Chú Minh',
    phone: '0901000001',
    passwordHash: null,
    ward: 'Phường Trấn Biên',
    largeTextMode: false,
    isActive: true,
  } as User;

  function createService() {
    const userRepo = {
      findOne: vi.fn(),
      save: vi.fn(),
    };
    const roleRepo = {
      find: vi.fn(),
    };
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
    } as unknown as JwtService;

    const service = new AuthService(
      userRepo as never,
      roleRepo as never,
      jwtService,
    );
    return { service, userRepo, roleRepo, jwtService };
  }

  it('switches demo role to CITIZEN and issues JWT token', async () => {
    const { service, userRepo } = createService();
    userRepo.findOne.mockResolvedValue(citizenUser);

    const result = await service.demoSwitch({ role: RoleName.CITIZEN });

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { phone: '0901000001' },
      relations: { role: true },
    });
    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.user.role).toBe(RoleName.CITIZEN);
  });

  it('rejects demoSwitch to ADMIN', async () => {
    const { service } = createService();

    await expect(
      service.demoSwitch({ role: RoleName.ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs in demo user by phone with whitespace normalized', async () => {
    const { service, userRepo } = createService();
    userRepo.findOne.mockResolvedValue(citizenUser);

    const result = await service.login({ phone: '0901 000 001' });

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { phone: '0901000001' },
      relations: { role: true },
    });
    expect(result.user.publicId).toBe('user-uuid-10');
  });

  it('throws UnauthorizedException for unknown user', async () => {
    const { service, userRepo } = createService();
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.login({ phone: '0999999999' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates largeTextMode preference', async () => {
    const { service, userRepo } = createService();
    const userCopy = Object.assign(Object.create(null), citizenUser) as User;
    userRepo.findOne.mockResolvedValue(userCopy);
    userRepo.save.mockImplementation(async (u: User) => u);

    const updated = await service.updatePreferences(10, {
      largeTextMode: true,
    });

    expect(updated.largeTextMode).toBe(true);
  });
});
