import { NotFoundException } from '@nestjs/common';
import {
  FeedbackReviewStatus,
  IssueStatus,
  MediaStage,
  Priority,
  RoleName,
  TimelineAction,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { Issue } from '../entities/issue.entity.js';
import { IssueGeoService } from './issue-geo.service.js';
import { IssuesService } from './issues.service.js';

describe('IssuesService (public queries)', () => {
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
          phone: '0901000001',
          fullName: 'Cô/Chú Minh',
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
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(issues),
      getManyAndCount: vi.fn().mockResolvedValue([issues, issues.length]),
    };

    const issueRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      findOne: vi.fn().mockResolvedValue(issues[0] ?? null),
    };
    const categoryRepo = {
      findOne: vi.fn().mockResolvedValue({ code: 'ROAD_SURFACE' }),
    };

    return {
      service: new IssuesService(
        issueRepo as never,
        categoryRepo as never,
        new IssueGeoService(),
      ),
      issueRepo,
      qb,
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
    expect(results[0].publicReview.verified).toBe(true);
    expect(results[0].assignedUnit).toBe('Đội duy tu đường bộ');
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
    expect(JSON.stringify(res)).not.toContain('0901000001');
  });

  it('returns public detail with stage, previousStage/newStage, timestamp and zero PII', async () => {
    const { service, issueRepo } = createService();

    const detail = await service.findPublicDetail('ht-2026-001');

    expect(issueRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'HT-2026-001' } }),
    );
    expect(detail.stage).toBe(WorkflowStage.WORK_ACCEPTED);
    expect(detail.intakeNote).toBe('Ưu tiên xử lý sớm trước mùa mưa');
    expect(detail.timeline[0].previousStage).toBeNull();
    expect(detail.timeline[0].newStage).toBe(WorkflowStage.UNASSIGNED);
    expect(detail.timeline[0].timestamp).toEqual(detail.timeline[0].createdAt);
    expect(detail.timeline[0].actorLabel).toBe('Người dân');

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('0901000001');
    expect(serialized).not.toContain('Cô/Chú Minh');
  });

  it('throws NotFoundException when issue is private or missing', async () => {
    const { service } = createService([]);

    await expect(service.findPublicDetail('HT-9999-999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
