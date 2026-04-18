import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { desc, eq, count } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { coupons, partners } from '../../../db/schema';
import { AuditService } from '../../../services/audit.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminCouponsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
  ) {}

  async getCoupons(page = 1, limit = 20) {
    const db = this.drizzle.db;
    
    const [metaRow] = await db.select({ value: count() }).from(coupons);

    const data = await db.select({
      id: coupons.id,
      partnerId: coupons.partnerId,
      partnerName: partners.name,
      code: coupons.code,
      description: coupons.description,
      redirectUrl: coupons.redirectUrl,
      validFrom: coupons.validFrom,
      validUntil: coupons.validUntil,
      isActive: coupons.isActive
    })
    .from(coupons)
    .leftJoin(partners, eq(coupons.partnerId, partners.id))
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy(desc(coupons.validFrom));

    return {
      data,
      meta: {
        total: Number(metaRow.value),
        page,
        limit,
        pages: Math.ceil(Number(metaRow.value) / limit),
      }
    };
  }

  async createCoupon(adminId: string, payload: any) {
    const db = this.drizzle.db;
    const newId = randomUUID();

    if (!payload.partnerId) {
       throw new BadRequestException('partnerId is required');
    }

    await db.insert(coupons).values({
      id: newId,
      partnerId: payload.partnerId,
      code: payload.code,
      description: payload.description,
      redirectUrl: payload.redirectUrl,
      isActive: payload.isActive ?? true,
      validFrom: payload.validFrom,
      validUntil: payload.validUntil,
    });

    await this.auditService.logAdminAction(adminId, 'CREATE_COUPON', 'coupon', newId);
    return { success: true, id: newId };
  }

  async updateCoupon(adminId: string, id: string, payload: any) {
    const db = this.drizzle.db;
    
    const [existing] = await db.select().from(coupons).where(eq(coupons.id, id));
    if (!existing) throw new NotFoundException('Coupon not found');

    await db.update(coupons).set({
      code: payload.code ?? existing.code,
      description: payload.description ?? existing.description,
      redirectUrl: payload.redirectUrl ?? existing.redirectUrl,
      isActive: payload.isActive ?? existing.isActive,
      validFrom: payload.validFrom !== undefined ? payload.validFrom : existing.validFrom,
      validUntil: payload.validUntil !== undefined ? payload.validUntil : existing.validUntil,
    }).where(eq(coupons.id, id));

    await this.auditService.logAdminAction(adminId, 'UPDATE_COUPON', 'coupon', id);
    return { success: true };
  }

  async deleteCoupon(adminId: string, id: string) {
    const db = this.drizzle.db;
    
    const [existing] = await db.select().from(coupons).where(eq(coupons.id, id));
    if (!existing) throw new NotFoundException('Coupon not found');

    await db.delete(coupons).where(eq(coupons.id, id));
    await this.auditService.logAdminAction(adminId, 'DELETE_COUPON', 'coupon', id);
    
    return { success: true };
  }
}
