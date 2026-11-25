import { IssueStatus, WorkflowStage } from '../../../common/enums/domain.enums.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  it('returns metrics across all active wards including zero-issue wards', async () => {
    const issueQb = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        {
          id: 1,
          categoryId: 1,
          status: IssueStatus.RESOLVED,
          stage: WorkflowStage.COMPLETED,
          ward: 'Phường Trấn Biên',
          wardId: 1,
          dueAt: null,
          needsReopenReview: false,
          createdAt: new Date('2026-11-20T00:00:00Z'),
          resolvedAt: new Date('2026-11-22T00:00:00Z'),
        },
      ]),
    };

    const reportQb = {
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(3),
    };

    const issueRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(issueQb),
    };
    const reportRepo = {
      count: vi.fn().mockResolvedValue(5),
      createQueryBuilder: vi.fn().mockReturnValue(reportQb),
    };
    const categoryRepo = {
      find: vi.fn().mockResolvedValue([
        { id: 1, publicId: 'cat-1', code: 'WASTE', name: 'Rác thải' },
      ]),
    };
    const wardRepo = {
      find: vi.fn().mockResolvedValue([
        { id: 1, publicId: 'ward-1', code: 'DN-TRAN-BIEN', name: 'Phường Trấn Biên' },
        { id: 2, publicId: 'ward-2', code: 'DN-LONG-KHANH', name: 'Phường Long Khánh' },
      ]),
    };

    const service = new DashboardService(
      issueRepo as never,
      reportRepo as never,
      categoryRepo as never,
      wardRepo as never,
    );

    const allMetrics = await service.getMetrics({});
    expect(allMetrics.totalReports).toBe(5);
    expect(allMetrics.totalIssues).toBe(1);
    expect(allMetrics.byWard).toEqual([
      {
        wardPublicId: 'ward-1',
        code: 'DN-TRAN-BIEN',
        name: 'Phường Trấn Biên',
        total: 1,
        resolved: 1,
        pending: 0,
        overdue: 0,
        resolvedRate: 100,
      },
      {
        wardPublicId: 'ward-2',
        code: 'DN-LONG-KHANH',
        name: 'Phường Long Khánh',
        total: 0,
        resolved: 0,
        pending: 0,
        overdue: 0,
        resolvedRate: 0,
      },
    ]);

    const filteredMetrics = await service.getMetrics({
      wardPublicId: 'ward-1',
    });
    expect(filteredMetrics.wardFilter).toBe('Phường Trấn Biên');
    expect(filteredMetrics.totalReports).toBe(3);
    expect(issueQb.andWhere).toHaveBeenCalledWith(
      'wardUnit.publicId = :wardPublicId',
      { wardPublicId: 'ward-1' },
    );
  });
});

