import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** FCM registration tokens are ~160 characters; anything near this is not one. */
const MAX_TOKEN_LENGTH = 4096;

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM registration token for this device' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TOKEN_LENGTH)
  token: string;

  @ApiProperty({ enum: DEVICE_PLATFORMS })
  @IsIn(DEVICE_PLATFORMS)
  platform: DevicePlatform;
}

export class UnregisterDeviceDto {
  @ApiProperty({ description: 'FCM registration token to forget' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TOKEN_LENGTH)
  token: string;
}
