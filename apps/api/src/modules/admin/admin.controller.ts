import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { FormSchemaService } from './form-schema.service';
import { CampaignsService } from './campaigns.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User, UserRole } from '@prisma/client';

@Controller('admin')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private formSchemaService: FormSchemaService,
    private campaignsService: CampaignsService,
  ) {}

  // ============ STATS ============
  @Get('stats')
  async getStats() {
    const stats = await this.adminService.getStats();
    return { success: true, data: stats };
  }

  // ============ USERS ============
  @Get('users')
  async listUsers(@Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.adminService.listUsers(page, limit);
    return { success: true, data: result };
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.adminService.getUserByIdOrPublicId(id);
    return { success: true, data: user };
  }

  @Put('users/:id/boost')
  @Audit('ADMIN_BOOST_USER')
  async boostUser(@Param('id') id: string, @Body('amount') amount: number) {
    const user = await this.adminService.boostUser(id, amount);
    return { success: true, data: user };
  }

  // ============ ADMINS (SUPER_ADMIN only) ============
  @Post('admins')
  @Roles(UserRole.SUPER_ADMIN)
  @Audit('ADMIN_ADDED')
  async addAdmin(@Body('userId') userId: string, @CurrentUser() admin: User) {
    const user = await this.adminService.addAdmin(userId, admin.id);
    return { success: true, data: user };
  }

  @Delete('admins/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @Audit('ADMIN_REMOVED')
  async removeAdmin(@Param('id') userId: string, @CurrentUser() admin: User) {
    const user = await this.adminService.removeAdmin(userId, admin.id);
    return { success: true, data: user };
  }

  // ============ SITE CONFIG ============
  @Get('config')
  async getSiteConfig() {
    const config = await this.adminService.getSiteConfig();
    return { success: true, data: config };
  }

  @Put('config')
  @Audit('CONFIG_UPDATED')
  async updateSiteConfig(@Body() data: any) {
    const config = await this.adminService.updateSiteConfig(data);
    return { success: true, data: config };
  }

  // ============ FORM SCHEMAS ============
  @Get('form-schema/:name')
  async getFormSchema(@Param('name') name: string) {
    const schema = await this.formSchemaService.getSchema(name);
    return { success: true, data: schema };
  }

  @Put('form-schema/:name')
  @Audit('FORM_SCHEMA_UPDATED')
  async updateFormSchema(@Param('name') name: string, @Body('schema') schema: object) {
    const updated = await this.formSchemaService.updateSchema(name, schema);
    return { success: true, data: updated };
  }

  // ============ ADS ============
  @Get('ads')
  async listAds() {
    const ads = await this.adminService.listAds();
    return { success: true, data: ads };
  }

  @Post('ads')
  @Audit('AD_CREATED')
  async createAd(@Body() data: any) {
    const ad = await this.adminService.createAd(data);
    return { success: true, data: ad };
  }

  @Put('ads/:id')
  @Audit('AD_UPDATED')
  async updateAd(@Param('id') id: string, @Body() data: any) {
    const ad = await this.adminService.updateAd(id, data);
    return { success: true, data: ad };
  }

  @Delete('ads/:id')
  @Audit('AD_DELETED')
  async deleteAd(@Param('id') id: string) {
    await this.adminService.deleteAd(id);
    return { success: true };
  }

  // ============ COUPONS ============
  @Get('coupons')
  async listCoupons() {
    const coupons = await this.adminService.listCoupons();
    return { success: true, data: coupons };
  }

  @Post('coupons')
  @Audit('COUPON_CREATED')
  async createCoupon(@Body() data: any) {
    const coupon = await this.adminService.createCoupon(data);
    return { success: true, data: coupon };
  }

  @Put('coupons/:id')
  @Audit('COUPON_UPDATED')
  async updateCoupon(@Param('id') id: string, @Body() data: any) {
    const coupon = await this.adminService.updateCoupon(id, data);
    return { success: true, data: coupon };
  }

  @Delete('coupons/:id')
  @Audit('COUPON_DELETED')
  async deleteCoupon(@Param('id') id: string) {
    await this.adminService.deleteCoupon(id);
    return { success: true };
  }

  // ============ CAMPAIGNS ============
  @Get('campaigns')
  async listCampaigns() {
    const campaigns = await this.campaignsService.listCampaigns();
    return { success: true, data: campaigns };
  }

  @Post('campaigns')
  @Audit('CAMPAIGN_CREATED')
  async createCampaign(@Body() data: any, @CurrentUser() admin: User) {
    const campaign = await this.campaignsService.createCampaign({ ...data, createdById: admin.id });
    return { success: true, data: campaign };
  }

  @Post('campaigns/:id/send')
  @Audit('CAMPAIGN_SENT')
  async sendCampaign(@Param('id') id: string) {
    const result = await this.campaignsService.sendCampaign(id);
    return { success: true, data: result };
  }
}
