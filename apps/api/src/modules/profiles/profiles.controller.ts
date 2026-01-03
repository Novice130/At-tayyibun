import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto, ProfileFiltersDto } from './dto/profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '@prisma/client';

@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  /**
   * GET /api/profiles
   * Browse profiles with filters (authenticated)
   */
  @Get()
  @Audit('BROWSE_PROFILES')
  async browseProfiles(
    @CurrentUser() user: User,
    @Query() filters: ProfileFiltersDto,
  ) {
    const result = await this.profilesService.browseProfiles(user.id, filters);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /api/profiles/me
   * Get current user's full profile
   */
  @Get('me')
  async getMyProfile(@CurrentUser() user: User) {
    const profile = await this.profilesService.getMyProfile(user.id);
    
    return {
      success: true,
      data: profile,
    };
  }

  /**
   * POST /api/profiles
   * Create user profile
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audit('PROFILE_CREATED')
  async createProfile(
    @CurrentUser() user: User,
    @Body() dto: CreateProfileDto,
  ) {
    const profile = await this.profilesService.createProfile(user.id, dto);
    
    return {
      success: true,
      message: 'Profile created successfully',
      data: { profileId: profile.id },
    };
  }

  /**
   * PUT /api/profiles/me
   * Update current user's profile
   */
  @Put('me')
  @Audit('PROFILE_UPDATED')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    const profile = await this.profilesService.updateProfile(user.id, dto);
    
    return {
      success: true,
      message: 'Profile updated successfully',
      data: { profileId: profile.id },
    };
  }

  /**
   * GET /api/profiles/:publicId
   * Get public profile by public ID
   * Public endpoint - returns limited data
   */
  @Public()
  @Get(':publicId')
  async getPublicProfile(@Param('publicId') publicId: string) {
    const profile = await this.profilesService.getPublicProfile(publicId);
    
    return {
      success: true,
      data: profile,
    };
  }
}
