import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import {
  IssueStatus,
  MediaStage,
  TimelineAction,
  VerificationOutcome,
  VerificationStatus,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { Issue } from '../../issues/entities/issue.entity.js';
import { ProgressUpdate } from '../../issues/entities/progress-update.entity.js';
import { IssuesService } from '../../issues/services/issues.service.js';
import { IssueMedia } from '../../media/entities/issue-media.entity.js';
import type { VerificationTaskDto } from '../dto/verification-response.dto.js';
import type {
  CreateVerificationDto,
  QueryVolunteerVerificationsDto,
  SubmitVerificationDto,
} from '../dto/verifications.dto.js';
import { Verification } from '../entities/verification.entity.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OUTCOME_LABEL_VI: Record<VerificationOutcome, string> = {
  [VerificationOutcome.STILL_EXISTS]: 'Sự cố vẫn tồn tại ngoài thực địa',
  [VerificationOutcome.ALREADY_RESOLVED]: 'Hiện trường đã được xử lý/dọn sạch',
  [VerificationOutcome.NOT_FOUND_OR_UNCLEAR]: 'Chưa xác định rõ / không tìm thấy',
};

@Injectable()
export class VerificationsService {
  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    private readonly issuesService: IssuesService,
  ) {}

  async requestVerification(
    issueIdentifier: string,
    user: AuthenticatedUser,
    dto: CreateVerificationDto,
  ): Promise<VerificationTaskDto> {
    const issue = await this.issueRepo.findOne({
      where: this.issuesService.buildIdentifierWhere(issueIdentifier),
      relations: { category: true },
    });

    if (!issue) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ phản ánh ${issueIdentifier}`,
      );
    }

    if (
      issue.isDuplicate ||
      issue.status === IssueStatus.RESOLVED ||
      issue.status === IssueStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Không thể yêu cầu xác minh cho hồ sơ trùng lặp, đã hoàn thành hoặc đã từ chối.',
      );
    }

    const existingActive = await this.verificationRepo.findOne({
      where: [
        { issueId: issue.id, status: VerificationStatus.OPEN },
        { issueId: issue.id, status: VerificationStatus.IN_PROGRESS },
      ],
    });
    if (existingActive) {
      throw new BadRequestException(
        'Hồ sơ này đang có một yêu cầu xác minh chưa hoàn tất.',
      );
    }

    const hours = dto.slaHours ?? 24;
    const dueAt = dto.dueAt ?? new Date(Date.now() + hours * 3600 * 1000);
    const instruction =
      dto.instruction?.trim() ||
      'Kiểm tra thực tế hiện trạng sự cố, chụp ảnh đối chiếu và gửi báo cáo xác minh.';

    const createdPublicId = await this.verificationRepo.manager.transaction(
      async (manager) => {
        const txVerificationRepo = manager.getRepository(Verification);
        const txIssueRepo = manager.getRepository(Issue);
        const txProgressRepo = manager.getRepository(ProgressUpdate);

        const saved = await txVerificationRepo.save(
          txVerificationRepo.create({
            issueId: issue.id,
            requestedById: user.id,
            status: VerificationStatus.OPEN,
            instruction,
            dueAt,
          }),
        );

        const fromStatus = issue.status;
        const previousStage = issue.stage;
        issue.status = IssueStatus.VERIFYING;
        issue.stage = WorkflowStage.VERIFICATION_REQUESTED;
        if (!issue.dueAt) {
          issue.dueAt = dueAt;
        }
        await txIssueRepo.save(issue);

        await txProgressRepo.save(
          txProgressRepo.create({
            issueId: issue.id,
            actorId: user.id,
            actionType: TimelineAction.VERIFICATION_REQUESTED,
            fromStatus,
            toStatus: IssueStatus.VERIFYING,
            previousStage,
            newStage: WorkflowStage.VERIFICATION_REQUESTED,
            content: `Cán bộ đã gửi yêu cầu Tình nguyện viên xác minh thực địa: ${instruction}`,
            isPublic: true,
          }),
        );

        return saved.publicId;
      },
    );

    return this.findVolunteerDetail(createdPublicId, user);
  }

  async findVolunteerList(
    user: AuthenticatedUser,
    query: QueryVolunteerVerificationsDto,
  ): Promise<ApiResponseDto<VerificationTaskDto[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.verificationRepo
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.issue', 'issue')
      .innerJoinAndSelect('issue.category', 'category')
      .leftJoinAndSelect('issue.media', 'issueMedia')
      .leftJoinAndSelect('v.media', 'verificationMedia')
      .leftJoinAndSelect('v.volunteer', 'volunteer');

    if (query.mine) {
      qb.andWhere('v.volunteerId = :volunteerId', { volunteerId: user.id });
      if (query.status) {
        qb.andWhere('v.status = :status', { status: query.status });
      }
    } else if (query.status) {
      qb.andWhere('v.status = :status', { status: query.status });
      if (query.status !== VerificationStatus.OPEN) {
        qb.andWhere('v.volunteerId = :volunteerId', { volunteerId: user.id });
      }
    } else {
      qb.andWhere('(v.status = :openStatus OR v.volunteerId = :volunteerId)', {
        openStatus: VerificationStatus.OPEN,
        volunteerId: user.id,
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
      `CASE v.status WHEN 'IN_PROGRESS' THEN 1 WHEN 'OPEN' THEN 2 WHEN 'COMPLETED' THEN 3 ELSE 4 END`,
      'verification_status_rank',
    )
      .orderBy('verification_status_rank', 'ASC')
      .addOrderBy('v.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const now = new Date();

    return {
      success: true,
      data: items.map((item) => this.toTaskDto(item, user, now)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findVolunteerDetail(
    identifier: string,
    user: AuthenticatedUser,
  ): Promise<VerificationTaskDto> {
    const verification = await this.resolveVerification(identifier);
    return this.toTaskDto(verification, user, new Date());
  }

  async claimVerification(
    identifier: string,
    user: AuthenticatedUser,
  ): Promise<VerificationTaskDto> {
    const existing = await this.resolveVerification(identifier);

    await this.verificationRepo.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Verification)
        .set({
          volunteerId: user.id,
          status: VerificationStatus.IN_PROGRESS,
        })
        .where(
          'id = :id AND status = :openStatus AND volunteerId IS NULL',
          {
            id: existing.id,
            openStatus: VerificationStatus.OPEN,
          },
        )
        .execute();

      if (!result.affected || result.affected === 0) {
        throw new ConflictException(
          'Nhiệm vụ xác minh này đã được tình nguyện viên khác nhận hoặc không còn mở.',
        );
      }

      const txIssueRepo = manager.getRepository(Issue);
      const txProgressRepo = manager.getRepository(ProgressUpdate);
      const issue = await txIssueRepo.findOneByOrFail({ id: existing.issueId });

      const previousStage = issue.stage;
      issue.stage = WorkflowStage.VOLUNTEER_ASSIGNED;
      await txIssueRepo.save(issue);

      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.PROGRESS_NOTE,
          fromStatus: issue.status,
          toStatus: issue.status,
          previousStage,
          newStage: WorkflowStage.VOLUNTEER_ASSIGNED,
          content:
            'Tình nguyện viên đã tiếp nhận nhiệm vụ và đang di chuyển xác minh tại hiện trường.',
          isPublic: true,
        }),
      );
    });

    return this.findVolunteerDetail(existing.publicId, user);
  }

  async submitVerification(
    identifier: string,
    user: AuthenticatedUser,
    dto: SubmitVerificationDto,
  ): Promise<VerificationTaskDto> {
    const existing = await this.resolveVerification(identifier);

    if (existing.status === VerificationStatus.COMPLETED) {
      throw new ConflictException('Nhiệm vụ xác minh này đã được hoàn thành trước đó.');
    }
    if (existing.status === VerificationStatus.OPEN || existing.volunteerId === null) {
      throw new BadRequestException(
        'Vui lòng bấm Nhận nhiệm vụ (claim) trước khi nộp kết quả xác minh.',
      );
    }
    if (existing.volunteerId !== user.id) {
      throw new ForbiddenException(
        'Nhiệm vụ này đã được tình nguyện viên khác tiếp nhận.',
      );
    }

    const now = new Date();
    const cleanedUrls = (dto.imageUrls ?? [])
      .map((url) => url.trim())
      .filter(Boolean);

    await this.verificationRepo.manager.transaction(async (manager) => {
      const txVerificationRepo = manager.getRepository(Verification);
      const txIssueRepo = manager.getRepository(Issue);
      const txMediaRepo = manager.getRepository(IssueMedia);
      const txProgressRepo = manager.getRepository(ProgressUpdate);

      existing.outcome = dto.outcome;
      existing.isIssueConfirmed =
        dto.outcome === VerificationOutcome.STILL_EXISTS;
      existing.verifiedLatitude = dto.verifiedLatitude ?? null;
      existing.verifiedLongitude = dto.verifiedLongitude ?? null;
      existing.safetyRiskNote = dto.safetyRiskNote?.trim() || null;
      existing.resultNote = dto.resultNote?.trim() || null;
      existing.status = VerificationStatus.COMPLETED;
      existing.completedAt = now;
      await txVerificationRepo.save(existing);

      const issue = await txIssueRepo.findOneByOrFail({ id: existing.issueId });
      const previousStage = issue.stage;
      issue.stage = WorkflowStage.VERIFICATION_SUBMITTED;
      await txIssueRepo.save(issue);

      if (cleanedUrls.length > 0) {
        await txMediaRepo.save(
          cleanedUrls.map((url, idx) =>
            txMediaRepo.create({
              issueId: issue.id,
              verificationId: existing.id,
              uploadedById: user.id,
              stage: MediaStage.VERIFICATION,
              url,
              caption: `Ảnh xác minh thực địa #${idx + 1} (${issue.code})`,
            }),
          ),
        );
      }

      const outcomeText = OUTCOME_LABEL_VI[dto.outcome];
      const noteSuffix = existing.resultNote ? `: ${existing.resultNote}` : '';
      await txProgressRepo.save(
        txProgressRepo.create({
          issueId: issue.id,
          actorId: user.id,
          actionType: TimelineAction.VERIFICATION_SUBMITTED,
          fromStatus: issue.status,
          toStatus: issue.status,
          previousStage,
          newStage: WorkflowStage.VERIFICATION_SUBMITTED,
          content: `Tình nguyện viên đã nộp kết quả xác minh (${outcomeText})${noteSuffix}`,
          isPublic: true,
        }),
      );
    });

    return this.findVolunteerDetail(existing.publicId, user);
  }

  private async resolveVerification(identifier: string): Promise<Verification> {
    const trimmed = identifier.trim();
    const relations = {
      issue: { category: true, media: true },
      media: true,
      volunteer: true,
    } as const;

    if (UUID_REGEX.test(trimmed)) {
      const byPublicId = await this.verificationRepo.findOne({
        where: { publicId: trimmed },
        relations,
      });
      if (byPublicId) return byPublicId;
    }

    const issue = await this.issueRepo.findOne({
      where: this.issuesService.buildIdentifierWhere(trimmed),
    });
    if (issue) {
      const byIssue = await this.verificationRepo.findOne({
        where: { issueId: issue.id },
        relations,
        order: { createdAt: 'DESC' },
      });
      if (byIssue) return byIssue;
    }

    throw new NotFoundException(
      `Không tìm thấy nhiệm vụ xác minh ${identifier}`,
    );
  }

  private toTaskDto(
    v: Verification,
    user: AuthenticatedUser,
    now: Date,
  ): VerificationTaskDto {
    const issue = v.issue;
    const isOverdue =
      issue.dueAt !== null &&
      issue.status !== IssueStatus.RESOLVED &&
      issue.status !== IssueStatus.REJECTED &&
      now.getTime() > issue.dueAt.getTime();

    const issueMedia = [...(issue.media ?? [])]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        publicId: m.publicId,
        stage: m.stage,
        url: m.url,
        caption: m.caption,
        createdAt: m.createdAt,
      }));

    const verificationMedia = [...(v.media ?? [])]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        publicId: m.publicId,
        stage: m.stage,
        url: m.url,
        caption: m.caption,
        createdAt: m.createdAt,
      }));

    return {
      publicId: v.publicId,
      status: v.status,
      instruction: v.instruction,
      dueAt: v.dueAt,
      outcome: v.outcome,
      isIssueConfirmed: v.isIssueConfirmed,
      verifiedLatitude: v.verifiedLatitude,
      verifiedLongitude: v.verifiedLongitude,
      safetyRiskNote: v.safetyRiskNote,
      resultNote: v.resultNote,
      completedAt: v.completedAt,
      claimedByMe: v.volunteerId !== null && v.volunteerId === user.id,
      volunteerPublicId: v.volunteer?.publicId ?? null,
      volunteerName: v.volunteer?.fullName ?? null,
      media: verificationMedia,
      issue: {
        publicId: issue.publicId,
        code: issue.code,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        stage: issue.stage,
        priority: issue.priority,
        latitude: issue.latitude,
        longitude: issue.longitude,
        addressText: issue.addressText,
        ward: issue.ward,
        thumbnailUrl: issue.thumbnailUrl,
        reportCount: issue.reportCount,
        dueAt: issue.dueAt,
        isOverdue,
        category: {
          publicId: issue.category.publicId,
          code: issue.category.code,
          name: issue.category.name,
          icon: issue.category.icon,
        },
        media: issueMedia,
      },
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }
}

