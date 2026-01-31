import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyIdToken } from '../lib/firebase.js';

// Extend FastifyRequest to include user info
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    firebaseUid?: string;
    email?: string;
  }
}

/**
 * Auth middleware - verifies Firebase ID token and attaches user info to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // Verify token with Firebase
    const decodedToken = await verifyIdToken(token);

    // Attach user info to request
    request.firebaseUid = decodedToken.uid;
    request.email = decodedToken.email;

    // Get internal user ID from database
    const { prisma } = await import('../lib/prisma.js');
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: { id: true }
    });

    if (user) {
      request.userId = user.id;
    } else {
      // User exists in Firebase but not in our DB yet
      // This can happen on first login - let the route handle user creation
      request.userId = undefined;
    }
  } catch (error) {
    request.log.error(error, 'Auth middleware error');
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth - doesn't fail if no token, just sets user info if present
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // No auth, but that's OK
    }

    const token = authHeader.substring(7);

    const decodedToken = await verifyIdToken(token);
    request.firebaseUid = decodedToken.uid;
    request.email = decodedToken.email;

    const { prisma } = await import('../lib/prisma.js');
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: { id: true }
    });

    if (user) {
      request.userId = user.id;
    }
  } catch {
    // Ignore errors for optional auth
  }
}
