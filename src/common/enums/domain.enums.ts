export enum RoleName {
  CITIZEN = 'CITIZEN',
  STAFF = 'STAFF',
  VOLUNTEER = 'VOLUNTEER',
  ADMIN = 'ADMIN',
}

export enum IssueStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  RECEIVED = 'RECEIVED',
  VERIFYING = 'VERIFYING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum WorkflowStage {
  UNASSIGNED = 'unassigned',
  RECEIVED = 'received',
  NEEDS_INFORMATION = 'needs_information',
  NOT_ACCEPTED = 'not_accepted',
  VERIFICATION_REQUESTED = 'verification_requested',
  VOLUNTEER_ASSIGNED = 'volunteer_assigned',
  VERIFICATION_SUBMITTED = 'verification_submitted',
  DEPARTMENT_ASSIGNED = 'department_assigned',
  WORK_ACCEPTED = 'work_accepted',
  RESOLUTION_SUBMITTED = 'resolution_submitted',
  RESOLUTION_REVIEW = 'resolution_review',
  COMPLETED = 'completed',
  REOPENED = 'reopened',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ReportType {
  INITIAL = 'INITIAL',
  ME_TOO = 'ME_TOO',
  MERGED = 'MERGED',
}

export enum MediaStage {
  BEFORE = 'BEFORE',
  VERIFICATION = 'VERIFICATION',
  AFTER = 'AFTER',
}

export enum VerificationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VerificationOutcome {
  STILL_EXISTS = 'STILL_EXISTS',
  ALREADY_RESOLVED = 'ALREADY_RESOLVED',
  NOT_FOUND_OR_UNCLEAR = 'NOT_FOUND_OR_UNCLEAR',
}

export enum TimelineAction {
  CREATED = 'CREATED',
  ME_TOO_ADDED = 'ME_TOO_ADDED',
  MERGED = 'MERGED',
  RECEIVED = 'RECEIVED',
  ASSIGNED = 'ASSIGNED',
  VERIFICATION_REQUESTED = 'VERIFICATION_REQUESTED',
  VERIFICATION_SUBMITTED = 'VERIFICATION_SUBMITTED',
  PROGRESS_NOTE = 'PROGRESS_NOTE',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
  REJECTED = 'REJECTED',
}

export enum FeedbackReviewStatus {
  SUBMITTED = 'SUBMITTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  REOPENED = 'REOPENED',
}
