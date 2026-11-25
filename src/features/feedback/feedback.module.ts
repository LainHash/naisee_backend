import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuesModule } from '../issues/issues.module.js';
import { FeedbackController } from './controllers/feedback.controller.js';
import { Feedback } from './entities/feedback.entity.js';
import { FeedbackService } from './services/feedback.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback]), IssuesModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [TypeOrmModule, FeedbackService],
})
export class FeedbackModule {}
