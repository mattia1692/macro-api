import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'change-me-cookie';

const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  await fastify.register(fastifyCookie, { secret: COOKIE_SECRET });
  await fastify.register(fastifyJwt, { secret: ACCESS_SECRET });
});

export default authPlugin;
