import { env } from 'cloudflare:workers';
import type { NextRequest } from 'next/server';

const COOKIE = 'sd_admin';
const ADMIN_PASSWORD_SHA256 =
  '58e901a25d346776cad704b492af711a3dc3d44e847d291c3b31dbffacce0d3d';
const MAX_AGE_SECONDS = 60 * 60 * 8;

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function key() {
  const secret = (env as unknown as { MEDIA_TOKEN_SECRET?: string }).MEDIA_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error('Admin session signing secret unavailable');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(value: string) {
  return hex(
    await crypto.subtle.sign(
      'HMAC',
      await key(),
      new TextEncoder().encode(value),
    ),
  );
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyAdminPassword(password: string) {
  if (!password || password.length > 200) return false;
  return secureEqual(await sha256(password), ADMIN_PASSWORD_SHA256);
}

export async function createAdminSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const nonce = crypto.randomUUID();
  const version = ADMIN_PASSWORD_SHA256.slice(0, 12);
  const value = `v2.${version}.${exp}.${nonce}`;
  return {
    value: `${value}.${await sign(value)}`,
    maxAge: MAX_AGE_SECONDS,
  };
}

function cookieValue(request: NextRequest, name: string) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function isAdminRequest(request: NextRequest) {
  const token = cookieValue(request, COOKIE);
  if (!token || token.length > 500) return false;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'v2') return false;
  if (parts[1] !== ADMIN_PASSWORD_SHA256.slice(0, 12)) return false;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  const value = parts.slice(0, 4).join('.');
  try {
    return secureEqual(await sign(value), parts[4]);
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = COOKIE;
