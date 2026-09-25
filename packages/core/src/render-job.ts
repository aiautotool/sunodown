import type { ProjectDocument, VideoAspect } from './project';

export const RENDER_JOB_SCHEMA_VERSION = 1 as const;

export type RenderQuality = 'preview' | '720p' | '1080p';
export type RenderTarget = 'local' | 'server';

export type RenderJob = {
  schemaVersion: typeof RENDER_JOB_SCHEMA_VERSION;
  id: string;
  projectId: string;
  createdAt: number;
  target: RenderTarget;
  quality: RenderQuality;
  aspect: VideoAspect;
  project: ProjectDocument;
};

export function createRenderJob(input: Omit<RenderJob,'schemaVersion'|'createdAt'> & {createdAt?:number}): RenderJob {
  return {schemaVersion:RENDER_JOB_SCHEMA_VERSION,createdAt:input.createdAt??Date.now(),...input};
}

export function shouldRenderOnServer(job: RenderJob) {
  const duration=Math.max(0,...job.project.assets.map(a=>a.duration||0));
  const hasHeavyTimeline=job.project.timeline.length>12;
  return job.quality==='1080p' || duration>300 || hasHeavyTimeline;
}
