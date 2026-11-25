import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  IssueStatus,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import { Issue } from '../../issues/entities/issue.entity.js';
import { Report } from '../../issues/entities/report.entity.js';
import { IssueCategory } from '../../master-data/entities/issue-category.entity.js';
import type { DashboardMetricsDto } from '../dto/dashboard-response.dto.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(IssueCategory)
    private readonly categoryRepo: Repository<IssueCategory>,
  ) {}

  async getMetrics(): Promise<DashboardMetricsDto> {
    const now = new Date();
    const [issues, totalReports, categories] = await Promise.all([
      this.issueRepo.find({
        where: { isDuplicate: false },
        relations: { category: true },
      }),
      this.reportRepo.count(),
      this.categoryRepo.find({
        where: { isActive: true },
        order: { id: 'ASC' },
      }),
    ]);

    const totalIssues = issues.length;
    const resolvedIssues = issues.filter(
      (item) => item.status === IssueStatus.RESOLVED,
    );
    const resolvedCount = resolvedIssues.length;
    const resolvedRate =
      totalIssues > 0
        ? Number(((resolvedCount / totalIssues) * 100).toFixed(1))
        : 0;

    const resolutionDurationsDays = resolvedIssues
      .filter((item): item is Issue & { resolvedAt: Date } =>
        Boolean(item.resolvedAt),
      )
      .map(
        (item) =>
          Math.max(0, item.resolvedAt.getTime() - item.createdAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
    const avgResolutionDays =
      resolutionDurationsDays.length > 0
        ? Number(
            (
              resolutionDurationsDays.reduce((sum, days) => sum + days, 0) /
              resolutionDurationsDays.length
            ).toFixed(1),
          )
        : 0;

    const pendingCount = issues.filter(
      (item) =>
        item.status !== IssueStatus.RESOLVED &&
        item.status !== IssueStatus.REJECTED,
    ).length;

    const overdueCount = issues.filter(
      (item) =>
        item.dueAt !== null &&
        item.status !== IssueStatus.RESOLVED &&
        item.status !== IssueStatus.REJECTED &&
        now.getTime() > item.dueAt.getTime(),
    ).length;

    const reopenedCount = issues.filter(
      (item) =>
        item.needsReopenReview || item.stage === WorkflowStage.REOPENED,
    ).length;

    const byCategory = categories.map((category) => {
      const matching = issues.filter((item) => item.categoryId === category.id);
      const catResolved = matching.filter(
        (item) => item.status === IssueStatus.RESOLVED,
      ).length;
      const catPending = matching.filter(
        (item) =>
          item.status !== IssueStatus.RESOLVED &&
          item.status !== IssueStatus.REJECTED,
      ).length;

      return {
        categoryPublicId: category.publicId,
        code: category.code,
        name: category.name,
        totalIssues: matching.length,
        resolvedCount: catResolved,
        pendingCount: catPending,
        percentage:
          totalIssues > 0
            ? Number(((matching.length / totalIssues) * 100).toFixed(1))
            : 0,
      };
    });

    const wardMap = new Map<string, { total: number; resolved: number }>();
    for (const issue of issues) {
      const wardName = issue.ward?.trim() || 'Phường Trấn Biên';
      const entry = wardMap.get(wardName) ?? { total: 0, resolved: 0 };
      entry.total += 1;
      if (issue.status === IssueStatus.RESOLVED) {
        entry.resolved += 1;
      }
      wardMap.set(wardName, entry);
    }

    const byWard = Array.from(wardMap.entries()).map(([name, counts]) => ({
      name,
      total: counts.total,
      resolved: counts.resolved,
    }));

    return {
      totalReports,
      totalIssues,
      resolvedCount,
      resolvedRate,
      avgResolutionDays,
      pendingCount,
      overdueCount,
      reopenedCount,
      byCategory,
      byWard,
    };
  }
}
