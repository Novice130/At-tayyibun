/**
 * OAuth Provider Interface
 * 
 * This interface defines the contract for OAuth providers.
 * Instagram OAuth is designed as a pluggable provider but requires
 * Meta App Review for approval.
 * 
 * TODO: Implement InstagramOAuthProvider when Meta App Review is approved
 */
export interface OAuthProvider {
  readonly name: string;
  readonly signInProvider: string;

  /**
   * Validate the OAuth token and return user info
   */
  validateToken(token: string): Promise<OAuthUserInfo>;

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(redirectUri: string, state: string): string;

  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(code: string, redirectUri: string): Promise<string>;
}

export interface OAuthUserInfo {
  providerId: string;
  email?: string;
  name?: string;
  picture?: string;
  phone?: string;
}

/**
 * Placeholder Instagram OAuth Provider
 * 
 * Instagram Basic Display API requires Meta App Review.
 * This is a placeholder implementation showing the interface contract.
 * 
 * Steps to implement:
 * 1. Create a Facebook Developer account
 * 2. Create an app and add Instagram Basic Display product
 * 3. Submit for Meta App Review with required permissions:
 *    - instagram_graph_user_profile
 *    - instagram_graph_user_media (if needed)
 * 4. Implement the methods below with actual API calls
 * 
 * @see https://developers.facebook.com/docs/instagram-basic-display-api
 */
export class InstagramOAuthProvider implements OAuthProvider {
  readonly name = 'instagram';
  readonly signInProvider = 'instagram.com';

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  async validateToken(token: string): Promise<OAuthUserInfo> {
    // TODO: Implement after Meta App Review approval
    // Call Instagram Graph API: GET /me?fields=id,username&access_token=TOKEN
    throw new Error('Instagram OAuth not implemented - requires Meta App Review');
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    // TODO: Implement after Meta App Review approval
    const baseUrl = 'https://api.instagram.com/oauth/authorize';
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'user_profile',
      response_type: 'code',
      state,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    // TODO: Implement after Meta App Review approval
    // POST to https://api.instagram.com/oauth/access_token
    throw new Error('Instagram OAuth not implemented - requires Meta App Review');
  }
}
