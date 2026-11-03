import { Body, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { UnsubscribeService } from './unsubscribe.service';

@ApiTags('Email')
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly unsubscribeService: UnsubscribeService) {}

  /**
   * POST only: mail scanners follow GET links, and must not opt anyone out.
   * The web page sends the token in the body; a mail client's one-click POST
   * (RFC 8058) carries it in the query with a form-encoded body.
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Opt out of campaign email using a signed link' })
  @ApiResponse({ status: 200, description: 'Unsubscribed' })
  @ApiResponse({ status: 400, description: 'Invalid link' })
  async unsubscribe(@Query('token') queryToken?: unknown, @Body('token') bodyToken?: unknown) {
    return this.unsubscribeService.unsubscribe(queryToken ?? bodyToken);
  }
}
