import type {
  IssueStatus,
  Priority,
  VerificationOutcome,
  VerificationStatus,
  WorkflowStage,
} from '../../../common/enums/domain.enums.js';
import type { IssueMediaItemDto } from '../../issues/dto/issue-response.dto.js';

export class VerificationIssueSummaryDto {
  publicId: string;
  code: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  stage: WorkflowStage;
  priority: Priority;
  latitude: number;
  longitude: number;
  addressText: string;
  ward: string;
  wardPublicId?: string | null;
  thumbnailUrl: string | null;
  reportCount: number;
  dueAt: Date | null;
  isOverdue: boolean;
  category: {
    publicId: string;
    code: string;
    name: string;
    icon: string | null;
  };
  media: IssueMediaItemDto[];
}

export class VerificationTaskDto {
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
  claimedByMe: boolean;
  volunteerPublicId: string | null;
  volunteerName: string | null;
  media: IssueMediaItemDto[];
  issue: VerificationIssueSummaryDto;
  distanceMeters?: number;
  createdAt: Date;
  updatedAt: Date;
}

