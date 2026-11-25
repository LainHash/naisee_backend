import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type { VerificationTaskDto } from '../dto/verification-response.dto.js';
import { CreateVerificationDto } from '../dto/verifications.dto.js';
import { VerificationsService } from '../services/verifications.service.js';

@ApiTags('staff-verifications')
@ApiBearerAuth()
@Roles(RoleName.STAFF, RoleName.ADMIN)
@Controller('staff/issues')
export class StaffVerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post(':publicId/verifications')
  @ApiOperation({
    summary:
      'Cán bộ tạo yêu cầu Tình nguyện viên xác minh thực địa (Issue -> VERIFYING / verification_requested)',
  })
  requestVerification(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVerificationDto,
  ): Promise<VerificationTaskDto> {
    return this.verificationsService.requestVerification(publicId, user, dto);
  }
}

