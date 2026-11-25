import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback])],
  exports: [TypeOrmModule],
})
export class FeedbackModule {}
