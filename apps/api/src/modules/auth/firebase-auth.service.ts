import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

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
  private app: admin.app.App;

  constructor(private configService: ConfigService) {
    const firebaseConfig = this.configService.get('security.firebase');

    if (!admin.apps.length) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseConfig.projectId,
          privateKey: firebaseConfig.privateKey,
          clientEmail: firebaseConfig.clientEmail,
        }),
      });
    } else {
      this.app = admin.apps[0]!;
    }
  }

  /**
   * Verify a Firebase ID token
   */
  async verifyToken(token: string): Promise<DecodedFirebaseToken> {
    try {
      const decodedToken = await this.app.auth().verifyIdToken(token);
      return decodedToken as DecodedFirebaseToken;
    } catch (error) {
      throw new Error('Invalid or expired Firebase token');
    }
  }

  /**
   * Get Firebase user by UID
   */
  async getUser(uid: string): Promise<admin.auth.UserRecord | null> {
    try {
      return await this.app.auth().getUser(uid);
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
  }): Promise<admin.auth.UserRecord> {
    return this.app.auth().createUser({
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
  async updateUser(uid: string, data: Partial<admin.auth.UpdateRequest>): Promise<admin.auth.UserRecord> {
    return this.app.auth().updateUser(uid, data);
  }

  /**
   * Delete a Firebase user
   */
  async deleteUser(uid: string): Promise<void> {
    await this.app.auth().deleteUser(uid);
  }

  /**
   * Set custom claims on a user (for RBAC)
   */
  async setCustomClaims(uid: string, claims: object): Promise<void> {
    await this.app.auth().setCustomUserClaims(uid, claims);
  }

  /**
   * Generate a custom token for a user
   */
  async createCustomToken(uid: string, claims?: object): Promise<string> {
    return this.app.auth().createCustomToken(uid, claims);
  }

  /**
   * Verify phone number (generate verification code)
   */
  async generatePhoneVerificationCode(phoneNumber: string): Promise<string> {
    // In production, Firebase handles this client-side
    // This is a placeholder for server-side verification flow
    throw new Error('Phone verification should be handled client-side with Firebase');
  }
}
