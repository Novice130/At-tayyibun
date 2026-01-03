import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FormSchemaService } from './form-schema.service';
import { CampaignsService } from './campaigns.service';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [AdminController],
  providers: [AdminService, FormSchemaService, CampaignsService],
  exports: [AdminService],
})
export class AdminModule {}
