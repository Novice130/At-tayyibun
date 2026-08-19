import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminCampaignsService } from '../services/admin-campaigns.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreateCampaignDto } from '../dto';

@Controller('admin/campaigns')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminCampaignsController {
  constructor(private readonly campaignsService: AdminCampaignsService) {}

  @Get()
  async getCampaigns(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.campaignsService.getCampaigns(pageNum, limitNum);
  }

  @Post()
  async createCampaign(@CurrentUser() admin: any, @Body() payload: any) {
    return this.campaignsService.createCampaign(admin.id, payload);
  }

  @Post(':id/dispatch')
  async dispatchCampaign(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.campaignsService.dispatchCampaign(admin.id, id);
  }

  @Delete(':id')
  async deleteCampaign(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.campaignsService.deleteCampaign(admin.id, id);
  }
}
