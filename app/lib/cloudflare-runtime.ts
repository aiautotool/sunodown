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
  const bridged =
    typeof globalThis.__SUNODOWN_GROQ_API_KEY === 'string'
      ? globalThis.__SUNODOWN_GROQ_API_KEY.trim()
      : '';
  if (bridged) {
    return { key: bridged, source: 'worker-isolate' as const };
  }

  try {
    const mod = await import('cloudflare:workers');
    const env = ((mod as any).env || {}) as GroqEnv;
    const key = env.GROQ_API_KEY?.trim() || '';
    return {
      key,
      source: key ? ('cloudflare-env' as const) : ('none' as const),
    };
  } catch {
    const key =
      typeof process !== 'undefined'
        ? process.env.GROQ_API_KEY?.trim() || ''
        : '';
    return {
      key,
      source: key ? ('process-env' as const) : ('none' as const),
    };
  }
}

export function getSubtitleStoreNamespace() {
  return globalThis.__SUNODOWN_SUBTITLE_STORE || null;
}
