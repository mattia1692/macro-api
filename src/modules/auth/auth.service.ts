import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import { UnauthorizedError } from '../../shared/errors';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh';
const ACCESS_EXPIRES = '1h';
const REFRESH_EXPIRES = '30d';
const REFRESH_COOKIE = 'wilo_refresh';

interface FirebaseUser {
  localId: string;
  email: string;
}

export async function verifyFirebaseToken(idToken: string): Promise<FirebaseUser> {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new UnauthorizedError('Configurazione server non valida');

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!resp.ok) throw new UnauthorizedError('Token Firebase non valido');
  const data = (await resp.json()) as { users?: { localId: string; email: string }[] };
  const user = data.users?.[0];
  if (!user?.localId) throw new UnauthorizedError('Token Firebase non valido');

  return { localId: user.localId, email: user.email || '' };
}

export function signAccessToken(payload: { sub: string; email: string }): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyRefreshToken(token: string): { sub: string } {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { sub: string };
  } catch {
    throw new UnauthorizedError('Refresh token non valido o scaduto');
  }
}

export function getRefreshCookieName(): string {
  return REFRESH_COOKIE;
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30d in seconds
  };
}

export async function loginOrRegister(prisma: PrismaClient, fbUser: FirebaseUser) {
  const user = await prisma.user.upsert({
    where: { id: fbUser.localId },
    create: { id: fbUser.localId, email: fbUser.email },
    update: { email: fbUser.email },
  });
  return user;
}

export async function getUserById(prisma: PrismaClient, id: string) {
  return prisma.user.findUnique({ where: { id } });
}
