import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { FeedbackReviewStatus } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { Issue } from '../../issues/entities/issue.entity.js';

@Entity('feedbacks')
export class Feedback extends BaseCoreEntity {
  @Index()
  @Column({ type: 'int' })
  issueId: number;

  @ManyToOne(() => Issue, (issue) => issue.feedbacks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issueId' })
  issue: Relation<Issue>;

  @Column({ type: 'int' })
  citizenId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'citizenId' })
  citizen: Relation<User>;

  @Column({ type: 'boolean' })
  isSatisfied: boolean;

  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: FeedbackReviewStatus,
    default: FeedbackReviewStatus.SUBMITTED,
  })
  reviewStatus: FeedbackReviewStatus;

  @Column({ type: 'int', nullable: true })
  reviewedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Relation<User> | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;
}

