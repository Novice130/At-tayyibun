import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../profiles/encryption.service';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { id: userId } } },
      include: {
        participants: { select: { id: true, publicId: true, profile: { select: { firstName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map(c => ({
      ...c,
      messages: c.messages.map(m => ({
        ...m,
        content: this.encryption.decrypt(m.content),
      })),
    }));
  }

  async getMessages(userId: string, otherUserId: string, page = 1, limit = 50) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: otherUserId } } },
        ],
      },
    });

    if (!conversation) return { messages: [], total: 0 };

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId: conversation.id } }),
    ]);

    // Mark as read
    await this.prisma.message.updateMany({
      where: { conversationId: conversation.id, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    return {
      messages: messages.map(m => ({ ...m, content: this.encryption.decrypt(m.content) })),
      total,
    };
  }

  async sendMessage(senderId: string, receiverPublicId: string, content: string) {
    const receiver = await this.prisma.user.findUnique({ where: { publicId: receiverPublicId } });
    if (!receiver) throw new NotFoundException('User not found');

    // Find or create conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: senderId } } },
          { participants: { some: { id: receiver.id } } },
        ],
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { participants: { connect: [{ id: senderId }, { id: receiver.id }] } },
      });
    }

    const encryptedContent = this.encryption.encrypt(content);

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        receiverId: receiver.id,
        content: encryptedContent,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    return { ...message, content };
  }
}
