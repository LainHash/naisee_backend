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
import { Ward } from '../../../features/master-data/entities/ward.entity.js';
import { IssueMedia } from '../../../features/media/entities/issue-media.entity.js';
import { Verification } from '../../../features/verifications/entities/verification.entity.js';
import { upsertWardsAndBackfill } from './ward-seed.helper.js';

export interface SeedResult {
  skipped: boolean;
  wards: number;
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
  ward?: string;
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
      lat: 10.9425,
      lng: 106.8255,
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
      lat: 10.9389,
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
      lat: 10.9412,
      lng: 106.8325,
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
      lat: 10.928 + i * 0.0009,
      lng: 106.818 + (i % 5) * 0.0045,
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
      lat: 10.9332 + i * 0.0022,
      lng: 106.8245 + i * 0.0025,
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
    lat: 10.9435,
    lng: 106.8215,
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
    lat: 10.9318,
    lng: 106.8345,
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
      lat: 10.927 + i * 0.0011,
      lng: 106.82 + (i % 4) * 0.0052,
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
    lat: 10.9395,
    lng: 106.8285,
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
    lat: 10.9415,
    lng: 106.8365,
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
    lat: 10.9345,
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
      lat: 10.929 + i * 0.001,
      lng: 106.823 + (i % 4) * 0.0045,
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
    lat: 10.9365,
    lng: 106.8255,
    status: IssueStatus.PENDING_REVIEW,
    priority: Priority.HIGH,
    reportCount: 1,
  });

  // Multi-ward Dong Nai distribution across 14 additional wards
  const multiWardSpecs: Array<{
    ward: string;
    categoryCode: IssueSeedSpec['categoryCode'];
    title: string;
    description: string;
    addressText: string;
    lat: number;
    lng: number;
    status: IssueStatus;
    priority: Priority;
    reportCount: number;
    resolvedDaysAgo?: number;
  }> = [
    {
      ward: 'Phường Biên Hòa',
      categoryCode: 'ROAD_SURFACE',
      title: 'Mặt đường Nguyễn Ái Quốc đoạn Hóa An xuống cấp',
      description: 'Xuất hiện nhiều ổ gà lớn sau mùa mưa gây ùn tắc giờ cao điểm.',
      addressText: 'Đường Nguyễn Ái Quốc, khu vực Hóa An, Phường Biên Hòa',
      lat: 10.9443,
      lng: 106.77,
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      reportCount: 3,
    },
    {
      ward: 'Phường Tam Hiệp',
      categoryCode: 'FLOODING',
      title: 'Ngập cục bộ ngã tư đường Đồng Khởi – Phạm Văn Thuận',
      description: 'Nước thoát chậm sau mưa lớn gây ngập nửa bánh xe.',
      addressText: 'Ngã tư Đồng Khởi – Phạm Văn Thuận, Phường Tam Hiệp',
      lat: 10.951,
      lng: 106.8566,
      status: IssueStatus.RESOLVED,
      priority: Priority.HIGH,
      reportCount: 2,
      resolvedDaysAgo: 2,
    },
    {
      ward: 'Phường Long Bình',
      categoryCode: 'WASTE',
      title: 'Điểm tập kết rác tự phát gần khu công nghiệp',
      description: 'Rác sinh hoạt và bao bì tồn đọng ven lề đường.',
      addressText: 'Đường Bùi Văn Hòa, Phường Long Bình',
      lat: 10.9325,
      lng: 106.9015,
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      reportCount: 2,
    },
    {
      ward: 'Phường Trảng Dài',
      categoryCode: 'STREET_LIGHT',
      title: 'Tuyến đèn chiếu sáng đường Nguyễn Khuyến mất điện',
      description: 'Khoảng 8 trụ đèn liên tiếp không sáng từ 18h30.',
      addressText: 'Đường Nguyễn Khuyến, Phường Trảng Dài',
      lat: 11.0059,
      lng: 106.8858,
      status: IssueStatus.VERIFYING,
      priority: Priority.HIGH,
      reportCount: 1,
    },
    {
      ward: 'Phường Hố Nai',
      categoryCode: 'ROAD_SURFACE',
      title: 'Nắp cống gãy chắn ngang lề đường Quốc lộ 1A',
      description: 'Cần thay mới nắp bê tông bảo đảm an toàn cho xe máy.',
      addressText: 'Quốc lộ 1A đoạn Tân Hòa, Phường Hố Nai',
      lat: 10.9796,
      lng: 106.9159,
      status: IssueStatus.RESOLVED,
      priority: Priority.HIGH,
      reportCount: 1,
      resolvedDaysAgo: 3,
    },
    {
      ward: 'Phường Long Hưng',
      categoryCode: 'FLOODING',
      title: 'Triều cường kết hợp mưa gây ngập tuyến nhánh Long Bình Tân',
      description: 'Nước tràn mặt đường khoảng 20cm vào buổi chiều.',
      addressText: 'Ngã ba Long Bình Tân, Phường Long Hưng',
      lat: 10.8859,
      lng: 106.8637,
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      reportCount: 2,
    },
    {
      ward: 'Phường Tân Triều',
      categoryCode: 'STREET_LIGHT',
      title: 'Đèn đường khu vực bến đò Tân Triều chập chờn',
      description: 'Đèn nhấp nháy liên tục gây khó quan sát ban đêm.',
      addressText: 'Đường Hương lộ 9, Phường Tân Triều',
      lat: 10.9951,
      lng: 106.8116,
      status: IssueStatus.RESOLVED,
      priority: Priority.MEDIUM,
      reportCount: 1,
      resolvedDaysAgo: 4,
    },
    {
      ward: 'Phường Phước Tân',
      categoryCode: 'WASTE',
      title: 'Rác thải công nghiệp nhẹ đổ trộm ven đường tránh',
      description: 'Cần thu gom và cắm biển cảnh báo khu vực.',
      addressText: 'Đường Võ Nguyên Giáp, Phường Phước Tân',
      lat: 10.909,
      lng: 106.9392,
      status: IssueStatus.PENDING_REVIEW,
      priority: Priority.MEDIUM,
      reportCount: 1,
    },
    {
      ward: 'Phường Tam Phước',
      categoryCode: 'ROAD_SURFACE',
      title: 'Lún mặt đường trước cổng khu dân cư Tam Phước',
      description: 'Xe tải trọng lớn làm lún vệt bánh xe dài 10m.',
      addressText: 'Quốc lộ 51, Phường Tam Phước',
      lat: 10.8426,
      lng: 106.929,
      status: IssueStatus.RESOLVED,
      priority: Priority.MEDIUM,
      reportCount: 1,
      resolvedDaysAgo: 5,
    },
    {
      ward: 'Phường Long Khánh',
      categoryCode: 'STREET_LIGHT',
      title: 'Cụm đèn quảng trường công viên Long Khánh tắt bóng',
      description: 'Hai trụ đèn chính bị hỏng bộ nguồn.',
      addressText: 'Đường Hùng Vương, Phường Long Khánh',
      lat: 10.9214,
      lng: 107.2861,
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      reportCount: 2,
    },
    {
      ward: 'Phường Bảo Vinh',
      categoryCode: 'FLOODING',
      title: 'Rãnh thoát nước bị đất đá bồi lấp sau mưa',
      description: 'Cần nạo vét trước đợt mưa cuối tuần.',
      addressText: 'Đường Lê A, Phường Bảo Vinh',
      lat: 10.9643,
      lng: 107.2736,
      status: IssueStatus.RESOLVED,
      priority: Priority.HIGH,
      reportCount: 1,
      resolvedDaysAgo: 1,
    },
    {
      ward: 'Phường Chơn Thành',
      categoryCode: 'ROAD_SURFACE',
      title: 'Ổ gà tại vòng xoay trung tâm Chơn Thành',
      description: 'Mặt nhựa bong tróc cạnh vạch kẻ đường.',
      addressText: 'Quốc lộ 13, Phường Chơn Thành',
      lat: 11.4098,
      lng: 106.6365,
      status: IssueStatus.RESOLVED,
      priority: Priority.HIGH,
      reportCount: 1,
      resolvedDaysAgo: 3,
    },
    {
      ward: 'Phường Đồng Xoài',
      categoryCode: 'WASTE',
      title: 'Thùng rác công cộng khu vực chợ Đồng Xoài quá tải',
      description: 'Cần tăng tần suất thu gom vào cuối ngày.',
      addressText: 'Đường Phú Riềng Đỏ, Phường Đồng Xoài',
      lat: 11.5269,
      lng: 106.788,
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      reportCount: 3,
    },
    {
      ward: 'Phường Phước Long',
      categoryCode: 'STREET_LIGHT',
      title: 'Đèn chiếu sáng tuyến dốc khu vực trung tâm Phước Long hỏng',
      description: 'Đoạn đường dốc thiếu ánh sáng vào buổi tối.',
      addressText: 'Đường ĐT 741, Phường Phước Long',
      lat: 11.7635,
      lng: 107.0349,
      status: IssueStatus.RECEIVED,
      priority: Priority.HIGH,
      reportCount: 1,
    },
  ];

  for (const item of multiWardSpecs) {
    specs.push({
      code: makeCode(),
      ...item,
      resolutionDurationDays: item.status === IssueStatus.RESOLVED ? 2.8 : undefined,
    });
  }

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
      'TRUNCATE TABLE feedbacks, verifications, issue_media, progress_updates, reports, issues, issue_categories, users, departments, roles, wards RESTART IDENTITY CASCADE',
    );
  }

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

    const existingDemoIssue = await issueRepo.findOne({
      where: { code: 'HT-2026-001' },
    });
    if (existingDemoIssue && !options.reset) {
      return {
        skipped: true,
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
    const adminRole = roleMap.get(RoleName.ADMIN)!;

    const users = await userRepo.save([
      userRepo.create({
        roleId: citizenRole.id,
        fullName: 'Cô/Chú Minh',
        phone: '0901000001',
        ward: 'Phường Trấn Biên',
        wardId: tranBienWard?.id ?? null,
        largeTextMode: false,
      }),
      userRepo.create({
        roleId: staffRole.id,
        departmentId: deptMap.get('ROAD_MAINTENANCE')!.id,
        fullName: 'Chị Lan – Cán bộ UBND Đồng Nai',
        phone: '0901000002',
        ward: 'Phường Trấn Biên',
        wardId: tranBienWard?.id ?? null,
      }),
      userRepo.create({
        roleId: volunteerRole.id,
        fullName: 'Bạn Hùng – Đoàn viên thanh niên',
        phone: '0901000003',
        ward: 'Phường Trấn Biên',
        wardId: tranBienWard?.id ?? null,
      }),
      userRepo.create({
        roleId: citizenRole.id,
        fullName: 'Anh Tuấn – Cư dân Biên Hòa',
        phone: '0901000004',
        ward: 'Phường Biên Hòa',
        wardId: wardIdByName.get('phường biên hòa') ?? null,
      }),
      userRepo.create({
        roleId: citizenRole.id,
        fullName: 'Chị Hoa – Cư dân Long Khánh',
        phone: '0901000005',
        ward: 'Phường Long Khánh',
        wardId: wardIdByName.get('phường long khánh') ?? null,
      }),
      userRepo.create({
        roleId: adminRole.id,
        fullName: 'Quản trị viên Cổng Tỉnh Đồng Nai',
        phone: '0901000099',
        ward: 'Phường Trấn Biên',
        wardId: tranBienWard?.id ?? null,
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
      const reporter =
        spec.code === 'HT-2026-001'
          ? users[3]
          : citizenPool[idx % citizenPool.length];

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

          const targetWardName = spec.ward ?? 'Phường Trấn Biên';
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
        const meTooUser =
          spec.code === 'HT-2026-001'
            ? (r % 2 === 1 ? users[4] : users[3])
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

    await manager.query('CREATE SEQUENCE IF NOT EXISTS issue_code_seq');
    await manager.query(
      "SELECT setval('issue_code_seq', GREATEST(COALESCE((SELECT MAX(id) FROM issues), 0), 1), true)",
    );

    return {
      skipped: false,
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

