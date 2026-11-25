import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity.js';
import { IssueCategory } from './entities/issue-category.entity.js';
import { MasterDataController } from './master-data.controller.js';
import { MasterDataService } from './master-data.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Department, IssueCategory])],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [TypeOrmModule, MasterDataService],
})
export class MasterDataModule {}
