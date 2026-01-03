import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FormSchemaService {
  constructor(private prisma: PrismaService) {}

  async getSchema(name: string) {
    const schema = await this.prisma.formSchema.findUnique({ where: { name } });
    if (!schema) throw new NotFoundException(`Form schema '${name}' not found`);
    return schema;
  }

  async updateSchema(name: string, schema: object) {
    return this.prisma.formSchema.upsert({
      where: { name },
      create: { name, schema, isActive: true },
      update: { schema, version: { increment: 1 } },
    });
  }

  async listSchemas() {
    return this.prisma.formSchema.findMany({ orderBy: { name: 'asc' } });
  }
}
