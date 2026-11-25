import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ReportType } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import type { IssueMedia } from '../../media/entities/issue-media.entity.js';
import { Issue } from './issue.entity.js';

@Entity('reports')
export class Report extends BaseCoreEntity {
  @Index()
  @Column({ type: 'int' })
  issueId: number;

  @ManyToOne(() => Issue, (issue) => issue.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issueId' })
  issue: Relation<Issue>;

  @Index()
  @Column({ type: 'int' })
  reporterId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporterId' })
  reporter: Relation<User>;

  @Column({ type: 'enum', enum: ReportType, default: ReportType.INITIAL })
  reportType: ReportType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  addressText: string | null;

  @OneToMany('IssueMedia', (media: IssueMedia) => media.report)
  media: Relation<IssueMedia[]>;
}

