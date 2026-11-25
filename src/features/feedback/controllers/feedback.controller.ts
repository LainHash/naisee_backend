import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type {
  PublicIssueDetailDto,
  StaffIssueDetailDto,
} from '../../issues/dto/issue-response.dto.js';
import {
  CreateFeedbackDto,
  ReviewFeedbackDto,
} from '../dto/feedback.dto.js';
import { FeedbackService } from '../services/feedback.service.js';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('issues/:publicId/feedback')
  @Roles(RoleName.CITIZEN, RoleName.VOLUNTEER)
  @ApiOperation({
    summary:
      'Người dân đánh giá hài lòng hoặc yêu cầu mở lại hồ sơ đã RESOLVED (nếu isSatisfied=false bật needsReopenReview)',
  })
  submitFeedback(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeedbackDto,
  ): Promise<PublicIssueDetailDto> {
    return this.feedbackService.submitFeedback(publicId, user, dto);
  }

  @Patch('staff/feedbacks/:publicId/review')
  @Roles(RoleName.STAFF, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Cán bộ xử lý đánh giá (ACKNOWLEDGED hoặc REOPENED theo feedback publicId hoặc issue publicId/code)',
  })
  reviewFeedback(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewFeedbackDto,
  ): Promise<StaffIssueDetailDto> {
    return this.feedbackService.reviewFeedback(publicId, user, dto);
  }
}

