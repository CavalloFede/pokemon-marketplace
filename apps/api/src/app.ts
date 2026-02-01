import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';

// Firebase initialization
import { initializeFirebase } from './lib/firebase.js';

// Middleware
import { authMiddleware } from './middleware/auth.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { pokemonRoutes } from './routes/pokemon.js';
import { shopRoutes } from './routes/shop.js';
import { tradeRoutes } from './routes/trades.js';
import { pokedexRoutes } from './routes/pokedex.js';
import { wantListingsRoutes } from './routes/want-listings.js';
import { counterOffersRoutes } from './routes/counter-offers.js';
import metricsRoutes, { trackRequest } from './routes/metrics.js';

export async function buildApp(): Promise<FastifyInstance> {
  // Initialize Firebase Admin SDK
  initializeFirebase();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined
    }
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN
      : true, // Allow all origins in development
    credentials: true
  });

  await app.register(helmet);
  await app.register(sensible);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Metrics tracking hook
  app.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode;
    const latency = reply.elapsedTime;
    trackRequest(route, method, statusCode, latency);
    done();
  });

  // Public routes (no auth required)
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(metricsRoutes);

  // Routes with mixed auth (handle auth internally)
  await app.register(wantListingsRoutes, { prefix: '/want-listings' });
  await app.register(counterOffersRoutes, { prefix: '/counter-offers' });

  // Protected routes (auth required)
  await app.register(async (protectedApp) => {
    // Add auth middleware to all routes in this scope
    protectedApp.addHook('preHandler', authMiddleware);

    await protectedApp.register(userRoutes, { prefix: '/users' });
    await protectedApp.register(pokemonRoutes, { prefix: '/pokemon' });
    await protectedApp.register(shopRoutes, { prefix: '/shop' });
    await protectedApp.register(tradeRoutes, { prefix: '/trades' });
    await protectedApp.register(pokedexRoutes, { prefix: '/pokedex' });
  });

  return app;
}
