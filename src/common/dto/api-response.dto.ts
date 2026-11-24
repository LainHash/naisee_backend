export class PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponseDto<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMetaDto;
}

export class ApiErrorDetailDto {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiErrorResponseDto {
  success: false;
  error: ApiErrorDetailDto;
}

