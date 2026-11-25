import { BadRequestException } from '@nestjs/common';
import {
  IssueStatus,
  Priority,
  RoleName,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type { Issue } from '../entities/issue.entity.js';
import { IssuePriorityService } from './issue-priority.service.js';
import { StaffIssuesService } from './staff-issues.service.js';

describe('StaffIssuesService', () => {
  const staffUser: AuthenticatedUser = {
    id: 2,
    publicId: 'staff-uuid-2',
    role: RoleName.STAFF,
    fullName: 'Chị Lan',
    phone: '0901000002',
    ward: 'Phường Trấn Biên',
    departmentId: 1,
  };

  function makeIssue(overrides: Partial<Issue> = {}): Issue {
    return {
      id: 10,
      publicId: 'issue-uuid-10',
      code: 'HT-2026-010',
      title: 'Ổ gà đường 30/4',
      description: 'Mặt đường bong tróc',
      categoryId: 1,
      status: IssueStatus.PENDING_REVIEW,
      stage: WorkflowStage.UNASSIGNED,
      priority: Priority.MEDIUM,
      suggestedPriority: Priority.MEDIUM,
      priorityReason: 'Theo mức mặc định',
      latitude: 10.952,
      longitude: 106.825,
      addressText: 'Số 88 đường 30/4',
      ward: 'Phường Trấn Biên',
      thumbnailUrl: 'https://res.cloudinary.com/demo/before.jpg',
      reportCount: 2,
      createdById: 1,
      assignedDepartmentId: null,
      assignedById: null,
      dueAt: null,
      resolvedAt: null,
      intakeNote: null,
      resolutionNote: null,
      rejectionReason: null,
      isPublic: true,
      publicReviewVerified: false,
      publicApprovedAt: null,
      isDuplicate: false,
      duplicateOfId: null,
      needsReopenReview: false,
      aiSuggestedCategoryId: null,
      aiConfidence: null,
      createdAt: new Date('2026-11-24T08:00:00Z'),
      updatedAt: new Date('2026-11-24T08:00:00Z'),
      category: {
        id: 1,
        publicId: 'cat-uuid-1',
        code: 'ROAD_SURFACE',
        name: 'Mặt đường / Ổ gà',
        defaultDepartmentId: 1,
        defaultPriority: Priority.HIGH,
        slaHours: 72,
        icon: 'road',
        isActive: true,
      },
      assignedDepartment: null,
      ...overrides,
    } as unknown as Issue;
  }

  function createHarness(issues: Issue[]) {
    const qb = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([issues, issues.length]),
    };

    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const txIssueRepo = {
      save: vi.fn(async (entity: Issue) => entity),
    };
    const txReportRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(updateBuilder),
    };
    const txMediaRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(updateBuilder),
    };
    const txProgressRepo = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: unknown) => data),
    };

    const issueRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      findOne: vi.fn(async ({ where }: { where: { publicId?: string; code?: string } }) =>
        issues.find(
          (i) =>
            (where.publicId && i.publicId === where.publicId) ||
            (where.code && i.code === where.code),
        ) ?? null,
      ),
      manager: {
        transaction: vi.fn(
          async (
            cb: (m: {
              getRepository: (e: { name?: string }) => unknown;
            }) => Promise<unknown>,
          ) =>
            cb({
              getRepository: (entity: { name?: string }) => {
                if (entity.name === 'Issue') return txIssueRepo;
                if (entity.name === 'Report') return txReportRepo;
                if (entity.name === 'IssueMedia') return txMediaRepo;
                return txProgressRepo;
              },
            }),
        ),
      },
    };

    const departmentRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        publicId: 'dept-uuid-1',
        code: 'ROAD_MAINTENANCE',
        name: 'Đội duy tu đường bộ',
        isActive: true,
      }),
    };

    const issuesService = {
      buildIdentifierWhere: (id: string) =>
        id.startsWith('HT-') ? { code: id } : { publicId: id },
      resolveCategory: vi.fn().mockResolvedValue(issues[0].category),
      toPublicSummary: vi.fn((issue: Issue) => ({
        publicId: issue.publicId,
        code: issue.code,
        title: issue.title,
        status: issue.status,
        stage: issue.stage,
        priority: issue.priority,
        reportCount: issue.reportCount,
      })),
      findDetailByIdentifier: vi.fn(async (id: string) => {
        const found = issues.find((i) => i.publicId === id || i.code === id);
        return {
          publicId: found?.publicId,
          code: found?.code,
          status: found?.status,
          stage: found?.stage,
          priority: found?.priority,
          reportCount: found?.reportCount,
          rejectionReason: found?.rejectionReason ?? null,
          intakeNote: found?.intakeNote ?? null,
          publicReview: {
            verified: found?.publicReviewVerified ?? false,
            approvedAt: found?.publicApprovedAt ?? null,
          },
        };
      }),
    };

    return {
      service: new StaffIssuesService(
        issueRepo as never,
        departmentRepo as never,
        issuesService as never,
        new IssuePriorityService(),
      ),
      issuesService: issuesService as never,
      qb,
      txProgressRepo,
      updateBuilder,
    };
  }

  it('triages PENDING_REVIEW issue to RECEIVED and supports needs_information', async () => {
    const issue = makeIssue();
    const { service } = createHarness([issue]);

    const res = await service.triageIssue('HT-2026-010', staffUser, {
      priority: Priority.HIGH,
    });
    expect(res.status).toBe(IssueStatus.RECEIVED);
    expect(res.stage).toBe(WorkflowStage.RECEIVED);
    expect(res.priority).toBe(Priority.HIGH);

    await expect(
      service.triageIssue('HT-2026-010', staffUser, { needsInformation: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an intake issue with REJECTED status and not_accepted stage', async () => {
    const issue = makeIssue();
    const { service } = createHarness([issue]);

    const res = await service.rejectIssue('HT-2026-010', staffUser, {
      rejectionReason: 'Không thuộc phạm vi quản lý phường',
    });
    expect(res.status).toBe(IssueStatus.REJECTED);
    expect(res.stage).toBe(WorkflowStage.NOT_ACCEPTED);
    expect(res.rejectionReason).toBe('Không thuộc phạm vi quản lý phường');
  });

  it('assigns department and dueAt moving issue to IN_PROGRESS', async () => {
    const issue = makeIssue({ status: IssueStatus.RECEIVED, stage: WorkflowStage.RECEIVED });
    const { service } = createHarness([issue]);

    const res = await service.assignIssue('HT-2026-010', staffUser, {
      departmentPublicId: 'dept-uuid-1',
      slaHours: 24,
      publicReviewVerified: true,
    });
    expect(res.status).toBe(IssueStatus.IN_PROGRESS);
    expect(res.stage).toBe(WorkflowStage.DEPARTMENT_ASSIGNED);
    expect(res.publicReview.verified).toBe(true);
  });

  it('merges duplicate source issue into target and adds reportCount', async () => {
    const target = makeIssue({ id: 10, publicId: 'issue-uuid-10', code: 'HT-2026-010', reportCount: 2 });
    const source = makeIssue({ id: 11, publicId: 'issue-uuid-11', code: 'HT-2026-011', reportCount: 3 });
    const { service, updateBuilder } = createHarness([target, source]);

    const res = await service.mergeIssues('HT-2026-010', staffUser, {
      sourceIssuePublicIds: ['HT-2026-011'],
    });

    expect(res.reportCount).toBe(5);
    expect(source.isDuplicate).toBe(true);
    expect(source.duplicateOfId).toBe(target.id);
    expect(updateBuilder.execute).toHaveBeenCalledTimes(2);
  });

  it('filters staff issues by ward or wardPublicId without cross-ward restriction', async () => {
    const issue = makeIssue();
    const { service, qb } = createHarness([issue]);

    await service.findStaffList({
      ward: 'Long Khánh',
      wardPublicId: 'ward-uuid-11',
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'wardUnit.publicId = :wardPublicId',
      { wardPublicId: 'ward-uuid-11' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('LOWER(issue.ward) LIKE :ward', {
      ward: '%long khánh%',
    });
  });
});

