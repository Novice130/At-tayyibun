import {
  IsString,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { AllowedShareType } from '@prisma/client';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  targetPublicId: string;

  @IsBoolean()
  @IsOptional()
  requestPhoto?: boolean = true;

  @IsBoolean()
  @IsOptional()
  requestPhone?: boolean = true;

  @IsBoolean()
  @IsOptional()
  requestEmail?: boolean = true;
}

export class RespondRequestDto {
  @IsBoolean()
  approve: boolean;

  @IsEnum(AllowedShareType)
  @IsOptional()
  shareType?: AllowedShareType = AllowedShareType.ALL;
}

export class SkipProfileDto {
  @IsString()
  @IsNotEmpty()
  targetPublicId: string;

  @IsString()
  @IsNotEmpty()
  reasonCode: string; // 'NOT_INTERESTED', 'LOCATION', 'AGE', 'OTHER'

  @IsString()
  @IsOptional()
  customText?: string;
}
