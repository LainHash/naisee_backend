import type { DataSource } from 'typeorm';
import {
  FeedbackReviewStatus,
  IssueStatus,
  MediaStage,
  Priority,
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
import { IssueMedia } from '../../../features/media/entities/issue-media.entity.js';
import { Verification } from '../../../features/verifications/entities/verification.entity.js';

export interface SeedResult {
  skipped: boolean;
  roles: number;
  departments: number;
  categories: number;
  users: number;
  issues: number;
  reports: number;
  resolvedIssues: number;
}

interface IssueSeedSpec {
  code: string;
  categoryCode: 'ROAD_SURFACE' | 'WASTE' | 'STREET_LIGHT' | 'FLOODING';
  title: string;
  description: string;
  addressText: string;
  lat: number;
  lng: number;
  status: IssueStatus;
  priority: Priority;
  reportCount: number;
  resolvedDaysAgo?: number;
  resolutionDurationDays?: number;
  overdue?: boolean;
}

const DEMO_ANCHOR_DATE = new Date('2026-11-24T12:00:00.000Z');

function daysBefore(base: Date, days: number): Date {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

function buildIssueSpecs(): IssueSeedSpec[] {
  const specs: IssueSeedSpec[] = [
    // HT-2026-001: Hồ sơ demo xuyên suốt (8 reports, ROAD_SURFACE, IN_PROGRESS)
    {
      code: 'HT-2026-001',
      categoryCode: 'ROAD_SURFACE',
      title: 'Ổ gà gây mất an toàn giao thông',
      description:
        'Mặt đường bị bong tróc, xuất hiện ổ gà sâu khoảng 15cm trước khu vực ngã ba gần trường học, dễ gây té ngã cho xe máy vào ban đêm.',
      addressText: 'Đường Cách Mạng Tháng 8, gần số 124, Phường Trấn Biên',
      lat: 10.9512,
      lng: 106.8245,
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      reportCount: 8,
    },
    // 2 hồ sơ ROAD_SURFACE đã xử lý (1 report mỗi hồ sơ -> tổng ROAD_SURFACE = 10 reports)
    {
      code: 'HT-2026-002',
      categoryCode: 'ROAD_SURFACE',
      title: 'Nắp hố ga bị sụt lún mặt đường',
      description: 'Nắp hố ga lệch cao hơn mặt đường gây xóc mạnh.',
      addressText: 'Đường Nguyễn Ái Quốc, đoạn gần chợ Biên Hòa',
      lat: 10.9489,
      lng: 106.8211,
      status: IssueStatus.RESOLVED,
      priority: Priority.HIGH,
      reportCount: 1,
      resolvedDaysAgo: 2,
      resolutionDurationDays: 3.1,
    },
    {
      code: 'HT-2026-003',
      categoryCode: 'ROAD_SURFACE',
      title: 'Vỉa hè lát gạch bị bong bật',
      description: 'Gạch lát vỉa hè vỡ nhiều viên gây vấp ngã cho người đi bộ.',
      addressText: 'Đường 30 Tháng 4, khu phố 2, Phường Trấn Biên',
      lat: 10.9531,
      lng: 106.8278,
      status: IssueStatus.RESOLVED,
      priority: Priority.MEDIUM,
      reportCount: 1,
      resolvedDaysAgo: 4,
      resolutionDurationDays: 3.4,
    },
  ];

  let nextIdx = 4;
  const makeCode = () => `HT-2026-${String(nextIdx++).padStart(3, '0')}`;

  // WASTE: 21 reports = 16 RESOLVED (1 report each) + 2 PENDING_REVIEW (1 each) + 1 VERIFYING (2 reports) + 1 IN_PROGRESS overdue (1)
  for (let i = 1; i <= 16; i++) {
    specs.push({
      code: makeCode(),
      categoryCode: 'WASTE',
      title: `Điểm tập kết rác tự phát #${i}`,
      description: 'Rác thải sinh hoạt tồn đọng chưa được thu gom đúng giờ.',
      addressText: `Hẻm ${10 + i} đường Hà Huy Giáp, Phường Trấn Biên`,
      lat: 10.946 + i * 0.0006,
      lng: 106.818 + (i % 5) * 0.0022,
      status: IssueStatus.RESOLVED,
      priority: i % 4 === 0 ? Priority.HIGH : Priority.MEDIUM,
      reportCount: 1,
      resolvedDaysAgo: (i % 7) + 1,
      resolutionDurationDays: i % 2 === 0 ? 3.2 : 3.0,
    });
  }
  for (let i = 1; i <= 2; i++) {
    specs.push({
      code: makeCode(),
      categoryCode: 'WASTE',
      title: `Rác cồng kềnh lấn chiếm lòng đường #${i}`,
      description: 'Vật liệu bỏ đi chất đống ngay góc cua khu dân cư.',
      addressText: `Đường Phan Chu Trinh số ${45 + i * 10}, Phường Trấn Biên`,
      lat: 10.9502 + i * 0.001,
      lng: 106.8235 + i * 0.001,
      status: IssueStatus.PENDING_REVIEW,
      priority: Priority.MEDIUM,
      reportCount: 1,
    });
  }
  specs.push({
    code: makeCode(),
    categoryCode: 'WASTE',
    title: 'Bãi rác tự phát ven kênh thoát nước',
    description: 'Mùi hôi nồng nặc, cần thanh niên tình nguyện kiểm chứng vị trí.',
    addressText: 'Bờ kè khu phố 3, Phường Trấn Biên',
    lat: 10.9544,
    lng: 106.8204,
    status: IssueStatus.VERIFYING,
    priority: Priority.HIGH,
    reportCount: 2,
  });
  specs.push({
    code: makeCode(),
    categoryCode: 'WASTE',
    title: 'Thùng rác công cộng hư hỏng tràn rác',
    description: 'Thùng rác bị vỡ đáy gây rò rỉ nước thải ra vỉa hè.',
    addressText: 'Công viên ven sông, Phường Trấn Biên',
    lat: 10.9478,
    lng: 106.8291,
    status: IssueStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    reportCount: 1,
    overdue: true,
  });

  // STREET_LIGHT: 18 reports = 15 RESOLVED (1 each) + 1 RECEIVED (1) + 1 VERIFYING (1) + 1 IN_PROGRESS overdue (1)
  for (let i = 1; i <= 15; i++) {
    specs.push({
      code: makeCode(),
      categoryCode: 'STREET_LIGHT',
      title: `Đèn đường tắt không sáng #${i}`,
      description: 'Bóng đèn cao áp nhấp nháy hoặc tắt hoàn toàn sau 18h.',
      addressText: `Trụ đèn số ${20 + i} đường Hưng Đạo Vương, Phường Trấn Biên`,
      lat: 10.947 + i * 0.0007,
      lng: 106.821 + (i % 4) * 0.0025,
      status: IssueStatus.RESOLVED,
      priority: i % 3 === 0 ? Priority.HIGH : Priority.MEDIUM,
      reportCount: 1,
      resolvedDaysAgo: (i % 6) + 1,
      resolutionDurationDays: i % 2 === 0 ? 3.5 : 3.0,
    });
  }
  specs.push({
    code: makeCode(),
    categoryCode: 'STREET_LIGHT',
    title: 'Cụm đèn ngã tư mất điện toàn bộ',
    description: 'Cả đoạn 150m tối om, tiềm ẩn nguy cơ tai nạn buổi tối.',
    addressText: 'Ngã tư Vườn Mít, Phường Trấn Biên',
    lat: 10.9522,
    lng: 106.8258,
    status: IssueStatus.RECEIVED,
    priority: Priority.HIGH,
    reportCount: 1,
  });
  specs.push({
    code: makeCode(),
    categoryCode: 'STREET_LIGHT',
    title: 'Trụ đèn nghiêng và hở nắp tủ điện',
    description: 'Cần xác minh mức độ nguy hiểm điện giật gần khu dân cư.',
    addressText: 'Đường Võ Thị Sáu đoạn khu phố 4, Phường Trấn Biên',
    lat: 10.9551,
    lng: 106.8286,
    status: IssueStatus.VERIFYING,
    priority: Priority.CRITICAL,
    reportCount: 1,
  });
  specs.push({
    code: makeCode(),
    categoryCode: 'STREET_LIGHT',
    title: 'Đèn hẻm bị che khuất bởi tán cây và đứt dây',
    description: 'Đèn không sáng nhiều ngày qua.',
    addressText: 'Hẻm 82 khu phố 1, Phường Trấn Biên',
    lat: 10.9495,
    lng: 106.8195,
    status: IssueStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    reportCount: 1,
    overdue: true,
  });

  // FLOODING: 15 reports = 14 RESOLVED (1 each) + 1 PENDING_REVIEW (1)
  for (let i = 1; i <= 14; i++) {
    specs.push({
      code: makeCode(),
      categoryCode: 'FLOODING',
      title: `Điểm ngập cục bộ sau mưa lớn #${i}`,
      description: 'Miệng cống bị rác lá cây che lấp gây thoát nước chậm.',
      addressText: `Đoạn số ${30 + i * 3} đường Phạm Văn Thuận, Phường Trấn Biên`,
      lat: 10.948 + i * 0.00065,
      lng: 106.825 + (i % 4) * 0.0018,
      status: IssueStatus.RESOLVED,
      priority: Priority.HIGH,
      reportCount: 1,
      resolvedDaysAgo: (i % 5) + 1,
      resolutionDurationDays: i % 2 === 0 ? 3.3 : 3.1,
    });
  }
  specs.push({
    code: makeCode(),
    categoryCode: 'FLOODING',
    title: 'Nước đọng sâu trước cổng trường tiểu học',
    description: 'Ngập khoảng 25cm sau cơn mưa chiều, gây khó khăn đưa đón học sinh.',
    addressText: 'Cổng trường Tiểu học khu phố 2, Phường Trấn Biên',
    lat: 10.9519,
    lng: 106.8226,
    status: IssueStatus.PENDING_REVIEW,
    priority: Priority.HIGH,
    reportCount: 1,
  });

  return specs;
}

/**
 * Seeds baseline roles, departments, categories, demo accounts, and 64 demo reports.
 * Idempotent by default; pass reset=true to truncate and re-seed cleanly.
 */
export async function runSeed(
  dataSource: DataSource,
  options: { reset?: boolean } = {},
): Promise<SeedResult> {
  if (options.reset) {
    await dataSource.query(
      'TRUNCATE TABLE feedbacks, verifications, issue_media, progress_updates, reports, issues, issue_categories, users, departments, roles RESTART IDENTITY CASCADE',
    );
  }

  return dataSource.transaction(async (manager) => {
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

    const existingDemoIssue = await issueRepo.findOne({
      where: { code: 'HT-2026-001' },
    });
    if (existingDemoIssue && !options.reset) {
      return {
        skipped: true,
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

    // 1. Roles
    const roles = await roleRepo.save([
      roleRepo.create({
        name: RoleName.CITIZEN,
        description: 'Người dân địa phương gửi và theo dõi phản ánh',
      }),
      roleRepo.create({
        name: RoleName.STAFF,
        description: 'Cán bộ tiếp nhận & điều phối UBND Phường Trấn Biên',
      }),
      roleRepo.create({
        name: RoleName.VOLUNTEER,
        description: 'Thanh niên tình nguyện hỗ trợ xác minh tại chỗ',
      }),
      roleRepo.create({
        name: RoleName.ADMIN,
        description: 'Quản trị hệ thống và danh mục nền',
      }),
    ]);
    const roleMap = new Map(roles.map((r) => [r.name, r]));

    // 2. Departments
    const departments = await deptRepo.save([
      deptRepo.create({
        code: 'ROAD_MAINTENANCE',
        name: 'Đội duy tu đường bộ',
        contactPhone: '02513800101',
        description: 'Xử lý ổ gà, sụt lún mặt đường, vỉa hè và nắp hố ga',
      }),
      deptRepo.create({
        code: 'LIGHTING',
        name: 'Đội chiếu sáng đô thị',
        contactPhone: '02513800102',
        description: 'Bảo trì hệ thống đèn đường, trụ đèn và tủ điện công cộng',
      }),
      deptRepo.create({
        code: 'ENVIRONMENT',
        name: 'Tổ môi trường đô thị',
        contactPhone: '02513800103',
        description: 'Thu gom rác thải tự phát, vệ sinh công viên và lòng đường',
      }),
      deptRepo.create({
        code: 'DRAINAGE',
        name: 'Đội thoát nước',
        contactPhone: '02513800104',
        description: 'Khơi thông cống rãnh, xử lý các điểm ngập úng cục bộ',
      }),
    ]);
    const deptMap = new Map(departments.map((d) => [d.code, d]));

    // 3. Issue Categories
    const categories = await catRepo.save([
      catRepo.create({
        code: 'ROAD_SURFACE',
        name: 'Mặt đường / Ổ gà',
        defaultDepartmentId: deptMap.get('ROAD_MAINTENANCE')!.id,
        defaultPriority: Priority.HIGH,
        slaHours: 72,
        icon: 'construction',
      }),
      catRepo.create({
        code: 'STREET_LIGHT',
        name: 'Đèn đường',
        defaultDepartmentId: deptMap.get('LIGHTING')!.id,
        defaultPriority: Priority.MEDIUM,
        slaHours: 24,
        icon: 'lightbulb',
      }),
      catRepo.create({
        code: 'WASTE',
        name: 'Rác thải',
        defaultDepartmentId: deptMap.get('ENVIRONMENT')!.id,
        defaultPriority: Priority.MEDIUM,
        slaHours: 48,
        icon: 'trash-2',
      }),
      catRepo.create({
        code: 'FLOODING',
        name: 'Ngập nước',
        defaultDepartmentId: deptMap.get('DRAINAGE')!.id,
        defaultPriority: Priority.HIGH,
        slaHours: 12,
        icon: 'waves',
      }),
      catRepo.create({
        code: 'OTHER',
        name: 'Vấn đề khác',
        defaultDepartmentId: deptMap.get('ROAD_MAINTENANCE')!.id,
        defaultPriority: Priority.LOW,
        slaHours: 72,
        icon: 'alert-circle',
      }),
    ]);
    const catMap = new Map(categories.map((c) => [c.code, c]));

    // 4. Demo Users (3 vai trò chính + 2 tài khoản người dân phụ cho ME_TOO)
    const citizenRole = roleMap.get(RoleName.CITIZEN)!;
    const staffRole = roleMap.get(RoleName.STAFF)!;
    const volunteerRole = roleMap.get(RoleName.VOLUNTEER)!;

    const users = await userRepo.save([
      userRepo.create({
        roleId: citizenRole.id,
        fullName: 'Cô/Chú Minh',
        phone: '0901000001',
        ward: 'Phường Trấn Biên',
        largeTextMode: false,
      }),
      userRepo.create({
        roleId: staffRole.id,
        departmentId: deptMap.get('ROAD_MAINTENANCE')!.id,
        fullName: 'Chị Lan – Cán bộ UBND Phường Trấn Biên',
        phone: '0901000002',
        ward: 'Phường Trấn Biên',
      }),
      userRepo.create({
        roleId: volunteerRole.id,
        fullName: 'Bạn Hùng – Đoàn viên thanh niên',
        phone: '0901000003',
        ward: 'Phường Trấn Biên',
      }),
      userRepo.create({
        roleId: citizenRole.id,
        fullName: 'Anh Tuấn – Cư dân KP2',
        phone: '0901000004',
        ward: 'Phường Trấn Biên',
      }),
      userRepo.create({
        roleId: citizenRole.id,
        fullName: 'Chị Hoa – Cư dân KP3',
        phone: '0901000005',
        ward: 'Phường Trấn Biên',
      }),
    ]);

    const demoCitizen = users[0];
    const demoStaff = users[1];
    const demoVolunteer = users[2];
    const citizenPool = [users[0], users[3], users[4]];

    // 5. Issues, Reports, Media, ProgressUpdates, Verifications, Feedback
    const specs = buildIssueSpecs();
    let totalReports = 0;
    let resolvedIssues = 0;

    for (let idx = 0; idx < specs.length; idx++) {
      const spec = specs[idx];
      const category = catMap.get(spec.categoryCode)!;
      const defaultDept = departments.find(
        (d) => d.id === category.defaultDepartmentId,
      )!;
      const reporter = citizenPool[idx % citizenPool.length];

      let createdAt = daysBefore(DEMO_ANCHOR_DATE, 2);
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
        assignedById = demoStaff.id;
      } else if (spec.status === IssueStatus.IN_PROGRESS) {
        assignedDeptId = defaultDept.id;
        assignedById = demoStaff.id;
        dueAt = spec.overdue
          ? daysBefore(DEMO_ANCHOR_DATE, 1)
          : new Date(DEMO_ANCHOR_DATE.getTime() + 2 * 24 * 60 * 60 * 1000);
      }

      const beforeImageUrl = `/seed-media/${spec.categoryCode.toLowerCase()}-before.svg`;
      const afterImageUrl = `/seed-media/${spec.categoryCode.toLowerCase()}-after.svg`;
      const resolutionNote =
        spec.status === IssueStatus.RESOLVED
          ? 'Đã hoàn tất xử lý tại hiện trường kèm ảnh nghiệm thu.'
          : null;

      let stage = WorkflowStage.UNASSIGNED;
      if (spec.code === 'HT-2026-001') {
        stage = WorkflowStage.WORK_ACCEPTED;
      } else if (spec.status === IssueStatus.RECEIVED) {
        stage = WorkflowStage.RECEIVED;
      } else if (spec.status === IssueStatus.VERIFYING) {
        stage = WorkflowStage.VERIFICATION_REQUESTED;
      } else if (spec.status === IssueStatus.IN_PROGRESS) {
        stage = WorkflowStage.DEPARTMENT_ASSIGNED;
      } else if (spec.status === IssueStatus.RESOLVED) {
        stage = WorkflowStage.COMPLETED;
      }

      const isPublicApproved =
        spec.status === IssueStatus.IN_PROGRESS ||
        spec.status === IssueStatus.RESOLVED;

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
          ward: 'Phường Trấn Biên',
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
        const meTooUser = citizenPool[(idx + r) % citizenPool.length];
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

      if (
        spec.status === IssueStatus.IN_PROGRESS ||
        spec.status === IssueStatus.RESOLVED
      ) {
        await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: demoStaff.id,
            actionType: TimelineAction.ASSIGNED,
            fromStatus: IssueStatus.PENDING_REVIEW,
            toStatus: IssueStatus.IN_PROGRESS,
            previousStage: WorkflowStage.RECEIVED,
            newStage:
              spec.code === 'HT-2026-001'
                ? WorkflowStage.WORK_ACCEPTED
                : WorkflowStage.DEPARTMENT_ASSIGNED,
            content: `Đã giao ${defaultDept.name} xử lý.`,
            isPublic: true,
          }),
        );
      }

      if (spec.status === IssueStatus.VERIFYING) {
        await verificationRepo.save(
          verificationRepo.create({
            issueId: issue.id,
            requestedById: demoStaff.id,
            status: VerificationStatus.OPEN,
            instruction:
              'Nhờ thanh niên tình nguyện kiểm tra thực tế và chụp ảnh bổ sung.',
            dueAt: new Date(DEMO_ANCHOR_DATE.getTime() + 12 * 60 * 60 * 1000),
          }),
        );

        await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: demoStaff.id,
            actionType: TimelineAction.VERIFICATION_REQUESTED,
            fromStatus: IssueStatus.RECEIVED,
            toStatus: IssueStatus.VERIFYING,
            previousStage: WorkflowStage.RECEIVED,
            newStage: WorkflowStage.VERIFICATION_REQUESTED,
            content: 'Đã chuyển yêu cầu xác minh cho đội thanh niên tình nguyện.',
            isPublic: true,
          }),
        );
      }

      if (spec.status === IssueStatus.RESOLVED && resolvedAt) {
        const resolveUpdate = await progressRepo.save(
          progressRepo.create({
            issueId: issue.id,
            actorId: demoStaff.id,
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

        await mediaRepo.save(
          mediaRepo.create({
            issueId: issue.id,
            progressUpdateId: resolveUpdate.id,
            uploadedById: demoStaff.id,
            stage: MediaStage.AFTER,
            url: afterImageUrl,
            caption: `Ảnh sau xử lý (${spec.code})`,
          }),
        );

        if (idx % 3 === 0) {
          await feedbackRepo.save(
            feedbackRepo.create({
              issueId: issue.id,
              citizenId: demoCitizen.id,
              isSatisfied: true,
              rating: 5,
              comment: 'Xử lý nhanh, sạch sẽ và minh bạch.',
              reviewStatus: FeedbackReviewStatus.ACKNOWLEDGED,
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

        await mediaRepo.save(
          mediaRepo.create({
            issueId: issue.id,
            verificationId: verification.id,
            uploadedById: demoVolunteer.id,
            stage: MediaStage.VERIFICATION,
            url: '/seed-media/road_surface-verify.svg',
            caption: 'Ảnh thanh niên xác minh thực địa HT-2026-001',
          }),
        );
      }
    }

    return {
      skipped: false,
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

