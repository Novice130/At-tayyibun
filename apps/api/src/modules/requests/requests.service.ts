import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../services/audit.service';
import { EmailService } from '../../services/email.service';
import { StorageService } from '../../services/storage.service';
import { EncryptionService } from '../../services/encryption.service';
import { RequestStatus } from '@prisma/client';
import { RespondRequestDto } from './dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Create a new info request
   * Enforces: only one active (PENDING) request per requester
   */
  async createRequest(requesterId: string, targetPublicId: string): Promise<{ id: string }> {
    // Find target user by public ID
    const target = await this.prisma.user.findUnique({
      where: { publicId: targetPublicId },
      include: { profile: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.id === requesterId) {
      throw new BadRequestException('Cannot request your own information');
    }

    // Check for existing pending request from this requester
    const existingRequest = await this.prisma.infoRequest.findFirst({
      where: {
        requesterId,
        status: RequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictException('You already have a pending request. Please wait for a response or let it expire.');
    }

    // Create the request with 72-hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const request = await this.prisma.infoRequest.create({
      data: {
        requesterId,
        targetId: target.id,
        status: RequestStatus.PENDING,
        expiresAt,
        allowedShares: [],
      },
    });

    // Get requester info for email
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      include: { profile: true },
    });

    // Send email notification to target
    if (requester?.profile && target.profile) {
      try {
        await this.emailService.sendContactRequestEmail(
          target.email,
          target.profile.firstName,
          requester.profile.firstName,
          requester.profile.ethnicity,
          [requester.profile.city, requester.profile.state].filter(Boolean).join(', '),
        );
      } catch (error) {
        console.error('Failed to send contact request email:', error);
      }
    }

    // Log the request
    await this.auditService.logInfoRequest(
      requesterId,
      'REQUEST_SENT',
      target.id,
      request.id,
    );

    return { id: request.id };
  }

  /**
   * Check if the current user has a pending request (locks them from requesting others)
   */
  async getActiveRequest(userId: string) {
    const pendingRequest = await this.prisma.infoRequest.findFirst({
      where: {
        requesterId: userId,
        status: RequestStatus.PENDING,
      },
      include: {
        target: {
          select: {
            publicId: true,
            profile: {
              select: {
                firstName: true,
              },
            },
          },
        },
      },
    });

    return pendingRequest;
  }

  /**
   * Respond to an info request (approve/deny)
   */
  async respondToRequest(
    userId: string,
    requestId: string,
    dto: RespondRequestDto,
  ): Promise<{ success: boolean }> {
    const request = await this.prisma.infoRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: {
          include: { profile: true },
        },
        target: {
          include: { profile: true, photos: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.targetId !== userId) {
      throw new ForbiddenException('You can only respond to requests sent to you');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('This request has already been processed');
    }

    if (new Date() > request.expiresAt) {
      await this.prisma.infoRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.EXPIRED },
      });
      throw new BadRequestException('This request has expired');
    }

    if (dto.approved) {
      const oneTimeToken = this.encryptionService.generateToken(32);

      await this.prisma.infoRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.APPROVED,
          allowedShares: dto.shareItems || ['phone', 'email'],
          respondedAt: new Date(),
          oneTimeToken,
        },
      });

      // Prepare shared info — share guardian/parent contact when available, not user's direct contact
      const sharedInfo: { photo?: string; phone?: string; email?: string } = {};
      const allowedShares = dto.shareItems || ['phone', 'email'];
      const profile = request.target.profile;

      if (allowedShares.includes('photo')) {
        const primaryPhoto = request.target.photos.find(p => p.isPrimary);
        if (primaryPhoto && primaryPhoto.gcsDisplayPath) {
          sharedInfo.photo = await this.storageService.getOneTimeSignedUrl(
            primaryPhoto.gcsDisplayPath,
          );
        }
      }

      if (allowedShares.includes('phone')) {
        // Share guardian phone if profile was created by guardian/sibling, else user's phone
        if (profile?.guardianPhoneEnc && profile.creatorRole !== 'SELF') {
          try {
            sharedInfo.phone = this.encryptionService.decrypt(profile.guardianPhoneEnc);
          } catch {
            sharedInfo.phone = request.target.phone || undefined;
          }
        } else {
          sharedInfo.phone = request.target.phone || undefined;
        }
      }

      if (allowedShares.includes('email')) {
        // Share guardian email if available, else user's email
        if (profile?.guardianEmailEnc && profile.creatorRole !== 'SELF') {
          try {
            sharedInfo.email = this.encryptionService.decrypt(profile.guardianEmailEnc);
          } catch {
            sharedInfo.email = request.target.email;
          }
        } else {
          sharedInfo.email = request.target.email;
        }
      }

      // Send email to requester with shared info
      try {
        await this.emailService.sendSharedInfoEmail(
          request.requester.email,
          request.requester.profile?.firstName || 'User',
          request.target.profile?.firstName || 'A user',
          sharedInfo,
        );
      } catch (error) {
        console.error('Failed to send shared info email:', error);
      }

      await this.auditService.logInfoRequest(
        userId,
        'REQUEST_APPROVED',
        request.requesterId,
        requestId,
        allowedShares,
      );
    } else {
      // Deny request
      await this.prisma.infoRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.DENIED,
          respondedAt: new Date(),
        },
      });

      // Send denial notification email
      try {
        await this.emailService.sendRequestDeniedEmail(
          request.requester.email,
          request.requester.profile?.firstName || 'User',
        );
      } catch (error) {
        console.error('Failed to send denial email:', error);
      }

      await this.auditService.logInfoRequest(
        userId,
        'REQUEST_DENIED',
        request.requesterId,
        requestId,
      );
    }

    return { success: true };
  }

  /**
   * Get incoming requests for a user
   */
  async getIncomingRequests(userId: string) {
    return this.prisma.infoRequest.findMany({
      where: { targetId: userId },
      include: {
        requester: {
          select: {
            publicId: true,
            profile: {
              select: {
                firstName: true,
                gender: true,
                ethnicity: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get outgoing requests for a user
   */
  async getOutgoingRequests(userId: string) {
    return this.prisma.infoRequest.findMany({
      where: { requesterId: userId },
      include: {
        target: {
          select: {
            publicId: true,
            profile: {
              select: {
                firstName: true,
                gender: true,
                ethnicity: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Access shared info via one-time token
   */
  async getSharedInfo(token: string) {
    const request = await this.prisma.infoRequest.findUnique({
      where: { oneTimeToken: token },
      include: {
        target: {
          include: {
            profile: true,
            photos: { where: { isPrimary: true } },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Invalid or expired link');
    }

    if (request.status !== RequestStatus.APPROVED) {
      throw new BadRequestException('This request was not approved');
    }

    if (request.tokenUsedAt) {
      throw new BadRequestException('This link has already been used');
    }

    await this.prisma.infoRequest.update({
      where: { id: request.id },
      data: { tokenUsedAt: new Date() },
    });

    const result: { photoUrl?: string; phone?: string; email?: string } = {};

    if (request.allowedShares.includes('photo')) {
      const photo = request.target.photos[0];
      if (photo?.gcsDisplayPath) {
        result.photoUrl = await this.storageService.getSignedUrl(photo.gcsDisplayPath, 60);
      }
    }

    if (request.allowedShares.includes('phone')) {
      result.phone = request.target.phone || undefined;
    }

    if (request.allowedShares.includes('email')) {
      result.email = request.target.email;
    }

    return result;
  }
}
