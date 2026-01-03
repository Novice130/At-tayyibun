import { Controller, Get, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() user: User) {
    return { success: true, data: user };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @Audit('USER_DEACTIVATED')
  async deactivateAccount(@CurrentUser() user: User) {
    await this.usersService.deactivateUser(user.id);
    return { success: true, message: 'Account deactivated' };
  }
}
