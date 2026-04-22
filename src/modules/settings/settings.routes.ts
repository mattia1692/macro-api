import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { settingsPatchSchema } from './settings.schema';
import { patchSettings } from './settings.service';
import { ValidationError } from '../../shared/errors';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // PATCH /settings — aggiorna qualsiasi campo delle impostazioni
  fastify.patch('/', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = settingsPatchSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Dati non validi');

    const settings = await patchSettings(fastify.prisma, userId, parsed.data);
    return reply.send(settings);
  });
}
