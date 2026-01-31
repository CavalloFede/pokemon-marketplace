import { verifyIdToken } from '../lib/firebase.js';
import { userService } from './user.service.js';

interface UserInfo {
  firebaseUid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export class AuthService {
  /**
   * Verify Firebase ID token and return user info
   */
  async verifyToken(idToken: string): Promise<UserInfo> {
    const decodedToken = await verifyIdToken(idToken);

    return {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Trainer',
      avatarUrl: decodedToken.picture
    };
  }

  /**
   * Authenticate user - verify token and get/create user in database
   */
  async authenticate(idToken: string) {
    // Verify the Firebase ID token
    const userInfo = await this.verifyToken(idToken);

    // Get or create user in our database
    const user = await userService.getOrCreateUser({
      firebaseUid: userInfo.firebaseUid,
      email: userInfo.email,
      displayName: userInfo.displayName,
      avatarUrl: userInfo.avatarUrl
    });

    return { user };
  }

  /**
   * Sign out - Firebase handles token invalidation on client side
   * This endpoint can be used for server-side cleanup if needed
   */
  async signOut(): Promise<void> {
    // Firebase token revocation happens client-side
    // Server can perform any cleanup here if needed
    console.info('[AUTH] User signed out');
  }
}

export const authService = new AuthService();
