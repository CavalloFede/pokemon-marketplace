import { FastifyRequest, FastifyReply } from 'fastify';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Extend FastifyRequest to include user info
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    cognitoId?: string;
    email?: string;
  }
}

// JWT Verifier for Cognito tokens
let verifier: CognitoJwtVerifier<{
  userPoolId: string;
  tokenUse: 'access';
  clientId: string;
}> | null = null;

function getVerifier() {
  if (!verifier) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      throw new Error('Cognito configuration missing');
    }

    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId
    });
  }
  return verifier;
}

interface CognitoTokenPayload {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  token_use: string;
  auth_time: number;
  iss: string;
  exp: number;
  iat: number;
  client_id: string;
}

/**
 * Auth middleware - verifies JWT and attaches user info to request
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

    // For development without Cognito
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      // Use a test user
      request.userId = process.env.TEST_USER_ID || 'test-user-id';
      request.cognitoId = 'test-cognito-id';
      request.email = 'test@example.com';
      return;
    }

    // Verify token with Cognito
    const payload = await getVerifier().verify(token) as CognitoTokenPayload;

    // Attach user info to request
    request.cognitoId = payload.sub;
    request.email = payload.email;

    // Get internal user ID from database
    const { prisma } = await import('../lib/prisma.js');
    const user = await prisma.user.findUnique({
      where: { cognitoId: payload.sub },
      select: { id: true }
    });

    if (user) {
      request.userId = user.id;
    } else {
      // User exists in Cognito but not in our DB yet
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

    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      request.userId = process.env.TEST_USER_ID || 'test-user-id';
      request.cognitoId = 'test-cognito-id';
      request.email = 'test@example.com';
      return;
    }

    const payload = await getVerifier().verify(token) as CognitoTokenPayload;
    request.cognitoId = payload.sub;
    request.email = payload.email;

    const { prisma } = await import('../lib/prisma.js');
    const user = await prisma.user.findUnique({
      where: { cognitoId: payload.sub },
      select: { id: true }
    });

    if (user) {
      request.userId = user.id;
    }
  } catch {
    // Ignore errors for optional auth
  }
}
