import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  IssueStatus,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import { Issue } from '../../issues/entities/issue.entity.js';
import { Report } from '../../issues/entities/report.entity.js';
import { IssueCategory } from '../../master-data/entities/issue-category.entity.js';
import { Ward } from '../../master-data/entities/ward.entity.js';
import type {
  DashboardMetricsDto,
  DashboardWardMetricDto,
} from '../dto/dashboard-response.dto.js';
import type { QueryDashboardDto } from '../dto/query-dashboard.dto.js';

interface WardBucket {
  wardPublicId: string | null;
  code: string | null;
  name: string;
  total: number;
  resolved: number;
  pending: number;
  overdue: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(IssueCategory)
    private readonly categoryRepo: Repository<IssueCategory>,
    @InjectRepository(Ward)
    private readonly wardRepo: Repository<Ward>,
  ) {}

  async getMetrics(query: QueryDashboardDto = {}): Promise<DashboardMetricsDto> {
    const now = new Date();
    const hasWardFilter = Boolean(query.wardPublicId || query.ward?.trim());

    const issueQb = this.issueRepo
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.category', 'category')
      .leftJoinAndSelect('issue.wardUnit', 'wardUnit')
      .where('issue.isDuplicate = :isDuplicate', { isDuplicate: false });
    this.applyWardFilter(issueQb, query);

    const reportCountPromise = hasWardFilter
      ? this.countFilteredReports(query)
      : this.reportRepo.count();

    const [issues, totalReports, categories, activeWards] = await Promise.all([
      issueQb.getMany(),
      reportCountPromise,
      this.categoryRepo.find({
        where: { isActive: true },
        order: { id: 'ASC' },
      }),
      this.wardRepo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
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

    const overdueCount = issues.filter((item) => this.isOverdue(item, now)).length;

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

    const byWard = this.buildWardBreakdown(activeWards, issues, query, now);

    const matchedWardLabel = query.wardPublicId
      ? (activeWards.find((w) => w.publicId === query.wardPublicId)?.name ??
        query.wardPublicId)
      : query.ward?.trim() || null;

    return {
      wardFilter: matchedWardLabel,
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

  private applyWardFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: QueryDashboardDto,
  ): void {
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
  }

  private async countFilteredReports(query: QueryDashboardDto): Promise<number> {
    const qb = this.reportRepo
      .createQueryBuilder('report')
      .innerJoin('report.issue', 'issue')
      .leftJoin('issue.wardUnit', 'wardUnit')
      .where('issue.isDuplicate = :isDuplicate', { isDuplicate: false });
    this.applyWardFilter(qb, query);
    return qb.getCount();
  }

  private isOverdue(issue: Issue, now: Date): boolean {
    return (
      issue.dueAt !== null &&
      issue.status !== IssueStatus.RESOLVED &&
      issue.status !== IssueStatus.REJECTED &&
      now.getTime() > issue.dueAt.getTime()
    );
  }

  private buildWardBreakdown(
    activeWards: Ward[],
    issues: Issue[],
    query: QueryDashboardDto,
    now: Date,
  ): DashboardWardMetricDto[] {
    const wardBuckets = new Map<string, WardBucket>();
    const wardKeyById = new Map<number, string>();

    const wardTerm = query.ward?.trim().toLowerCase();
    const seededWards = activeWards.filter((ward) => {
      if (query.wardPublicId && ward.publicId !== query.wardPublicId) {
        return false;
      }
      if (wardTerm && !ward.name.toLowerCase().includes(wardTerm)) {
        return false;
      }
      return true;
    });

    for (const ward of seededWards) {
      const key = ward.name.trim().toLowerCase();
      wardBuckets.set(key, {
        wardPublicId: ward.publicId,
        code: ward.code,
        name: ward.name,
        total: 0,
        resolved: 0,
        pending: 0,
        overdue: 0,
      });
      wardKeyById.set(ward.id, key);
    }

    for (const issue of issues) {
      const wardName =
        issue.wardUnit?.name ?? issue.ward?.trim() ?? 'Chưa xác định';
      const key =
        (issue.wardId !== null ? wardKeyById.get(issue.wardId) : undefined) ??
        wardName.toLowerCase();

      const bucket = wardBuckets.get(key) ?? {
        wardPublicId: issue.wardUnit?.publicId ?? null,
        code: issue.wardUnit?.code ?? null,
        name: wardName,
        total: 0,
        resolved: 0,
        pending: 0,
        overdue: 0,
      };

      bucket.total += 1;
      if (issue.status === IssueStatus.RESOLVED) {
        bucket.resolved += 1;
      } else if (issue.status !== IssueStatus.REJECTED) {
        bucket.pending += 1;
      }
      if (this.isOverdue(issue, now)) {
        bucket.overdue += 1;
      }

      wardBuckets.set(key, bucket);
    }

    return Array.from(wardBuckets.values())
      .map((entry) => ({
        wardPublicId: entry.wardPublicId,
        code: entry.code,
        name: entry.name,
        total: entry.total,
        resolved: entry.resolved,
        pending: entry.pending,
        overdue: entry.overdue,
        resolvedRate:
          entry.total > 0
            ? Number(((entry.resolved / entry.total) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name, 'vi');
      });
  }
}
