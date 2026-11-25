import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { CreateIssueDto } from '../dto/create-issue.dto.js';
import {
  MyIssueItemDto,
  NearbyIssueItemDto,
  PublicIssueDetailDto,
  PublicIssueSummaryDto,
} from '../dto/issue-response.dto.js';
import { MeTooIssueDto } from '../dto/me-too-issue.dto.js';
import { NearbyIssuesQueryDto } from '../dto/nearby-issues.dto.js';
import { QueryIssuesDto, QueryMyIssuesDto } from '../dto/query-issues.dto.js';
import { IssuesService } from '../services/issues.service.js';

@ApiTags('issues')
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Public()
  @Get('nearby')
  @ApiOperation({
    summary:
      'Tìm sự cố quanh tọa độ (dùng cho bản đồ R03 và phát hiện trùng lúc gửi R01, ẩn PII)',
  })
  findNearby(
    @Query() query: NearbyIssuesQueryDto,
  ): Promise<NearbyIssueItemDto[]> {
    return this.issuesService.findNearby(query);
  }

  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({
    summary:
      'Danh sách phản ánh của tôi (bao gồm hồ sơ đã gửi mới và đã bấm Tôi cũng gặp)',
  })
  findMyIssues(
    @CurrentUser('id') userId: number,
    @Query() query: QueryMyIssuesDto,
  ): Promise<ApiResponseDto<MyIssueItemDto[]>> {
    return this.issuesService.findMyIssues(userId, query);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách sự cố công khai (phân trang, lọc, ẩn PII)',
  })
  findPublicList(
    @Query() query: QueryIssuesDto,
  ): Promise<ApiResponseDto<PublicIssueSummaryDto[]>> {
    return this.issuesService.findPublicList(query);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({
    summary:
      'Chi tiết sự cố công khai theo publicId (UUID) hoặc code (VD: HT-2026-001), ẩn PII',
  })
  findPublicDetail(
    @Param('publicId') publicId: string,
  ): Promise<PublicIssueDetailDto> {
    return this.issuesService.findPublicDetail(publicId);
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN, RoleName.VOLUNTEER)
  @Post()
  @ApiOperation({
    summary:
      'Gửi phản ánh mới 3 bước (tạo Issue + Report INITIAL + IssueMedia BEFORE + ProgressUpdate CREATED)',
  })
  createIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIssueDto,
  ): Promise<PublicIssueDetailDto> {
    return this.issuesService.createIssue(user, dto);
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN, RoleName.VOLUNTEER)
  @Post(':publicId/me-too')
  @ApiOperation({
    summary:
      'Ghi nhận thêm "Tôi cũng gặp vấn đề này" vào hồ sơ đã tồn tại (tăng reportCount, cập nhật suggestedPriority)',
  })
  addMeToo(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MeTooIssueDto,
  ): Promise<PublicIssueDetailDto> {
    return this.issuesService.addMeToo(publicId, user, dto);
  }
}
