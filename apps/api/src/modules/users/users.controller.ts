import { Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Permanently delete the caller's own account" })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteMe(@CurrentUser('id') userId: string) {
    return this.usersService.deleteOwnAccount(userId);
  }
}
