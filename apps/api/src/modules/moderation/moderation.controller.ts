import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ModerationService } from './moderation.service';
import { BlockDto, ReportDto } from './dto';
import { CurrentUser } from '../../common/decorators';

export const BLOCK_CREATE_LIMIT = 30;

// Keyed on the signed-in user rather than the address, so a limit survives a
// change of network and does not charge members who share one. BetterAuthGuard
// runs first and sets request.user on this route.
const blockTracker = (req: Record<string, any>) => req.user?.id ?? req.ip;

@ApiTags('Moderation')
@ApiBearerAuth()
@Controller()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('blocks')
  @Throttle({ long: { limit: BLOCK_CREATE_LIMIT, ttl: 3600000, getTracker: blockTracker } })
  @ApiOperation({ summary: 'Block a user by public ID (idempotent, 30/hour/user limit)' })
  @ApiResponse({ status: 201, description: 'Block recorded' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 429, description: 'Hourly limit reached' })
  async block(@Body() dto: BlockDto, @CurrentUser('id') userId: string) {
    return this.moderationService.block(userId, dto.targetPublicId);
  }

  @Delete('blocks/:targetPublicId')
  @ApiOperation({ summary: 'Unblock a user by public ID' })
  @ApiResponse({ status: 200, description: 'Block removed' })
  async unblock(@Param('targetPublicId') targetPublicId: string, @CurrentUser('id') userId: string) {
    return this.moderationService.unblock(userId, targetPublicId);
  }

  @Get('blocks')
  @ApiOperation({ summary: "List the caller's blocked users" })
  @ApiResponse({ status: 200, description: 'Blocked users' })
  async listBlocks(@CurrentUser('id') userId: string) {
    return this.moderationService.listBlocks(userId);
  }

  @Post('reports')
  @Throttle({ long: { limit: 10, ttl: 86400000 } })
  @ApiOperation({ summary: 'Report a user (10/day/user limit)' })
  @ApiResponse({ status: 201, description: 'Report recorded' })
  @ApiResponse({ status: 400, description: 'Invalid reason' })
  @ApiResponse({ status: 429, description: 'Daily limit reached' })
  async report(@Body() dto: ReportDto, @CurrentUser('id') userId: string) {
    return this.moderationService.report(userId, dto.targetPublicId, dto.reason, dto.details);
  }
}
