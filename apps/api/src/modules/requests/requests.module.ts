import { Module } from '@nestjs/common';
import { RequestsController, SkipController } from './requests.controller';
import { RequestsService } from './requests.service';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [PhotosModule],
  controllers: [RequestsController, SkipController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
