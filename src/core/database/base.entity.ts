import {
  Column,
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Shared base entity providing internal integer PK, public UUID, and audit timestamps.
 */
export abstract class BaseCoreEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true })
  @Generated('uuid')
  publicId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

