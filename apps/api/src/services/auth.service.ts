import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { userService } from './user.service.js';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1'
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

interface TokenResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserInfo {
  cognitoId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export class AuthService {
  /**
   * Exchange authorization code for tokens (OAuth callback)
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    // For OAuth with hosted UI, we need to call the token endpoint directly
    const tokenEndpoint = `https://${process.env.COGNITO_DOMAIN}/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<Omit<TokenResponse, 'refreshToken'>> {
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Failed to refresh tokens');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      expiresIn: response.AuthenticationResult.ExpiresIn!
    };
  }

  /**
   * Get user info from access token
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const command = new GetUserCommand({
      AccessToken: accessToken
    });

    const response = await cognitoClient.send(command);

    const attributes = response.UserAttributes || [];
    const getAttr = (name: string) =>
      attributes.find(a => a.Name === name)?.Value;

    return {
      cognitoId: getAttr('sub') || response.Username!,
      email: getAttr('email') || '',
      displayName: getAttr('name') || getAttr('email')?.split('@')[0] || 'Trainer',
      avatarUrl: getAttr('picture')
    };
  }

  /**
   * Handle OAuth callback - exchange code, get user info, create/update user
   */
  async handleOAuthCallback(code: string, redirectUri: string) {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, redirectUri);

    // Get user info from Cognito
    const userInfo = await this.getUserInfo(tokens.accessToken);

    // Get or create user in our database
    const user = await userService.getOrCreateUser({
      cognitoId: userInfo.cognitoId,
      email: userInfo.email,
      displayName: userInfo.displayName,
      avatarUrl: userInfo.avatarUrl
    });

    return {
      user,
      tokens
    };
  }

  /**
   * Global sign out - invalidate all tokens
   */
  async signOut(accessToken: string): Promise<void> {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken
    });

    await cognitoClient.send(command);
  }

  /**
   * Build the Cognito hosted UI login URL
   */
  getLoginUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'email openid profile',
      redirect_uri: redirectUri,
      identity_provider: 'Google'
    });

    if (state) {
      params.set('state', state);
    }

    return `https://${process.env.COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
  }
}

export const authService = new AuthService();
