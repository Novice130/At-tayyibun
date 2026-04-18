import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { desc, eq, count } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { ads, partners } from '../../../db/schema';
import { AuditService } from '../../../services/audit.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminAdsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
  ) {}

  async getPartners() {
    const db = this.drizzle.db;
    return db.select().from(partners).orderBy(desc(partners.name));
  }

  async getAds(page = 1, limit = 20) {
    const db = this.drizzle.db;
    
    const [[metaRow], data] = await Promise.all([
      db.select({ value: count() }).from(ads),
      db.select({
        id: ads.id,
        partnerId: ads.partnerId,
        partnerName: partners.name,
        title: ads.title,
        imageUrl: ads.imageUrl,
        clickUrl: ads.clickUrl,
        frequencyRules: ads.frequencyRules,
        isActive: ads.isActive,
        startDate: ads.startDate,
        endDate: ads.endDate
      })
      .from(ads)
      .leftJoin(partners, eq(ads.partnerId, partners.id))
      .limit(limit)
      .offset((page - 1) * limit)
      .orderBy(desc(ads.startDate))
    ]);

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

  async createAd(adminId: string, payload: any) {
    const db = this.drizzle.db;
    const newId = randomUUID();

    // ensure partner exists or create one? For simplicity, assume partnerId is passed.
    if (!payload.partnerId) {
       throw new BadRequestException('partnerId is required');
    }

    await db.insert(ads).values({
      id: newId,
      partnerId: payload.partnerId,
      title: payload.title,
      imageUrl: payload.imageUrl,
      clickUrl: payload.clickUrl,
      frequencyRules: payload.frequencyRules || {},
      isActive: payload.isActive ?? true,
      startDate: payload.startDate,
      endDate: payload.endDate,
    });

    await this.auditService.logAdminAction(adminId, 'CREATE_AD', 'ad', newId);
    return { success: true, id: newId };
  }

  async updateAd(adminId: string, id: string, payload: any) {
    const db = this.drizzle.db;
    
    const [existing] = await db.select().from(ads).where(eq(ads.id, id));
    if (!existing) throw new NotFoundException('Ad not found');

    await db.update(ads).set({
      title: payload.title ?? existing.title,
      imageUrl: payload.imageUrl ?? existing.imageUrl,
      clickUrl: payload.clickUrl ?? existing.clickUrl,
      frequencyRules: payload.frequencyRules ?? existing.frequencyRules,
      isActive: payload.isActive ?? existing.isActive,
      startDate: payload.startDate !== undefined ? payload.startDate : existing.startDate,
      endDate: payload.endDate !== undefined ? payload.endDate : existing.endDate,
    }).where(eq(ads.id, id));

    await this.auditService.logAdminAction(adminId, 'UPDATE_AD', 'ad', id);
    return { success: true };
  }

  async deleteAd(adminId: string, id: string) {
    const db = this.drizzle.db;
    
    const [existing] = await db.select().from(ads).where(eq(ads.id, id));
    if (!existing) throw new NotFoundException('Ad not found');

    await db.delete(ads).where(eq(ads.id, id));
    await this.auditService.logAdminAction(adminId, 'DELETE_AD', 'ad', id);
    
    return { success: true };
  }
}
