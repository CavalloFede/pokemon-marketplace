import type { VercelRequest } from '@vercel/node';
import { getFirebaseAuth } from '../lib/firebase.js';
import { prisma } from '../lib/prisma.js';

export interface AuthUser {
  firebaseUid: string;
  email: string;
  userId: string;
}

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Verify Firebase token and get user info
 * Throws AuthError if authentication fails
 */
export async function requireAuth(req: VercelRequest): Promise<AuthUser> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401);
  }

  const token = authHeader.slice(7);

  try {
    const auth = getFirebaseAuth();
    const decoded = await auth.verifyIdToken(token);

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true }
    });

    if (!user) {
      throw new AuthError('User not found', 401);
    }

    return {
      firebaseUid: decoded.uid,
      email: decoded.email || '',
      userId: user.id
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Auth verification error:', error);
    throw new AuthError('Invalid or expired token', 401);
  }
}

/**
 * Optional authentication - returns user info if token is valid, null otherwise
 * Does not throw errors for missing or invalid tokens
 */
export async function optionalAuth(req: VercelRequest): Promise<AuthUser | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}

/**
 * Extract Firebase user info without requiring internal user to exist
 * Useful for authentication endpoints that may create users
 */
export async function verifyFirebaseToken(req: VercelRequest): Promise<{ uid: string; email: string }> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401);
  }

  const token = authHeader.slice(7);

  try {
    const auth = getFirebaseAuth();
    const decoded = await auth.verifyIdToken(token);

    return {
      uid: decoded.uid,
      email: decoded.email || ''
    };
  } catch (error) {
    console.error('Firebase token verification error:', error);
    throw new AuthError('Invalid or expired token', 401);
  }
}
