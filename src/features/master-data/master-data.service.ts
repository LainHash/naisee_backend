import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type {
  CategoryDto,
  DepartmentDto,
} from './dto/master-data-response.dto.js';
import { Department } from './entities/department.entity.js';
import { IssueCategory } from './entities/issue-category.entity.js';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(IssueCategory)
    private readonly categoryRepo: Repository<IssueCategory>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
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
}

