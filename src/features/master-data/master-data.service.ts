import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import type {
  CategoryDto,
  DepartmentDto,
  ResolveWardResponseDto,
  WardDto,
} from './dto/master-data-response.dto.js';
import type { QueryWardsDto } from './dto/query-wards.dto.js';
import { Department } from './entities/department.entity.js';
import { IssueCategory } from './entities/issue-category.entity.js';
import { Ward } from './entities/ward.entity.js';
import { WardBoundaryService } from './ward-boundary.service.js';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(IssueCategory)
    private readonly categoryRepo: Repository<IssueCategory>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Ward)
    private readonly wardRepo: Repository<Ward>,
    private readonly wardBoundaryService: WardBoundaryService,
  ) {}

  async getCategories(): Promise<CategoryDto[]> {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      relations: { defaultDepartment: true },
      order: { id: 'ASC' },
    });

    return categories.map((cat) => ({
      publicId: cat.publicId,
      code: cat.code,
      name: cat.name,
      defaultPriority: cat.defaultPriority,
      slaHours: cat.slaHours,
      icon: cat.icon,
      defaultDepartment: cat.defaultDepartment
        ? {
            publicId: cat.defaultDepartment.publicId,
            code: cat.defaultDepartment.code,
            name: cat.defaultDepartment.name,
          }
        : null,
    }));
  }

  async getDepartments(): Promise<DepartmentDto[]> {
    const departments = await this.departmentRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });

    return departments.map((dept) => ({
      publicId: dept.publicId,
      code: dept.code,
      name: dept.name,
      contactPhone: dept.contactPhone,
      description: dept.description,
    }));
  }

  async getWards(query: QueryWardsDto = {}): Promise<WardDto[]> {
    const where: FindOptionsWhere<Ward> = {};
    if (!query.includeInactive) {
      where.isActive = true;
    }
    if (query.unitType) {
      where.unitType = query.unitType;
    }

    const wards = await this.wardRepo.find({
      where,
      order: { name: 'ASC' },
    });

    return wards.map((ward) =>
      this.toWardDto(ward, Boolean(query.includeBoundary)),
    );
  }

  async resolveWard(lat: number, lng: number): Promise<ResolveWardResponseDto> {
    const ward = await this.wardBoundaryService.resolveByCoordinates(lat, lng);
    return {
      inServiceArea: Boolean(ward),
      ward: ward ? this.toWardDto(ward, false) : null,
    };
  }

  private toWardDto(ward: Ward, includeBoundary: boolean): WardDto {
    const dto: WardDto = {
      publicId: ward.publicId,
      code: ward.code,
      name: ward.name,
      unitType: ward.unitType,
      provinceName: ward.provinceName,
      centerLat: ward.centerLat,
      centerLng: ward.centerLng,
      defaultZoom: ward.defaultZoom,
      bbox: [ward.minLng, ward.minLat, ward.maxLng, ward.maxLat],
      isActive: ward.isActive,
    };
    if (includeBoundary) {
      dto.boundaryGeoJson = ward.boundaryGeoJson;
    }
    return dto;
  }
}

