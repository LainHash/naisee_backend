import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { DashboardMetricsDto } from '../dto/dashboard-response.dto.js';
import { QueryDashboardDto } from '../dto/query-dashboard.dto.js';
import { DashboardService } from '../services/dashboard.service.js';

@ApiTags('dashboard')
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('staff/dashboard')
  @ApiBearerAuth()
  @Roles(RoleName.STAFF, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Thống kê điều hành toàn tỉnh hoặc theo phường cho Cán bộ (KPI, SLA, danh mục, địa bàn)',
  })
  getStaffDashboard(
    @Query() query: QueryDashboardDto,
  ): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics(query);
  }

  @Get('dashboard/public')
  @Public()
  @ApiOperation({
    summary:
      'Số liệu tổng hợp công khai toàn tỉnh hoặc theo phường phục vụ Cổng minh bạch (Zero-PII)',
  })
  getPublicDashboard(
    @Query() query: QueryDashboardDto,
  ): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics(query);
  }
}

