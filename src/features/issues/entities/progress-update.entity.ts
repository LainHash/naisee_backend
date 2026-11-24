import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import {
  IssueStatus,
  TimelineAction,
} from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import type { IssueMedia } from '../../media/entities/issue-media.entity.js';
import { Issue } from './issue.entity.js';

@Entity('progress_updates')
export class ProgressUpdate extends BaseCoreEntity {
  @Index()
  @Column({ type: 'int' })
  issueId: number;

  @ManyToOne(() => Issue, (issue) => issue.progressUpdates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'issueId' })
  issue: Relation<Issue>;

  @Column({ type: 'int' })
  actorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actorId' })
  actor: Relation<User>;

  @Column({ type: 'enum', enum: TimelineAction })
  actionType: TimelineAction;

  @Column({ type: 'enum', enum: IssueStatus, nullable: true })
  fromStatus: IssueStatus | null;

  @Column({ type: 'enum', enum: IssueStatus, nullable: true })
  toStatus: IssueStatus | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @OneToMany('IssueMedia', (media: IssueMedia) => media.progressUpdate)
  media: Relation<IssueMedia[]>;
}

