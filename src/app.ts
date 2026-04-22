import Fastify from 'fastify';
import prismaPlugin from './plugins/prisma';
import authPlugin from './plugins/auth';
import corsPlugin from './plugins/cors';
import { authRoutes } from './modules/auth/auth.routes';
import { diaryRoutes } from './modules/diary/diary.routes';
import { weightRoutes } from './modules/weight/weight.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { foodsRoutes } from './modules/foods/foods.routes';
import { getToday, getHistory } from './modules/diary/diary.service';
import { getWeights, getCheckpoints } from './modules/weight/weight.service';
import { getCustomFoods } from './modules/foods/foods.service';
import { getSettings } from './modules/settings/settings.service';
import { requireAuth } from './shared/middleware/auth';
import { AppError } from './shared/errors';
import type { FastifyInstance } from 'fastify';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  });

  // Plugins (order matters: db → auth → cors)
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);
  await fastify.register(corsPlugin);

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    fastify.log.error(error);
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Errore interno del server' });
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // ── Init endpoint — carica tutti i dati utente in una sola chiamata ─────────
  fastify.get('/init', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const [settings, today, history, weights, checkpoints, customFoods] = await Promise.all([
      getSettings(fastify.prisma, userId),
      getToday(fastify.prisma, userId),
      getHistory(fastify.prisma, userId),
      getWeights(fastify.prisma, userId),
      getCheckpoints(fastify.prisma, userId),
      getCustomFoods(fastify.prisma, userId),
    ]);
    return reply.send({ settings, today, history, weights, checkpoints, customFoods });
  });

  // Module routes
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(diaryRoutes, { prefix: '/diary' });
  await fastify.register(weightRoutes, { prefix: '/weight' });
  await fastify.register(settingsRoutes, { prefix: '/settings' });
  await fastify.register(foodsRoutes, { prefix: '/food' });

  // Legacy root POST endpoint — backward compat durante la migrazione pwa.
  // Verifica Firebase token (vecchio schema), esegue le stesse logiche AI.
  fastify.post('/', async (request, reply) => {
    const authHeader = (request.headers.authorization as string) || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return reply.status(401).send({ error: 'Autenticazione richiesta' });

    const { verifyFirebaseToken } = await import('./modules/auth/auth.service');
    const { checkAiRate, aiAnalyze, aiSuggest, aiPlan } = await import('./modules/foods/foods.service');

    let fbUser: { localId: string; email: string };
    try {
      fbUser = await verifyFirebaseToken(idToken);
    } catch {
      return reply.status(401).send({ error: 'Token non valido o scaduto' });
    }

    if (!checkAiRate(fbUser.localId)) {
      return reply.status(429).send({ error: "Troppe richieste. Riprova tra un'ora." });
    }

    const payload = request.body as Record<string, unknown>;
    if (payload.type === 'suggest') {
      return reply.send(await aiSuggest(payload.remaining as Parameters<typeof aiSuggest>[0]));
    }
    if (payload.type === 'plan') {
      return reply.send(await aiPlan(payload as Parameters<typeof aiPlan>[0]));
    }
    if (!payload.food || typeof payload.food !== 'string') {
      return reply.status(400).send({ error: 'Campo food mancante' });
    }
    return reply.send(await aiAnalyze(payload.food.slice(0, 500)));
  });

  return fastify;
}
