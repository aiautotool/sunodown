import { Buffer } from 'node:buffer';

type Env = {
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }
    if (request.method !== 'POST' || url.pathname !== '/transcribe') {
      return new Response('Not found', { status: 404 });
    }

    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return Response.json({ error: 'missing audio' }, { status: 400 });
    }

    const bytes = await audio.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const model = url.searchParams.get('model') === 'classic'
      ? '@cf/openai/whisper'
      : '@cf/openai/whisper-large-v3-turbo';

    const input: Record<string, unknown> = { audio: base64 };
    if (model.includes('large-v3-turbo')) {
      Object.assign(input, {
        task: 'transcribe',
        language: 'vi',
        vad_filter: true,
        beam_size: 5,
        condition_on_previous_text: false,
        no_speech_threshold: 0.55,
        compression_ratio_threshold: 2.2,
        log_prob_threshold: -1,
        hallucination_silence_threshold: 1,
      });
    }

    const result = await env.AI.run(model, input);
    return Response.json({ model, result });
  },
} satisfies ExportedHandler<Env>;
