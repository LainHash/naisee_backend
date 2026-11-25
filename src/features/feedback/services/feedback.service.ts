import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  FeedbackReviewStatus,
  IssueStatus,
  TimelineAction,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type {
  PublicIssueDetailDto,
  StaffIssueDetailDto,
} from '../../issues/dto/issue-response.dto.js';
import { Issue } from '../../issues/entities/issue.entity.js';
import { ProgressUpdate } from '../../issues/entities/progress-update.entity.js';
import { IssuesService } from '../../issues/services/issues.service.js';
import { StaffIssuesService } from '../../issues/services/staff-issues.service.js';
import type {
  CreateFeedbackDto,
  ReviewFeedbackDto,
} from '../dto/feedback.dto.js';
import { Feedback } from '../entities/feedback.entity.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    private readonly issuesService: IssuesService,
    private readonly staffIssuesService: StaffIssuesService,
  ) {}

  async submitFeedback(
    issueIdentifier: string,
    user: AuthenticatedUser,
    dto: CreateFeedbackDto,
  ): Promise<PublicIssueDetailDto> {
    const issue = await this.issueRepo.findOne({
      where: this.issuesService.buildIdentifierWhere(issueIdentifier),
    });
    if (!issue) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ phản ánh ${issueIdentifier}`,
      );
    }

    if (issue.status !== IssueStatus.RESOLVED) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá hài lòng hoặc yêu cầu mở lại khi hồ sơ đã hoàn thành (RESOLVED).',
      );
    }

    const reasonText = dto.reason?.trim() || null;
    const commentText = dto.comment?.trim() || null;
    if (!dto.isSatisfied && !reasonText && !commentText) {
      throw new BadRequestException(
        'Vui lòng nhập lý do chưa hài lòng để cán bộ xem xét mở lại hồ sơ.',
      );
    }

    await this.feedbackRepo.manager.transaction(async (manager) => {
      const txFeedbackRepo = manager.getRepository(Feedback);
      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      await txFeedbackRepo.save(
        txFeedbackRepo.create({
          issueId: issue.id,
          citizenId: user.id,
          isSatisfied: dto.isSatisfied,
          rating: dto.rating ?? (dto.isSatisfied ? 5 : 2),
          reason: reasonText,
          comment: commentText ?? reasonText,
          reviewStatus: FeedbackReviewStatus.SUBMITTED,
        }),
      );

      if (!dto.isSatisfied) {
        issue.needsReopenReview = true;
        await txIssueRepo.save(issue);
      }

      const content = dto.isSatisfied
        ? `Người dân đã đánh giá hài lòng (${dto.rating ?? 5}/5 sao)${commentText ? `: ${commentText}` : '.'}`
        : `Người dân đánh giá chưa hài lòng và đề nghị xem xét lại: ${reasonText ?? commentText}.`;

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.PROGRESS_NOTE,
          fromStatus: issue.status,
          toStatus: issue.status,
          previousStage: issue.stage,
          newStage: issue.stage,
          content,
          isPublic: true,
        }),
      );
    });

    return this.issuesService.findPublicDetail(issue.publicId);
  }

  async reviewFeedback(
    identifier: string,
    user: AuthenticatedUser,
    dto: ReviewFeedbackDto,
  ): Promise<StaffIssueDetailDto> {
    const feedback = await this.resolveFeedbackForReview(identifier);
    const issue = await this.issueRepo.findOneByOrFail({ id: feedback.issueId });

    await this.feedbackRepo.manager.transaction(async (manager) => {
      const txFeedbackRepo = manager.getRepository(Feedback);
      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      feedback.reviewStatus = dto.reviewStatus;
      feedback.reviewedById = user.id;
      feedback.reviewNote = dto.reviewNote?.trim() || null;
      await txFeedbackRepo.save(feedback);

      const fromStatus = issue.status;
      const previousStage = issue.stage;
      issue.needsReopenReview = false;

      if (dto.reviewStatus === FeedbackReviewStatus.REOPENED) {
        const slaHours = dto.slaHours ?? 48;
        const nextDueAt =
          dto.dueAt ?? new Date(Date.now() + slaHours * 3600 * 1000);
        const reassign =
          Boolean(dto.reassignToDepartment) || !issue.assignedDepartmentId;

        issue.resolvedAt = null;
        issue.dueAt = nextDueAt;
        if (reassign) {
          issue.status = IssueStatus.RECEIVED;
          issue.stage = WorkflowStage.RECEIVED;
          issue.assignedDepartmentId = null;
        } else {
          issue.status = IssueStatus.IN_PROGRESS;
          issue.stage = WorkflowStage.WORK_ACCEPTED;
        }
      }

      await txIssueRepo.save(issue);

      const notePart = feedback.reviewNote ? `: ${feedback.reviewNote}` : '';
      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType:
            dto.reviewStatus === FeedbackReviewStatus.REOPENED
              ? TimelineAction.REOPENED
              : TimelineAction.PROGRESS_NOTE,
          fromStatus,
          toStatus: issue.status,
          previousStage,
          newStage: issue.stage,
          content:
            dto.reviewStatus === FeedbackReviewStatus.REOPENED
              ? `Cán bộ đã mở lại hồ sơ sau phản hồi chưa hài lòng của người dân${notePart}.`
              : `Cán bộ đã tiếp nhận và phản hồi đánh giá của người dân${notePart}.`,
          isPublic: true,
        }),
      );
    });

    return this.staffIssuesService.findStaffDetail(issue.publicId);
  }

  private async resolveFeedbackForReview(identifier: string): Promise<Feedback> {
    const trimmed = identifier.trim();
    if (UUID_REGEX.test(trimmed)) {
      const byFeedbackId = await this.feedbackRepo.findOne({
        where: { publicId: trimmed },
      });
      if (byFeedbackId) return byFeedbackId;
    }

    const issue = await this.issueRepo.findOne({
      where: this.issuesService.buildIdentifierWhere(trimmed),
    });
    if (issue) {
      const submitted = await this.feedbackRepo.findOne({
        where: {
          issueId: issue.id,
          reviewStatus: FeedbackReviewStatus.SUBMITTED,
        },
        order: { createdAt: 'DESC' },
      });
      if (submitted) return submitted;

      const latest = await this.feedbackRepo.findOne({
        where: { issueId: issue.id },
        order: { createdAt: 'DESC' },
      });
      if (latest) return latest;
    }

    throw new NotFoundException(
      `Không tìm thấy phản hồi đánh giá cần xem xét cho ${identifier}`,
    );
  }
}

