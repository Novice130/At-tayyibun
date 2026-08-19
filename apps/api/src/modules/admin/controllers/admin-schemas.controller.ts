import { Controller, Get, Post, Patch, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AdminSchemasService } from '../services/admin-schemas.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateSchemaDto,
  UpdateSchemaDto,
  CreateSchemaFieldDto,
  UpdateSchemaFieldDto,
} from '../dto';

@Controller('admin/schemas')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminSchemasController {
  constructor(private readonly schemasService: AdminSchemasService) {}

  @Get()
  async getSchemas() {
    return this.schemasService.getSchemas();
  }

  @Post()
  async createSchema(@CurrentUser() admin: any, @Body() payload: CreateSchemaDto) {
    return this.schemasService.createSchema(admin.id, payload);
  }

  @Patch(':id')
  async updateSchema(@CurrentUser() admin: any, @Param('id') id: string, @Body() payload: UpdateSchemaDto) {
    return this.schemasService.updateSchema(admin.id, id, payload);
  }

  @Put(':id/activate')
  @Roles('SUPER_ADMIN')
  async activateSchema(@CurrentUser() admin: any, @Param('id') id: string) {
    return this.schemasService.activateSchema(admin.id, id);
  }

  @Get(':id/fields')
  async getSchemaFields(@Param('id') id: string) {
    return this.schemasService.getSchemaFields(id);
  }

  @Post(':id/fields')
  async createField(@CurrentUser() admin: any, @Param('id') schemaId: string, @Body() payload: CreateSchemaFieldDto) {
    return this.schemasService.createField(admin.id, schemaId, payload);
  }

  @Patch('fields/:fieldId')
  async updateField(@CurrentUser() admin: any, @Param('fieldId') fieldId: string, @Body() payload: UpdateSchemaFieldDto) {
    return this.schemasService.updateField(admin.id, fieldId, payload);
  }

  @Delete('fields/:fieldId')
  async deleteField(@CurrentUser() admin: any, @Param('fieldId') fieldId: string) {
    return this.schemasService.deleteField(admin.id, fieldId);
  }
}
