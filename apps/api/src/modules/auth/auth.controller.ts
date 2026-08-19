import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators';
import { SendPhoneOtpDto, VerifyPhoneDto } from './dto';

@ApiTags('Session')
@Controller('session')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Health check - public endpoint
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Auth health check' })
  @ApiResponse({ status: 200, description: 'Auth service is healthy' })
  health() {
    return { status: 'ok', auth: 'better-auth' };
  }

  /**
   * Get current authenticated user
   * Session cookie is validated by BetterAuthGuard
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user from session' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.authService.getMe(user.id);
  }

  /**
   * Logout - session is managed by BetterAuth on frontend
   * Backend just confirms the action
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout() {
    return { message: 'Logged out successfully. Clear session on client.' };
  }

  @Post('phone/send')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Save phone on user and send Twilio Verify OTP' })
  async sendPhoneOtp(@Req() req: Request, @Body() dto: SendPhoneOtpDto) {
    const user = req.user as { id: string };
    await this.authService.sendPhoneOtp(user.id, dto.phone);
    return { sent: true };
  }

  @Post('phone/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify Twilio OTP and mark user phone-verified' })
  async verifyPhoneOtp(@Req() req: Request, @Body() dto: VerifyPhoneDto) {
    const user = req.user as { id: string };
    return this.authService.verifyPhoneOtp(user.id, dto.code);
  }
}
