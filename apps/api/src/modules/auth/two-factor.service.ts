import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { users } from '../../db/schema';
import { EncryptionService } from '../../services/encryption.service';
import { AuditService } from '../../services/audit.service';

@Injectable()
export class TwoFactorService {
  private readonly appName: string;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'At-Tayyibun');
  }

  private async findUser(id: string) {
    const [row] = await this.drizzle.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async generateSetup(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(email, this.appName, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    const encryptedSecret = this.encryptionService.encrypt(secret);

    await this.drizzle.db
      .update(users)
      .set({ twoFactorSecret: encryptedSecret, twoFactorEnabled: false })
      .where(eq(users.id, userId));

    return { secret, qrCodeDataUrl, otpAuthUrl };
  }

  async enable2FA(userId: string, code: string, ipAddress: string) {
    const user = await this.findUser(userId);
    if (!user || !user.twoFactorSecret) throw new BadRequestException('2FA setup not initiated');

    const secret = this.encryptionService.decrypt(user.twoFactorSecret);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );
    const encryptedBackupCodes = backupCodes.map((c) => this.encryptionService.encrypt(c));

    await this.drizzle.db
      .update(users)
      .set({ twoFactorEnabled: true, twoFactorBackupCodes: encryptedBackupCodes })
      .where(eq(users.id, userId));

    await this.auditService.log({
      userId,
      action: '2FA_ENABLED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
    });

    return backupCodes;
  }

  async verifyLogin(tempToken: string, code: string, _ipAddress: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    const userId = payload.sub as string;
    const user = await this.findUser(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled for user');
    }

    const secret = this.encryptionService.decrypt(user.twoFactorSecret);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return { userId };
  }

  async disable2FA(userId: string, _password: string, code: string, ipAddress: string) {
    const user = await this.findUser(userId);
    if (!user || !user.twoFactorSecret) throw new BadRequestException('2FA not enabled');

    const secret = this.encryptionService.decrypt(user.twoFactorSecret);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.drizzle.db
      .update(users)
      .set({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] })
      .where(eq(users.id, userId));

    await this.auditService.log({
      userId,
      action: '2FA_DISABLED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
    });
  }
}
