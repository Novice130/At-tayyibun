import {
  Controller,
  Post,
  Delete,
  Put,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PhotosService } from './photos.service';
import { CurrentUser } from '../../common/decorators';
import { PhotoType } from '@prisma/client';

@ApiTags('Photos')
@ApiBearerAuth()
@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a photo' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Photo uploaded' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|heic|heif)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.photosService.uploadPhoto(
      userId,
      file.buffer,
      file.originalname,
      PhotoType.REAL_PHOTO,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted' })
  async deletePhoto(
    @Param('id') photoId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.photosService.deletePhoto(userId, photoId);
  }

  @Put(':id/primary')
  @ApiOperation({ summary: 'Set photo as primary' })
  @ApiResponse({ status: 200, description: 'Primary photo updated' })
  async setPrimaryPhoto(
    @Param('id') photoId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.photosService.setPrimaryPhoto(userId, photoId);
  }
}
