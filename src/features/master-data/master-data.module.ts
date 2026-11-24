import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity.js';
import { IssueCategory } from './entities/issue-category.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Department, IssueCategory])],
  exports: [TypeOrmModule],
})
export class MasterDataModule {}
