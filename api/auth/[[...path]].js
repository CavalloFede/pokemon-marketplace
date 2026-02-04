import { PrismaClient } from '@prisma/client';
import { verifyIdToken } from '../_lib/firebase.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

const INITIAL_COINS = 500;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get path from query parameter (array of path segments)
  const path = req.query.path || [];
  const endpoint = path[0];

  // Route based on path
  if (endpoint === 'authenticate') {
    return handleAuthenticate(req, res);
  } else if (endpoint === 'logout') {
    return handleLogout(req, res);
  } else {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
}

async function handleAuthenticate(req, res) {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Verify Firebase token
    const decoded = await verifyIdToken(idToken);
    const firebaseUid = decoded.uid;
    const email = decoded.email || '';
    const displayName = decoded.name || email.split('@')[0] || 'Trainer';
    const avatarUrl = decoded.picture;

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { firebaseUid }
    });

    if (!user) {
      // Create new user with initial coins
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            firebaseUid,
            email,
            displayName,
            avatarUrl,
            coins: INITIAL_COINS
          }
        });

        await tx.coinTransaction.create({
          data: {
            userId: newUser.id,
            amount: INITIAL_COINS,
            type: 'initial_bonus'
          }
        });

        return newUser;
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coins: user.coins
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: error.message || 'Authentication failed' });
  }
}

async function handleLogout(req, res) {
  // Firebase token revocation happens client-side
  return res.status(200).json({ success: true });
}
