import {
  FeedbackReviewStatus,
  IssueStatus,
  MediaStage,
  Priority,
  RoleName,
  TimelineAction,
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

export class PublicIssueSummaryDto {
  publicId: string;
  code: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: Priority;
  suggestedPriority: Priority | null;
  latitude: number;
  longitude: number;
  addressText: string;
  ward: string;
  thumbnailUrl: string | null;
  reportCount: number;
  dueAt: Date | null;
  resolvedAt: Date | null;
  isOverdue: boolean;
  needsReopenReview: boolean;
  category: IssueCategorySummaryDto;
  assignedDepartment: IssueDepartmentSummaryDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export class NearbyIssueItemDto extends PublicIssueSummaryDto {
  distanceMeters: number;
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
  content: string;
  actorRole: RoleName | null;
  actorLabel: string;
  createdAt: Date;
}

export class PublicFeedbackItemDto {
  publicId: string;
  isSatisfied: boolean;
  rating: number | null;
  comment: string | null;
  reviewStatus: FeedbackReviewStatus;
  createdAt: Date;
}

export class FeedbackSummaryDto {
  totalCount: number;
  satisfiedCount: number;
  unsatisfiedCount: number;
  averageRating: number | null;
  items: PublicFeedbackItemDto[];
}

export class PublicIssueDetailDto extends PublicIssueSummaryDto {
  resolutionNote: string | null;
  rejectionReason: string | null;
  aiSuggestedCategoryCode: string | null;
  aiConfidence: number | null;
  media: IssueMediaItemDto[];
  timeline: IssueTimelineItemDto[];
  feedbackSummary: FeedbackSummaryDto;
}
