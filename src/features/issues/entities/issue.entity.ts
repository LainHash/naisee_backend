import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { IssueStatus, Priority } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import type { Feedback } from '../../feedback/entities/feedback.entity.js';
import { Department } from '../../master-data/entities/department.entity.js';
import { IssueCategory } from '../../master-data/entities/issue-category.entity.js';
import type { IssueMedia } from '../../media/entities/issue-media.entity.js';
import type { Verification } from '../../verifications/entities/verification.entity.js';
import type { ProgressUpdate } from './progress-update.entity.js';
import type { Report } from './report.entity.js';

@Entity('issues')
export class Issue extends BaseCoreEntity {
  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'int' })
  categoryId: number;

  @ManyToOne(() => IssueCategory, (cat) => cat.issues)
  @JoinColumn({ name: 'categoryId' })
  category: Relation<IssueCategory>;

  @Index()
  @Column({
    type: 'enum',
    enum: IssueStatus,
    default: IssueStatus.PENDING_REVIEW,
  })
  status: IssueStatus;

  @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
  priority: Priority;

  @Column({ type: 'enum', enum: Priority, nullable: true })
  suggestedPriority: Priority | null;

  @Column({ type: 'text', nullable: true })
  priorityReason: string | null;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'varchar', length: 500 })
  addressText: string;

  @Column({ type: 'varchar', length: 128, default: 'Phường Trấn Biên' })
  ward: string;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'int', default: 1 })
  reportCount: number;

  @Column({ type: 'int' })
  createdById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: Relation<User>;

  @Column({ type: 'int', nullable: true })
  assignedDepartmentId: number | null;

  @ManyToOne(() => Department, (dept) => dept.assignedIssues, {
    nullable: true,
  })
  @JoinColumn({ name: 'assignedDepartmentId' })
  assignedDepartment: Relation<Department> | null;

  @Column({ type: 'int', nullable: true })
  assignedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedById' })
  assignedBy: Relation<User> | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  needsReopenReview: boolean;

  @Column({ type: 'int', nullable: true })
  aiSuggestedCategoryId: number | null;

  @Column({ type: 'double precision', nullable: true })
  aiConfidence: number | null;

  @OneToMany('Report', (report: Report) => report.issue)
  reports: Relation<Report[]>;

  @OneToMany('IssueMedia', (media: IssueMedia) => media.issue)
  media: Relation<IssueMedia[]>;

  @OneToMany('Verification', (verification: Verification) => verification.issue)
  verifications: Relation<Verification[]>;

  @OneToMany('ProgressUpdate', (update: ProgressUpdate) => update.issue)
  progressUpdates: Relation<ProgressUpdate[]>;

  @OneToMany('Feedback', (feedback: Feedback) => feedback.issue)
  feedbacks: Relation<Feedback[]>;
}

