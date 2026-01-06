import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { 
  SignupDto, 
  LoginDto, 
  Enable2FADto, 
  Verify2FADto, 
  Disable2FADto,
  TwoFactorSetupResponseDto,
  Enable2FAResponseDto,
} from './dto';
import { Public } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Post('signup')
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 signups per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User registered, check email to verify' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.authService.signup(dto, req.ip);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address with token' })
  @ApiResponse({ status: 200, description: 'Email verified, login successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    const result = await this.authService.verifyEmail(token, req.ip);
    // Redirect to frontend with success
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    res.redirect(`${webUrl}/verify-email?success=true&token=${result.accessToken}`);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful or requires 2FA' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout() {
    // JWT is stateless, client should remove token
    return { message: 'Logged out successfully' };
  }

  // =========================================================================
  // TWO-FACTOR AUTHENTICATION ENDPOINTS
  // =========================================================================

  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set up 2FA - get QR code and secret' })
  @ApiResponse({ status: 200, type: TwoFactorSetupResponseDto })
  async setup2FA(@Req() req: Request) {
    const user = req.user as { id: string; email: string };
    return this.twoFactorService.generateSetup(user.id, user.email);
  }

  @Post('2fa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA by verifying code from authenticator app' })
  @ApiBody({ type: Enable2FADto })
  @ApiResponse({ status: 200, type: Enable2FAResponseDto })
  async enable2FA(@Body() dto: Enable2FADto, @Req() req: Request) {
    const user = req.user as { id: string };
    const backupCodes = await this.twoFactorService.enable2FA(user.id, dto.code, req.ip || '');
    return {
      message: 'Two-factor authentication enabled successfully',
      backupCodes,
    };
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Verify 2FA code during login' })
  @ApiBody({ type: Verify2FADto })
  @ApiResponse({ status: 200, description: 'Full access token returned' })
  async verify2FA(@Body() dto: Verify2FADto, @Req() req: Request) {
    const { userId } = await this.twoFactorService.verifyLogin(dto.tempToken, dto.code, req.ip || '');
    return this.authService.generateTokenForUser(userId);
  }

  @Post('2fa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA (requires password and current code)' })
  @ApiBody({ type: Disable2FADto })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  async disable2FA(@Body() dto: Disable2FADto, @Req() req: Request) {
    const user = req.user as { id: string };
    await this.twoFactorService.disable2FA(user.id, dto.password, dto.code, req.ip || '');
    return { message: 'Two-factor authentication disabled successfully' };
  }

  // =========================================================================
  // OAUTH ENDPOINTS
  // =========================================================================

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
  @ApiBearerAuth()
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
  @ApiBearerAuth()
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 verification attempts per minute
  @ApiOperation({ summary: 'Verify phone number with OTP' })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  async verifyPhone(@Body() dto: { code: string }, @Req() req: Request) {
    // TODO: Implement Firebase phone verification
    return { message: 'Phone verification not implemented yet' };
  }
}

