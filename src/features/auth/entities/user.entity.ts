import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import type { Department } from '../../master-data/entities/department.entity.js';
import { Role } from './role.entity.js';

@Entity('users')
export class User extends BaseCoreEntity {
  @Column({ type: 'int' })
  roleId: number;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'roleId' })
  role: Relation<Role>;

  @Column({ type: 'int', nullable: true })
  departmentId: number | null;

  @ManyToOne('Department', (dept: Department) => dept.users, {
    nullable: true,
  })
  @JoinColumn({ name: 'departmentId' })
  department: Relation<Department> | null;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 128, default: 'Phường Trấn Biên' })
  ward: string;

  @Column({ type: 'boolean', default: false })
  largeTextMode: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}

