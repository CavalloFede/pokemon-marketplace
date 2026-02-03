import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: counterOfferId } = req.query;

  try {
    const auth = await requireAuth(req);

    const counterOffer = await prisma.counterOffer.findUnique({
      where: { id: counterOfferId },
      include: {
        wantListing: true
      }
    });

    if (!counterOffer) {
      return res.status(404).json({ error: 'Counter-offer not found' });
    }

    if (counterOffer.wantListing.userId !== auth.userId) {
      return res.status(403).json({ error: 'Only the listing owner can reject counter-offers' });
    }

    if (counterOffer.status !== 'pending') {
      return res.status(400).json({ error: 'Counter-offer is no longer pending' });
    }

    await prisma.counterOffer.update({
      where: { id: counterOfferId },
      data: { status: 'rejected' }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Reject counter-offer error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
