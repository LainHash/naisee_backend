import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from './entities/issue.entity.js';
import { ProgressUpdate } from './entities/progress-update.entity.js';
import { Report } from './entities/report.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Issue, Report, ProgressUpdate])],
  exports: [TypeOrmModule],
})
export class IssuesModule {}
