import { Controller, Get, Post, Param } from '@nestjs/common';
import { AdsService } from './ads.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('ads')
export class AdsController {
  constructor(private adsService: AdsService) {}

  @Get()
  async getAds(@CurrentUser() user: User) {
    const ads = await this.adsService.getAdsForUser(user.membershipTier);
    const frequency = await this.adsService.getAdFrequency(user.membershipTier);
    return { success: true, data: { ads, frequency } };
  }

  @Post(':id/impression')
  async recordImpression(@Param('id') id: string) {
    await this.adsService.recordImpression(id);
    return { success: true };
  }

  @Post(':id/click')
  async recordClick(@Param('id') id: string) {
    await this.adsService.recordClick(id);
    return { success: true };
  }
}
