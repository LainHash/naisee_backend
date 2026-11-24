import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { MediaStage } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { Issue } from '../../issues/entities/issue.entity.js';
import { ProgressUpdate } from '../../issues/entities/progress-update.entity.js';
import { Report } from '../../issues/entities/report.entity.js';
import type { Verification } from '../../verifications/entities/verification.entity.js';

@Entity('issue_media')
export class IssueMedia extends BaseCoreEntity {
  @Index()
  @Column({ type: 'int' })
  issueId: number;

  @ManyToOne(() => Issue, (issue) => issue.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issueId' })
  issue: Relation<Issue>;

  @Column({ type: 'int', nullable: true })
  reportId: number | null;

  @ManyToOne(() => Report, (report) => report.media, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reportId' })
  report: Relation<Report> | null;

  @Column({ type: 'int', nullable: true })
  verificationId: number | null;

  @ManyToOne('Verification', (verification: Verification) => verification.media, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'verificationId' })
  verification: Relation<Verification> | null;

  @Column({ type: 'int', nullable: true })
  progressUpdateId: number | null;

  @ManyToOne(() => ProgressUpdate, (update) => update.media, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'progressUpdateId' })
  progressUpdate: Relation<ProgressUpdate> | null;

  @Column({ type: 'int' })
  uploadedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: Relation<User>;

  @Column({ type: 'enum', enum: MediaStage })
  stage: MediaStage;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  caption: string | null;
}

