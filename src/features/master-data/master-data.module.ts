import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity.js';
import { IssueCategory } from './entities/issue-category.entity.js';
import { Ward } from './entities/ward.entity.js';
import { MasterDataController } from './master-data.controller.js';
import { MasterDataService } from './master-data.service.js';
import { WardBoundaryService } from './ward-boundary.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Department, IssueCategory, Ward])],
  controllers: [MasterDataController],
  providers: [MasterDataService, WardBoundaryService],
  exports: [TypeOrmModule, MasterDataService, WardBoundaryService],
})
export class MasterDataModule {}
