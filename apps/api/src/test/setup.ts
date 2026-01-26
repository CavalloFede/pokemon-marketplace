import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.COGNITO_USER_POOL_ID = 'test-pool-id';
process.env.COGNITO_CLIENT_ID = 'test-client-id';

// Mock Redis
vi.mock('../lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
}));

beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global cleanup
});
