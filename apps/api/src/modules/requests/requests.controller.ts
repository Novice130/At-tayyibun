import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto, RespondRequestDto, SkipProfileDto } from './dto/request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private requestsService: RequestsService,
    private prisma: PrismaService,
  ) {}

  /**
   * POST /api/requests
   * Send an info request
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audit('REQUEST_SENT')
  async createRequest(
    @CurrentUser() user: User,
    @Body() dto: CreateRequestDto,
  ) {
    const request = await this.requestsService.createRequest(user.id, dto);
    
    return {
      success: true,
      message: 'Request sent successfully. You will be notified when they respond.',
      data: { requestId: request.id },
    };
  }

  /**
   * GET /api/requests/sent
   * Get requests sent by current user
   */
  @Get('sent')
  async getSentRequests(@CurrentUser() user: User) {
    const requests = await this.requestsService.getSentRequests(user.id);
    
    return {
      success: true,
      data: requests,
    };
  }

  /**
   * GET /api/requests/received
   * Get requests received by current user
   */
  @Get('received')
  async getReceivedRequests(@CurrentUser() user: User) {
    const requests = await this.requestsService.getReceivedRequests(user.id);
    
    return {
      success: true,
      data: requests,
    };
  }

  /**
   * PUT /api/requests/:id/respond
   * Respond to a request (approve/deny)
   */
  @Put(':id/respond')
  @Audit('REQUEST_RESPONDED')
  async respondToRequest(
    @CurrentUser() user: User,
    @Param('id') requestId: string,
    @Body() dto: RespondRequestDto,
  ) {
    const request = await this.requestsService.respondToRequest(user.id, requestId, dto);
    
    return {
      success: true,
      message: dto.approve ? 'Request approved. They will receive your information via email.' : 'Request denied.',
      data: { requestId: request.id, status: request.status },
    };
  }
}

@Controller('skip')
export class SkipController {
  constructor(private prisma: PrismaService) {}

  /**
   * POST /api/skip
   * Skip a profile with reason
   */
  @Post()
  @Audit('PROFILE_SKIPPED')
  async skipProfile(
    @CurrentUser() user: User,
    @Body() dto: SkipProfileDto,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { publicId: dto.targetPublicId },
    });

    if (!target) {
      return { success: false, message: 'User not found' };
    }

    await this.prisma.skipReason.upsert({
      where: {
        requesterId_targetId: {
          requesterId: user.id,
          targetId: target.id,
        },
      },
      create: {
        requesterId: user.id,
        targetId: target.id,
        reasonCode: dto.reasonCode,
        customText: dto.customText,
      },
      update: {
        reasonCode: dto.reasonCode,
        customText: dto.customText,
      },
    });

    return {
      success: true,
      message: 'Profile skipped',
    };
  }
}
