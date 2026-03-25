import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators';

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
}
