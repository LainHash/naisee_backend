import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponseDto } from '../../../common/dto/api-response.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import {
  NearbyIssueItemDto,
  PublicIssueDetailDto,
  PublicIssueSummaryDto,
} from '../dto/issue-response.dto.js';
import { NearbyIssuesQueryDto } from '../dto/nearby-issues.dto.js';
import { QueryIssuesDto } from '../dto/query-issues.dto.js';
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
}

