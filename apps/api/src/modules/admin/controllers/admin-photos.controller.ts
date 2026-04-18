import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AdminPhotosService } from '../services/admin-photos.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('admin/photos')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPhotosController {
  constructor(private readonly photosService: AdminPhotosService) {}

  @Get('pending')
  async getPendingPhotos(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.photosService.getPendingPhotos(pageNum, limitNum);
  }

  @Post(':id/approve')
  async approvePhoto(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.photosService.approvePhoto(admin.id, id);
  }

  @Post(':id/reject')
  async rejectPhoto(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.photosService.rejectPhoto(admin.id, id);
  }
}
