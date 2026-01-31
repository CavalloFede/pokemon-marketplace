import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App | null = null;
let auth: Auth | null = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase(): void {
  if (getApps().length > 0) {
    app = getApps()[0];
    auth = getAuth(app);
    return;
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required');
  }

  try {
    // Parse service account from environment variable
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // Use application default credentials (for GCP environments)
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }

    auth = getAuth(app);
    console.info('[FIREBASE] Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('[FIREBASE] Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebase();
  }

  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  return auth;
}

/**
 * Verify Firebase ID token
 */
export async function verifyIdToken(idToken: string) {
  const firebaseAuth = getFirebaseAuth();
  return firebaseAuth.verifyIdToken(idToken);
}
