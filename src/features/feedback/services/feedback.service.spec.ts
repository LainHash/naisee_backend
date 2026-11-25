import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import {
  FeedbackReviewStatus,
  IssueStatus,
  RoleName,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { FeedbackService } from './feedback.service.js';

describe('FeedbackService', () => {
  const citizenUser: AuthenticatedUser = {
    id: 1,
    publicId: 'citizen-uuid',
    phone: '0901000001',
    fullName: 'Chú Minh',
    role: RoleName.CITIZEN,
    ward: 'Phường Trấn Biên',
    departmentId: null,
  };

  const staffUser: AuthenticatedUser = {
    id: 2,
    publicId: 'staff-uuid',
    phone: '0901000002',
    fullName: 'Chị Lan',
    role: RoleName.STAFF,
    ward: 'Phường Trấn Biên',
    departmentId: 1,
  };

  function createHarness(initialStatus = IssueStatus.RESOLVED) {
    const issueRow = {
      id: 1,
      publicId: 'issue-uuid-1',
      code: 'HT-2026-001',
      status: initialStatus,
      stage: WorkflowStage.COMPLETED,
      assignedDepartmentId: 2,
      needsReopenReview: false,
      dueAt: null as Date | null,
      resolvedAt: new Date() as Date | null,
    };

    const feedbackRow = {
      id: 11,
      publicId: 'fb-uuid-11',
      issueId: 1,
      citizenId: 1,
      isSatisfied: false,
      rating: 2,
      reason: 'Chưa sạch hoàn toàn',
      comment: 'Chưa sạch hoàn toàn',
      reviewStatus: FeedbackReviewStatus.SUBMITTED,
      reviewedById: null as number | null,
      reviewNote: null as string | null,
    };

    const mockProgressRepo = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: Record<string, unknown>) => data),
    };
    const mockFeedbackRepo = {
      findOne: vi.fn(async () => feedbackRow),
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (entity: unknown) => entity),
      manager: {
        transaction: vi.fn(async (cb: (m: unknown) => Promise<unknown>) =>
          cb({
            getRepository: vi.fn((entity: { name?: string }) => {
              if (entity?.name === 'Issue') return mockIssueRepo;
              if (entity?.name === 'ProgressUpdate') return mockProgressRepo;
              return mockFeedbackRepo;
            }),
          }),
        ),
      },
    };
    const mockIssueRepo = {
      findOne: vi.fn(async () => issueRow),
      findOneByOrFail: vi.fn(async () => issueRow),
      save: vi.fn(async (entity: unknown) => entity),
    };
    const issuesService = {
      buildIdentifierWhere: vi.fn((id: string) => ({ publicId: id })),
      findPublicDetail: vi.fn(async () => ({
        publicId: issueRow.publicId,
        needsReopenReview: issueRow.needsReopenReview,
      })),
    };
    const staffIssuesService = {
      findStaffDetail: vi.fn(async () => ({
        publicId: issueRow.publicId,
        status: issueRow.status,
        stage: issueRow.stage,
        needsReopenReview: issueRow.needsReopenReview,
      })),
    };

    const service = new FeedbackService(
      mockFeedbackRepo as never,
      mockIssueRepo as never,
      issuesService as never,
      staffIssuesService as never,
    );

    return { service, issueRow, feedbackRow };
  }

  it('rejects feedback when issue is not RESOLVED', async () => {
    const { service } = createHarness(IssueStatus.IN_PROGRESS);
    await expect(
      service.submitFeedback('issue-uuid-1', citizenUser, {
        isSatisfied: true,
        rating: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets needsReopenReview=true on unsatisfied feedback and reopens issue on staff REOPENED review', async () => {
    const { service, issueRow, feedbackRow } = createHarness(IssueStatus.RESOLVED);

    await service.submitFeedback('issue-uuid-1', citizenUser, {
      isSatisfied: false,
      rating: 2,
      reason: 'Vẫn còn rác đọng',
    });
    expect(issueRow.needsReopenReview).toBe(true);

    const reviewed = await service.reviewFeedback('fb-uuid-11', staffUser, {
      reviewStatus: FeedbackReviewStatus.REOPENED,
      reviewNote: 'Giao kiểm tra lại',
      slaHours: 24,
    });

    expect(feedbackRow.reviewStatus).toBe(FeedbackReviewStatus.REOPENED);
    expect(issueRow.needsReopenReview).toBe(false);
    expect(issueRow.resolvedAt).toBeNull();
    expect(reviewed.status).toBe(IssueStatus.IN_PROGRESS);
    expect(reviewed.stage).toBe(WorkflowStage.WORK_ACCEPTED);
  });
});
