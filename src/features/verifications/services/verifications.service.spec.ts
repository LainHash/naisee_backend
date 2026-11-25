import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';
import {
  IssueStatus,
  RoleName,
  VerificationOutcome,
  VerificationStatus,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { IssueGeoService } from '../../issues/services/issue-geo.service.js';
import { VerificationsService } from './verifications.service.js';

describe('VerificationsService', () => {
  const volunteerUser: AuthenticatedUser = {
    id: 3,
    publicId: 'vol-user-uuid',
    phone: '0901000003',
    fullName: 'Bạn Hùng',
    role: RoleName.VOLUNTEER,
    ward: 'Phường Trấn Biên',
    departmentId: null,
  };

  function createHarness() {
    const verificationRow = {
      id: 10,
      publicId: 'verif-uuid-1',
      issueId: 50,
      requestedById: 2,
      volunteerId: null as number | null,
      status: VerificationStatus.OPEN,
      instruction: 'Kiểm tra thực tế',
      dueAt: null,
      outcome: null as VerificationOutcome | null,
      isIssueConfirmed: null as boolean | null,
      verifiedLatitude: null as number | null,
      verifiedLongitude: null as number | null,
      safetyRiskNote: null as string | null,
      resultNote: null as string | null,
      completedAt: null as Date | null,
      media: [],
      volunteer: null,
      issue: {
        id: 50,
        publicId: 'issue-uuid-50',
        code: 'HT-2026-050',
        title: 'Test issue',
        description: 'Desc',
        status: IssueStatus.VERIFYING,
        stage: WorkflowStage.VERIFICATION_REQUESTED,
        priority: 'MEDIUM',
        latitude: 10.9465,
        longitude: 106.8425,
        addressText: 'Trấn Biên',
        ward: 'Phường Trấn Biên',
        thumbnailUrl: null,
        reportCount: 1,
        dueAt: null,
        category: {
          publicId: 'cat-uuid',
          code: 'WASTE',
          name: 'Rác thải',
          icon: 'trash',
        },
        media: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProgressRepo = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: Record<string, unknown>) => data),
    };
    const mockIssueRepo = {
      findOne: vi.fn(async () => verificationRow.issue),
      findOneByOrFail: vi.fn(async () => verificationRow.issue),
      save: vi.fn(async (entity: unknown) => entity),
    };
    const mockMediaRepo = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: unknown) => data),
    };
    let affectedRows = 1;
    const qb = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn(async () => [verificationRow]),
      getManyAndCount: vi.fn(async () => [[verificationRow], 1]),
    };
    const mockVerificationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      findOne: vi.fn(async () => verificationRow),
      save: vi.fn(async (entity: unknown) => entity),
      manager: {
        transaction: vi.fn(async (cb: (m: unknown) => Promise<unknown>) =>
          cb({
            getRepository: vi.fn((entity: { name?: string }) => {
              if (entity?.name === 'Issue') return mockIssueRepo;
              if (entity?.name === 'ProgressUpdate') return mockProgressRepo;
              if (entity?.name === 'IssueMedia') return mockMediaRepo;
              return mockVerificationRepo;
            }),
            createQueryBuilder: vi.fn(() => ({
              update: vi.fn().mockReturnThis(),
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              execute: vi.fn(async () => ({ affected: affectedRows })),
            })),
          }),
        ),
      },
    };

    const issuesService = {
      buildIdentifierWhere: vi.fn((id: string) => ({ publicId: id })),
    };

    const service = new VerificationsService(
      mockVerificationRepo as never,
      mockIssueRepo as never,
      issuesService as never,
      new IssueGeoService(),
    );

    return {
      service,
      qb,
      verificationRow,
      setAffectedRows: (n: number) => {
        affectedRows = n;
      },
    };
  }

  it('throws ConflictException when two volunteers claim the same task concurrently', async () => {
    const { service, setAffectedRows } = createHarness();
    setAffectedRows(0);

    await expect(
      service.claimVerification('verif-uuid-1', volunteerUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('completes verification and sets VERIFICATION_SUBMITTED without resolving the issue', async () => {
    const { service, verificationRow } = createHarness();
    verificationRow.status = VerificationStatus.IN_PROGRESS;
    verificationRow.volunteerId = volunteerUser.id;

    const result = await service.submitVerification(
      'verif-uuid-1',
      volunteerUser,
      {
        outcome: VerificationOutcome.STILL_EXISTS,
        verifiedLatitude: 10.9466,
        verifiedLongitude: 106.8426,
        resultNote: 'Đúng thực tế ngoài hiện trường',
        imageUrls: ['https://res.cloudinary.com/demo/image/upload/v1/verify.jpg'],
      },
    );

    expect(result.status).toBe(VerificationStatus.COMPLETED);
    expect(result.outcome).toBe(VerificationOutcome.STILL_EXISTS);
    expect(verificationRow.issue.stage).toBe(
      WorkflowStage.VERIFICATION_SUBMITTED,
    );
    expect(verificationRow.issue.status).toBe(IssueStatus.VERIFYING);
  });

  it('filters volunteer verification tasks by ward and geo radius', async () => {
    const { service, qb } = createHarness();

    const res = await service.findVolunteerList(volunteerUser, {
      ward: 'Trấn Biên',
      lat: 10.9465,
      lng: 106.8425,
      radiusMeters: 1000,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('LOWER(issue.ward) LIKE :ward', {
      ward: '%trấn biên%',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'issue.latitude BETWEEN :minLat AND :maxLat AND issue.longitude BETWEEN :minLng AND :maxLng',
      expect.objectContaining({
        minLat: expect.any(Number),
        maxLat: expect.any(Number),
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.data[0].distanceMeters).toBe(0);
  });
});
