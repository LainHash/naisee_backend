import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryService } from './cloudinary.service.js';
import { IssueMedia } from './entities/issue-media.entity.js';
import { MediaController } from './media.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([IssueMedia])],
  controllers: [MediaController],
  providers: [CloudinaryService],
  exports: [TypeOrmModule, CloudinaryService],
})
export class MediaModule {}
