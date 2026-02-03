import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, optionalAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { wantListingService } from '../../apps/api/src/services/want-listing.service.js';

function parseQueryParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value: string | string[] | undefined, defaultValue?: number): number | undefined {
  const str = parseQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    // GET /api/want-listings (public with optional auth)
    if ((path === '' || pathParts[0] === '') && req.method === 'GET') {
      const auth = await optionalAuth(req);
      const result = await wantListingService.getListings({
        speciesId: parseIntParam(req.query.speciesId),
        minCoins: parseIntParam(req.query.minCoins),
        maxCoins: parseIntParam(req.query.maxCoins),
        page: parseIntParam(req.query.page, 1),
        pageSize: parseIntParam(req.query.pageSize, 20),
        excludeUserId: auth?.userId
      });
      return res.status(200).json(result);
    }

    // POST /api/want-listings
    if ((path === '' || pathParts[0] === '') && req.method === 'POST') {
      const auth = await requireAuth(req);
      const listing = await wantListingService.createListing(auth.userId, req.body);
      return res.status(201).json(listing);
    }

    // GET /api/want-listings/mine
    if (path === 'mine' && req.method === 'GET') {
      const auth = await requireAuth(req);
      const listings = await wantListingService.getUserListings(auth.userId);
      return res.status(200).json(listings);
    }

    // Routes with listing ID: /api/want-listings/:id/...
    if (pathParts.length >= 1 && pathParts[0] !== '' && pathParts[0] !== 'mine') {
      const listingId = pathParts[0];

      // GET /api/want-listings/:id
      if (pathParts.length === 1 && req.method === 'GET') {
        const listing = await wantListingService.getListing(listingId);
        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }
        return res.status(200).json(listing);
      }

      // PATCH /api/want-listings/:id
      if (pathParts.length === 1 && req.method === 'PATCH') {
        const auth = await requireAuth(req);
        const listing = await wantListingService.updateListing(auth.userId, listingId, req.body);
        return res.status(200).json(listing);
      }

      // DELETE /api/want-listings/:id
      if (pathParts.length === 1 && req.method === 'DELETE') {
        const auth = await requireAuth(req);
        await wantListingService.cancelListing(auth.userId, listingId);
        return res.status(200).json({ success: true });
      }

      // POST /api/want-listings/:id/accept
      if (pathParts[1] === 'accept' && req.method === 'POST') {
        const auth = await requireAuth(req);
        const { pokemonId } = req.body || {};
        if (!pokemonId) {
          return res.status(400).json({ error: 'pokemonId is required' });
        }
        const result = await wantListingService.acceptListing(auth.userId, listingId, pokemonId);
        return res.status(200).json(result);
      }

      // GET /api/want-listings/:id/matching-pokemon
      if (pathParts[1] === 'matching-pokemon' && req.method === 'GET') {
        const auth = await requireAuth(req);
        const pokemon = await wantListingService.findMatchingPokemon(listingId, auth.userId);
        return res.status(200).json(pokemon);
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Want-listings error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
