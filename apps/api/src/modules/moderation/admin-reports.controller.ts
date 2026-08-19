import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';
import { ResolveReportDto } from './dto';

@Controller('admin/reports')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminReportsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get()
  async listReports(@Query('status') status?: string) {
    return this.moderationService.listReports(status);
  }

  @Post(':id/resolve')
  async resolveReport(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.moderationService.resolveReport(admin.id, id, dto.action, dto.note);
  }
}
