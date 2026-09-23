import type { KaraokeLine } from '@/app/lib/karaoke';
import type { MediaClip } from '@/components/editor-timeline';
import type { OverlayLayout } from '@/components/v9/overlay-layout-panel';
import type {
  LyricsMode,
  VideoAspect,
  VisualTemplate,
  WaveStyle,
} from '@/components/v4/types';
import type { VideoEffect } from '@/components/v8/video-effects';
import type { OverlayTextStyles } from '@/components/v4/renderer-safe';
import type { KaraokeDrawStyle } from '@/app/lib/karaoke';

export type SavedProject = {
  url: string;
  title: string;
  updatedAt: number;
  wave: WaveStyle;
  template: VisualTemplate;
  aspect: VideoAspect;
  lyrics: LyricsMode;
  effects: VideoEffect[];
  layout: OverlayLayout;
  textStyles?: OverlayTextStyles;
  subtitleStyle?: KaraokeDrawStyle;
  trimStart: number;
  trimEnd: number;
  karaokeTimeline: KaraokeLine[];
  media: Array<Omit<MediaClip, 'url'> & { blob: Blob }>;
};

const DB = 'sunodown-projects-v2';
const STORE = 'projects';

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: 'url' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectData(project: SavedProject) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(project);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadProjectData(url: string) {
  const db = await database();
  const value = await new Promise<SavedProject | undefined>(
    (resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(url);
      request.onsuccess = () =>
        resolve(request.result as SavedProject | undefined);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return value;
}

export async function clearProjectData() {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
