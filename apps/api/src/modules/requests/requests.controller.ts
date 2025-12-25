import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RequestsService } from './requests.service';
import { CreateRequestDto, RespondRequestDto } from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Info Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Throttle({ short: { limit: 10, ttl: 3600000 } }) // 10 requests per hour
  @ApiOperation({ summary: 'Request info from a user' })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 409, description: 'Already have a pending request' })
  async createRequest(
    @Body() dto: CreateRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.requestsService.createRequest(userId, dto.targetPublicId);
  }

  @Get('incoming')
  @ApiOperation({ summary: 'Get incoming info requests' })
  @ApiResponse({ status: 200, description: 'List of incoming requests' })
  async getIncoming(@CurrentUser('id') userId: string) {
    return this.requestsService.getIncomingRequests(userId);
  }

  @Get('outgoing')
  @ApiOperation({ summary: 'Get outgoing info requests' })
  @ApiResponse({ status: 200, description: 'List of outgoing requests' })
  async getOutgoing(@CurrentUser('id') userId: string) {
    return this.requestsService.getOutgoingRequests(userId);
  }

  @Put(':id/respond')
  @ApiOperation({ summary: 'Respond to an info request (approve/deny)' })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  @ApiResponse({ status: 403, description: 'Not your request to respond to' })
  async respondToRequest(
    @Param('id') requestId: string,
    @Body() dto: RespondRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.requestsService.respondToRequest(userId, requestId, dto);
  }

  @Public()
  @Get('shared/:token')
  @ApiOperation({ summary: 'View shared info via one-time link' })
  @ApiResponse({ status: 200, description: 'Shared info' })
  @ApiResponse({ status: 404, description: 'Invalid or used link' })
  async getSharedInfo(@Param('token') token: string) {
    return this.requestsService.getSharedInfo(token);
  }
}
