import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MinLength,
  MaxLength,
  IsObject,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MARITAL_STATUSES, MaritalStatus } from '../marital-match';
import { Gender } from '../../../common/types/role';
import type { BrowseFilters } from '../profiles.service';

/** Highest browse page. With MAX_BROWSE_LIMIT this bounds OFFSET at 24,950 rows. */
export const MAX_BROWSE_PAGE = 500;
export const MAX_BROWSE_LIMIT = 50;

/**
 * Turns raw browse query params into filters. Anything unparseable or out of
 * range falls back to the default rather than reaching the query as NaN or an
 * invalid enum literal. Not a validated DTO class on purpose: the global
 * ValidationPipe rejects unknown params, and clients send extras here.
 */
export function normalizeBrowseQuery(query: Record<string, unknown>): BrowseFilters {
  const toInt = (value: unknown): number | undefined => {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  };
  const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
    allowed.includes(value as T) ? (value as T) : undefined;

  const { ethnicity, gender, minAge, maxAge, sortBy, order, page, limit } = query;
  const parsedMinAge = toInt(minAge);
  const parsedMaxAge = toInt(maxAge);

  return {
    ethnicity: typeof ethnicity === 'string' ? ethnicity.trim().slice(0, 50) || undefined : undefined,
    gender: oneOf(gender, [Gender.MALE, Gender.FEMALE]),
    minAge: parsedMinAge && parsedMinAge > 0 && parsedMinAge <= 120 ? parsedMinAge : undefined,
    maxAge: parsedMaxAge && parsedMaxAge > 0 && parsedMaxAge <= 120 ? parsedMaxAge : undefined,
    sortBy: oneOf(sortBy, ['age', 'createdAt', 'rankBoost'] as const),
    order: oneOf(order, ['asc', 'desc'] as const),
    page: Math.min(Math.max(1, toInt(page) ?? 1), MAX_BROWSE_PAGE),
    limit: Math.min(Math.max(1, toInt(limit) ?? 20), MAX_BROWSE_LIMIT),
  };
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ahmad' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Khan' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: '1995-06-15' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({ example: 'MALE', enum: ['MALE', 'FEMALE'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: 'MALE' | 'FEMALE';

  @ApiPropertyOptional({ example: 'South Asian' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ethnicity?: string;

  @ApiPropertyOptional({ example: 'Chicago' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'IL' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({ example: 'Looking for a righteous spouse...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ description: 'Custom form data fields' })
  @IsOptional()
  @IsObject()
  biodata?: Record<string, unknown>;

  // The marital answers may be omitted from a PUT but never set to null:
  // @IsOptional would let null through, the service would store it, and a
  // cleared answer must not leave a profile complete (the open-to columns are
  // also NOT NULL, so null there would be a 500 rather than a 400).
  @ApiPropertyOptional({ enum: MARITAL_STATUSES })
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  hasChildren?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.childrenCount !== null)
  @IsInt()
  @Min(1)
  @Max(20)
  childrenCount?: number | null;

  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  openToDivorced?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  openToWidowed?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  openToChildren?: boolean;
}
