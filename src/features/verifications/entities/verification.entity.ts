import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { VerificationStatus } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { Issue } from '../../issues/entities/issue.entity.js';
import type { IssueMedia } from '../../media/entities/issue-media.entity.js';

@Entity('verifications')
export class Verification extends BaseCoreEntity {
  @Index()
  @Column({ type: 'int' })
  issueId: number;

  @ManyToOne(() => Issue, (issue) => issue.verifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'issueId' })
  issue: Relation<Issue>;

  @Column({ type: 'int' })
  requestedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requestedById' })
  requestedBy: Relation<User>;

  @Index()
  @Column({ type: 'int', nullable: true })
  volunteerId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'volunteerId' })
  volunteer: Relation<User> | null;

  @Index()
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.OPEN,
  })
  status: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  instruction: string | null;

  @Column({ type: 'boolean', nullable: true })
  isIssueConfirmed: boolean | null;

  @Column({ type: 'text', nullable: true })
  safetyRiskNote: string | null;

  @Column({ type: 'text', nullable: true })
  resultNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany('IssueMedia', (media: IssueMedia) => media.verification)
  media: Relation<IssueMedia[]>;
}

