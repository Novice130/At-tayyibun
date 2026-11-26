import { Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AllowSuspended, AllowUnverifiedPhone, CurrentUser } from '../../common/decorators';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete('me')
  @AllowSuspended()
  // Deletion must work for every account, including one that signed up with
  // Google or Apple and never got past the phone gate.
  @AllowUnverifiedPhone()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Permanently delete the caller's own account" })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteMe(@CurrentUser('id') userId: string) {
    return this.usersService.deleteOwnAccount(userId);
  }
}
