import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MOCK_AUTH = 'true';
process.env.FIREBASE_PROJECT_ID = 'test-project';

// Mock Redis
vi.mock('../lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
}));

// Mock Firebase
vi.mock('../lib/firebase.js', () => ({
  initializeFirebase: vi.fn(),
  verifyIdToken: vi.fn().mockResolvedValue({
    uid: 'test-firebase-uid',
    email: 'test@example.com',
    name: 'Test User'
  }),
  IS_MOCK_MODE: true
}));

beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global cleanup
});
