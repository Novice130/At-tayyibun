import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";

export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase: {
    sign_in_provider: string;
  };
}

/**
 * Firebase Authentication Service
 * Handles token verification and user management via Firebase Admin SDK
 */
@Injectable()
export class FirebaseAuthService {
  private app: admin.app.App | null = null;
  private readonly logger = new Logger(FirebaseAuthService.name);
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const firebaseConfig = this.configService.get("security.firebase");

      // Check if Firebase credentials are properly configured
      if (
        !firebaseConfig?.projectId ||
        firebaseConfig.projectId === "your-project-id"
      ) {
        this.logger.warn(
          "Firebase credentials not configured. Authentication will be disabled."
        );
        return;
      }

      if (!admin.apps.length) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            privateKey: firebaseConfig.privateKey?.replace(/\\n/g, "\n"),
            clientEmail: firebaseConfig.clientEmail,
          }),
        });
        this.isInitialized = true;
        this.logger.log("Firebase Admin SDK initialized successfully");
      } else {
        this.app = admin.apps[0]!;
        this.isInitialized = true;
      }
    } catch (error) {
      this.logger.error("Failed to initialize Firebase Admin SDK:", error);
      this.logger.warn("Continuing without Firebase authentication...");
    }
  }

  /**
   * Check if Firebase is properly initialized
   */
  isFirebaseInitialized(): boolean {
    return this.isInitialized && this.app !== null;
  }

  /**
   * Verify a Firebase ID token
   */
  async verifyToken(token: string): Promise<DecodedFirebaseToken> {
    if (!this.isFirebaseInitialized()) {
      throw new Error("Firebase authentication is not configured");
    }
    try {
      const decodedToken = await this.app!.auth().verifyIdToken(token);
      return decodedToken as DecodedFirebaseToken;
    } catch (error) {
      throw new Error("Invalid or expired Firebase token");
    }
  }

  /**
   * Get Firebase user by UID
   */
  async getUser(uid: string): Promise<admin.auth.UserRecord | null> {
    if (!this.isFirebaseInitialized()) {
      return null;
    }
    try {
      return await this.app!.auth().getUser(uid);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a new Firebase user
   */
  async createUser(data: {
    email: string;
    password: string;
    phoneNumber?: string;
    displayName?: string;
  }): Promise<admin.auth.UserRecord | null> {
    if (!this.isFirebaseInitialized()) {
      this.logger.warn('Firebase not configured - skipping Firebase user creation');
      return null;
    }
    return this.app!.auth().createUser({
      email: data.email,
      password: data.password,
      phoneNumber: data.phoneNumber,
      displayName: data.displayName,
      emailVerified: false,
    });
  }

  /**
   * Update a Firebase user
   */
  async updateUser(
    uid: string,
    data: Partial<admin.auth.UpdateRequest>
  ): Promise<admin.auth.UserRecord | null> {
    if (!this.isFirebaseInitialized()) {
      this.logger.warn('Firebase not configured - skipping user update');
      return null;
    }
    return this.app!.auth().updateUser(uid, data);
  }

  /**
   * Delete a Firebase user
   */
  async deleteUser(uid: string): Promise<void> {
    if (!this.isFirebaseInitialized()) {
      this.logger.warn('Firebase not configured - skipping user deletion');
      return;
    }
    await this.app!.auth().deleteUser(uid);
  }

  /**
   * Set custom claims on a user (for RBAC)
   */
  async setCustomClaims(uid: string, claims: object): Promise<void> {
    if (!this.isFirebaseInitialized()) {
      this.logger.warn('Firebase not configured - skipping custom claims');
      return;
    }
    await this.app!.auth().setCustomUserClaims(uid, claims);
  }

  /**
   * Generate a custom token for a user
   */
  async createCustomToken(uid: string, claims?: object): Promise<string | null> {
    if (!this.isFirebaseInitialized()) {
      this.logger.warn('Firebase not configured - cannot create custom token');
      return null;
    }
    return this.app!.auth().createCustomToken(uid, claims);
  }

  /**
   * Verify phone number (generate verification code)
   */
  async generatePhoneVerificationCode(phoneNumber: string): Promise<string> {
    // In production, Firebase handles this client-side
    // This is a placeholder for server-side verification flow
    throw new Error(
      "Phone verification should be handled client-side with Firebase"
    );
  }
}
