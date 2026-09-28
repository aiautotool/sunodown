/// <reference lib="webworker" />

type RequestMessage = {
  type: 'transcribe';
  id?: number;
  audio: ArrayBuffer;
  language?: string;
  mode?: 'desktop' | 'mobile';
};

type Chunk = {
  text: string;
  timestamp: [number | null, number | null];
};

const transcriberPromises = new Map<string, Promise<any>>();

async function getTranscriber(mode: 'desktop' | 'mobile') {
  const key = mode;
  let promise = transcriberPromises.get(key);
  if (!promise) {
    const moduleUrl = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
    const transformers = await import(/* @vite-ignore */ moduleUrl);
    const pipeline = transformers.pipeline as any;

    const mobile = mode === 'mobile';
    const hasWebGPU =
      !mobile &&
      typeof navigator !== 'undefined' &&
      'gpu' in navigator;

    const model = mobile
      ? 'onnx-community/whisper-tiny_timestamped'
      : 'onnx-community/whisper-base_timestamped';

    self.postMessage({
      type: 'status',
      message: mobile
        ? 'Đang tải Whisper Tiny cho mobile…'
        : 'Đang tải Whisper Base…',
    });

    promise = pipeline(
      'automatic-speech-recognition',
      model,
      hasWebGPU
        ? {
            device: 'webgpu',
            dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
            progress_callback: (progress: any) => {
              self.postMessage({ type: 'progress', stage: 'model', progress });
            },
          }
        : {
            device: 'wasm',
            dtype: 'q8',
            progress_callback: (progress: any) => {
              self.postMessage({ type: 'progress', stage: 'model', progress });
            },
          },
    ) as Promise<any>;

    transcriberPromises.set(key, promise);
  }
  return promise;
}

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  if (event.data?.type !== 'transcribe') return;

  const id = event.data.id;
  const mode = event.data.mode || 'desktop';

  try {
    const transcriber = await getTranscriber(mode);
    self.postMessage({
      type: 'status',
      id,
      message:
        mode === 'mobile'
          ? 'Whisper Tiny đang nhận diện đoạn audio…'
          : 'Đang nhận diện giọng hát...',
    });

    const audio = new Float32Array(event.data.audio);
    const mobile = mode === 'mobile';
    const output = await transcriber(audio, {
      return_timestamps: 'word',
      chunk_length_s: mobile ? 18 : 29,
      stride_length_s: mobile ? 2 : 4,
      language: event.data.language || 'vi',
      task: 'transcribe',
      do_sample: false,
    });

    const chunks: Chunk[] = Array.isArray(output?.chunks)
      ? output.chunks
          .map((chunk: any) => ({
            text: String(chunk?.text ?? '').trim(),
            timestamp: [
              typeof chunk?.timestamp?.[0] === 'number' ? chunk.timestamp[0] : null,
              typeof chunk?.timestamp?.[1] === 'number' ? chunk.timestamp[1] : null,
            ] as [number | null, number | null],
          }))
          .filter((chunk: Chunk) => chunk.text)
      : [];

    self.postMessage({
      type: 'result',
      id,
      text: String(output?.text ?? ''),
      chunks,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      message:
        error instanceof Error
          ? error.message
          : 'Whisper trong trình duyệt bị lỗi.',
    });
  }
};
