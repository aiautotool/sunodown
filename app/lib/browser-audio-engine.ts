'use client';

import {
  convertProcessedAudio,
  masterAudio,
  render5DAudio,
  type AdvancedMasterSettings,
  type MasterProfileId,
} from '@/app/lib/audio-processing';
import type {
  AudioAsset,
  AudioEngine,
  AudioOutputFormat,
  SpatialMode,
} from '@/packages/core/src/audio';

async function toBlob(source: AudioAsset) {
  if (source.bytes?.byteLength) {
    return new Blob([source.bytes], {
      type: source.mimeType || 'application/octet-stream',
    });
  }
  const response = await fetch(source.uri, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Audio fetch failed (HTTP ${response.status})`);
  return response.blob();
}

async function toAsset(blob: Blob): Promise<AudioAsset> {
  return {
    uri: '',
    mimeType: blob.type,
    bytes: new Uint8Array(await blob.arrayBuffer()),
  };
}

export class BrowserAudioEngine implements AudioEngine {
  async master(source: AudioAsset, options: Record<string, unknown>) {
    const profile = (options.profile || 'clean') as MasterProfileId;
    const advanced = options.advanced as AdvancedMasterSettings | undefined;
    const result = await masterAudio(await toBlob(source), profile, advanced);
    return toAsset(result.blob);
  }

  async spatial(source: AudioAsset, amount: number, mode: SpatialMode) {
    const blob = await render5DAudio(await toBlob(source), amount, mode);
    return toAsset(blob);
  }

  async convert(source: AudioAsset, format: AudioOutputFormat) {
    const blob = await convertProcessedAudio(await toBlob(source), format);
    return toAsset(blob);
  }
}

export const browserAudioEngine = new BrowserAudioEngine();
