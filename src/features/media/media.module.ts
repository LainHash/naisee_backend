import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueMedia } from './entities/issue-media.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([IssueMedia])],
  exports: [TypeOrmModule],
})
export class MediaModule {}
