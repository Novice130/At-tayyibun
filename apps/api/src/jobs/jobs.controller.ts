// Jobs Controller
// HTTP handlers for Cloud Scheduler triggered jobs

import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequestExpiryJob } from './request-expiry.job';
import { GoldBoostJob } from './gold-boost.job';

@Controller('jobs')
export class JobsController {
  constructor(
    private requestExpiryJob: RequestExpiryJob,
    private goldBoostJob: GoldBoostJob,
  ) {}

  @Public()  // Protected by Cloud IAM, not application auth
  @Post('request-expiry')
  @HttpCode(HttpStatus.OK)
  async runRequestExpiry() {
    const result = await this.requestExpiryJob.execute();
    return { success: true, ...result };
  }

  @Public()
  @Post('gold-boost')
  @HttpCode(HttpStatus.OK)
  async runGoldBoost() {
    const result = await this.goldBoostJob.execute();
    return { success: true, ...result };
  }
}
