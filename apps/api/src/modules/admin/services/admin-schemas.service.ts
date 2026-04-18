import { Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, asc } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { formSchemas, formFields } from '../../../db/schema';
import { AuditService } from '../../../services/audit.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminSchemasService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
  ) {}

  async getSchemas() {
    const db = this.drizzle.db;
    const schemas = await db.select().from(formSchemas).orderBy(desc(formSchemas.isActive));
    return { data: schemas };
  }

  async getSchemaFields(schemaId: string) {
    const db = this.drizzle.db;
    const fields = await db.select()
      .from(formFields)
      .where(eq(formFields.schemaId, schemaId))
      .orderBy(asc(formFields.displayOrder));
    return { data: fields };
  }

  async createSchema(adminId: string, payload: any) {
    const db = this.drizzle.db;
    const newId = randomUUID();
    
    await db.insert(formSchemas).values({
      id: newId,
      name: payload.name,
      version: payload.version || 1,
      isActive: payload.isActive ?? true,
    });
    
    await this.auditService.logAdminAction(adminId, 'CREATE_SCHEMA', 'schema', newId);
    return { success: true, id: newId };
  }

  async updateSchema(adminId: string, id: string, payload: any) {
    const db = this.drizzle.db;
    
    const [existing] = await db.select().from(formSchemas).where(eq(formSchemas.id, id));
    if (!existing) throw new NotFoundException('Schema not found');

    await db.update(formSchemas).set({
      name: payload.name ?? existing.name,
      version: payload.version ?? existing.version,
      isActive: payload.isActive ?? existing.isActive,
    }).where(eq(formSchemas.id, id));

    await this.auditService.logAdminAction(adminId, 'UPDATE_SCHEMA', 'schema', id);
    return { success: true };
  }

  async createField(adminId: string, schemaId: string, payload: any) {
    const db = this.drizzle.db;
    const newId = randomUUID();

    await db.insert(formFields).values({
      id: newId,
      schemaId: schemaId,
      fieldName: payload.fieldName,
      fieldType: payload.fieldType,
      label: payload.label,
      placeholder: payload.placeholder,
      required: payload.required ?? false,
      options: payload.options,
      displayOrder: payload.displayOrder || 0,
    });

    await this.auditService.logAdminAction(adminId, 'CREATE_SCHEMA_FIELD', 'schema', schemaId);
    return { success: true, id: newId };
  }

  async updateField(adminId: string, fieldId: string, payload: any) {
    const db = this.drizzle.db;
    
    const [existing] = await db.select().from(formFields).where(eq(formFields.id, fieldId));
    if (!existing) throw new NotFoundException('Field not found');

    await db.update(formFields).set({
      fieldName: payload.fieldName ?? existing.fieldName,
      fieldType: payload.fieldType ?? existing.fieldType,
      label: payload.label ?? existing.label,
      placeholder: payload.placeholder ?? existing.placeholder,
      required: payload.required ?? existing.required,
      options: payload.options ?? existing.options,
      displayOrder: payload.displayOrder ?? existing.displayOrder,
    }).where(eq(formFields.id, fieldId));

    await this.auditService.logAdminAction(adminId, 'UPDATE_SCHEMA_FIELD', 'schema', existing.schemaId);
    return { success: true };
  }

  async deleteField(adminId: string, fieldId: string) {
    const db = this.drizzle.db;
    const [existing] = await db.select().from(formFields).where(eq(formFields.id, fieldId));
    if (!existing) throw new NotFoundException('Field not found');
    
    await db.delete(formFields).where(eq(formFields.id, fieldId));
    await this.auditService.logAdminAction(adminId, 'DELETE_SCHEMA_FIELD', 'schema', existing.schemaId);
    return { success: true };
  }
}
