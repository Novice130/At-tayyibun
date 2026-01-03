import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  HttpException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { OAuthDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '@prisma/client';
import { FirebaseAuthService } from './firebase-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private firebaseAuth: FirebaseAuthService,
  ) {}

  /**
   * POST /api/auth/signup
   * Register a new user with email, password, and phone
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Audit('USER_SIGNUP')
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    // Rate limit check
    const ip = req.ip || 'unknown';
    const allowed = await this.authService.checkRateLimit(ip, 'signup');
    if (!allowed) {
      throw new HttpException('Too many signup attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const result = await this.authService.signup(dto);
    
    return {
      success: true,
      message: result.message,
      data: {
        userId: result.user.id,
        publicId: result.user.publicId,
        email: result.user.email,
      },
    };
  }

  /**
   * POST /api/auth/oauth/google
   * Handle Google OAuth login/signup
   */
  @Public()
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @Audit('OAUTH_LOGIN')
  async googleOAuth(@Body() dto: OAuthDto) {
    const decoded = await this.firebaseAuth.verifyToken(dto.idToken);
    
    if (decoded.firebase.sign_in_provider !== 'google.com') {
      throw new HttpException('Invalid Google OAuth token', HttpStatus.BAD_REQUEST);
    }

    const oauthUser = await this.authService.handleOAuthUser(
      decoded.uid,
      decoded.email!,
    );

    return {
      success: true,
      data: {
        userId: oauthUser.id,
        publicId: oauthUser.publicId,
        email: oauthUser.email,
        isNewUser: !oauthUser.profile,
      },
    };
  }

  /**
   * POST /api/auth/oauth/facebook
   * Handle Facebook OAuth login/signup
   */
  @Public()
  @Post('oauth/facebook')
  @HttpCode(HttpStatus.OK)
  @Audit('OAUTH_LOGIN')
  async facebookOAuth(@Body() dto: OAuthDto) {
    const decoded = await this.firebaseAuth.verifyToken(dto.idToken);
    
    if (decoded.firebase.sign_in_provider !== 'facebook.com') {
      throw new HttpException('Invalid Facebook OAuth token', HttpStatus.BAD_REQUEST);
    }

    const oauthUser = await this.authService.handleOAuthUser(
      decoded.uid,
      decoded.email!,
    );

    return {
      success: true,
      data: {
        userId: oauthUser.id,
        publicId: oauthUser.publicId,
        email: oauthUser.email,
        isNewUser: !oauthUser.profile,
      },
    };
  }

  /**
   * POST /api/auth/logout
   * Logout the current user
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
    
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  /**
   * POST /api/auth/verify-phone
   * Verify phone number (client-side Firebase verification confirmed)
   */
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @Audit('PHONE_VERIFIED')
  async verifyPhone(@CurrentUser() user: User) {
    // Phone verification is handled client-side by Firebase
    // This endpoint just confirms the server has received the updated token
    return {
      success: true,
      message: 'Phone number verified',
    };
  }
}
