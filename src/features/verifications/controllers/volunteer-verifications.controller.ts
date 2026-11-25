import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type { VerificationTaskDto } from '../dto/verification-response.dto.js';
import {
  QueryVolunteerVerificationsDto,
  SubmitVerificationDto,
} from '../dto/verifications.dto.js';
import { VerificationsService } from '../services/verifications.service.js';

@ApiTags('volunteer-verifications')
@ApiBearerAuth()
@Roles(RoleName.VOLUNTEER, RoleName.ADMIN)
@Controller('volunteer/verifications')
export class VolunteerVerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách nhiệm vụ xác minh cho Tình nguyện viên (lọc status=OPEN hoặc mine=true)',
  })
  findList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryVolunteerVerificationsDto,
  ): Promise<ApiResponseDto<VerificationTaskDto[]>> {
    return this.verificationsService.findVolunteerList(user, query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Chi tiết một nhiệm vụ xác minh (theo verification publicId hoặc issue code)',
  })
  findDetail(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VerificationTaskDto> {
    return this.verificationsService.findVolunteerDetail(publicId, user);
  }

  @Post(':publicId/claim')
  @ApiOperation({
    summary: 'Tình nguyện viên nhận nhiệm vụ xác minh (atomic update tránh nhận trùng)',
  })
  claim(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VerificationTaskDto> {
    return this.verificationsService.claimVerification(publicId, user);
  }

  @Post(':publicId/submit')
  @ApiOperation({
    summary:
      'Tình nguyện viên nộp kết quả xác minh thực địa (STILL_EXISTS | ALREADY_RESOLVED | NOT_FOUND_OR_UNCLEAR)',
  })
  submit(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationDto,
  ): Promise<VerificationTaskDto> {
    return this.verificationsService.submitVerification(publicId, user, dto);
  }
}

