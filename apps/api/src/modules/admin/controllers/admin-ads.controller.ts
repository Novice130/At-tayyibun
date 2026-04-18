import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminAdsService } from '../services/admin-ads.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('admin/ads')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminAdsController {
  constructor(private readonly adsService: AdminAdsService) {}

  @Get('partners')
  async getPartners() {
    return this.adsService.getPartners();
  }

  @Get()
  async getAds(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adsService.getAds(pageNum, limitNum);
  }

  @Post()
  async createAd(@CurrentUser() admin: any, @Body() payload: any) {
    return this.adsService.createAd(admin.id, payload);
  }

  @Patch(':id')
  async updateAd(@CurrentUser() admin: any, @Param('id') id: string, @Body() payload: any) {
    return this.adsService.updateAd(admin.id, id, payload);
  }

  @Delete(':id')
  async deleteAd(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.adsService.deleteAd(admin.id, id);
  }
}
