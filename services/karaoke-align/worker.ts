import { Container } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

type KaraokeEnv = {
  KARAOKE_ALIGNER: DurableObjectNamespace<KaraokeAlignContainer>;
  KARAOKE_ALIGN_TOKEN?: string;
};

export class KaraokeAlignContainer extends Container<KaraokeEnv> {
  defaultPort = 8000;
  sleepAfter = '10m';

  envVars = {
    KARAOKE_ALIGN_TOKEN: String(env.KARAOKE_ALIGN_TOKEN || ''),
    WHISPER_MODEL: '/models/whisper-small',
    WHISPER_DEVICE: 'cpu',
    WHISPER_COMPUTE_TYPE: 'int8',
    DISABLE_DEMUCS: '1',
  };
}

export default {
  async fetch(request: Request, bindings: KaraokeEnv) {
    const url = new URL(request.url);
    const container = bindings.KARAOKE_ALIGNER.getByName('karaoke-primary');

    if (url.pathname === '/health' && request.method === 'GET') {
      return container.fetch(request);
    }

    if (
      request.method !== 'POST' ||
      (url.pathname !== '/align' && url.pathname !== '/transcribe')
    ) {
      return new Response('Not found', { status: 404 });
    }

    const token = bindings.KARAOKE_ALIGN_TOKEN;
    if (!token) {
      return new Response('Karaoke backend is not configured', { status: 503 });
    }

    if (request.headers.get('authorization') !== `Bearer ${token}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    return container.fetch(request);
  },
} satisfies ExportedHandler<KaraokeEnv>;
