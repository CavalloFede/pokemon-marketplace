import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Validate required environment variables
export function validateEnv() {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }

  // Log Firebase status
  if (process.env.FIREBASE_PROJECT_ID) {
    console.info('[ENV] Firebase configuration found');
  } else {
    console.info('[ENV] Firebase not configured - using mock mode');
  }
}

validateEnv();
