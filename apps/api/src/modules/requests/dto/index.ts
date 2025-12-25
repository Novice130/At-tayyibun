import { IsString, IsBoolean, IsArray, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({ example: 'abc123xyz789', description: 'Public ID of the target user' })
  @IsString()
  targetPublicId: string;
}

export class RespondRequestDto {
  @ApiProperty({ example: true, description: 'Whether to approve the request' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({
    example: ['photo', 'phone', 'email'],
    description: 'Items to share (only used when approved is true)',
  })
  @IsOptional()
  @IsArray()
  @IsIn(['photo', 'phone', 'email'], { each: true })
  shareItems?: string[];
}
