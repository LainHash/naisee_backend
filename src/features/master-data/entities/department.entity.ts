import { Column, Entity, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import type { User } from '../../auth/entities/user.entity.js';
import type { Issue } from '../../issues/entities/issue.entity.js';
import type { IssueCategory } from './issue-category.entity.js';

@Entity('departments')
export class Department extends BaseCoreEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('User', (user: User) => user.department)
  users: Relation<User[]>;

  @OneToMany('IssueCategory', (cat: IssueCategory) => cat.defaultDepartment)
  defaultCategories: Relation<IssueCategory[]>;

  @OneToMany('Issue', (issue: Issue) => issue.assignedDepartment)
  assignedIssues: Relation<Issue[]>;
}

