import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Header,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto, RespondRequestDto } from './dto';
import { CurrentUser } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Info Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Throttle({ short: { limit: 10, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request info from a user' })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 409, description: 'Already have a pending request' })
  async createRequest(
    @Body() dto: CreateRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.requestsService.createRequest(userId, dto.targetPublicId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current pending request (if any)' })
  @ApiResponse({ status: 200, description: 'Active pending request or null' })
  async getActiveRequest(@CurrentUser('id') userId: string) {
    return this.requestsService.getActiveRequest(userId);
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

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel your own pending info request' })
  @ApiResponse({ status: 200, description: 'Request cancelled' })
  @ApiResponse({ status: 403, description: 'Not your request to cancel' })
  async cancelRequest(
    @Param('id') requestId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.requestsService.cancelRequest(userId, requestId);
  }

  @Post(':id/contact')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ long: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Reveal the shared contact on your approved request, once' })
  @ApiResponse({ status: 200, description: 'Shared contact' })
  @ApiResponse({ status: 404, description: 'Not your approved request' })
  @ApiResponse({ status: 410, description: 'Already viewed, expired or unavailable' })
  async revealContact(
    @Param('id') requestId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.requestsService.revealContact(userId, requestId);
  }
}
