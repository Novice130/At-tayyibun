import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminCouponsService } from '../services/admin-coupons.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('admin/coupons')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminCouponsController {
  constructor(private readonly couponsService: AdminCouponsService) {}

  @Get()
  async getCoupons(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.couponsService.getCoupons(pageNum, limitNum);
  }

  @Post()
  async createCoupon(@CurrentUser() admin: any, @Body() payload: any) {
    return this.couponsService.createCoupon(admin.id, payload);
  }

  @Patch(':id')
  async updateCoupon(@CurrentUser() admin: any, @Param('id') id: string, @Body() payload: any) {
    return this.couponsService.updateCoupon(admin.id, id, payload);
  }

  @Delete(':id')
  async deleteCoupon(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.couponsService.deleteCoupon(admin.id, id);
  }
}
