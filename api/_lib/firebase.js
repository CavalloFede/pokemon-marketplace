import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let auth = null;

export function getFirebaseAuth() {
  if (auth) return auth;

  if (getApps().length > 0) {
    auth = getAuth(getApps()[0]);
    return auth;
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required');
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  let app;

  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  } else {
    app = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  }

  auth = getAuth(app);
  return auth;
}

export async function verifyIdToken(idToken) {
  const firebaseAuth = getFirebaseAuth();
  return firebaseAuth.verifyIdToken(idToken);
}
