import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PhotosService } from '../photos/photos.service';
import { CreateRequestDto, RespondRequestDto } from './dto/request.dto';
import { RequestStatus, AllowedShareType } from '@prisma/client';
import { nanoid } from 'nanoid';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private photosService: PhotosService,
  ) {}

  /**
   * Send an info request to another user
   * Enforces: one active request at a time per requester
   */
  async createRequest(requesterId: string, dto: CreateRequestDto) {
    // Prevent self-request
    const target = await this.prisma.user.findUnique({
      where: { publicId: dto.targetPublicId },
    });

    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    if (target.id === requesterId) {
      throw new BadRequestException('Cannot request your own information');
    }

    // Check for existing active request using Redis lock
    const lockKey = `active_request:${requesterId}`;
    const hasLock = await this.redis.acquireLock(lockKey, 86400); // 24h lock

    if (!hasLock) {
      // Check if there's an actual pending request
      const existingRequest = await this.prisma.infoRequest.findFirst({
        where: {
          requesterId,
          status: 'PENDING',
        },
      });

      if (existingRequest) {
        throw new ConflictException('You already have an active request pending. Please wait for a response.');
      }

      // Lock exists but no pending request - clean up stale lock
      await this.redis.releaseLock(lockKey);
    }

    try {
      // Set expiration 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create the request
      const request = await this.prisma.infoRequest.create({
        data: {
          requesterId,
          targetId: target.id,
          requestedPhoto: dto.requestPhoto,
          requestedPhone: dto.requestPhone,
          requestedEmail: dto.requestEmail,
          expiresAt,
        },
      });

      // Track active request
      await this.prisma.activeRequest.create({
        data: {
          requesterId,
          requestId: request.id,
        },
      });

      return request;
    } catch (error) {
      await this.redis.releaseLock(lockKey);
      throw error;
    }
  }

  /**
   * Respond to an info request (approve/deny)
   */
  async respondToRequest(targetId: string, requestId: string, dto: RespondRequestDto) {
    const request = await this.prisma.infoRequest.findFirst({
      where: {
        id: requestId,
        targetId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Request not found or already responded');
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      throw new BadRequestException('This request has expired');
    }

    // Update request status
    const updatedRequest = await this.prisma.infoRequest.update({
      where: { id: requestId },
      data: {
        status: dto.approve ? 'APPROVED' : 'DENIED',
        allowedShares: dto.approve ? dto.shareType : 'NONE',
        respondedAt: new Date(),
      },
    });

    // Clean up active request tracking
    await this.prisma.activeRequest.deleteMany({
      where: { requestId },
    });

    // Release Redis lock
    await this.redis.releaseLock(`active_request:${request.requesterId}`);

    // If approved, queue email notification
    if (dto.approve && dto.shareType !== 'NONE') {
      await this.queueApprovalEmail(updatedRequest);
    }

    return updatedRequest;
  }

  /**
   * Get requests sent by user
   */
  async getSentRequests(userId: string) {
    return this.prisma.infoRequest.findMany({
      where: { requesterId: userId },
      include: {
        target: {
          select: {
            publicId: true,
            profile: {
              select: {
                firstName: true,
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
   * Get requests received by user
   */
  async getReceivedRequests(userId: string) {
    return this.prisma.infoRequest.findMany({
      where: { targetId: userId },
      include: {
        requester: {
          select: {
            publicId: true,
            profile: {
              select: {
                firstName: true,
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
   * Queue email for approved request
   */
  private async queueApprovalEmail(request: any) {
    // In production, this would publish to Cloud Tasks/Pub/Sub
    // For now, we create tokens that will be used by the email job
    
    if (request.allowedShares === 'ALL' || request.requestedPhoto) {
      // Create one-time use signed URL token
      const token = nanoid(32);
      
      await this.prisma.signedUrlToken.create({
        data: {
          token,
          requestId: request.id,
          resourceType: 'PHOTO',
          gcsPath: '', // Will be set by job
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });
    }

    // TODO: Trigger Cloud Tasks job for email sending
    console.log(`[TODO] Queue email for request ${request.id}`);
  }
}
