/// <reference lib="webworker" />

type RequestMessage = {
  type: 'transcribe';
  audio: ArrayBuffer;
  language?: string;
};

type Chunk = {
  text: string;
  timestamp: [number | null, number | null];
};

let transcriberPromise: Promise<any> | null = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    const moduleUrl = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
    const transformers = await import(/* @vite-ignore */ moduleUrl);
    const pipeline = transformers.pipeline as any;
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    transcriberPromise = pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-base_timestamped',
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
  }
  return transcriberPromise;
}

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  if (event.data?.type !== 'transcribe') return;

  try {
    const transcriber = await getTranscriber();
    self.postMessage({ type: 'status', message: 'Đang nhận diện giọng hát...' });

    const audio = new Float32Array(event.data.audio);
    const output = await transcriber(audio, {
      return_timestamps: 'word',
      chunk_length_s: 29,
      stride_length_s: 4,
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

    self.postMessage({ type: 'result', text: String(output?.text ?? ''), chunks });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Whisper trong trình duyệt bị lỗi.',
    });
  }
};
