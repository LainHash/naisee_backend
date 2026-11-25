import { Column, Entity, Index, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { AdministrativeUnitType } from '../../../common/enums/domain.enums.js';
import { BaseCoreEntity } from '../../../core/database/base.entity.js';
import type { User } from '../../auth/entities/user.entity.js';
import type { Issue } from '../../issues/entities/issue.entity.js';

export interface GeoJsonPolygonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

/**
 * Administrative unit at commune/ward level (2-tier model: Province <-> Ward/Commune).
 */
@Entity('wards')
export class Ward extends BaseCoreEntity {
  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Index()
  @Column({
    type: 'enum',
    enum: AdministrativeUnitType,
    default: AdministrativeUnitType.WARD,
  })
  unitType: AdministrativeUnitType;

  @Column({ type: 'varchar', length: 128, default: 'Tỉnh Đồng Nai' })
  provinceName: string;

  @Column({ type: 'double precision' })
  centerLat: number;

  @Column({ type: 'double precision' })
  centerLng: number;

  @Column({ type: 'int', default: 14 })
  defaultZoom: number;

  @Column({ type: 'double precision' })
  minLat: number;

  @Column({ type: 'double precision' })
  maxLat: number;

  @Column({ type: 'double precision' })
  minLng: number;

  @Column({ type: 'double precision' })
  maxLng: number;

  @Column({ type: 'jsonb', nullable: true })
  boundaryGeoJson: GeoJsonPolygonGeometry | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('User', (user: User) => user.wardUnit)
  users: Relation<User[]>;

  @OneToMany('Issue', (issue: Issue) => issue.wardUnit)
  issues: Relation<Issue[]>;
}

