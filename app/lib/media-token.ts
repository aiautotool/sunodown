import { env } from 'cloudflare:workers';

type MediaKind = 'audio' | 'image';
type MediaClaims = { u: string; typ: MediaKind; iat: number; exp: number };

function base64Url(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = (env as unknown as { MEDIA_TOKEN_SECRET?: string }).MEDIA_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error('MEDIA_TOKEN_SECRET is not configured');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function createMediaToken(url: string, type: MediaKind, lifetimeSeconds = 7200) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' }));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ u: url, typ: type, iat: now, exp: now + lifetimeSeconds } satisfies MediaClaims));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(header), tagLength: 128 }, await encryptionKey(), plaintext));
  const ciphertext = encrypted.slice(0, -16);
  const tag = encrypted.slice(-16);
  return `${header}..${base64Url(iv)}.${base64Url(ciphertext)}.${base64Url(tag)}`;
}

export async function verifyMediaToken(token: string | null, expectedType: MediaKind) {
  if (!token || token.length > 5000) return null;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[1] !== '') return null;
  try {
    const [header, , encodedIv, encodedCiphertext, encodedTag] = parts;
    const decodedHeader = JSON.parse(new TextDecoder().decode(decodeBase64Url(header))) as { alg?: unknown; enc?: unknown; typ?: unknown };
    if (decodedHeader.alg !== 'dir' || decodedHeader.enc !== 'A256GCM' || decodedHeader.typ !== 'JWT') return null;
    const ciphertext = decodeBase64Url(encodedCiphertext);
    const tag = decodeBase64Url(encodedTag);
    const encrypted = new Uint8Array(ciphertext.length + tag.length);
    encrypted.set(ciphertext); encrypted.set(tag, ciphertext.length);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64Url(encodedIv), additionalData: new TextEncoder().encode(header), tagLength: 128 }, await encryptionKey(), encrypted);
    const claims = JSON.parse(new TextDecoder().decode(plaintext)) as Partial<MediaClaims>;
    const now = Math.floor(Date.now() / 1000);
    if (claims.typ !== expectedType || typeof claims.u !== 'string' || typeof claims.exp !== 'number' || claims.exp <= now) return null;
    return claims.u;
  } catch {
    return null;
  }
}
