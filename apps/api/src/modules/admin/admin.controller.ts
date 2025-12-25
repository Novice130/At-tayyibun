import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get user analytics' })
  @ApiResponse({ status: 200, description: 'Analytics data' })
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(page || 1, limit || 20, search);
  }

  @Get('users/:identifier')
  @ApiOperation({ summary: 'Get user by ID or public ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  async getUser(@Param('identifier') identifier: string) {
    return this.adminService.getUser(identifier);
  }

  @Put('users/:id/boost')
  @ApiOperation({ summary: 'Set rank boost for user' })
  @ApiResponse({ status: 200, description: 'Boost updated' })
  async setRankBoost(
    @Param('id') userId: string,
    @Body() dto: { boost: number },
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.setRankBoost(adminId, userId, dto.boost);
  }

  @Post('admins')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add admin user (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Admin added' })
  async addAdmin(
    @Body() dto: { userId: string },
    @CurrentUser('id') superAdminId: string,
  ) {
    return this.adminService.addAdmin(superAdminId, dto.userId);
  }

  @Delete('admins/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove admin user (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Admin removed' })
  async removeAdmin(
    @Param('id') adminId: string,
    @CurrentUser('id') superAdminId: string,
  ) {
    return this.adminService.removeAdmin(superAdminId, adminId);
  }

  @Put('settings/membership')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle membership system' })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  async toggleMembership(
    @Body() dto: { enabled: boolean },
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.toggleMembership(adminId, dto.enabled);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get system config' })
  @ApiResponse({ status: 200, description: 'System config' })
  async getSystemConfig() {
    return this.adminService.getSystemConfig();
  }
}
