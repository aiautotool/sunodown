import type { KaraokeLine } from './karaoke';

type CapCutSyncOptions = {
  audio: Blob;
  lyrics: string;
  duration: number;
  language?: string;
  onStage?: (message: string) => void;
};

type CapCutResponse = {
  engine?: string;
  timeline?: KaraokeLine[];
  words?: number;
  error?: string;
};

export async function buildCapCutKaraokeTimeline({
  audio,
  lyrics,
  duration,
  language = 'vi-VN',
  onStage,
}: CapCutSyncOptions): Promise<KaraokeLine[]> {
  const form = new FormData();
  form.set(
    'audio',
    new File([audio], 'song.mp3', {
      type: audio.type || 'audio/mpeg',
    }),
  );
  form.set('lyrics', lyrics);
  form.set('duration', String(duration));
  form.set('language', language);

  onStage?.('Đang gửi audio sang CapCut để nhận timestamp…');
  const response = await fetch('/api/karaoke/capcut', {
    method: 'POST',
    body: form,
  });
  const data = (await response.json().catch(() => ({}))) as CapCutResponse;
  if (!response.ok) {
    throw new Error(data.error || 'CapCut STT không khả dụng.');
  }
  if (!Array.isArray(data.timeline) || !data.timeline.length) {
    throw new Error('CapCut không trả về timeline hợp lệ.');
  }
  onStage?.(
    `Đã nhận timestamp CapCut${data.words ? ` · ${data.words} từ` : ''}.`,
  );
  return data.timeline;
}
