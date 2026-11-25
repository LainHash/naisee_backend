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
  name: string;
  total: number;
  resolved: number;
}

export class DashboardMetricsDto {
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

