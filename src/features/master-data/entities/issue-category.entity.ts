import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Priority } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import type { Issue } from '../../issues/entities/issue.entity.js';
import { Department } from './department.entity.js';

@Entity('issue_categories')
export class IssueCategory extends BaseCoreEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', nullable: true })
  defaultDepartmentId: number | null;

  @ManyToOne(() => Department, (dept) => dept.defaultCategories, {
    nullable: true,
  })
  @JoinColumn({ name: 'defaultDepartmentId' })
  defaultDepartment: Relation<Department> | null;

  @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
  defaultPriority: Priority;

  @Column({ type: 'int', default: 72 })
  slaHours: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  icon: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('Issue', (issue: Issue) => issue.category)
  issues: Relation<Issue[]>;
}

