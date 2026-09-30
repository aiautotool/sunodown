import {
  createLayer,
  type SceneDocument,
  type SceneLayer,
} from '@/packages/scene-core/src';
import type { MediaClip } from '@/components/editor-timeline';
import type { KaraokeLine } from '@/app/lib/karaoke';
export function buildStudioScene(
  base: SceneDocument,
  media: MediaClip[],
  cues: KaraokeLine[],
  audio: string,
  overrides: Record<string, SceneLayer>,
): SceneDocument {
  const scene = structuredClone(base),
    duration = scene.canvas.durationMs;
  for (const layer of scene.layers) {
    layer.name =
      (
        {
          title: 'Tên bài hát',
          creator: 'Nghệ sĩ',
          subtitle: 'Karaoke',
          wave: 'Sóng nhạc',
          background: 'Nền',
          template: 'Template',
        } as Record<string, string>
      )[layer.id] ?? layer.name;
    if(layer.type === 'effect' && layer.name.startsWith('effect-')) {
      layer.name=({rain:'Mưa',smoke:'Khói',fog:'Sương mù',snow:'Tuyết',snowstorm:'Bão tuyết',dust:'Bụi',lightleak:'Vệt sáng',film:'Hạt phim',vignette:'Tối viền',bokeh:'Ánh sáng nhòe',sparkles:'Lấp lánh'} as Record<string,string>)[layer.effectId || ''] || layer.effectId || 'Hiệu ứng';
    }
    if (layer.id === 'background')
      layer.params.timelineHidden = media.length > 0;
    if (layer.type === 'karaoke') {
      layer.role = 'subtitle';
      layer.params.cues = cues.map((cue) => ({
        startMs: cue.start * 1000,
        endMs: cue.end * 1000,
        text: cue.text,
        words: structuredClone(cue.words),
      }));
    }
    if (layer.type !== 'effect' && layer.type !== 'karaoke')
      layer.params.timelineReadonly = true;
    if (layer.type === 'text') layer.role = 'text';
    if (layer.type === 'effect') layer.role = 'atmosphere';
  }
  for (const clip of media) {
    const layer = createLayer(clip.id, clip.type, duration);
    layer.name = clip.name;
    layer.startMs = clip.start * 1000;
    layer.endMs = clip.end * 1000;
    layer.role = clip.isDefault ? 'main-video' : 'foreground';
    layer.zIndex = clip.isDefault ? 0 : 1;
    layer.assetId = `media:${clip.id}`;
    layer.params = {
      originClip: true,
      songBound: clip.isDefault === true,
      trimStartMs: clip.trimStartMs || 0,
    };
    layer.transform.width = scene.canvas.width;
    layer.transform.height = scene.canvas.height;
    scene.assets.push({
      id: layer.assetId,
      type: clip.type,
      mime: clip.type === 'image' ? 'image/*' : 'video/*',
      source: clip.url,
    });
    scene.layers.push(layer);
  }
  const audioLayer = createLayer('song-audio', 'audio', duration);
  audioLayer.name = 'Âm thanh bài hát';
  audioLayer.role = 'audio';
  audioLayer.assetId = 'song-audio';
  audioLayer.zIndex = -1;
  audioLayer.params = { songBound: true, timelineReadonly: true };
  scene.assets.push({
    id: 'song-audio',
    type: 'audio',
    mime: 'audio/*',
    source: audio,
  });
  scene.layers.push(audioLayer);
  scene.layers = scene.layers.map((layer) =>
    overrides[layer.id]
      ? {
          ...structuredClone(overrides[layer.id]),
          assetId: layer.assetId,
          params: { ...layer.params, ...overrides[layer.id].params },
        }
      : layer,
  );
  return scene;
}
