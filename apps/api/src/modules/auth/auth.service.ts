import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { FirebaseAuthService } from "./firebase-auth.service";
import { SignupDto } from "./dto/signup.dto";
import { User, Profile } from "@prisma/client";
import { nanoid } from "nanoid";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private firebaseAuth: FirebaseAuthService,
    private configService: ConfigService
  ) {}

  /**
   * Register a new user
   */
  async signup(dto: SignupDto): Promise<{ user: User; message: string }> {
    // Check if email already exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException("Email already registered");
    }

    // Check if phone already exists
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException("Phone number already registered");
    }

    // Create Firebase user
    const firebaseUser = await this.firebaseAuth.createUser({
      email: dto.email,
      password: dto.password,
      phoneNumber: dto.phone,
      displayName: dto.firstName,
    });

    // Create user in database
    const user = await this.prisma.user.create({
      data: {
        firebaseUid: firebaseUser?.uid || `local_${nanoid(12)}`,
        email: dto.email,
        phone: dto.phone,
        publicId: nanoid(12),
      },
    });

    return {
      user,
      message: "Registration successful. Please verify your phone number.",
    };
  }

  /**
   * Validate user from Firebase token and return user record
   */
  async validateUser(firebaseUid: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { profile: true },
    });
  }

  /**
   * Link OAuth provider to existing user
   */
  async linkOAuthProvider(userId: string, provider: string): Promise<User> {
    // This would be implemented with Firebase's linkWithCredential on client side
    // Server just records the linked provider
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  /**
   * Handle OAuth signup/login
   */
  async handleOAuthUser(
    firebaseUid: string,
    email: string,
    phone?: string
  ): Promise<User & { profile: Profile | null }> {
    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { profile: true },
    });

    if (user) {
      return user;
    }

    // Check if email already used
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException(
        "Email already registered with another account"
      );
    }

    // Create new user from OAuth
    user = await this.prisma.user.create({
      data: {
        firebaseUid,
        email,
        phone: phone || `oauth_${nanoid(10)}`, // Temporary phone if not provided
        publicId: nanoid(12),
      },
      include: { profile: true },
    });

    return user;
  }

  /**
   * Logout user (invalidate sessions if using custom tokens)
   */
  async logout(userId: string): Promise<void> {
    // Clear any server-side session data
    await this.redis.del(`session:${userId}`);
  }

  /**
   * Check rate limit for auth endpoints
   */
  async checkRateLimit(ip: string, type: "login" | "signup"): Promise<boolean> {
    const limits = this.configService.get(`security.rateLimits.${type}`);
    const key = `ratelimit:${type}:${ip}`;
    return this.redis.checkRateLimit(key, limits.max, limits.windowMs / 1000);
  }
}
