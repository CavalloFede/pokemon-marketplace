import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
vi.stubEnv('VITE_MOCK_AUTH', 'true');

// Mock Firebase
vi.mock('../services/firebase', () => ({
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
  onAuthChange: vi.fn(() => () => {}),
  getCurrentUser: vi.fn(),
  setMockLoggedIn: vi.fn(),
  IS_MOCK_MODE: true
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
