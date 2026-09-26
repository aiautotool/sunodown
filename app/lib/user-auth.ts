import { env } from 'cloudflare:workers';
import type { NextRequest } from 'next/server';

export const USER_COOKIE = 'sd_user';
export const OAUTH_STATE_COOKIE = 'sd_oauth_state';
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

const bytes = new TextEncoder();
const base64url = (value: Uint8Array | string) => {
  const data = typeof value === 'string' ? bytes.encode(value) : value;
  let binary = '';
  data.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const decode64url = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
};

async function signingKey() {
  const secret = (env as unknown as { MEDIA_TOKEN_SECRET?: string }).MEDIA_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error('Session signing secret unavailable');
  return crypto.subtle.importKey('raw', bytes.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signature(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(), bytes.encode(value))));
}

export async function createUserSession(user: AuthUser) {
  const payload = base64url(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return { value: `${payload}.${await signature(payload)}`, maxAge: SESSION_SECONDS };
}

export async function readUserSession(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(USER_COOKIE)?.value;
  if (!token || token.length > 5000) return null;
  const [payload, provided, extra] = token.split('.');
  if (!payload || !provided || extra) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await signingKey(), Uint8Array.from(atob(provided.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - provided.length % 4) % 4)), (char) => char.charCodeAt(0)), bytes.encode(payload)))) return null;
    const parsed = JSON.parse(decode64url(payload)) as AuthUser & { exp: number };
    if (!parsed.sub || !parsed.email || !parsed.name || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return { sub: parsed.sub, email: parsed.email, name: parsed.name, picture: parsed.picture };
  } catch {
    return null;
  }
}

export function googleCredentials() {
  const values = env as unknown as { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string };
  if (!values.GOOGLE_CLIENT_ID || !values.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth credentials unavailable');
  return { clientId: values.GOOGLE_CLIENT_ID, clientSecret: values.GOOGLE_CLIENT_SECRET };
}
