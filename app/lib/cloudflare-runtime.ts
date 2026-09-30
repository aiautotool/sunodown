import { env as cloudflareEnv } from 'cloudflare:workers';

type GroqEnv = {
  GROQ_API_KEY?: string;
};

export type SubtitleStoreStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type SubtitleStoreNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): SubtitleStoreStub;
};

declare global {
  // eslint-disable-next-line no-var
  var __SUNODOWN_GROQ_API_KEY: string | undefined;
  // eslint-disable-next-line no-var
  var __SUNODOWN_SUBTITLE_STORE: SubtitleStoreNamespace | undefined;
}

export async function getGroqCredentials() {
  const direct = (cloudflareEnv as unknown as GroqEnv).GROQ_API_KEY?.trim() || '';
  if (direct) {
    return { key: direct, source: 'cloudflare-env' as const };
  }

  const bridged =
    typeof globalThis.__SUNODOWN_GROQ_API_KEY === 'string'
      ? globalThis.__SUNODOWN_GROQ_API_KEY.trim()
      : '';
  if (bridged) {
    return { key: bridged, source: 'worker-isolate' as const };
  }

  const key =
    typeof process !== 'undefined'
      ? process.env.GROQ_API_KEY?.trim() || ''
      : '';
  return {
    key,
    source: key ? ('process-env' as const) : ('none' as const),
  };
}

export function getSubtitleStoreNamespace() {
  const direct = (
    cloudflareEnv as unknown as { SUBTITLE_STORE?: SubtitleStoreNamespace }
  ).SUBTITLE_STORE;
  return direct || globalThis.__SUNODOWN_SUBTITLE_STORE || null;
}
