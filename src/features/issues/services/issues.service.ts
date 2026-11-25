import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import { IssueStatus, RoleName } from '../../../common/enums/domain.enums.js';
import { IssueCategory } from '../../master-data/entities/issue-category.entity.js';
import type {
  FeedbackSummaryDto,
  NearbyIssueItemDto,
  PublicIssueDetailDto,
  PublicIssueSummaryDto,
} from '../dto/issue-response.dto.js';
import type { NearbyIssuesQueryDto } from '../dto/nearby-issues.dto.js';
import type { QueryIssuesDto } from '../dto/query-issues.dto.js';
import { Issue } from '../entities/issue.entity.js';
import { IssueGeoService } from './issue-geo.service.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_ALLOWED_STATUSES = [
  IssueStatus.IN_PROGRESS,
  IssueStatus.RESOLVED,
];

const ACTOR_LABEL_BY_ROLE: Record<RoleName, string> = {
  [RoleName.CITIZEN]: 'Người dân',
  [RoleName.STAFF]: 'Cán bộ UBND phường',
  [RoleName.VOLUNTEER]: 'Thanh niên tình nguyện',
  [RoleName.ADMIN]: 'Quản trị hệ thống',
};

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(IssueCategory)
    private readonly categoryRepo: Repository<IssueCategory>,
    private readonly geoService: IssueGeoService,
  ) {}

  async findNearby(
    query: NearbyIssuesQueryDto,
  ): Promise<NearbyIssueItemDto[]> {
    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .innerJoinAndSelect('issue.category', 'category')
      .leftJoinAndSelect('issue.assignedDepartment', 'department')
      .where('issue.isPublic = :isPublic', { isPublic: true })
      .andWhere('issue.isDuplicate = :isDuplicate', { isDuplicate: false });

    if (query.forDuplicateCheck) {
      qb.andWhere('issue.status != :rejectedStatus', {
        rejectedStatus: IssueStatus.REJECTED,
      });
    } else {
      this.applyPublicPortalVisibility(qb);
    }

    if (query.categoryPublicId) {
      qb.andWhere('category.publicId = :categoryPublicId', {
        categoryPublicId: query.categoryPublicId,
      });
    }
    if (query.categoryCode) {
      qb.andWhere('category.code = :categoryCode', {
        categoryCode: query.categoryCode,
      });
    }
    if (query.status) {
      qb.andWhere('issue.status = :status', { status: query.status });
    }

    const candidates = await qb.getMany();
    const now = new Date();

    return candidates
      .map((issue) =>
        Object.assign(this.toPublicSummary(issue, now), {
          distanceMeters: this.geoService.calculateDistanceMeters(
            query.lat,
            query.lng,
            issue.latitude,
            issue.longitude,
          ),
        }),
      )
      .filter((item) => item.distanceMeters <= query.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, query.limit);
  }

  async findPublicList(
    query: QueryIssuesDto,
  ): Promise<ApiResponseDto<PublicIssueSummaryDto[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .innerJoinAndSelect('issue.category', 'category')
      .leftJoinAndSelect('issue.assignedDepartment', 'department')
      .where('issue.isPublic = :isPublic', { isPublic: true })
      .andWhere('issue.isDuplicate = :isDuplicate', { isDuplicate: false });

    this.applyPublicPortalVisibility(qb);

    if (query.categoryPublicId) {
      qb.andWhere('category.publicId = :categoryPublicId', {
        categoryPublicId: query.categoryPublicId,
      });
    }
    if (query.categoryCode) {
      qb.andWhere('category.code = :categoryCode', {
        categoryCode: query.categoryCode,
      });
    }
    if (query.status) {
      qb.andWhere('issue.status = :status', { status: query.status });
    }
    if (query.ward?.trim()) {
      qb.andWhere('LOWER(issue.ward) LIKE :ward', {
        ward: `%${query.ward.trim().toLowerCase()}%`,
      });
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(issue.code) LIKE :term OR LOWER(issue.title) LIKE :term OR LOWER(issue.addressText) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('issue.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const now = new Date();

    return {
      success: true,
      data: items.map((issue) => this.toPublicSummary(issue, now)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findPublicDetail(identifier: string): Promise<PublicIssueDetailDto> {
    const trimmed = identifier.trim();
    const whereCondition = UUID_REGEX.test(trimmed)
      ? { publicId: trimmed }
      : { code: trimmed.toUpperCase() };

    const issue = await this.issueRepo.findOne({
      where: whereCondition,
      relations: {
        category: true,
        assignedDepartment: true,
        media: true,
        progressUpdates: {
          actor: {
            role: true,
          },
        },
        feedbacks: true,
      },
    });

    if (!issue || !issue.isPublic) {
      throw new NotFoundException(`Không tìm thấy hồ sơ phản ánh ${identifier}`);
    }

    let aiSuggestedCategoryCode: string | null = null;
    if (issue.aiSuggestedCategoryId) {
      const aiCategory = await this.categoryRepo.findOne({
        where: { id: issue.aiSuggestedCategoryId },
      });
      aiSuggestedCategoryCode = aiCategory?.code ?? null;
    }

    const now = new Date();
    const summary = this.toPublicSummary(issue, now);

    const media = [...(issue.media ?? [])]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        publicId: item.publicId,
        stage: item.stage,
        url: item.url,
        caption: item.caption,
        createdAt: item.createdAt,
      }));

    const timeline = [...(issue.progressUpdates ?? [])]
      .filter((update) => update.isPublic)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((update) => {
        const actorRole = update.actor?.role?.name ?? null;
        return {
          publicId: update.publicId,
          actionType: update.actionType,
          fromStatus: update.fromStatus,
          toStatus: update.toStatus,
          previousStage: update.previousStage,
          newStage: update.newStage,
          content: update.content,
          actorRole,
          actorLabel: actorRole
            ? ACTOR_LABEL_BY_ROLE[actorRole]
            : 'Hệ thống',
          createdAt: update.createdAt,
          timestamp: update.createdAt,
        };
      });

    const feedbackSummary = this.buildFeedbackSummary(issue);

    return Object.assign(summary, {
      intakeNote: issue.intakeNote,
      resolutionNote: issue.resolutionNote,
      rejectionReason: issue.rejectionReason,
      aiSuggestedCategoryCode,
      aiConfidence: issue.aiConfidence,
      media,
      timeline,
      feedbackSummary,
    });
  }

  computeIsOverdue(issue: Issue, now = new Date()): boolean {
    return (
      issue.dueAt !== null &&
      issue.status !== IssueStatus.RESOLVED &&
      issue.status !== IssueStatus.REJECTED &&
      now.getTime() > issue.dueAt.getTime()
    );
  }

  private applyPublicPortalVisibility(qb: SelectQueryBuilder<Issue>): void {
    qb.andWhere('issue.publicReviewVerified = :publicReviewVerified', {
      publicReviewVerified: true,
    }).andWhere('issue.status IN (:...publicStatuses)', {
      publicStatuses: PUBLIC_ALLOWED_STATUSES,
    });
  }

  private toPublicSummary(issue: Issue, now: Date): PublicIssueSummaryDto {
    const assignedUnit = issue.assignedDepartment?.name ?? null;

    return {
      publicId: issue.publicId,
      code: issue.code,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      stage: issue.stage,
      priority: issue.priority,
      suggestedPriority: issue.suggestedPriority,
      latitude: issue.latitude,
      longitude: issue.longitude,
      addressText: issue.addressText,
      ward: issue.ward,
      thumbnailUrl: issue.thumbnailUrl,
      reportCount: issue.reportCount,
      assignedUnit,
      dueAt: issue.dueAt,
      deadlineAt: issue.dueAt,
      resolvedAt: issue.resolvedAt,
      isOverdue: this.computeIsOverdue(issue, now),
      isDuplicate: issue.isDuplicate,
      needsReopenReview: issue.needsReopenReview,
      publicReview: {
        verified: issue.publicReviewVerified,
        approvedAt: issue.publicApprovedAt,
      },
      category: {
        publicId: issue.category.publicId,
        code: issue.category.code,
        name: issue.category.name,
        icon: issue.category.icon,
        slaHours: issue.category.slaHours,
      },
      assignedDepartment: issue.assignedDepartment
        ? {
            publicId: issue.assignedDepartment.publicId,
            code: issue.assignedDepartment.code,
            name: issue.assignedDepartment.name,
          }
        : null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }

  private buildFeedbackSummary(issue: Issue): FeedbackSummaryDto {
    const feedbacks = [...(issue.feedbacks ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const satisfiedCount = feedbacks.filter((f) => f.isSatisfied).length;
    const unsatisfiedCount = feedbacks.length - satisfiedCount;
    const rated = feedbacks.filter(
      (f): f is typeof f & { rating: number } => typeof f.rating === 'number',
    );
    const averageRating =
      rated.length > 0
        ? Number(
            (
              rated.reduce((sum, item) => sum + item.rating, 0) / rated.length
            ).toFixed(1),
          )
        : null;

    return {
      totalCount: feedbacks.length,
      satisfiedCount,
      unsatisfiedCount,
      averageRating,
      items: feedbacks.map((f) => ({
        publicId: f.publicId,
        isSatisfied: f.isSatisfied,
        rating: f.rating,
        comment: f.comment,
        reviewStatus: f.reviewStatus,
        createdAt: f.createdAt,
      })),
    };
  }
}
