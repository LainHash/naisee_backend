import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterDataModule } from '../master-data/master-data.module.js';
import { IssuesController } from './controllers/issues.controller.js';
import { Issue } from './entities/issue.entity.js';
import { ProgressUpdate } from './entities/progress-update.entity.js';
import { Report } from './entities/report.entity.js';
import { IssueGeoService } from './services/issue-geo.service.js';
import { IssuePriorityService } from './services/issue-priority.service.js';
import { IssuesService } from './services/issues.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Issue, Report, ProgressUpdate]),
    MasterDataModule,
  ],
  controllers: [IssuesController],
  providers: [IssuesService, IssueGeoService, IssuePriorityService],
  exports: [TypeOrmModule, IssuesService, IssueGeoService, IssuePriorityService],
})
export class IssuesModule {}
