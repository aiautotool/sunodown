export const PROJECT_SCHEMA_VERSION = 1 as const;

export type Platform = 'web' | 'ios' | 'android';
export type VideoAspect = '16:9' | '9:16' | '1:1' | '4:5';
export type LyricsMode = 'off' | 'scroll' | 'focus';

export type AssetRef = {
  id: string;
  kind: 'audio' | 'image' | 'video';
  uri: string;
  mimeType?: string;
  duration?: number;
};

export type TimelineItem = {
  id: string;
  type: 'image' | 'video' | 'subtitle' | 'effect';
  start: number;
  end: number;
  assetId?: string;
  payload?: Record<string, unknown>;
};

export type ProjectDocument = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  sourceUrl: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  platform?: Platform;
  assets: AssetRef[];
  timeline: TimelineItem[];
  presetId?: string | null;
  config: Record<string, unknown>;
};

export function createProjectDocument(input: Omit<ProjectDocument,'schemaVersion'|'createdAt'|'updatedAt'> & {createdAt?:number;updatedAt?:number}): ProjectDocument {
  const now=Date.now();
  return {schemaVersion:PROJECT_SCHEMA_VERSION,createdAt:input.createdAt??now,updatedAt:input.updatedAt??now,...input};
}
