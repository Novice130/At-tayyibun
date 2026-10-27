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
