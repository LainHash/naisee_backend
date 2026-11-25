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

export class IssueCategorySummaryDto {
  publicId: string;
  code: string;
  name: string;
  icon: string | null;
  slaHours: number;
}

export class IssueDepartmentSummaryDto {
  publicId: string;
  code: string;
  name: string;
}

export class PublicReviewDto {
  verified: boolean;
  approvedAt: Date | null;
}

export class PublicIssueSummaryDto {
  publicId: string;
  code: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  stage: WorkflowStage;
  priority: Priority;
  suggestedPriority: Priority | null;
  latitude: number;
  longitude: number;
  addressText: string;
  ward: string;
  thumbnailUrl: string | null;
  reportCount: number;
  assignedUnit: string | null;
  dueAt: Date | null;
  deadlineAt: Date | null;
  resolvedAt: Date | null;
  isOverdue: boolean;
  isDuplicate: boolean;
  needsReopenReview: boolean;
  publicReview: PublicReviewDto;
  category: IssueCategorySummaryDto;
  assignedDepartment: IssueDepartmentSummaryDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export class NearbyIssueItemDto extends PublicIssueSummaryDto {
  distanceMeters: number;
}

export class MyIssueItemDto extends PublicIssueSummaryDto {
  intakeNote: string | null;
  rejectionReason: string | null;
  myReportTypes: ReportType[];
}

export class IssueMediaItemDto {
  publicId: string;
  stage: MediaStage;
  url: string;
  caption: string | null;
  createdAt: Date;
}

export class IssueTimelineItemDto {
  publicId: string;
  actionType: TimelineAction;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus | null;
  previousStage: WorkflowStage | null;
  newStage: WorkflowStage | null;
  content: string;
  actorRole: RoleName | null;
  actorLabel: string;
  createdAt: Date;
  timestamp: Date;
}

export class PublicFeedbackItemDto {
  publicId: string;
  isSatisfied: boolean;
  rating: number | null;
  reason: string | null;
  comment: string | null;
  reviewStatus: FeedbackReviewStatus;
  reviewNote: string | null;
  createdAt: Date;
}

export class FeedbackSummaryDto {
  totalCount: number;
  satisfiedCount: number;
  unsatisfiedCount: number;
  averageRating: number | null;
  items: PublicFeedbackItemDto[];
}

export class IssueVerificationSummaryDto {
  publicId: string;
  status: VerificationStatus;
  instruction: string | null;
  dueAt: Date | null;
  outcome: VerificationOutcome | null;
  isIssueConfirmed: boolean | null;
  verifiedLatitude: number | null;
  verifiedLongitude: number | null;
  safetyRiskNote: string | null;
  resultNote: string | null;
  completedAt: Date | null;
  volunteerLabel: string | null;
}

export class PublicIssueDetailDto extends PublicIssueSummaryDto {
  intakeNote: string | null;
  resolutionNote: string | null;
  rejectionReason: string | null;
  aiSuggestedCategoryCode: string | null;
  aiConfidence: number | null;
  media: IssueMediaItemDto[];
  timeline: IssueTimelineItemDto[];
  latestVerification: IssueVerificationSummaryDto | null;
  feedbackSummary: FeedbackSummaryDto;
}

export class StaffIssueItemDto extends PublicIssueSummaryDto {
  intakeNote: string | null;
  rejectionReason: string | null;
  priorityReason: string | null;
}

export class StaffIssueDetailDto extends PublicIssueDetailDto {
  priorityReason: string | null;
}
