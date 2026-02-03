import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { counterOfferService } from '../../apps/api/src/services/counter-offer.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    const auth = await requireAuth(req);

    // POST /api/counter-offers
    if ((path === '' || pathParts[0] === '') && req.method === 'POST') {
      const counterOffer = await counterOfferService.createCounterOffer(auth.userId, req.body);
      return res.status(201).json(counterOffer);
    }

    // GET /api/counter-offers/mine
    if (path === 'mine' && req.method === 'GET') {
      const counterOffers = await counterOfferService.getUserCounterOffers(auth.userId);
      return res.status(200).json(counterOffers);
    }

    // Routes with counter-offer ID: /api/counter-offers/:id/...
    if (pathParts.length >= 1 && pathParts[0] !== '' && pathParts[0] !== 'mine') {
      const counterOfferId = pathParts[0];

      // GET /api/counter-offers/:id
      if (pathParts.length === 1 && req.method === 'GET') {
        const counterOffer = await counterOfferService.getCounterOffer(counterOfferId);
        if (!counterOffer) {
          return res.status(404).json({ error: 'Counter-offer not found' });
        }
        return res.status(200).json(counterOffer);
      }

      // DELETE /api/counter-offers/:id (withdraw)
      if (pathParts.length === 1 && req.method === 'DELETE') {
        await counterOfferService.withdrawCounterOffer(auth.userId, counterOfferId);
        return res.status(200).json({ success: true });
      }

      // POST /api/counter-offers/:id/accept
      if (pathParts[1] === 'accept' && req.method === 'POST') {
        const result = await counterOfferService.acceptCounterOffer(auth.userId, counterOfferId);
        return res.status(200).json(result);
      }

      // POST /api/counter-offers/:id/reject
      if (pathParts[1] === 'reject' && req.method === 'POST') {
        await counterOfferService.rejectCounterOffer(auth.userId, counterOfferId);
        return res.status(200).json({ success: true });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Counter-offers error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
