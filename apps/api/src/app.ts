import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';

// Routes
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { pokemonRoutes } from './routes/pokemon.js';
import { shopRoutes } from './routes/shop.js';
import { tradeRoutes } from './routes/trades.js';
import { pokedexRoutes } from './routes/pokedex.js';

export async function buildApp(): Promise<FastifyInstance> {
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
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  });

  await app.register(helmet);
  await app.register(sensible);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Register routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(pokemonRoutes, { prefix: '/pokemon' });
  await app.register(shopRoutes, { prefix: '/shop' });
  await app.register(tradeRoutes, { prefix: '/trades' });
  await app.register(pokedexRoutes, { prefix: '/pokedex' });

  return app;
}
