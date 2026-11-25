import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RoleName } from '../../common/enums/domain.enums.js';
import {
  CategoryDto,
  DepartmentDto,
  ResolveWardResponseDto,
  WardDto,
} from './dto/master-data-response.dto.js';
import { QueryWardsDto, ResolveWardQueryDto } from './dto/query-wards.dto.js';
import { MasterDataService } from './master-data.service.js';

@ApiTags('master-data')
@Controller()
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Danh sách loại sự cố kèm SLA và bộ phận mặc định' })
  getCategories(): Promise<CategoryDto[]> {
    return this.masterDataService.getCategories();
  }

  @ApiBearerAuth()
  @Roles(RoleName.STAFF, RoleName.ADMIN)
  @Get('departments')
  @ApiOperation({ summary: 'Danh sách bộ phận phụ trách (chỉ Cán bộ/Admin)' })
  getDepartments(): Promise<DepartmentDto[]> {
    return this.masterDataService.getDepartments();
  }

  @Public()
  @Get('wards')
  @ApiOperation({
    summary: 'Danh sách phường/xã tỉnh Đồng Nai (kèm tọa độ tâm, bbox và tùy chọn GeoJSON)',
  })
  getWards(@Query() query: QueryWardsDto): Promise<WardDto[]> {
    return this.masterDataService.getWards(query);
  }

  @Public()
  @Get('wards/resolve')
  @ApiOperation({
    summary: 'Xác định phường/xã thuộc tỉnh Đồng Nai từ tọa độ GPS (lat, lng)',
  })
  resolveWard(
    @Query() query: ResolveWardQueryDto,
  ): Promise<ResolveWardResponseDto> {
    return this.masterDataService.resolveWard(query.lat, query.lng);
  }
}

