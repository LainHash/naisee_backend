import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RoleName } from '../../../common/enums/domain.enums.js';
import type { DashboardMetricsDto } from '../dto/dashboard-response.dto.js';
import { DashboardService } from '../services/dashboard.service.js';

@ApiTags('dashboard')
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('staff/dashboard')
  @ApiBearerAuth()
  @Roles(RoleName.STAFF, RoleName.ADMIN)
  @ApiOperation({
    summary: 'Thống kê điều hành toàn phường cho Cán bộ (KPI, SLA, danh mục, khu vực)',
  })
  getStaffDashboard(): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics();
  }

  @Get('dashboard/public')
  @Public()
  @ApiOperation({
    summary: 'Số liệu tổng hợp công khai phục vụ Cổng minh bạch (Zero-PII)',
  })
  getPublicDashboard(): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics();
  }
}

