import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Standard pagination query parameters.
 */
export class PaginationQueryDto {
  /** Page index starting from 1 */
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Number of items per page (1..100) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

