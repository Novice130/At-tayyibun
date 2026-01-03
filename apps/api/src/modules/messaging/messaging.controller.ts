import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '@prisma/client';
import { IsString, MinLength, MaxLength } from 'class-validator';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

@Controller('messages')
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Get('conversations')
  async getConversations(@CurrentUser() user: User) {
    const conversations = await this.messagingService.getConversations(user.id);
    return { success: true, data: conversations };
  }

  @Get(':publicId')
  async getMessages(
    @CurrentUser() user: User,
    @Param('publicId') publicId: string,
    @Query('page') page?: number,
  ) {
    const result = await this.messagingService.getMessages(user.id, publicId, page);
    return { success: true, data: result };
  }

  @Post(':publicId')
  @Audit('MESSAGE_SENT')
  async sendMessage(
    @CurrentUser() user: User,
    @Param('publicId') publicId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendMessage(user.id, publicId, dto.content);
    return { success: true, data: message };
  }
}
