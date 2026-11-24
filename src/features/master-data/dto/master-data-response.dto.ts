import { Priority } from '../../../common/enums/domain.enums.js';

export class DepartmentSummaryDto {
  publicId: string;
  code: string;
  name: string;
}

export class CategoryDto {
  publicId: string;
  code: string;
  name: string;
  defaultPriority: Priority;
  slaHours: number;
  icon: string | null;
  defaultDepartment: DepartmentSummaryDto | null;
}

export class DepartmentDto {
  publicId: string;
  code: string;
  name: string;
  contactPhone: string | null;
  description: string | null;
}

