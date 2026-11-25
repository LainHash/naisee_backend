import type { DataSource } from 'typeorm';
import {
  FeedbackReviewStatus,
  IssueStatus,
  MediaStage,
  ReportType,
  RoleName,
  TimelineAction,
  VerificationOutcome,
  VerificationStatus,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import { Role } from '../../../features/auth/entities/role.entity.js';
import { User } from '../../../features/auth/entities/user.entity.js';
import { Feedback } from '../../../features/feedback/entities/feedback.entity.js';
import { Issue } from '../../../features/issues/entities/issue.entity.js';
import { ProgressUpdate } from '../../../features/issues/entities/progress-update.entity.js';
import { Report } from '../../../features/issues/entities/report.entity.js';
import { Department } from '../../../features/master-data/entities/department.entity.js';
import { IssueCategory } from '../../../features/master-data/entities/issue-category.entity.js';
import { Ward } from '../../../features/master-data/entities/ward.entity.js';
import { IssueMedia } from '../../../features/media/entities/issue-media.entity.js';
import { Verification } from '../../../features/verifications/entities/verification.entity.js';
import { loadSeedWorkbook } from './seed-excel.helper.js';
import { upsertWardsAndBackfill } from './ward-seed.helper.js';

export interface SeedResult {
  skipped: boolean;
  sourceFile?: string;
  wards: number;
  roles: number;
  departments: number;
  categories: number;
  users: number;
  issues: number;
  reports: number;
  resolvedIssues: number;
}

const DEMO_ANCHOR_DATE = new Date('2026-11-24T12:00:00.000Z');

function daysBefore(base: Date, days: number): Date {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Seeds baseline roles, departments, categories, demo accounts, and issues
 * from `data/naisee-seed-data.xlsx`.
 * Idempotent by default; pass reset=true to truncate and re-seed cleanly.
 */
export async function runSeed(
  dataSource: DataSource,
  options: { reset?: boolean; filePath?: string } = {},
): Promise<SeedResult> {
  if (options.reset) {
    await dataSource.query(
      'TRUNCATE TABLE feedbacks, verifications, issue_media, progress_updates, reports, issues, issue_categories, users, departments, roles, wards RESTART IDENTITY CASCADE',
    );
  }

  const workbookData = await loadSeedWorkbook(options.filePath);

  return dataSource.transaction(async (manager) => {
    const wardRepo = manager.getRepository(Ward);
    const roleRepo = manager.getRepository(Role);
    const deptRepo = manager.getRepository(Department);
    const catRepo = manager.getRepository(IssueCategory);
    const userRepo = manager.getRepository(User);
    const issueRepo = manager.getRepository(Issue);
    const reportRepo = manager.getRepository(Report);
    const mediaRepo = manager.getRepository(IssueMedia);
    const progressRepo = manager.getRepository(ProgressUpdate);
    const verificationRepo = manager.getRepository(Verification);
    const feedbackRepo = manager.getRepository(Feedback);

    await upsertWardsAndBackfill(manager);
    const allWards = await wardRepo.find();
    const wardIdByName = new Map(
      allWards.map((w) => [w.name.trim().toLowerCase(), w.id]),
    );
    const tranBienWard = allWards.find(
      (w) => w.name.trim().toLowerCase() === 'phường trấn biên',
    );

    const firstIssueCode = workbookData.issues[0]?.code ?? 'HT-2026-001';
    const existingDemoIssue = await issueRepo.findOne({
      where: { code: firstIssueCode },
    });
    if (existingDemoIssue && !options.reset) {
      return {
        skipped: true,
        sourceFile: workbookData.filePath,
        wards: await wardRepo.count(),
        roles: await roleRepo.count(),
        departments: await deptRepo.count(),
        categories: await catRepo.count(),
        users: await userRepo.count(),
        issues: await issueRepo.count(),
        reports: await reportRepo.count(),
        resolvedIssues: await issueRepo.count({
          where: { status: IssueStatus.RESOLVED },
        }),
      };
    }

    // 1. Roles (from Excel sheet `roles`)
    const roles = await roleRepo.save(
      workbookData.roles.map((r) =>
        roleRepo.create({
          name: r.name,
          description: r.description,
        }),
      ),
    );
    const roleMap = new Map(roles.map((r) => [r.name, r]));

    // 2. Departments (from Excel sheet `departments`)
    const departments = await deptRepo.save(
      workbookData.departments.map((d) =>
        deptRepo.create({
          code: d.code,
          name: d.name,
          contactPhone: d.contactPhone,
          description: d.description,
        }),
      ),
    );
    const deptMap = new Map(departments.map((d) => [d.code, d]));

    // 3. Issue Categories (from Excel sheet `categories`)
    const categories = await catRepo.save(
      workbookData.categories.map((c) => {
        const dept = deptMap.get(c.defaultDepartmentCode);
        if (!dept) {
          throw new Error(
            `Category ${c.code} tham chiếu phòng ban không tồn tại: ${c.defaultDepartmentCode}`,
          );
        }
        return catRepo.create({
          code: c.code,
          name: c.name,
          defaultDepartmentId: dept.id,
          defaultPriority: c.defaultPriority,
          slaHours: c.slaHours,
          icon: c.icon,
        });
      }),
    );
    const catMap = new Map(categories.map((c) => [c.code, c]));

    // 4. Demo Users (from Excel sheet `users`)
    const users = await userRepo.save(
      workbookData.users.map((u) => {
        const role = roleMap.get(u.roleName);
        if (!role) {
          throw new Error(
            `User ${u.phone} tham chiếu vai trò không tồn tại: ${u.roleName}`,
          );
        }
        const departmentId = u.departmentCode
          ? (deptMap.get(u.departmentCode)?.id ?? null)
          : null;
        const wardId =
          wardIdByName.get(u.ward.trim().toLowerCase()) ??
          tranBienWard?.id ??
          null;
        return userRepo.create({
          roleId: role.id,
          departmentId,
          fullName: u.fullName,
          phone: u.phone,
          ward: u.ward,
          wardId,
          largeTextMode: u.largeTextMode,
        });
      }),
    );

    const citizenUsers = users.filter(
      (u) => u.roleId === roleMap.get(RoleName.CITIZEN)?.id,
    );
    const staffUsers = users.filter(
      (u) => u.roleId === roleMap.get(RoleName.STAFF)?.id,
    );
    const volunteerUsers = users.filter(
      (u) => u.roleId === roleMap.get(RoleName.VOLUNTEER)?.id,
    );
    const demoCitizen = citizenUsers[0] ?? users[0];
    const demoStaff =
      staffUsers[0] ?? users[1] ?? users[0];
    const demoVolunteer =
      volunteerUsers[0] ?? users[2] ?? users[0];
    const citizenPool = citizenUsers.length > 0 ? citizenUsers : [demoCitizen];
    const staffPool = staffUsers.length > 0 ? staffUsers : [demoStaff];
    const volunteerPool =
      volunteerUsers.length > 0 ? volunteerUsers : [demoVolunteer];

    // Index fallback media presets from Excel sheet `media_presets`
    const beforePoolByCat = new Map<string, string[]>();
    const afterPoolByCat = new Map<string, string[]>();
    const verifyByCat = new Map<string, string>();
    let verifyMediaUrl = '';
    for (const preset of workbookData.mediaPresets) {
      if (preset.stage === MediaStage.BEFORE) {
        const list = beforePoolByCat.get(preset.categoryCode) ?? [];
        list.push(preset.url);
        beforePoolByCat.set(preset.categoryCode, list);
      } else if (preset.stage === MediaStage.AFTER) {
        const list = afterPoolByCat.get(preset.categoryCode) ?? [];
        list.push(preset.url);
        afterPoolByCat.set(preset.categoryCode, list);
      } else if (preset.stage === MediaStage.VERIFICATION) {
        verifyByCat.set(preset.categoryCode, preset.url);
        if (!verifyMediaUrl) {
          verifyMediaUrl = preset.url;
        }
      }
    }

    // 5. Issues, Reports, Media, ProgressUpdates, Verifications, Feedback (from Excel sheet `issues`)
    const specs = workbookData.issues;
    let totalReports = 0;
    let resolvedIssues = 0;

    for (let idx = 0; idx < specs.length; idx++) {
      const spec = specs[idx];
      const category = catMap.get(spec.categoryCode);
      if (!category) {
        throw new Error(
          `Issue ${spec.code} tham chiếu categoryCode không tồn tại: ${spec.categoryCode}`,
        );
      }
      const defaultDept = departments.find(
        (d) => d.id === category.defaultDepartmentId,
      )!;
      const reporter =
        spec.code === 'HT-2026-001'
          ? (citizenPool[1] ?? demoCitizen)
          : citizenPool[idx % citizenPool.length];

      const actorStaff = staffPool[idx % staffPool.length] ?? demoStaff;

      let createdAt = daysBefore(DEMO_ANCHOR_DATE, 1 + (idx % 12));
      let resolvedAt: Date | null = null;
      let dueAt: Date | null = null;
      let assignedDeptId: number | null = null;
      let assignedById: number | null = null;

      if (spec.code === 'HT-2026-001') {
        createdAt = new Date('2026-11-23T08:00:00.000Z');
        dueAt = new Date('2026-11-26T10:00:00.000Z');
        assignedDeptId = defaultDept.id;
        assignedById = demoStaff.id;
      } else if (spec.status === IssueStatus.RESOLVED) {
        resolvedIssues++;
        const resolvedAgo = spec.resolvedDaysAgo ?? 2;
        const duration = spec.resolutionDurationDays ?? 3.2;
        resolvedAt = daysBefore(DEMO_ANCHOR_DATE, resolvedAgo);
        createdAt = daysBefore(DEMO_ANCHOR_DATE, resolvedAgo + duration);
        dueAt = new Date(
          createdAt.getTime() + category.slaHours * 60 * 60 * 1000,
        );
        assignedDeptId = defaultDept.id;
        assignedById = actorStaff.id;
      } else if (spec.status === IssueStatus.IN_PROGRESS) {
        assignedDeptId = defaultDept.id;
        assignedById = actorStaff.id;
        dueAt = spec.overdue
          ? daysBefore(DEMO_ANCHOR_DATE, 1 + (idx % 3))
          : new Date(
              DEMO_ANCHOR_DATE.getTime() + ((idx % 40) + 4) * 60 * 60 * 1000,
            );
      } else if (spec.status === IssueStatus.VERIFYING) {
        dueAt = new Date(
          DEMO_ANCHOR_DATE.getTime() + (24 + (idx % 24)) * 60 * 60 * 1000,
        );
      }

      const categoryBeforePool = beforePoolByCat.get(spec.categoryCode) ?? [];
      const beforeImageUrl =
        spec.beforeImageUrl ||
        categoryBeforePool[idx % Math.max(categoryBeforePool.length, 1)] ||
        '';
      const categoryAfterPool = afterPoolByCat.get(spec.categoryCode) ?? [];
      const afterImageUrl =
        spec.afterImageUrl ||
        categoryAfterPool[idx % Math.max(categoryAfterPool.length, 1)] ||
        '';
      const resolutionNote =
        spec.status === IssueStatus.RESOLVED
          ? 'Đã hoàn tất xử lý tại hiện trường kèm ảnh nghiệm thu.'
          : null;
      const rejectionReasons = [
        'Phản ánh chưa đủ thông tin vị trí chính xác để kiểm tra thực địa.',
        'Nội dung phản ánh thuộc phạm vi quản lý nội bộ hộ dân, không thuộc hạ tầng công cộng.',
        'Trùng lặp với hồ sơ đã tiếp nhận trước đó tại cùng tuyến đường.',
      ];
      const rejectionReason =
        spec.status === IssueStatus.REJECTED
          ? rejectionReasons[idx % rejectionReasons.length]
          : null;

      let stage = WorkflowStage.UNASSIGNED;
      if (spec.code === 'HT-2026-001') {
        stage = WorkflowStage.WORK_ACCEPTED;
      } else if (spec.status === IssueStatus.RECEIVED) {
        stage = WorkflowStage.RECEIVED;
      } else if (spec.status === IssueStatus.VERIFYING) {
        stage =
          idx % 4 === 0
            ? WorkflowStage.VOLUNTEER_ASSIGNED
            : WorkflowStage.VERIFICATION_REQUESTED;
      } else if (spec.status === IssueStatus.IN_PROGRESS) {
        const stages = [
          WorkflowStage.DEPARTMENT_ASSIGNED,
          WorkflowStage.WORK_ACCEPTED,
          WorkflowStage.DEPARTMENT_ASSIGNED,
          WorkflowStage.WORK_ACCEPTED,
          WorkflowStage.RESOLUTION_SUBMITTED,
        ];
        stage = stages[idx % stages.length];
      } else if (spec.status === IssueStatus.RESOLVED) {
        stage = WorkflowStage.COMPLETED;
      } else if (spec.status === IssueStatus.REJECTED) {
        stage = WorkflowStage.NOT_ACCEPTED;
      }

      const isPublicApproved =
        spec.status === IssueStatus.IN_PROGRESS ||
        spec.status === IssueStatus.RESOLVED;

      const targetWardName = spec.ward || 'Phường Trấn Biên';
      const targetWardId =
        wardIdByName.get(targetWardName.trim().toLowerCase()) ??
        tranBienWard?.id ??
        null;

      const issue = await issueRepo.save(
        issueRepo.create({
          code: spec.code,
          title: spec.title,
          description: spec.description,
          categoryId: category.id,
          status: spec.status,
          stage,
          priority: spec.priority,
          suggestedPriority: spec.priority,
          priorityReason:
            spec.reportCount > 1
              ? `Có ${spec.reportCount} lượt ghi nhận tại khu vực đông dân cư`
              : `Mức ưu tiên mặc định theo nhóm ${category.name}`,
          latitude: spec.lat,
          longitude: spec.lng,
          addressText: spec.addressText,
          ward: targetWardName,
          wardId: targetWardId,
          thumbnailUrl: beforeImageUrl,
          reportCount: spec.reportCount,
          createdById: reporter.id,
          assignedDepartmentId: assignedDeptId,
          assignedById,
          dueAt,
          resolvedAt,
          intakeNote:
            spec.code === 'HT-2026-001'
              ? 'Đã xác minh thực địa qua đoàn viên thanh niên, giao Đội duy tu đường bộ xử lý ưu tiên cao.'
              : null,
          resolutionNote,
          rejectionReason,
          publicReviewVerified: isPublicApproved,
          publicApprovedAt: isPublicApproved ? createdAt : null,
          aiSuggestedCategoryId: category.id,
          aiConfidence: 0.92,
          createdAt,
          updatedAt: resolvedAt ?? createdAt,
        }),
      );

      // Reports (1 INITIAL + (reportCount - 1) ME_TOO)
      const initialReport = await reportRepo.save(
        reportRepo.create({
          issueId: issue.id,
          reporterId: reporter.id,
          reportType: ReportType.INITIAL,
          description: spec.description,
          latitude: spec.lat,
          longitude: spec.lng,
          addressText: spec.addressText,
          createdAt,
        }),
      );
      totalReports++;

      if (beforeImageUrl) {
        await mediaRepo.save(
          mediaRepo.create({
            issueId: issue.id,
            reportId: initialReport.id,
            uploadedById: reporter.id,
            stage: MediaStage.BEFORE,
            url: beforeImageUrl,
            caption: `Ảnh hiện trường ban đầu (${spec.code})`,
          }),
        );
      }

      await progressRepo.save(
        progressRepo.create({
          issueId: issue.id,
          actorId: reporter.id,
          actionType: TimelineAction.CREATED,
          toStatus: IssueStatus.PENDING_REVIEW,
          newStage: WorkflowStage.UNASSIGNED,
          content: `Người dân đã gửi phản ánh ${spec.code}.`,
          isPublic: true,
          createdAt,
        }),
      );

      for (let r = 1; r < spec.reportCount; r++) {
        const meTooUser =
          spec.code === 'HT-2026-001'
            ? (citizenPool[(r % 2 === 1 ? 2 : 1) % citizenPool.length] ??
              demoCitizen)
            : citizenPool[(idx + r) % citizenPool.length];
        await reportRepo.save(
          reportRepo.create({
            issueId: issue.id,
            reporterId: meTooUser.id,
            reportType: ReportType.ME_TOO,
            description: 'Tôi cũng gặp vấn đề này tại cùng vị trí.',
            latitude: spec.lat + r * 0.00003,
            longitude: spec.lng + r * 0.00003,
            addressText: spec.addressText,
          }),
        );
        totalReports++;

        await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: meTooUser.id,
            actionType: TimelineAction.ME_TOO_ADDED,
            content: 'Có thêm 1 người dân xác nhận cùng gặp sự cố.',
            isPublic: true,
          }),
        );
      }

      if (spec.status === IssueStatus.REJECTED) {
        await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: actorStaff.id,
            actionType: TimelineAction.REJECTED,
            fromStatus: IssueStatus.PENDING_REVIEW,
            toStatus: IssueStatus.REJECTED,
            previousStage: WorkflowStage.UNASSIGNED,
            newStage: WorkflowStage.NOT_ACCEPTED,
            content: rejectionReason ?? 'Không tiếp nhận hồ sơ phản ánh.',
            isPublic: false,
            createdAt,
          }),
        );
      }

      if (spec.status === IssueStatus.VERIFYING) {
        await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: actorStaff.id,
            actionType: TimelineAction.VERIFICATION_REQUESTED,
            fromStatus: IssueStatus.RECEIVED,
            toStatus: IssueStatus.VERIFYING,
            previousStage: WorkflowStage.RECEIVED,
            newStage: stage,
            content: 'Đã gửi yêu cầu xác minh thực địa cho tình nguyện viên địa phương.',
            isPublic: true,
            createdAt,
          }),
        );

        const isAssignedVolunteer = idx % 4 === 0;
        const assignedVolunteer =
          volunteerPool[idx % volunteerPool.length] ?? demoVolunteer;
        await verificationRepo.save(
          verificationRepo.create({
            issueId: issue.id,
            requestedById: actorStaff.id,
            volunteerId: isAssignedVolunteer ? assignedVolunteer.id : null,
            status: isAssignedVolunteer
              ? VerificationStatus.IN_PROGRESS
              : VerificationStatus.OPEN,
            instruction:
              'Kiểm tra thực tế tại hiện trường, chụp ảnh đối chiếu và đánh giá mức độ ảnh hưởng.',
            dueAt,
          }),
        );
      }

      if (
        spec.status === IssueStatus.IN_PROGRESS ||
        spec.status === IssueStatus.RESOLVED
      ) {
        await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: actorStaff.id,
            actionType: TimelineAction.ASSIGNED,
            fromStatus: IssueStatus.RECEIVED,
            toStatus: IssueStatus.IN_PROGRESS,
            previousStage: WorkflowStage.RECEIVED,
            newStage: WorkflowStage.DEPARTMENT_ASSIGNED,
            content: `Đã phân công ${defaultDept.name} tiếp nhận xử lý.`,
            isPublic: true,
            createdAt,
          }),
        );
      }

      if (spec.status === IssueStatus.RESOLVED && resolvedAt) {
        const resolveUpdate = await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: actorStaff.id,
            actionType: TimelineAction.RESOLVED,
            fromStatus: IssueStatus.IN_PROGRESS,
            toStatus: IssueStatus.RESOLVED,
            previousStage: WorkflowStage.WORK_ACCEPTED,
            newStage: WorkflowStage.COMPLETED,
            content: 'Đã hoàn tất xử lý tại hiện trường kèm ảnh nghiệm thu.',
            isPublic: true,
            createdAt: resolvedAt,
          }),
        );

        if (afterImageUrl) {
          await mediaRepo.save(
            mediaRepo.create({
              issueId: issue.id,
              progressUpdateId: resolveUpdate.id,
              uploadedById: actorStaff.id,
              stage: MediaStage.AFTER,
              url: afterImageUrl,
              caption: `Ảnh sau xử lý (${spec.code})`,
            }),
          );
        }

        if (idx % 3 === 0 || idx % 11 === 0) {
          const isUnsatisfied = idx % 11 === 0 && idx > 0;
          await feedbackRepo.save(
            feedbackRepo.create({
              issueId: issue.id,
              citizenId: reporter.id,
              isSatisfied: !isUnsatisfied,
              rating: isUnsatisfied ? 2 : idx % 6 === 0 ? 5 : 4,
              reason: isUnsatisfied ? 'Cần kiểm tra bổ sung sau nghiệm thu' : null,
              comment: isUnsatisfied
                ? 'Khu vực xung quanh còn ít vật liệu chưa dọn hết.'
                : 'Xử lý nhanh, sạch sẽ và minh bạch.',
              reviewStatus: isUnsatisfied
                ? FeedbackReviewStatus.SUBMITTED
                : FeedbackReviewStatus.ACKNOWLEDGED,
            }),
          );
        }
      }

      // HT-2026-001 có thêm 1 bản ghi xác minh đã hoàn tất của Bạn Hùng
      if (spec.code === 'HT-2026-001') {
        const verification = await verificationRepo.save(
          verificationRepo.create({
            issueId: issue.id,
            requestedById: demoStaff.id,
            volunteerId: demoVolunteer.id,
            status: VerificationStatus.COMPLETED,
            instruction: 'Kiểm tra độ sâu ổ gà và mức độ nguy hiểm ban đêm.',
            dueAt: new Date('2026-11-23T17:00:00.000Z'),
            outcome: VerificationOutcome.STILL_EXISTS,
            isIssueConfirmed: true,
            verifiedLatitude: spec.lat,
            verifiedLongitude: spec.lng,
            safetyRiskNote: 'Nguy hiểm cho xe máy khi trời tối hoặc mưa ngập.',
            resultNote: 'Đã đo thực tế ổ gà rộng ~70cm, sâu 15cm.',
            completedAt: new Date('2026-11-23T11:30:00.000Z'),
          }),
        );

        const verificationUrl =
          verifyByCat.get(spec.categoryCode) ?? verifyMediaUrl;
        if (verificationUrl) {
          await mediaRepo.save(
            mediaRepo.create({
              issueId: issue.id,
              verificationId: verification.id,
              uploadedById: demoVolunteer.id,
              stage: MediaStage.VERIFICATION,
              url: verificationUrl,
              caption: 'Ảnh thanh niên xác minh thực địa HT-2026-001',
            }),
          );
        }
      }
    }

    await manager.query('CREATE SEQUENCE IF NOT EXISTS issue_code_seq');
    await manager.query(
      "SELECT setval('issue_code_seq', GREATEST(COALESCE((SELECT MAX(id) FROM issues), 0), 1), true)",
    );

    return {
      skipped: false,
      sourceFile: workbookData.filePath,
      wards: await wardRepo.count(),
      roles: roles.length,
      departments: departments.length,
      categories: categories.length,
      users: users.length,
      issues: specs.length,
      reports: totalReports,
      resolvedIssues,
    };
  });
}
