import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../services/encryption.service';
import { AuditService } from '../../services/audit.service';
import * as crypto from 'crypto';

@Injectable()
export class TwoFactorService {
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'At-Tayyibun');
  }

  /**
   * Generate a 2FA secret and QR code for setup
   */
  async generateSetup(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(email, this.appName, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    // Encrypt secret
    const encryptedSecret = this.encryptionService.encrypt(secret);
    
    // Store in twoFactorSecret (pending until enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: false 
      },
    });

    return {
      secret,
      qrCodeDataUrl,
      otpAuthUrl,
    };
  }

  /**
   * Verify code and enable 2FA
   */
  async enable2FA(userId: string, code: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // Check if secret exists (setup called)
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const secret = this.encryptionService.decrypt(user.twoFactorSecret);

    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    const encryptedBackupCodes = backupCodes.map(c => this.encryptionService.encrypt(c));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: encryptedBackupCodes,
      },
    });

    await this.auditService.log({
      userId,
      action: '2FA_ENABLED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
    });

    return backupCodes;
  }

  /**
   * Verify 2FA code during login
   */
  async verifyLogin(tempToken: string, code: string, ipAddress: string) {
    // Verify temp token
    let payload;
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    const userId = payload.sub;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled for user');
    }

    const secret = this.encryptionService.decrypt(user.twoFactorSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return { userId };
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, password: string, code: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !user.twoFactorSecret) {
        throw new BadRequestException('2FA not enabled');
    }
    
    const secret = this.encryptionService.decrypt(user.twoFactorSecret);
    const isValid = authenticator.verify({ token: code, secret });
    
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });
    
    await this.auditService.log({
      userId,
      action: '2FA_DISABLED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
    });
  }
}
