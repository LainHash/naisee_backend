import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import {
  IssueStatus,
  MediaStage,
  ReportType,
  TimelineAction,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { Department } from '../../master-data/entities/department.entity.js';
import { IssueMedia } from '../../media/entities/issue-media.entity.js';
import type {
  StaffIssueDetailDto,
  StaffIssueItemDto,
} from '../dto/issue-response.dto.js';
import {
  extractResolutionSummary,
  formatOfficialResolutionResponse,
} from '../utils/official-response.util.js';
import type {
  AssignIssueDto,
  MergeIssuesDto,
  QueryStaffIssuesDto,
  RejectIssueDto,
  ResolveIssueDto,
  TriageIssueDto,
  UpdateIssueProgressDto,
  UpdatePublicReviewDto,
} from '../dto/staff-issues.dto.js';
import { Issue } from '../entities/issue.entity.js';
import { ProgressUpdate } from '../entities/progress-update.entity.js';
import { Report } from '../entities/report.entity.js';
import { IssuePriorityService } from './issue-priority.service.js';
import { IssuesService } from './issues.service.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ASSIGNABLE_STATUSES = [
  IssueStatus.PENDING_REVIEW,
  IssueStatus.RECEIVED,
  IssueStatus.VERIFYING,
  IssueStatus.IN_PROGRESS,
];

@Injectable()
export class StaffIssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    private readonly issuesService: IssuesService,
    private readonly priorityService: IssuePriorityService,
  ) {}

  async findStaffList(
    query: QueryStaffIssuesDto,
  ): Promise<ApiResponseDto<StaffIssueItemDto[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();

    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .innerJoinAndSelect('issue.category', 'category')
      .leftJoinAndSelect('issue.assignedDepartment', 'department')
      .leftJoinAndSelect('issue.wardUnit', 'wardUnit');

    if (!query.includeDuplicates) {
      qb.andWhere('issue.isDuplicate = :isDuplicate', { isDuplicate: false });
    }
    if (query.status) {
      qb.andWhere('issue.status = :status', { status: query.status });
    }
    if (query.stage) {
      qb.andWhere('issue.stage = :stage', { stage: query.stage });
    }
    if (query.priority) {
      qb.andWhere('issue.priority = :priority', { priority: query.priority });
    }
    if (query.categoryPublicId) {
      qb.andWhere('category.publicId = :categoryPublicId', {
        categoryPublicId: query.categoryPublicId,
      });
    }
    if (query.categoryCode) {
      qb.andWhere('category.code = :categoryCode', {
        categoryCode: query.categoryCode.trim().toUpperCase(),
      });
    }

    const deptFilter = query.departmentPublicId ?? query.departmentId;
    if (deptFilter?.trim()) {
      const trimmed = deptFilter.trim();
      if (UUID_REGEX.test(trimmed)) {
        qb.andWhere('department.publicId = :deptPublicId', {
          deptPublicId: trimmed,
        });
      } else if (/^\d+$/.test(trimmed)) {
        qb.andWhere('issue.assignedDepartmentId = :deptId', {
          deptId: Number(trimmed),
        });
      }
    }

    if (query.overdue) {
      qb.andWhere('issue.dueAt IS NOT NULL')
        .andWhere('issue.dueAt < :now', { now })
        .andWhere('issue.status NOT IN (:...closedStatuses)', {
          closedStatuses: [IssueStatus.RESOLVED, IssueStatus.REJECTED],
        });
    }

    if (query.needsReopenReview) {
      qb.andWhere('issue.needsReopenReview = :needsReopenReview', {
        needsReopenReview: true,
      });
    }
    if (query.wardPublicId) {
      qb.andWhere('wardUnit.publicId = :wardPublicId', {
        wardPublicId: query.wardPublicId,
      });
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

    qb.addSelect(
      `CASE issue.priority
        WHEN 'CRITICAL' THEN 4
        WHEN 'HIGH' THEN 3
        WHEN 'MEDIUM' THEN 2
        ELSE 1
      END`,
      'priority_rank',
    )
      .orderBy('issue.needsReopenReview', 'DESC')
      .addOrderBy('priority_rank', 'DESC')
      .addOrderBy('issue.reportCount', 'DESC')
      .addOrderBy('issue.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      success: true,
      data: items.map((issue) =>
        Object.assign(this.issuesService.toPublicSummary(issue, now), {
          intakeNote: issue.intakeNote,
          rejectionReason: issue.rejectionReason,
          priorityReason: issue.priorityReason,
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

  async findStaffDetail(identifier: string): Promise<StaffIssueDetailDto> {
    const issue = await this.issueRepo.findOne({
      where: this.issuesService.buildIdentifierWhere(identifier),
    });
    if (!issue) {
      throw new NotFoundException(`Không tìm thấy hồ sơ phản ánh ${identifier}`);
    }

    const detail = await this.issuesService.findDetailByIdentifier(
      issue.publicId,
      true,
    );
    return Object.assign(detail, {
      priorityReason: issue.priorityReason,
    });
  }

  async triageIssue(
    identifier: string,
    user: AuthenticatedUser,
    dto: TriageIssueDto,
  ): Promise<StaffIssueDetailDto> {
    const issue = await this.findIssueOrThrow(identifier);

    if (
      issue.status !== IssueStatus.PENDING_REVIEW &&
      issue.status !== IssueStatus.RECEIVED
    ) {
      throw new BadRequestException(
        'Chỉ có thể tiếp nhận/phân loại hồ sơ ở trạng thái Chờ tiếp nhận hoặc Đã tiếp nhận.',
      );
    }

    if (dto.needsInformation && !dto.intakeNote?.trim()) {
      throw new BadRequestException(
        'Vui lòng nhập nội dung yêu cầu người dân bổ sung thông tin.',
      );
    }

    const nextCategory =
      dto.categoryPublicId || dto.categoryCode
        ? await this.issuesService.resolveCategory(
            dto.categoryPublicId,
            dto.categoryCode,
          )
        : issue.category;

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      const fromStatus = issue.status;
      const previousStage = issue.stage;

      issue.categoryId = nextCategory.id;
      if (dto.priority) {
        issue.priority = dto.priority;
      }
      if (dto.intakeNote !== undefined) {
        issue.intakeNote = dto.intakeNote.trim() || null;
      }

      if (dto.needsInformation) {
        issue.status = IssueStatus.PENDING_REVIEW;
        issue.stage = WorkflowStage.NEEDS_INFORMATION;
      } else {
        issue.status = IssueStatus.RECEIVED;
        issue.stage = WorkflowStage.RECEIVED;
      }

      await txIssueRepo.save(issue);

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: dto.needsInformation
            ? TimelineAction.PROGRESS_NOTE
            : TimelineAction.RECEIVED,
          fromStatus,
          toStatus: issue.status,
          previousStage,
          newStage: issue.stage,
          content: dto.needsInformation
            ? `Cán bộ yêu cầu người dân bổ sung thông tin: ${issue.intakeNote}`
            : `Cán bộ đã tiếp nhận và phân loại (${nextCategory.name}, mức ${issue.priority}).`,
          isPublic: true,
        }),
      );
    });

    return this.findStaffDetail(issue.publicId);
  }

  async rejectIssue(
    identifier: string,
    user: AuthenticatedUser,
    dto: RejectIssueDto,
  ): Promise<StaffIssueDetailDto> {
    const issue = await this.findIssueOrThrow(identifier);

    if (
      issue.status !== IssueStatus.PENDING_REVIEW &&
      issue.status !== IssueStatus.RECEIVED
    ) {
      throw new BadRequestException(
        'Chỉ có thể từ chối hồ sơ đang ở bước tiếp nhận.',
      );
    }

    const reason = dto.rejectionReason.trim();
    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      const fromStatus = issue.status;
      const previousStage = issue.stage;

      issue.status = IssueStatus.REJECTED;
      issue.stage = WorkflowStage.NOT_ACCEPTED;
      issue.rejectionReason = reason;
      issue.intakeNote = reason;
      issue.publicReviewVerified = false;
      issue.publicApprovedAt = null;
      await txIssueRepo.save(issue);

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.REJECTED,
          fromStatus,
          toStatus: IssueStatus.REJECTED,
          previousStage,
          newStage: WorkflowStage.NOT_ACCEPTED,
          content: `Không tiếp nhận phản ánh: ${reason}`,
          isPublic: true,
        }),
      );
    });

    return this.findStaffDetail(issue.publicId);
  }

  async assignIssue(
    identifier: string,
    user: AuthenticatedUser,
    dto: AssignIssueDto,
  ): Promise<StaffIssueDetailDto> {
    const issue = await this.findIssueOrThrow(identifier);

    if (!ASSIGNABLE_STATUSES.includes(issue.status)) {
      throw new BadRequestException(
        'Không thể giao xử lý cho hồ sơ đã hoàn thành hoặc đã từ chối.',
      );
    }

    const department = await this.resolveDepartment(
      dto.departmentPublicId,
      dto.departmentCode,
      issue.category.defaultDepartmentId,
    );

    const nextDueAt =
      dto.dueAt ??
      new Date(
        Date.now() +
          (dto.slaHours ?? issue.category.slaHours ?? 48) * 3_600_000,
      );
    const nextStage = dto.stage ?? WorkflowStage.DEPARTMENT_ASSIGNED;

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      const fromStatus = issue.status;
      const previousStage = issue.stage;

      issue.assignedDepartmentId = department.id;
      issue.assignedById = user.id;
      issue.dueAt = nextDueAt;
      if (dto.priority) {
        issue.priority = dto.priority;
      }
      issue.status = IssueStatus.IN_PROGRESS;
      issue.stage = nextStage;

      if (dto.publicReviewVerified !== undefined) {
        issue.publicReviewVerified = dto.publicReviewVerified;
        issue.publicApprovedAt = dto.publicReviewVerified
          ? (issue.publicApprovedAt ?? new Date())
          : null;
      }

      await txIssueRepo.save(issue);

      const notePart = dto.note?.trim() ? ` (${dto.note.trim()})` : '';
      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.ASSIGNED,
          fromStatus,
          toStatus: IssueStatus.IN_PROGRESS,
          previousStage,
          newStage: nextStage,
          content: `Đã giao ${department.name} xử lý${notePart}.`,
          isPublic: true,
        }),
      );
    });

    return this.findStaffDetail(issue.publicId);
  }

  async updatePublicReview(
    identifier: string,
    user: AuthenticatedUser,
    dto: UpdatePublicReviewDto,
  ): Promise<StaffIssueDetailDto> {
    const issue = await this.findIssueOrThrow(identifier);

    if (issue.isDuplicate || issue.status === IssueStatus.REJECTED) {
      throw new BadRequestException(
        'Không thể duyệt công khai hồ sơ trùng lặp hoặc đã từ chối.',
      );
    }

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      issue.publicReviewVerified = dto.verified;
      issue.publicApprovedAt = dto.verified ? new Date() : null;
      await txIssueRepo.save(issue);

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.PROGRESS_NOTE,
          fromStatus: issue.status,
          toStatus: issue.status,
          previousStage: issue.stage,
          newStage: issue.stage,
          content: dto.verified
            ? `Cán bộ đã duyệt công khai hồ sơ lên bản đồ cộng đồng${dto.note?.trim() ? `: ${dto.note.trim()}` : '.'}`
            : `Cán bộ đã gỡ trạng thái hiển thị công khai${dto.note?.trim() ? `: ${dto.note.trim()}` : '.'}`,
          isPublic: false,
        }),
      );
    });

    return this.findStaffDetail(issue.publicId);
  }

  async mergeIssues(
    targetIdentifier: string,
    user: AuthenticatedUser,
    dto: MergeIssuesDto,
  ): Promise<StaffIssueDetailDto> {
    const target = await this.findIssueOrThrow(targetIdentifier);

    if (target.isDuplicate || target.status === IssueStatus.REJECTED) {
      throw new BadRequestException(
        'Hồ sơ đích đang bị đánh dấu trùng hoặc đã từ chối, không thể nhận gộp.',
      );
    }

    const uniqueSourceInputs = Array.from(
      new Set(dto.sourceIssuePublicIds.map((id) => id.trim()).filter(Boolean)),
    );

    const sources: Issue[] = [];
    for (const srcIdentifier of uniqueSourceInputs) {
      const src = await this.issueRepo.findOne({
        where: this.issuesService.buildIdentifierWhere(srcIdentifier),
      });
      if (!src) {
        throw new NotFoundException(
          `Không tìm thấy hồ sơ nguồn ${srcIdentifier}`,
        );
      }
      if (src.id === target.id) {
        throw new BadRequestException(
          'Không thể gộp một hồ sơ vào chính nó.',
        );
      }
      if (src.isDuplicate) {
        throw new BadRequestException(
          `Hồ sơ ${src.code} đã được gộp trước đó.`,
        );
      }
      if (src.status === IssueStatus.RESOLVED) {
        throw new BadRequestException(
          `Hồ sơ ${src.code} đã xử lý hoàn tất, không thể gộp.`,
        );
      }
      sources.push(src);
    }

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txReportRepo = manager.getRepository(Report);
      const txMediaRepo = manager.getRepository(IssueMedia);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      let addedReports = 0;
      const mergedCodes: string[] = [];

      for (const src of sources) {
        addedReports += src.reportCount;
        mergedCodes.push(src.code);

        await txReportRepo
          .createQueryBuilder()
          .update(Report)
          .set({ issueId: target.id, reportType: ReportType.MERGED })
          .where('issueId = :srcId', { srcId: src.id })
          .execute();

        await txMediaRepo
          .createQueryBuilder()
          .update(IssueMedia)
          .set({ issueId: target.id })
          .where('issueId = :srcId', { srcId: src.id })
          .execute();

        const srcFromStatus = src.status;
        const srcPreviousStage = src.stage;
        src.isDuplicate = true;
        src.duplicateOfId = target.id;
        src.publicReviewVerified = false;
        src.publicApprovedAt = null;
        await txIssueRepo.save(src);

        await txProgressRepo.save(
          txProgressRepo.create({
            issueId: src.id,
            actorId: user.id,
            actionType: TimelineAction.MERGED,
            fromStatus: srcFromStatus,
            toStatus: src.status,
            previousStage: srcPreviousStage,
            newStage: src.stage,
            content: `Hồ sơ ${src.code} đã được gộp vào hồ sơ chính ${target.code}.`,
            isPublic: true,
          }),
        );
      }

      const nextCount = target.reportCount + addedReports;
      const priorityEval = this.priorityService.evaluate({
        defaultPriority: target.category.defaultPriority,
        categoryName: target.category.name,
        reportCount: nextCount,
        title: target.title,
        description: target.description,
      });

      target.reportCount = nextCount;
      target.suggestedPriority = priorityEval.suggestedPriority;
      target.priorityReason = priorityEval.priorityReason;
      await txIssueRepo.save(target);

      const notePart = dto.note?.trim() ? ` (${dto.note.trim()})` : '';
      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: target.id,
          actorId: user.id,
          actionType: TimelineAction.MERGED,
          fromStatus: target.status,
          toStatus: target.status,
          previousStage: target.stage,
          newStage: target.stage,
          content: `Đã gộp ${mergedCodes.join(', ')} vào hồ sơ ${target.code} (tổng ${nextCount} lượt ghi nhận)${notePart}.`,
          isPublic: true,
        }),
      );
    });

    return this.findStaffDetail(target.publicId);
  }

  async updateProgress(
    identifier: string,
    user: AuthenticatedUser,
    dto: UpdateIssueProgressDto,
  ): Promise<StaffIssueDetailDto> {
    const issue = await this.findIssueOrThrow(identifier);

    if (issue.status !== IssueStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Chỉ có thể cập nhật tiến độ cho hồ sơ đang ở trạng thái Đang xử lý (IN_PROGRESS).',
      );
    }

    const cleanedUrls = (dto.imageUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);
    const noteText = dto.note?.trim() || null;

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txMediaRepo = manager.getRepository(IssueMedia);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      const previousStage = issue.stage;
      issue.stage = dto.stage;
      if (
        noteText &&
        (dto.stage === WorkflowStage.RESOLUTION_SUBMITTED ||
          dto.stage === WorkflowStage.RESOLUTION_REVIEW)
      ) {
        issue.resolutionNote = noteText;
      }
      await txIssueRepo.save(issue);

      if (cleanedUrls.length > 0) {
        await txMediaRepo.save(
          cleanedUrls.map((url, idx) =>
            txMediaRepo.create({
              issueId: issue.id,
              uploadedById: user.id,
              stage: MediaStage.AFTER,
              url,
              caption: `Ảnh cập nhật thi công #${idx + 1} (${issue.code})`,
            }),
          ),
        );
      }

      const stageLabel: Record<UpdateIssueProgressDto['stage'], string> = {
        [WorkflowStage.WORK_ACCEPTED]: 'Đơn vị phụ trách đã tiếp nhận thực hiện',
        [WorkflowStage.RESOLUTION_SUBMITTED]:
          'Đơn vị đã nộp kết quả và ảnh sau xử lý chờ nghiệm thu',
        [WorkflowStage.RESOLUTION_REVIEW]: 'Hồ sơ đang được kiểm tra nghiệm thu',
      };

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.PROGRESS_NOTE,
          fromStatus: issue.status,
          toStatus: issue.status,
          previousStage,
          newStage: dto.stage,
          content: noteText
            ? `${stageLabel[dto.stage]}: ${noteText}`
            : stageLabel[dto.stage],
          isPublic: true,
        }),
      );
    });

    return this.findStaffDetail(issue.publicId);
  }

  async resolveIssue(
    identifier: string,
    user: AuthenticatedUser,
    dto: ResolveIssueDto,
  ): Promise<StaffIssueDetailDto> {
    const issue = await this.findIssueOrThrow(identifier);

    if (issue.status !== IssueStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Chỉ có thể nghiệm thu hoàn thành hồ sơ đang xử lý (IN_PROGRESS).',
      );
    }

    const cleanedUrls = (dto.imageUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);

    if (cleanedUrls.length === 0) {
      const existingAfterCount = await this.issueRepo.manager
        .getRepository(IssueMedia)
        .count({
          where: { issueId: issue.id, stage: MediaStage.AFTER },
        });
      if (existingAfterCount === 0) {
        throw new BadRequestException(
          'Nghiệm thu hoàn thành bắt buộc có tối thiểu 1 ảnh sau xử lý (AFTER).',
        );
      }
    }

    const rawResolutionNote = dto.resolutionNote.trim();
    const resolutionNote = formatOfficialResolutionResponse({
      wardName: issue.wardUnit?.name ?? issue.ward,
      departmentName: issue.assignedDepartment?.name,
      issueCode: issue.code,
      issueTitle: issue.title,
      detailNote: rawResolutionNote,
    });
    const timelineSummary = extractResolutionSummary(resolutionNote);
    const resolvedAt = new Date();

    await this.issueRepo.manager.transaction(async (manager) => {
      const txIssueRepo = manager.getRepository(Issue);
      const txMediaRepo = manager.getRepository(IssueMedia);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      const fromStatus = issue.status;
      const previousStage = issue.stage;
      issue.status = IssueStatus.RESOLVED;
      issue.stage = WorkflowStage.COMPLETED;
      issue.resolutionNote = resolutionNote;
      issue.resolvedAt = resolvedAt;
      issue.needsReopenReview = false;
      await txIssueRepo.save(issue);

      if (cleanedUrls.length > 0) {
        await txMediaRepo.save(
          cleanedUrls.map((url, idx) =>
            txMediaRepo.create({
              issueId: issue.id,
              uploadedById: user.id,
              stage: MediaStage.AFTER,
              url,
              caption: `Ảnh nghiệm thu sau xử lý #${idx + 1} (${issue.code})`,
            }),
          ),
        );
      }

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.RESOLVED,
          fromStatus,
          toStatus: IssueStatus.RESOLVED,
          previousStage,
          newStage: WorkflowStage.COMPLETED,
          content: `Đã nghiệm thu hoàn thành: ${timelineSummary}`,
          isPublic: true,
        }),
      );
    });

    return this.findStaffDetail(issue.publicId);
  }

  private async findIssueOrThrow(identifier: string): Promise<Issue> {
    const issue = await this.issueRepo.findOne({
      where: this.issuesService.buildIdentifierWhere(identifier),
      relations: { category: true, assignedDepartment: true, wardUnit: true },
    });

    if (!issue) {
      throw new NotFoundException(`Không tìm thấy hồ sơ phản ánh ${identifier}`);
    }
    return issue;
  }

  private async resolveDepartment(
    departmentPublicId?: string,
    departmentCode?: string,
    fallbackDepartmentId?: number | null,
  ): Promise<Department> {
    if (departmentPublicId) {
      const dept = await this.departmentRepo.findOne({
        where: { publicId: departmentPublicId, isActive: true },
      });
      if (!dept) {
        throw new NotFoundException('Không tìm thấy bộ phận phụ trách');
      }
      return dept;
    }

    if (departmentCode?.trim()) {
      const dept = await this.departmentRepo.findOne({
        where: { code: departmentCode.trim().toUpperCase(), isActive: true },
      });
      if (!dept) {
        throw new NotFoundException('Không tìm thấy bộ phận phụ trách');
      }
      return dept;
    }

    if (fallbackDepartmentId) {
      const dept = await this.departmentRepo.findOne({
        where: { id: fallbackDepartmentId, isActive: true },
      });
      if (dept) return dept;
    }

    throw new BadRequestException(
      'Vui lòng chọn departmentPublicId hoặc departmentCode',
    );
  }
}

