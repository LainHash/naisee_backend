import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  RoleName,
  VerificationOutcome,
  VerificationStatus,
} from '../../../common/enums/domain.enums.js';
import { User } from '../../auth/entities/user.entity.js';
import type { StaffVolunteerDto } from '../dto/verification-response.dto.js';
import { Verification } from '../entities/verification.entity.js';

@Injectable()
export class StaffVolunteersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
  ) {}

  async listVolunteers(): Promise<StaffVolunteerDto[]> {
    const volunteers = await this.userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('role.name = :roleName', { roleName: RoleName.VOLUNTEER })
      .orderBy('user.id', 'ASC')
      .getMany();

    if (volunteers.length === 0) return [];

    const volunteerIds = volunteers.map((v) => v.id);
    const tasks = await this.verificationRepo
      .createQueryBuilder('v')
      .select([
        'v.volunteerId',
        'v.status',
        'v.outcome',
      ])
      .where('v.volunteerId IN (:...volunteerIds)', { volunteerIds })
      .getMany();

    return volunteers.map((user) => this.toVolunteerDto(user, tasks));
  }

  async updateStatus(
    publicId: string,
    isActive: boolean,
  ): Promise<StaffVolunteerDto> {
    const volunteer = await this.userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('user.publicId = :publicId', { publicId })
      .andWhere('role.name = :roleName', { roleName: RoleName.VOLUNTEER })
      .getOne();

    if (!volunteer) {
      throw new NotFoundException(
        `Không tìm thấy tình nguyện viên ${publicId}`,
      );
    }

    volunteer.isActive = isActive;
    const saved = await this.userRepo.save(volunteer);

    const tasks = await this.verificationRepo.find({
      where: { volunteerId: saved.id },
      select: { volunteerId: true, status: true, outcome: true },
    });

    return this.toVolunteerDto(saved, tasks);
  }

  private toVolunteerDto(
    user: User,
    tasks: Array<Pick<Verification, 'volunteerId' | 'status' | 'outcome'>>,
  ): StaffVolunteerDto {
    const ownTasks = tasks.filter((t) => t.volunteerId === user.id);
    const completed = ownTasks.filter(
      (t) => t.status === VerificationStatus.COMPLETED,
    );
    const activeClaims = ownTasks.filter(
      (t) => t.status === VerificationStatus.IN_PROGRESS,
    ).length;
    const unclear = completed.filter(
      (t) => t.outcome === VerificationOutcome.NOT_FOUND_OR_UNCLEAR,
    ).length;

    const reliabilityScore =
      completed.length > 0
        ? Math.max(
            50,
            Math.round(((completed.length - unclear) / completed.length) * 100),
          )
        : 95;

    return {
      publicId: user.publicId,
      fullName: user.fullName,
      phone: user.phone,
      ward: user.ward,
      isActive: user.isActive,
      totalVerified: completed.length,
      activeClaims,
      reliabilityScore,
      joinedAt: user.createdAt,
    };
  }
}
