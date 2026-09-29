import type { KaraokeLine, RoughWord } from './karaoke';
import { getSubtitleStoreNamespace } from './cloudflare-runtime';

export const SUBTITLE_ARTIFACT_VERSION = 1;
export const SUBTITLE_PIPELINE_VERSION = 1;

export type SubtitleArtifactStatus = 'synced' | 'fallback' | 'manual';

export type SubtitleArtifact = {
  version: number;
  pipelineVersion: number;
  songId: string;
  language: string;
  engine: string;
  status: SubtitleArtifactStatus;
  confidence: number;
  duration: number;
  audioHash: string;
  lyricsHash: string;
  lines: KaraokeLine[];
  rawWords: RoughWord[];
  generatedAt: number;
  updatedAt: number;
};

export type SubtitleClaimResult = {
  claimed: boolean;
  status: 'claimed' | 'generating';
  startedAt?: number;
};

function normalizeLanguage(value: string) {
  const cleaned = value.trim().toLowerCase();
  return /^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(cleaned)
    ? cleaned
    : 'vi';
}

function storeStub(songId: string) {
  const namespace = getSubtitleStoreNamespace();
  if (!namespace) return null;
  const id = namespace.idFromName(songId);
  return namespace.get(id);
}

function endpoint(pathname: string, language: string) {
  const url = new URL(`https://subtitle.internal${pathname}`);
  url.searchParams.set('language', normalizeLanguage(language));
  return url;
}

export async function getSubtitleArtifact(
  songId: string,
  language = 'vi',
): Promise<SubtitleArtifact | null> {
  const stub = storeStub(songId);
  if (!stub) return null;

  const response = await stub.fetch(endpoint('/artifact', language));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Subtitle store GET failed: ${response.status}`);
  }
  const payload = (await response.json()) as { subtitle?: SubtitleArtifact };
  return payload.subtitle || null;
}

export async function putSubtitleArtifact(
  artifact: SubtitleArtifact,
): Promise<void> {
  const stub = storeStub(artifact.songId);
  if (!stub) throw new Error('Subtitle store is not configured.');

  const response = await stub.fetch(
    endpoint('/artifact', artifact.language),
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subtitle: artifact }),
    },
  );
  if (!response.ok) {
    throw new Error(`Subtitle store PUT failed: ${response.status}`);
  }
}

export async function claimSubtitleGeneration(
  songId: string,
  language: string,
  fingerprint: string,
): Promise<SubtitleClaimResult> {
  const stub = storeStub(songId);
  if (!stub) {
    return { claimed: true, status: 'claimed' };
  }

  const response = await stub.fetch(endpoint('/claim', language), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fingerprint }),
  });

  if (response.status === 409) {
    const payload = (await response.json().catch(() => ({}))) as {
      startedAt?: number;
    };
    return {
      claimed: false,
      status: 'generating',
      startedAt: payload.startedAt,
    };
  }
  if (!response.ok) {
    throw new Error(`Subtitle store claim failed: ${response.status}`);
  }
  return { claimed: true, status: 'claimed' };
}

export async function releaseSubtitleGeneration(
  songId: string,
  language = 'vi',
): Promise<void> {
  const stub = storeStub(songId);
  if (!stub) return;
  await stub.fetch(endpoint('/claim', language), { method: 'DELETE' });
}

export async function sha256Hex(
  input: string | ArrayBuffer | Uint8Array,
): Promise<string> {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
