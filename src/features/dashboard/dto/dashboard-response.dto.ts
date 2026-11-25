export class DashboardCategoryMetricDto {
  categoryPublicId: string;
  code: string;
  name: string;
  totalIssues: number;
  resolvedCount: number;
  pendingCount: number;
  percentage: number;
}

export class DashboardWardMetricDto {
  wardPublicId?: string | null;
  code?: string | null;
  name: string;
  total: number;
  resolved: number;
  pending: number;
  overdue: number;
  resolvedRate: number;
}

export class DashboardMetricsDto {
  wardFilter?: string | null;
  totalReports: number;
  totalIssues: number;
  resolvedCount: number;
  resolvedRate: number;
  avgResolutionDays: number;
  pendingCount: number;
  overdueCount: number;
  reopenedCount: number;
  byCategory: DashboardCategoryMetricDto[];
  byWard: DashboardWardMetricDto[];
}

