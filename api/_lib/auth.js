import { getFirebaseAuth } from './firebase.js';
import { prisma } from './prisma.js';

export class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function requireAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401);
  }

  const token = authHeader.slice(7);
  const auth = getFirebaseAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (error) {
    throw new AuthError('Invalid or expired token', 401);
  }

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
}

export async function optionalAuth(req) {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}
