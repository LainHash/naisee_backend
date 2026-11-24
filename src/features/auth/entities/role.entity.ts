import { Column, Entity, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { RoleName } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import type { User } from './user.entity.js';

@Entity('roles')
export class Role extends BaseCoreEntity {
  @Column({ type: 'enum', enum: RoleName, unique: true })
  name: RoleName;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany('User', (user: User) => user.role)
  users: Relation<User[]>;
}

