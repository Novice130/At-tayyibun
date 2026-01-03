import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  IsObject,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export class CreateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  ethnicity: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state: string;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsObject()
  biodata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  ethnicity?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsObject()
  biodata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

export class ProfileFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Type(() => Number)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Max(100)
  @Type(() => Number)
  maxAge?: number;

  @IsOptional()
  @IsString()
  sortBy?: 'age' | 'rankBoost';
}
