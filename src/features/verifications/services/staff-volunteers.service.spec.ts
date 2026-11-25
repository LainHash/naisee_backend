import { NotFoundException } from '@nestjs/common';
import {
  RoleName,
  VerificationOutcome,
  VerificationStatus,
} from '../../../common/enums/domain.enums.js';
import type { User } from '../../auth/entities/user.entity.js';
import { StaffVolunteersService } from './staff-volunteers.service.js';

describe('StaffVolunteersService', () => {
  const volunteerRow = {
    id: 5,
    publicId: 'vol-uuid-5',
    fullName: 'Lê Hoàng Nam',
    phone: '0901000003',
    ward: 'Phường Trấn Biên',
    isActive: true,
    createdAt: new Date('2026-11-20T08:00:00.000Z'),
    role: { name: RoleName.VOLUNTEER },
  } as unknown as User;

  function createService(found: User | null = volunteerRow) {
    const userQb = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(found ? [found] : []),
      getOne: vi.fn().mockResolvedValue(found),
    };
    const userRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(userQb),
      save: vi.fn(async (u: User) => u),
    };
    const tasks = [
      {
        volunteerId: 5,
        status: VerificationStatus.COMPLETED,
        outcome: VerificationOutcome.STILL_EXISTS,
      },
      {
        volunteerId: 5,
        status: VerificationStatus.IN_PROGRESS,
        outcome: null,
      },
    ];
    const verifQb = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(tasks),
    };
    const verificationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(verifQb),
      find: vi.fn().mockResolvedValue(tasks),
    };

    const service = new StaffVolunteersService(
      userRepo as never,
      verificationRepo as never,
    );
    return { service, userRepo };
  }

  it('lists volunteers with verification stats', async () => {
    const { service } = createService();

    const list = await service.listVolunteers();

    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(
      expect.objectContaining({
        publicId: 'vol-uuid-5',
        fullName: 'Lê Hoàng Nam',
        totalVerified: 1,
        activeClaims: 1,
        reliabilityScore: 100,
      }),
    );
  });

  it('toggles volunteer active status and throws when missing', async () => {
    const { service, userRepo } = createService();

    const updated = await service.updateStatus('vol-uuid-5', false);
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    expect(updated.isActive).toBe(false);

    const missing = createService(null);
    await expect(
      missing.service.updateStatus('missing-id', false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

