import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockDto {
  @ApiProperty({ example: 'abc123xyz789', description: 'Public ID of the user to block' })
  @IsString()
  targetPublicId: string;
}

export class ReportDto {
  @ApiProperty({ example: 'abc123xyz789', description: 'Public ID of the reported user' })
  @IsString()
  targetPublicId: string;

  @ApiProperty({
    enum: ['FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM_OR_SCAM', 'UNDERAGE', 'OTHER'],
    description: 'Fixed reason code',
  })
  @IsIn(['FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM_OR_SCAM', 'UNDERAGE', 'OTHER'])
  reason: string;

  @ApiPropertyOptional({ example: 'Profile photo does not match the person I spoke to.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ['DISMISS', 'SUSPEND_USER', 'DELETE_USER'] })
  @IsIn(['DISMISS', 'SUSPEND_USER', 'DELETE_USER'])
  action: 'DISMISS' | 'SUSPEND_USER' | 'DELETE_USER';

  @ApiPropertyOptional({ description: 'Moderation note recorded in the audit log' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
