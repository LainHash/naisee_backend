import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuesModule } from '../issues/issues.module.js';
import { StaffVerificationsController } from './controllers/staff-verifications.controller.js';
import { VolunteerVerificationsController } from './controllers/volunteer-verifications.controller.js';
import { Verification } from './entities/verification.entity.js';
import { VerificationsService } from './services/verifications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Verification]), IssuesModule],
  controllers: [StaffVerificationsController, VolunteerVerificationsController],
  providers: [VerificationsService],
  exports: [TypeOrmModule, VerificationsService],
})
export class VerificationsModule {}
