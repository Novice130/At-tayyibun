/**
 * OAuth Provider Interface
 * Extensible interface for adding new OAuth providers (e.g., Instagram, Facebook)
 * 
 * TODO: Implement FacebookStrategy using this interface
 * TODO: Implement InstagramStrategy when Meta App Review is approved
 * 
 * Usage:
 * 1. Create a new strategy file (e.g., facebook.strategy.ts)
 * 2. Implement the OAuthProvider interface
 * 3. Register in auth.module.ts
 */

export interface OAuthUserProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  providerId?: string;
}

export interface OAuthProvider {
  /**
   * Provider name (e.g., 'google', 'facebook', 'instagram')
   */
  readonly name: string;

  /**
   * Validate and extract user profile from OAuth callback
   */
  validateUser(accessToken: string, profile: unknown): Promise<OAuthUserProfile>;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Base class for OAuth strategies
 * Provides common functionality for all OAuth providers
 */
export abstract class BaseOAuthProvider implements OAuthProvider {
  abstract readonly name: string;

  abstract validateUser(accessToken: string, profile: unknown): Promise<OAuthUserProfile>;

  isConfigured(): boolean {
    return true; // Override in subclasses to check env vars
  }

  protected sanitizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  protected sanitizeName(name: string): string {
    return name.trim().slice(0, 50);
  }
}
