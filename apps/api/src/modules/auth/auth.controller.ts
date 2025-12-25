import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './dto';
import { Public } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 signups per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.authService.signup(dto, req.ip);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout() {
    // JWT is stateless, client should remove token
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async googleAuth() {
    // Passport handles redirect
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.handleOAuthUser(
      'google',
      req.user as { email: string; firstName: string; lastName: string },
      req.ip,
    );

    // Redirect to frontend with token
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    res.redirect(`${webUrl}/auth/callback?token=${result.accessToken}`);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  async me(@Req() req: Request) {
    const user = req.user as { id: string; publicId: string; email: string; role: string };
    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
    };
  }

  @Post('verify-phone')
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 verification attempts per minute
  @ApiOperation({ summary: 'Verify phone number with OTP' })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  async verifyPhone(@Body() dto: { code: string }, @Req() req: Request) {
    // TODO: Implement Firebase phone verification
    return { message: 'Phone verification not implemented yet' };
  }
}
