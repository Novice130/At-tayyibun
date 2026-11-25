import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto';

// Counted per signed-in user by the app-wide AppThrottlerGuard. An app sends
// one of each per sign-in or token refresh; this leaves room for retries while
// stopping a client from churning the table.
export const DEVICE_WRITE_LIMIT = 30;
export const DEVICE_WRITE_TTL_MS = 3600000;

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: DEVICE_WRITE_LIMIT, ttl: DEVICE_WRITE_TTL_MS } })
  @ApiOperation({ summary: "Register this device's push token (idempotent, 30/hour/user limit)" })
  @ApiResponse({ status: 200, description: 'Token stored' })
  @ApiResponse({ status: 429, description: 'Hourly limit reached' })
  async register(@Body() dto: RegisterDeviceDto, @CurrentUser('id') userId: string) {
    return this.devicesService.register(userId, dto.token, dto.platform);
  }

  // POST rather than DELETE with a body: some proxies drop DELETE bodies, and
  // the token is too sensitive for a URL that ends up in access logs.
  @Post('unregister')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: DEVICE_WRITE_LIMIT, ttl: DEVICE_WRITE_TTL_MS } })
  @ApiOperation({ summary: "Forget this device's push token (sign-out)" })
  @ApiResponse({ status: 200, description: 'Token removed, or was not registered' })
  async unregister(@Body() dto: UnregisterDeviceDto, @CurrentUser('id') userId: string) {
    return this.devicesService.unregister(userId, dto.token);
  }
}
