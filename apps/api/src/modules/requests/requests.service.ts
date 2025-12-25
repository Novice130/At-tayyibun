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
import { CreateRequestDto, RespondRequestDto } from './dto';

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

    // Create the request with 24-hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const request = await this.prisma.infoRequest.create({
      data: {
        requesterId,
        targetId: target.id,
        status: RequestStatus.PENDING,
        expiresAt,
        allowedShares: [],
      },
    });

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
      // Mark as expired
      await this.prisma.infoRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.EXPIRED },
      });
      throw new BadRequestException('This request has expired');
    }

    // Process the response
    if (dto.approved) {
      // Generate one-time token for photo access
      const oneTimeToken = this.encryptionService.generateToken(32);

      await this.prisma.infoRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.APPROVED,
          allowedShares: dto.shareItems || ['photo', 'phone', 'email'],
          respondedAt: new Date(),
          oneTimeToken,
        },
      });

      // Prepare shared info
      const sharedInfo: { photo?: string; phone?: string; email?: string } = {};
      const allowedShares = dto.shareItems || ['photo', 'phone', 'email'];

      if (allowedShares.includes('photo')) {
        // Get primary photo and generate signed URL
        const primaryPhoto = request.target.photos.find(p => p.isPrimary);
        if (primaryPhoto && primaryPhoto.gcsDisplayPath) {
          sharedInfo.photo = await this.storageService.getOneTimeSignedUrl(
            primaryPhoto.gcsDisplayPath,
          );
        }
      }

      if (allowedShares.includes('phone')) {
        sharedInfo.phone = request.target.phone;
      }

      if (allowedShares.includes('email')) {
        sharedInfo.email = request.target.email;
      }

      // Send email to requester
      await this.emailService.sendSharedInfoEmail(
        request.requester.email,
        request.requester.profile?.firstName || 'User',
        request.target.profile?.firstName || 'A user',
        sharedInfo,
      );

      // Log approval
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

      // Log denial
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

    // Mark token as used
    await this.prisma.infoRequest.update({
      where: { id: request.id },
      data: { tokenUsedAt: new Date() },
    });

    // Build response based on allowed shares
    const result: {
      photoUrl?: string;
      phone?: string;
      email?: string;
    } = {};

    if (request.allowedShares.includes('photo')) {
      const photo = request.target.photos[0];
      if (photo?.gcsDisplayPath) {
        result.photoUrl = await this.storageService.getSignedUrl(photo.gcsDisplayPath, 60);
      }
    }

    if (request.allowedShares.includes('phone')) {
      result.phone = request.target.phone;
    }

    if (request.allowedShares.includes('email')) {
      result.email = request.target.email;
    }

    return result;
  }
}
