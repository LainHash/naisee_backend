import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import {
  IssueStatus,
  MediaStage,
  ReportType,
  RoleName,
  TimelineAction,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { IssueCategory } from '../../master-data/entities/issue-category.entity.js';
import { IssueMedia } from '../../media/entities/issue-media.entity.js';
import type { CreateIssueDto } from '../dto/create-issue.dto.js';
import type {
  FeedbackSummaryDto,
  MyIssueItemDto,
  NearbyIssueItemDto,
  PublicIssueDetailDto,
  PublicIssueSummaryDto,
} from '../dto/issue-response.dto.js';
import type { MeTooIssueDto } from '../dto/me-too-issue.dto.js';
import type { NearbyIssuesQueryDto } from '../dto/nearby-issues.dto.js';
import type { QueryIssuesDto, QueryMyIssuesDto } from '../dto/query-issues.dto.js';
import { Issue } from '../entities/issue.entity.js';
import { ProgressUpdate } from '../entities/progress-update.entity.js';
import { Report } from '../entities/report.entity.js';
import { IssueGeoService } from './issue-geo.service.js';
import { IssuePriorityService } from './issue-priority.service.js';

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
    private readonly priorityService: IssuePriorityService,
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
    const issue = await this.issueRepo.findOne({
      where: this.buildIdentifierWhere(identifier),
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

  async createIssue(
    user: AuthenticatedUser,
    dto: CreateIssueDto,
  ): Promise<PublicIssueDetailDto> {
    const category = await this.resolveCategory(
      dto.categoryPublicId,
      dto.categoryCode,
    );
    const aiCategory =
      dto.aiSuggestedCategoryPublicId || dto.aiSuggestedCategoryCode
        ? await this.resolveCategory(
            dto.aiSuggestedCategoryPublicId,
            dto.aiSuggestedCategoryCode,
            false,
          )
        : null;

    const priorityEval = this.priorityService.evaluate({
      defaultPriority: category.defaultPriority,
      categoryName: category.name,
      reportCount: 1,
      title: dto.title,
      description: dto.description,
    });

    const createdIssuePublicId = await this.issueRepo.manager.transaction(
      async (manager) => {
        const txIssueRepo = manager.getRepository(Issue);
        const txReportRepo = manager.getRepository(Report);
        const txMediaRepo = manager.getRepository(IssueMedia);
        const txProgressRepo = manager.getRepository(ProgressUpdate);

        const code = await this.generateNextIssueCode(txIssueRepo);

        const savedIssue = await txIssueRepo.save(
          txIssueRepo.create({
            code,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            categoryId: category.id,
            status: IssueStatus.PENDING_REVIEW,
            stage: WorkflowStage.UNASSIGNED,
            priority: priorityEval.suggestedPriority,
            suggestedPriority: priorityEval.suggestedPriority,
            priorityReason: priorityEval.priorityReason,
            latitude: dto.latitude,
            longitude: dto.longitude,
            addressText: dto.addressText.trim(),
            ward: dto.ward?.trim() || user.ward || 'Phường Trấn Biên',
            thumbnailUrl: dto.imageUrls[0],
            reportCount: 1,
            createdById: user.id,
            isPublic: true,
            publicReviewVerified: false,
            isDuplicate: false,
            aiSuggestedCategoryId: aiCategory?.id ?? null,
            aiConfidence: dto.aiConfidence ?? null,
          }),
        );

        const savedReport = await txReportRepo.save(
          txReportRepo.create({
            issueId: savedIssue.id,
            reporterId: user.id,
            reportType: ReportType.INITIAL,
            description: dto.description?.trim() || null,
            latitude: dto.latitude,
            longitude: dto.longitude,
            addressText: dto.addressText.trim(),
          }),
        );

        await txMediaRepo.save(
          dto.imageUrls.map((url, idx) =>
            txMediaRepo.create({
              issueId: savedIssue.id,
              reportId: savedReport.id,
              uploadedById: user.id,
              stage: MediaStage.BEFORE,
              url,
              caption: `Ảnh hiện trường #${idx + 1} (${code})`,
            }),
          ),
        );

        await txProgressRepo.save(
          txProgressRepo.create({
            issueId: savedIssue.id,
            actorId: user.id,
            actionType: TimelineAction.CREATED,
            fromStatus: null,
            toStatus: IssueStatus.PENDING_REVIEW,
            previousStage: null,
            newStage: WorkflowStage.UNASSIGNED,
            content: `Người dân đã gửi phản ánh ${code}.`,
            isPublic: true,
          }),
        );

        return savedIssue.publicId;
      },
    );

    return this.findPublicDetail(createdIssuePublicId);
  }

  async addMeToo(
    identifier: string,
    user: AuthenticatedUser,
    dto: MeTooIssueDto,
  ): Promise<PublicIssueDetailDto> {
    const issue = await this.issueRepo.findOne({
      where: this.buildIdentifierWhere(identifier),
      relations: { category: true },
    });

    if (!issue || !issue.isPublic || issue.isDuplicate) {
      throw new NotFoundException(`Không tìm thấy hồ sơ phản ánh ${identifier}`);
    }

    if (
      issue.status === IssueStatus.RESOLVED ||
      issue.status === IssueStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Hồ sơ này đã đóng hoặc không tiếp nhận, không thể ghi nhận thêm.',
      );
    }

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txReportRepo = manager.getRepository(Report);
      const txMediaRepo = manager.getRepository(IssueMedia);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      const existing = await txReportRepo.findOne({
        where: { issueId: issue.id, reporterId: user.id },
      });
      if (existing) {
        throw new ConflictException(
          `Bạn đã ghi nhận cùng gặp vấn đề ${issue.code} trước đó.`,
        );
      }

      const nextCount = issue.reportCount + 1;
      const priorityEval = this.priorityService.evaluate({
        defaultPriority: issue.category.defaultPriority,
        categoryName: issue.category.name,
        reportCount: nextCount,
        title: issue.title,
        description: issue.description,
      });

      const savedReport = await txReportRepo.save(
        txReportRepo.create({
          issueId: issue.id,
          reporterId: user.id,
          reportType: ReportType.ME_TOO,
          description:
            dto.description?.trim() || 'Tôi cũng gặp vấn đề này tại cùng vị trí.',
          latitude: dto.latitude ?? issue.latitude,
          longitude: dto.longitude ?? issue.longitude,
          addressText: dto.addressText?.trim() || issue.addressText,
        }),
      );

      if (dto.imageUrls && dto.imageUrls.length > 0) {
        await txMediaRepo.save(
          dto.imageUrls.map((url, idx) =>
            txMediaRepo.create({
              issueId: issue.id,
              reportId: savedReport.id,
              uploadedById: user.id,
              stage: MediaStage.BEFORE,
              url,
              caption: `Ảnh bổ sung từ người dân #${idx + 1} (${issue.code})`,
            }),
          ),
        );
      }

      issue.reportCount = nextCount;
      issue.suggestedPriority = priorityEval.suggestedPriority;
      issue.priorityReason = priorityEval.priorityReason;
      await txIssueRepo.save(issue);

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.ME_TOO_ADDED,
          fromStatus: issue.status,
          toStatus: issue.status,
          previousStage: issue.stage,
          newStage: issue.stage,
          content: `Có thêm 1 người dân xác nhận cùng gặp sự cố (tổng ${nextCount} lượt ghi nhận).`,
          isPublic: true,
        }),
      );
    });

    return this.findPublicDetail(issue.publicId);
  }

  async findMyIssues(
    userId: number,
    query: QueryMyIssuesDto,
  ): Promise<ApiResponseDto<MyIssueItemDto[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .innerJoinAndSelect('issue.category', 'category')
      .leftJoinAndSelect('issue.assignedDepartment', 'department')
      .where((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('1')
          .from(Report, 'r')
          .where('r.issueId = issue.id')
          .andWhere('r.reporterId = :userId')
          .getQuery();
        return `(issue.createdById = :userId OR EXISTS ${subQuery})`;
      })
      .setParameter('userId', userId);

    if (query.status) {
      qb.andWhere('issue.status = :status', { status: query.status });
    }
    if (query.stage) {
      qb.andWhere('issue.stage = :stage', { stage: query.stage });
    }

    qb.orderBy('issue.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const issueIds = items.map((i) => i.id);

    const userReports =
      issueIds.length > 0
        ? await this.issueRepo.manager
            .getRepository(Report)
            .createQueryBuilder('r')
            .where('r.reporterId = :userId', { userId })
            .andWhere('r.issueId IN (:...issueIds)', { issueIds })
            .getMany()
        : [];

    const reportTypesByIssue = new Map<number, ReportType[]>();
    for (const report of userReports) {
      const list = reportTypesByIssue.get(report.issueId) ?? [];
      if (!list.includes(report.reportType)) {
        list.push(report.reportType);
      }
      reportTypesByIssue.set(report.issueId, list);
    }

    const now = new Date();
    return {
      success: true,
      data: items.map((issue) =>
        Object.assign(this.toPublicSummary(issue, now), {
          intakeNote: issue.intakeNote,
          rejectionReason: issue.rejectionReason,
          myReportTypes: reportTypesByIssue.get(issue.id) ?? [
            ReportType.INITIAL,
          ],
        }),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  computeIsOverdue(issue: Issue, now = new Date()): boolean {
    return (
      issue.dueAt !== null &&
      issue.status !== IssueStatus.RESOLVED &&
      issue.status !== IssueStatus.REJECTED &&
      now.getTime() > issue.dueAt.getTime()
    );
  }

  private buildIdentifierWhere(
    identifier: string,
  ): { publicId: string } | { code: string } {
    const trimmed = identifier.trim();
    return UUID_REGEX.test(trimmed)
      ? { publicId: trimmed }
      : { code: trimmed.toUpperCase() };
  }

  private async resolveCategory(
    categoryPublicId?: string,
    categoryCode?: string,
    required = true,
  ): Promise<IssueCategory> {
    if (!categoryPublicId && !categoryCode) {
      if (!required) {
        return null as unknown as IssueCategory;
      }
      throw new BadRequestException(
        'Vui lòng cung cấp categoryPublicId hoặc categoryCode',
      );
    }

    const category = await this.categoryRepo.findOne({
      where: categoryPublicId
        ? { publicId: categoryPublicId, isActive: true }
        : { code: categoryCode!.trim().toUpperCase(), isActive: true },
    });

    if (!category && required) {
      throw new NotFoundException('Không tìm thấy loại sự cố được chọn');
    }

    return category as IssueCategory;
  }

  private async generateNextIssueCode(txIssueRepo: Repository<Issue>): Promise<string> {
    const latest = await txIssueRepo.find({
      order: { id: 'DESC' },
      take: 1,
    });
    const nextNumber = (latest[0]?.id ?? 0) + 1;
    return `HT-2026-${String(nextNumber).padStart(3, '0')}`;
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
