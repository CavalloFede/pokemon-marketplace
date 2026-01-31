import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock Firebase before importing auth middleware
vi.mock('../lib/firebase.js', () => ({
  verifyIdToken: vi.fn(),
  IS_MOCK_MODE: false
}));

// Mock prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn()
  }
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma
}));

// Now import after mocks are set up
import { authMiddleware, optionalAuthMiddleware } from './auth.js';
import { verifyIdToken } from '../lib/firebase.js';

describe('authMiddleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
      log: {
        error: vi.fn()
      } as any
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  describe('Missing/Invalid Authorization Header', () => {
    it('should reject request without authorization header', async () => {
      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header'
      });
    });

    it('should reject request with non-Bearer token', async () => {
      mockRequest.headers = { authorization: 'Basic some-token' };

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header'
      });
    });

    it('should reject request with empty Bearer token', async () => {
      mockRequest.headers = { authorization: 'Bearer ' };
      vi.mocked(verifyIdToken).mockRejectedValue(new Error('Invalid token'));

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // The middleware will try to verify an empty token
      // which should fail
      expect(mockReply.status).toHaveBeenCalled();
    });
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.SKIP_AUTH = 'true';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
      delete process.env.SKIP_AUTH;
    });

    it('should allow request with SKIP_AUTH in development', async () => {
      mockRequest.headers = { authorization: 'Bearer test-token' };

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).userId).toBe('test-user-id');
      expect((mockRequest as any).firebaseUid).toBe('test-firebase-uid');
      expect((mockRequest as any).email).toBe('test@example.com');
    });

    it('should use custom TEST_USER_ID if provided', async () => {
      process.env.TEST_USER_ID = 'custom-test-user';
      mockRequest.headers = { authorization: 'Bearer test-token' };

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).userId).toBe('custom-test-user');

      delete process.env.TEST_USER_ID;
    });
  });

  describe('Token Verification', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(verifyIdToken).mockRejectedValue(new Error('Invalid token'));

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
    });

    it('should accept valid token and set user info', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(verifyIdToken).mockResolvedValue({
        uid: 'firebase-uid-123',
        email: 'user@example.com'
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'db-user-id-123'
      });

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).firebaseUid).toBe('firebase-uid-123');
      expect((mockRequest as any).email).toBe('user@example.com');
      expect((mockRequest as any).userId).toBe('db-user-id-123');
    });

    it('should handle new Firebase user without DB record', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(verifyIdToken).mockResolvedValue({
        uid: 'new-firebase-user',
        email: 'new@example.com'
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await authMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).firebaseUid).toBe('new-firebase-user');
      expect((mockRequest as any).userId).toBeUndefined();
    });
  });
});

describe('optionalAuthMiddleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
      log: {
        error: vi.fn()
      } as any
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  it('should not fail when no authorization header present', async () => {
    await optionalAuthMiddleware(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    // Should not set any user info but should not fail
    expect(mockReply.status).not.toHaveBeenCalled();
    expect((mockRequest as any).userId).toBeUndefined();
  });

  it('should set user info when valid token provided', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_AUTH = 'true';
    mockRequest.headers = { authorization: 'Bearer test-token' };

    await optionalAuthMiddleware(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    expect((mockRequest as any).userId).toBe('test-user-id');

    process.env.NODE_ENV = 'test';
    delete process.env.SKIP_AUTH;
  });

  it('should silently ignore invalid tokens', async () => {
    process.env.NODE_ENV = 'production';

    mockRequest.headers = { authorization: 'Bearer invalid-token' };
    vi.mocked(verifyIdToken).mockRejectedValue(new Error('Invalid'));

    await optionalAuthMiddleware(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply
    );

    // Should not fail, just not set user info
    expect(mockReply.status).not.toHaveBeenCalled();

    process.env.NODE_ENV = 'test';
  });
});
