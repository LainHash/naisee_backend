import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedbackReviewStatus,
  IssueStatus,
  MediaStage,
  Priority,
  ReportType,
  RoleName,
  TimelineAction,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type { Issue } from '../entities/issue.entity.js';
import { IssueGeoService } from './issue-geo.service.js';
import { IssuePriorityService } from './issue-priority.service.js';
import { IssuesService } from './issues.service.js';

describe('IssuesService (public & citizen flows)', () => {
  const citizenUser: AuthenticatedUser = {
    id: 1,
    publicId: 'user-uuid-1',
    role: RoleName.CITIZEN,
    fullName: 'Cô/Chú Minh',
    phone: '0901000001',
    ward: 'Phường Trấn Biên',
    departmentId: null,
  };

  const baseIssue = {
    id: 1,
    publicId: 'issue-uuid-1',
    code: 'HT-2026-001',
    title: 'Ổ gà gây mất an toàn giao thông',
    description: 'Mặt đường bong tróc',
    categoryId: 1,
    category: {
      id: 1,
      publicId: 'cat-uuid-1',
      code: 'ROAD_SURFACE',
      name: 'Mặt đường / Ổ gà',
      icon: 'construction',
      defaultPriority: Priority.HIGH,
      slaHours: 72,
    },
    status: IssueStatus.IN_PROGRESS,
    stage: WorkflowStage.WORK_ACCEPTED,
    priority: Priority.HIGH,
    suggestedPriority: Priority.HIGH,
    latitude: 10.9512,
    longitude: 106.8245,
    addressText: 'Đường CMT8, Phường Trấn Biên',
    ward: 'Phường Trấn Biên',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/before.jpg',
    reportCount: 8,
    createdById: 10,
    assignedDepartmentId: 1,
    assignedDepartment: {
      id: 1,
      publicId: 'dept-uuid-1',
      code: 'ROAD_MAINTENANCE',
      name: 'Đội duy tu đường bộ',
    },
    dueAt: new Date('2020-01-01T00:00:00.000Z'), // overdue
    resolvedAt: null,
    intakeNote: 'Ưu tiên xử lý sớm trước mùa mưa',
    resolutionNote: null,
    rejectionReason: null,
    isPublic: true,
    publicReviewVerified: true,
    publicApprovedAt: new Date('2026-11-23T08:00:00.000Z'),
    isDuplicate: false,
    duplicateOfId: null,
    needsReopenReview: false,
    aiSuggestedCategoryId: 1,
    aiConfidence: 0.92,
    media: [
      {
        publicId: 'media-uuid-1',
        stage: MediaStage.BEFORE,
        url: 'https://res.cloudinary.com/demo/image/upload/before.jpg',
        caption: 'Ảnh trước',
        createdAt: new Date('2026-11-23T08:00:00.000Z'),
      },
    ],
    progressUpdates: [
      {
        publicId: 'prog-uuid-1',
        actionType: TimelineAction.CREATED,
        fromStatus: null,
        toStatus: IssueStatus.PENDING_REVIEW,
        previousStage: null,
        newStage: WorkflowStage.UNASSIGNED,
        content: 'Đã gửi phản ánh',
        isPublic: true,
        actor: {
          id: 10,
          phone: '0901000004',
          fullName: 'Anh Tuấn',
          role: { name: RoleName.CITIZEN },
        },
        createdAt: new Date('2026-11-23T08:00:00.000Z'),
      },
    ],
    feedbacks: [
      {
        publicId: 'fb-uuid-1',
        isSatisfied: true,
        rating: 5,
        comment: 'Tốt',
        reviewStatus: FeedbackReviewStatus.ACKNOWLEDGED,
        createdAt: new Date('2026-11-24T08:00:00.000Z'),
      },
    ],
    createdAt: new Date('2026-11-23T08:00:00.000Z'),
    updatedAt: new Date('2026-11-23T09:00:00.000Z'),
  } as unknown as Issue;

  function createService(issues: Issue[] = [baseIssue]) {
    const qb = {
      innerJoin: vi.fn().mockReturnThis(),
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      setParameter: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(issues.length),
      getMany: vi.fn().mockResolvedValue(issues),
      getManyAndCount: vi.fn().mockResolvedValue([issues, issues.length]),
    };

    const txIssueRepo = {
      find: vi.fn().mockResolvedValue([{ id: 56 }]),
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: Record<string, unknown>) => ({
        id: 57,
        publicId: 'issue-uuid-57',
        ...data,
      })),
    };
    const txReportRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: Record<string, unknown>) => ({
        id: 65,
        ...data,
      })),
    };
    const txMediaRepo = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: unknown) => data),
    };
    const txProgressRepo = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: unknown) => data),
    };

    const manager = {
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
      getRepository: vi.fn().mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getMany: vi.fn().mockResolvedValue([
            { issueId: 1, reportType: ReportType.ME_TOO },
          ]),
        }),
      }),
    };

    const issueRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      findOne: vi.fn().mockResolvedValue(issues[0] ?? null),
      manager,
    };
    const categoryRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        publicId: 'cat-uuid-1',
        code: 'ROAD_SURFACE',
        name: 'Mặt đường / Ổ gà',
        defaultPriority: Priority.HIGH,
      }),
    };

    return {
      service: new IssuesService(
        issueRepo as never,
        categoryRepo as never,
        new IssueGeoService(),
        new IssuePriorityService(),
      ),
      issueRepo,
      qb,
      txIssueRepo,
      txReportRepo,
      txProgressRepo,
    };
  }

  it('applies publicReview & IN_PROGRESS/RESOLVED filter in public nearby mode', async () => {
    const { service, qb } = createService();

    const results = await service.findNearby({
      lat: 10.9512,
      lng: 106.8245,
      radiusMeters: 500,
      forDuplicateCheck: false,
      limit: 10,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'issue.publicReviewVerified = :publicReviewVerified',
      { publicReviewVerified: true },
    );
    expect(results).toHaveLength(1);
    expect(results[0].stage).toBe(WorkflowStage.WORK_ACCEPTED);
    expect(results[0].distanceMeters).toBe(0);
    expect(results[0].isOverdue).toBe(true);
  });

  it('allows pending issues when forDuplicateCheck=true', async () => {
    const { service, qb } = createService();

    await service.findNearby({
      lat: 10.9512,
      lng: 106.8245,
      radiusMeters: 200,
      forDuplicateCheck: true,
      limit: 10,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'issue.status != :rejectedStatus',
      { rejectedStatus: IssueStatus.REJECTED },
    );
  });

  it('returns paginated public list without PII', async () => {
    const { service } = createService();

    const res = await service.findPublicList({ page: 1, limit: 10 });

    expect(res.success).toBe(true);
    expect(res.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(JSON.stringify(res)).not.toContain('0901000004');
  });

  it('returns public detail with stage, previousStage/newStage, timestamp and zero PII', async () => {
    const { service, issueRepo } = createService();

    const detail = await service.findPublicDetail('ht-2026-001');

    expect(issueRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'HT-2026-001' } }),
    );
    expect(detail.stage).toBe(WorkflowStage.WORK_ACCEPTED);
    expect(detail.timeline[0].newStage).toBe(WorkflowStage.UNASSIGNED);

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('0901000004');
    expect(serialized).not.toContain('Anh Tuấn');
  });

  it('throws NotFoundException when issue is private or missing', async () => {
    const { service } = createService([]);

    await expect(service.findPublicDetail('HT-9999-999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a new issue in PENDING_REVIEW / unassigned inside a transaction', async () => {
    const { service, txIssueRepo, txReportRepo, txProgressRepo } = createService();

    const res = await service.createIssue(citizenUser, {
      categoryCode: 'ROAD_SURFACE',
      title: 'Ổ gà mới trước cổng trường học',
      latitude: 10.952,
      longitude: 106.825,
      addressText: '12 Đường 30/4, Phường Trấn Biên',
      imageUrls: ['https://res.cloudinary.com/demo/image/upload/new.jpg'],
      aiSuggestedCategoryCode: 'ROAD_SURFACE',
      aiConfidence: 0.91,
    });

    expect(txIssueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'HT-2026-057',
        status: IssueStatus.PENDING_REVIEW,
        stage: WorkflowStage.UNASSIGNED,
        suggestedPriority: Priority.CRITICAL,
      }),
    );
    expect(txReportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reportType: ReportType.INITIAL }),
    );
    expect(txProgressRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: TimelineAction.CREATED,
        newStage: WorkflowStage.UNASSIGNED,
      }),
    );
    expect(res.code).toBe('HT-2026-001'); // mocked findOne returns baseIssue
  });

  it('throws BadRequestException when creating issue without category', async () => {
    const { service } = createService();

    await expect(
      service.createIssue(citizenUser, {
        title: 'Thiếu danh mục',
        latitude: 10.95,
        longitude: 106.82,
        addressText: 'Phường Trấn Biên',
        imageUrls: ['https://res.cloudinary.com/demo/image/upload/new.jpg'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds ME_TOO report, increments reportCount, and prevents duplicate me-too from same user', async () => {
    const mutableIssue = Object.assign(Object.create(null), baseIssue, {
      reportCount: 8,
    }) as Issue;
    const { service, txReportRepo, txIssueRepo } = createService([mutableIssue]);

    await service.addMeToo('HT-2026-001', citizenUser, {});

    expect(txIssueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reportCount: 9 }),
    );

    txReportRepo.findOne.mockResolvedValueOnce({ id: 99 });
    await expect(
      service.addMeToo('HT-2026-001', citizenUser, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns my issues including report types and intakeNote', async () => {
    const { service } = createService();

    const res = await service.findMyIssues(citizenUser.id, {
      page: 1,
      limit: 10,
    });

    expect(res.success).toBe(true);
    expect(res.data[0].myReportTypes).toEqual([ReportType.ME_TOO]);
    expect(res.data[0].intakeNote).toBe('Ưu tiên xử lý sớm trước mùa mưa');
  });

  it('returns lightweight map points with optional bbox filtering', async () => {
    const { service, qb } = createService();

    const res = await service.findMapPoints({
      bbox: '106.80,10.90,106.90,11.00',
      limit: 5000,
    });

    expect(res.total).toBe(1);
    expect(res.points).toEqual([
      expect.objectContaining({
        publicId: 'issue-uuid-1',
        code: 'HT-2026-001',
        latitude: 10.9512,
        longitude: 106.8245,
        categoryCode: 'ROAD_SURFACE',
      }),
    ]);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'issue.longitude BETWEEN :minLng AND :maxLng AND issue.latitude BETWEEN :minLat AND :maxLat',
      { minLng: 106.8, maxLng: 106.9, minLat: 10.9, maxLat: 11 },
    );
  });
});
