import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Query,
  ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhotosService } from './photos.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '@prisma/client';

@Controller('photos')
export class PhotosController {
  constructor(private photosService: PhotosService) {}

  /**
   * GET /api/photos
   * Get current user's photos
   */
  @Get()
  async getMyPhotos(@CurrentUser() user: User) {
    const photos = await this.photosService.getUserPhotos(user.id);
    
    return {
      success: true,
      data: photos,
    };
  }

  /**
   * POST /api/photos/upload
   * Upload a new photo
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @Audit('PHOTO_UPLOADED')
  async uploadPhoto(
    @CurrentUser() user: User,
    @UploadedFile() file: any,
    @Query('primary', new ParseBoolPipe({ optional: true })) primary?: boolean,
  ) {
    const photo = await this.photosService.uploadPhoto(user.id, file, primary);
    
    return {
      success: true,
      message: 'Photo uploaded successfully. Pending approval.',
      data: { photoId: photo.id },
    };
  }

  /**
   * POST /api/photos/avatar
   * Generate AI avatar
   */
  @Post('avatar')
  @Audit('AVATAR_GENERATED')
  async generateAvatar(
    @CurrentUser() user: User,
    @Query('seed') seed?: string,
  ) {
    const avatar = await this.photosService.generateAvatar(user.id, seed);
    
    return {
      success: true,
      message: 'Avatar generated successfully',
      data: { photoId: avatar.id },
    };
  }

  /**
   * DELETE /api/photos/:id
   * Delete a photo
   */
  @Delete(':id')
  @Audit('PHOTO_DELETED')
  async deletePhoto(
    @CurrentUser() user: User,
    @Param('id') photoId: string,
  ) {
    await this.photosService.deletePhoto(user.id, photoId);
    
    return {
      success: true,
      message: 'Photo deleted successfully',
    };
  }
}
