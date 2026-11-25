import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import type {
  IssueStatus,
  MediaStage,
  Priority,
  RoleName,
} from '../../../common/enums/domain.enums.js';

export const DEFAULT_SEED_EXCEL_PATH = resolve(
  import.meta.dirname,
  'data/naisee-seed-data.xlsx',
);

const SRC_FALLBACK_EXCEL_PATH = resolve(
  process.cwd(),
  'src/core/database/seeds/data/naisee-seed-data.xlsx',
);

export interface SeedRoleRow {
  name: RoleName;
  description: string;
}

export interface SeedDepartmentRow {
  code: string;
  name: string;
  contactPhone: string;
  description: string;
}

export interface SeedCategoryRow {
  code: string;
  name: string;
  defaultDepartmentCode: string;
  defaultPriority: Priority;
  slaHours: number;
  icon: string;
}

export interface SeedUserRow {
  roleName: RoleName;
  departmentCode?: string;
  fullName: string;
  phone: string;
  ward: string;
  largeTextMode: boolean;
}

export interface SeedMediaPresetRow {
  categoryCode: string;
  stage: MediaStage;
  url: string;
}

export interface SeedIssueRow {
  code: string;
  categoryCode: string;
  title: string;
  description: string;
  addressText: string;
  ward: string;
  lat: number;
  lng: number;
  status: IssueStatus;
  priority: Priority;
  reportCount: number;
  resolvedDaysAgo?: number;
  resolutionDurationDays?: number;
  overdue: boolean;
  beforeImageUrl?: string;
  afterImageUrl?: string;
}

export interface SeedWorkbookData {
  filePath: string;
  roles: SeedRoleRow[];
  departments: SeedDepartmentRow[];
  categories: SeedCategoryRow[];
  users: SeedUserRow[];
  mediaPresets: SeedMediaPresetRow[];
  issues: SeedIssueRow[];
}

export function resolveSeedExcelPath(explicitPath?: string): string {
  if (explicitPath) {
    const resolved = resolve(explicitPath);
    if (!existsSync(resolved)) {
      throw new Error(`Không tìm thấy file Excel seed tại: ${resolved}`);
    }
    return resolved;
  }
  if (existsSync(DEFAULT_SEED_EXCEL_PATH)) {
    return DEFAULT_SEED_EXCEL_PATH;
  }
  if (existsSync(SRC_FALLBACK_EXCEL_PATH)) {
    return SRC_FALLBACK_EXCEL_PATH;
  }
  throw new Error(
    `Không tìm thấy file Excel seed tại ${DEFAULT_SEED_EXCEL_PATH} hoặc ${SRC_FALLBACK_EXCEL_PATH}`,
  );
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('text' in value && value.text !== undefined) {
      return cellToText(value.text as ExcelJS.CellValue);
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return value.hyperlink.trim();
    }
    if ('result' in value && value.result !== undefined) {
      return cellToText(value.result as ExcelJS.CellValue);
    }
  }
  return '';
}

function toOptionalNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function readSheetObjects(
  workbook: ExcelJS.Workbook,
  sheetName: string,
): Record<string, string>[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`File Excel seed thiếu sheet "${sheetName}".`);
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellToText(cell.value);
  });

  const rows: Record<string, string>[] = [];
  for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
    const row = sheet.getRow(rowIdx);
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (let colIdx = 1; colIdx < headers.length; colIdx++) {
      const header = headers[colIdx];
      if (!header) continue;
      const val = cellToText(row.getCell(colIdx).value);
      if (val !== '') hasValue = true;
      obj[header] = val;
    }
    if (hasValue) {
      rows.push(obj);
    }
  }
  return rows;
}

/**
 * Loads all relational demo seed data (roles, departments, categories, users,
 * media presets, and issues) from the Excel workbook (.xlsx).
 */
export async function loadSeedWorkbook(
  explicitPath?: string,
): Promise<SeedWorkbookData> {
  const filePath = resolveSeedExcelPath(explicitPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const roles: SeedRoleRow[] = readSheetObjects(workbook, 'roles').map((r) => ({
    name: r.name as RoleName,
    description: r.description,
  }));

  const departments: SeedDepartmentRow[] = readSheetObjects(
    workbook,
    'departments',
  ).map((r) => ({
    code: r.code,
    name: r.name,
    contactPhone: r.contactPhone,
    description: r.description,
  }));

  const categories: SeedCategoryRow[] = readSheetObjects(
    workbook,
    'categories',
  ).map((r) => ({
    code: r.code,
    name: r.name,
    defaultDepartmentCode: r.defaultDepartmentCode,
    defaultPriority: r.defaultPriority as Priority,
    slaHours: Number(r.slaHours),
    icon: r.icon,
  }));

  const users: SeedUserRow[] = readSheetObjects(workbook, 'users').map((r) => ({
    roleName: r.roleName as RoleName,
    departmentCode: r.departmentCode || undefined,
    fullName: r.fullName,
    phone: r.phone,
    ward: r.ward,
    largeTextMode: toBoolean(r.largeTextMode),
  }));

  const mediaPresets: SeedMediaPresetRow[] = readSheetObjects(
    workbook,
    'media_presets',
  ).map((r) => ({
    categoryCode: r.categoryCode,
    stage: r.stage as MediaStage,
    url: r.url,
  }));

  const issues: SeedIssueRow[] = readSheetObjects(workbook, 'issues').map(
    (r) => ({
      code: r.code,
      categoryCode: r.categoryCode,
      title: r.title,
      description: r.description,
      addressText: r.addressText,
      ward: r.ward || 'Phường Trấn Biên',
      lat: Number(r.lat),
      lng: Number(r.lng),
      status: r.status as IssueStatus,
      priority: r.priority as Priority,
      reportCount: Number(r.reportCount) || 1,
      resolvedDaysAgo: toOptionalNumber(r.resolvedDaysAgo),
      resolutionDurationDays: toOptionalNumber(r.resolutionDurationDays),
      overdue: toBoolean(r.overdue),
      beforeImageUrl: r.beforeImageUrl || undefined,
      afterImageUrl: r.afterImageUrl || undefined,
    }),
  );

  return {
    filePath,
    roles,
    departments,
    categories,
    users,
    mediaPresets,
    issues,
  };
}

