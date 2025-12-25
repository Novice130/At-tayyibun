import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { ImageProcessorService } from './image-processor.service';

@Module({
  controllers: [PhotosController],
  providers: [PhotosService, ImageProcessorService],
  exports: [PhotosService, ImageProcessorService],
})
export class PhotosModule {}
