import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if we're in mock mode - use a function to ensure env vars are read at runtime
function checkMockMode(): boolean {
  return !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_MOCK_AUTH === 'true';
}

const IS_MOCK_MODE = checkMockMode();

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Initialize Firebase
 */
function initializeFirebase(): void {
  if (IS_MOCK_MODE) {
    console.info('[FIREBASE] Mock mode enabled - Firebase not initialized');
    return;
  }

  if (app) return;

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.info('[FIREBASE] Firebase initialized successfully');
  } catch (error) {
    console.error('[FIREBASE] Failed to initialize Firebase:', error);
  }
}

// Initialize on module load
initializeFirebase();

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle(): Promise<{
  user: User;
  idToken: string;
} | null> {
  // Mock mode for development
  if (IS_MOCK_MODE) {
    console.info('[FIREBASE] Mock mode: Returning mock auth result');
    return {
      user: {
        uid: 'mock-firebase-uid-12345',
        email: 'trainer@pokemon.local',
        displayName: 'Mock Trainer',
        photoURL: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'
      } as unknown as User,
      idToken: 'mock-id-token-' + Date.now()
    };
  }

  if (!auth) {
    throw new Error('Firebase not initialized');
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();

  return {
    user: result.user,
    idToken
  };
}

/**
 * Sign out from Firebase
 */
export async function signOut(): Promise<void> {
  if (IS_MOCK_MODE) {
    console.info('[FIREBASE] Mock mode: Sign out (no-op)');
    return;
  }

  if (!auth) {
    return;
  }

  await firebaseSignOut(auth);
}

/**
 * Wait for Firebase auth to be ready (restores session on page reload)
 */
export function waitForAuthReady(): Promise<User | null> {
  if (IS_MOCK_MODE) {
    const mockLoggedIn = localStorage.getItem('mockLoggedIn');
    if (mockLoggedIn) {
      return Promise.resolve({
        uid: 'mock-firebase-uid-12345',
        email: 'trainer@pokemon.local',
        displayName: 'Mock Trainer',
        photoURL: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'
      } as unknown as User);
    }
    return Promise.resolve(null);
  }

  if (!auth) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth!, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Get current user's ID token
 */
export async function getIdToken(): Promise<string | null> {
  if (IS_MOCK_MODE) {
    // In mock mode, return a mock token if user was previously "logged in"
    const mockLoggedIn = localStorage.getItem('mockLoggedIn');
    if (mockLoggedIn) {
      return 'mock-id-token-' + Date.now();
    }
    return null;
  }

  // Wait for auth to be ready first
  const user = await waitForAuthReady();
  if (!user) {
    return null;
  }

  return user.getIdToken();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (IS_MOCK_MODE) {
    // In mock mode, check localStorage for mock login state
    const mockLoggedIn = localStorage.getItem('mockLoggedIn');
    if (mockLoggedIn) {
      callback({
        uid: 'mock-firebase-uid-12345',
        email: 'trainer@pokemon.local',
        displayName: 'Mock Trainer',
        photoURL: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'
      } as unknown as User);
    } else {
      callback(null);
    }
    return () => {};
  }

  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

/**
 * Get current Firebase user
 */
export function getCurrentUser(): User | null {
  if (IS_MOCK_MODE) {
    const mockLoggedIn = localStorage.getItem('mockLoggedIn');
    if (mockLoggedIn) {
      return {
        uid: 'mock-firebase-uid-12345',
        email: 'trainer@pokemon.local',
        displayName: 'Mock Trainer',
        photoURL: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'
      } as unknown as User;
    }
    return null;
  }

  return auth?.currentUser ?? null;
}

/**
 * Set mock logged in state (for development)
 */
export function setMockLoggedIn(value: boolean): void {
  if (value) {
    localStorage.setItem('mockLoggedIn', 'true');
  } else {
    localStorage.removeItem('mockLoggedIn');
  }
}

export { IS_MOCK_MODE };
