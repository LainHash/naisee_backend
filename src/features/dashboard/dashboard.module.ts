import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from '../issues/entities/issue.entity.js';
import { Report } from '../issues/entities/report.entity.js';
import { IssueCategory } from '../master-data/entities/issue-category.entity.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Issue, Report, IssueCategory])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

