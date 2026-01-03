import { Controller, Get, Post, Param } from '@nestjs/common';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Get()
  async getCoupons() {
    const coupons = await this.couponsService.getActiveCoupons();
    return { success: true, data: coupons };
  }

  @Post(':id/use')
  async useCoupon(@Param('id') id: string) {
    await this.couponsService.recordUsage(id);
    return { success: true };
  }
}
