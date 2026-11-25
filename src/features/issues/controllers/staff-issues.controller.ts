import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import type {
  StaffIssueDetailDto,
  StaffIssueItemDto,
} from '../dto/issue-response.dto.js';
import {
  AssignIssueDto,
  MergeIssuesDto,
  QueryStaffIssuesDto,
  RejectIssueDto,
  ResolveIssueDto,
  TriageIssueDto,
  UpdateIssueProgressDto,
  UpdatePublicReviewDto,
} from '../dto/staff-issues.dto.js';
import { StaffIssuesService } from '../services/staff-issues.service.js';

@ApiTags('staff-issues')
@ApiBearerAuth()
@Roles(RoleName.STAFF, RoleName.ADMIN)
@Controller('staff/issues')
export class StaffIssuesController {
  constructor(private readonly staffIssuesService: StaffIssuesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách hồ sơ điều phối cho Cán bộ (lọc status, stage, priority, quá hạn, cần mở lại)',
  })
  findStaffList(
    @Query() query: QueryStaffIssuesDto,
  ): Promise<ApiResponseDto<StaffIssueItemDto[]>> {
    return this.staffIssuesService.findStaffList(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary:
      'Chi tiết Case 360 cho Cán bộ theo publicId hoặc code (bao gồm hồ sơ chưa duyệt công khai)',
  })
  findStaffDetail(
    @Param('publicId') publicId: string,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.findStaffDetail(publicId);
  }

  @Patch(':publicId/triage')
  @ApiOperation({
    summary:
      'Tiếp nhận & phân loại (RECEIVED) hoặc yêu cầu người dân bổ sung thông tin (needs_information)',
  })
  triageIssue(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriageIssueDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.triageIssue(publicId, user, dto);
  }

  @Patch(':publicId/reject')
  @ApiOperation({
    summary: 'Từ chối tiếp nhận phản ánh kèm lý do (REJECTED / not_accepted)',
  })
  rejectIssue(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectIssueDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.rejectIssue(publicId, user, dto);
  }

  @Patch(':publicId/assign')
  @ApiOperation({
    summary:
      'Giao bộ phận phụ trách và hạn xử lý (IN_PROGRESS / department_assigned hoặc work_accepted)',
  })
  assignIssue(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignIssueDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.assignIssue(publicId, user, dto);
  }

  @Patch(':publicId/public-review')
  @ApiOperation({
    summary: 'Phê chuẩn hoặc gỡ trạng thái hiển thị công khai trên bản đồ',
  })
  updatePublicReview(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePublicReviewDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.updatePublicReview(publicId, user, dto);
  }

  @Post(':publicId/merge')
  @ApiOperation({
    summary:
      'Gộp một hoặc nhiều hồ sơ trùng lặp vào hồ sơ chính (chuyển Report sang MERGED, gom Media, cộng reportCount)',
  })
  mergeIssues(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MergeIssuesDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.mergeIssues(publicId, user, dto);
  }

  @Patch(':publicId/progress')
  @ApiOperation({
    summary:
      'Cập nhật tiến độ xử lý của đơn vị chuyên trách (work_accepted, resolution_submitted, resolution_review)',
  })
  updateProgress(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateIssueProgressDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.updateProgress(publicId, user, dto);
  }

  @Patch(':publicId/resolve')
  @ApiOperation({
    summary:
      'Nghiệm thu hoàn thành sự cố (bắt buộc tối thiểu 1 ảnh AFTER, chuyển RESOLVED / completed)',
  })
  resolveIssue(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveIssueDto,
  ): Promise<StaffIssueDetailDto> {
    return this.staffIssuesService.resolveIssue(publicId, user, dto);
  }
}

