'use client';

export type ProcessedFormat = 'mp3' | 'wav' | 'm4a';

export async function renderTikTokLikeAudio(source: Blob) {
  const arrayBuffer = await source.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('Trình duyệt không hỗ trợ xử lý audio.');

  const decodeContext = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await decodeContext.close();
  }

  const sampleRate = 48_000;
  const frameCount = Math.ceil(decoded.duration * sampleRate);
  const offline = new OfflineAudioContext(2, frameCount, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;

  const hp = offline.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.707;
  const sub = offline.createBiquadFilter();
  sub.type = 'lowshelf'; sub.frequency.value = 80; sub.gain.value = -0.8;
  const lowMid = offline.createBiquadFilter();
  lowMid.type = 'peaking'; lowMid.frequency.value = 220; lowMid.Q.value = 1; lowMid.gain.value = 0.7;
  const presence = offline.createBiquadFilter();
  presence.type = 'peaking'; presence.frequency.value = 3000; presence.Q.value = 1.2; presence.gain.value = 1.2;
  const high = offline.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 8000; high.gain.value = -0.7;
  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 1.7; comp.attack.value = 0.02; comp.release.value = 0.11;

  src.connect(hp).connect(sub).connect(lowMid).connect(presence).connect(high).connect(comp).connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();

  let sum = 0, peak = 0, count = 0;
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i];
      sum += v * v; peak = Math.max(peak, Math.abs(v)); count++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  const targetRms = Math.pow(10, -13 / 20);
  const ceiling = Math.pow(10, -1 / 20);
  const gain = Math.max(0.25, Math.min(4, rms > 0 ? targetRms / rms : 1, peak > 0 ? ceiling / peak : 1));

  const normalized = new AudioBuffer({ length: rendered.length, numberOfChannels: 2, sampleRate });
  for (let ch = 0; ch < 2; ch++) {
    const input = rendered.getChannelData(Math.min(ch, rendered.numberOfChannels - 1));
    const output = normalized.getChannelData(ch);
    for (let i = 0; i < input.length; i++) output[i] = Math.max(-ceiling, Math.min(ceiling, input[i] * gain));
  }

  const wav = new ArrayBuffer(44 + normalized.length * 4);
  const view = new DataView(wav);
  const write = (o: number, t: string) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + normalized.length * 4, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); write(36, 'data');
  view.setUint32(40, normalized.length * 4, true);

  let offset = 44;
  const left = normalized.getChannelData(0), right = normalized.getChannelData(1);
  for (let i = 0; i < normalized.length; i++) {
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767))), true); offset += 2;
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767))), true); offset += 2;
  }
  return new Blob([wav], { type: 'audio/wav' });
}

export async function convertProcessedAudio(source: Blob, format: ProcessedFormat) {
  const { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Mp3OutputFormat, WavOutputFormat, Mp4OutputFormat, Conversion, canEncodeAudio } = await import('mediabunny');
  if (format === 'mp3' && !(await canEncodeAudio('mp3'))) {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
    registerMp3Encoder();
  }
  if (format === 'm4a' && !(await canEncodeAudio('aac'))) throw new Error('AAC encoder unavailable');

  const target = new BufferTarget();
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const output = new Output({
    format: format === 'mp3' ? new Mp3OutputFormat() : format === 'wav' ? new WavOutputFormat() : new Mp4OutputFormat(),
    target,
  });
  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
    audio: format === 'mp3'
      ? { bitrate: 192_000, numberOfChannels: 2, sampleRate: 48_000, forceTranscode: true }
      : format === 'wav'
        ? { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: 's16', forceTranscode: true }
        : { codec: 'aac', bitrate: 128_000, numberOfChannels: 2, sampleRate: 48_000, forceTranscode: true },
    copy: false,
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error(`Không hỗ trợ ${format.toUpperCase()} trên thiết bị này.`);
  await conversion.execute();
  if (!target.buffer) throw new Error(`Không tạo được ${format.toUpperCase()}.`);
  return new Blob([target.buffer], { type: format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/mp4' });
}
