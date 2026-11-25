import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity.js';
import { IssuesModule } from '../issues/issues.module.js';
import { StaffVerificationsController } from './controllers/staff-verifications.controller.js';
import { StaffVolunteersController } from './controllers/staff-volunteers.controller.js';
import { VolunteerVerificationsController } from './controllers/volunteer-verifications.controller.js';
import { Verification } from './entities/verification.entity.js';
import { StaffVolunteersService } from './services/staff-volunteers.service.js';
import { VerificationsService } from './services/verifications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Verification, User]), IssuesModule],
  controllers: [
    StaffVerificationsController,
    StaffVolunteersController,
    VolunteerVerificationsController,
  ],
  providers: [VerificationsService, StaffVolunteersService],
  exports: [TypeOrmModule, VerificationsService, StaffVolunteersService],
})
export class VerificationsModule {}
