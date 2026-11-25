import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { StaffVolunteerDto } from '../dto/verification-response.dto.js';
import { UpdateVolunteerStatusDto } from '../dto/verifications.dto.js';
import { StaffVolunteersService } from '../services/staff-volunteers.service.js';

@ApiTags('staff-volunteers')
@ApiBearerAuth()
@Roles(RoleName.STAFF, RoleName.ADMIN)
@Controller('staff/volunteers')
export class StaffVolunteersController {
  constructor(
    private readonly staffVolunteersService: StaffVolunteersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách Tình nguyện viên kèm thống kê lượt xác minh',
  })
  listVolunteers(): Promise<StaffVolunteerDto[]> {
    return this.staffVolunteersService.listVolunteers();
  }

  @Patch(':publicId/status')
  @ApiOperation({
    summary: 'Kích hoạt hoặc tạm dừng quyền tác nghiệp của Tình nguyện viên',
  })
  updateStatus(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateVolunteerStatusDto,
  ): Promise<StaffVolunteerDto> {
    return this.staffVolunteersService.updateStatus(publicId, dto.isActive);
  }
}

