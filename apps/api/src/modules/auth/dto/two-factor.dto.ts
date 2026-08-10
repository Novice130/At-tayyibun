import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNotEmpty } from 'class-validator';

/**
 * Response when setting up 2FA - contains QR code and secret
 */
export class TwoFactorSetupResponseDto {
  @ApiProperty({ description: 'QR code data URL for authenticator apps' })
  qrCodeDataUrl: string;

  @ApiProperty({ description: 'TOTP secret (show only once)' })
  secret: string;

  @ApiProperty({ description: 'OTP Auth URL for manual entry' })
  otpAuthUrl: string;
}

/**
 * DTO for enabling 2FA - requires verification code
 */
export class Enable2FADto {
  @ApiProperty({ description: '6-digit verification code from authenticator app' })
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @IsNotEmpty()
  code: string;
}

/**
 * DTO for verifying 2FA during login
 */
export class Verify2FADto {
  @ApiProperty({ description: '6-digit verification code from authenticator app' })
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Temporary token from initial login' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;
}

/**
 * DTO for disabling 2FA - requires password and code for security
 */
export class Disable2FADto {
  @ApiProperty({ description: 'Current password for verification' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: '6-digit verification code from authenticator app' })
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @IsNotEmpty()
  code: string;
}

/**
 * Response when 2FA is successfully enabled
 */
export class Enable2FAResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'Backup codes (show only once, user should save these)' })
  backupCodes: string[];
}
