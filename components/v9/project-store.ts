'use client';

import type {BackgroundConfig} from '../v8/background';
import type {KaraokeLine} from '@/app/lib/karaoke';
import type {LyricsMode,MotionIntensity,PlatformPreset,VideoAspect,VisualTemplate,WaveStyle} from '../v4/types';
import type {LongVideoConfig} from './long-video-render';

export const PROJECT_STORE_KEY='suno-v9-projects';
export const PROJECT_STORE_VERSION=1;

export type V9ProjectState={
  url:string;
  aspect:VideoAspect;
  wave:WaveStyle;
  template:VisualTemplate;
  motion:MotionIntensity;
  lyrics:LyricsMode;
  preset:PlatformPreset;
  previewStart:number;
  karaokeTimeline:KaraokeLine[];
  background:BackgroundConfig;
  longVideo:LongVideoConfig;
};

export type V9Project={
  id:string;
  version:1;
  name:string;
  createdAt:number;
  updatedAt:number;
  state:V9ProjectState;
};

type ProjectEnvelope={version:1;projects:V9Project[]};

function storage(){
  return typeof window==='undefined'?null:window.localStorage;
}

function validProject(value:unknown):value is V9Project{
  if(!value||typeof value!=='object')return false;
  const item=value as Partial<V9Project>;
  return item.version===1&&typeof item.id==='string'&&typeof item.name==='string'&&
    Number.isFinite(item.createdAt)&&Number.isFinite(item.updatedAt)&&!!item.state&&typeof item.state==='object';
}

export function listProjects():V9Project[]{
  const store=storage();
  if(!store)return [];
  try{
    const parsed=JSON.parse(store.getItem(PROJECT_STORE_KEY)||'null') as Partial<ProjectEnvelope>|null;
    if(!parsed||parsed.version!==PROJECT_STORE_VERSION||!Array.isArray(parsed.projects))return [];
    return parsed.projects.filter(validProject).sort((a,b)=>b.updatedAt-a.updatedAt);
  }catch{return [];}
}

function writeProjects(projects:V9Project[]){
  const store=storage();
  if(!store)return;
  const envelope:ProjectEnvelope={version:PROJECT_STORE_VERSION,projects};
  store.setItem(PROJECT_STORE_KEY,JSON.stringify(envelope));
}

export function saveProject(name:string,state:V9ProjectState,id?:string):V9Project{
  const now=Date.now();
  const projects=listProjects();
  const existing=id?projects.find(project=>project.id===id):undefined;
  const project:V9Project={
    id:existing?.id||globalThis.crypto?.randomUUID?.()||`project-${now}-${Math.random().toString(36).slice(2,8)}`,
    version:1,
    name:(name||existing?.name||'Dự án chưa đặt tên').trim().slice(0,80),
    createdAt:existing?.createdAt||now,
    updatedAt:now,
    state,
  };
  writeProjects([project,...projects.filter(item=>item.id!==project.id)].slice(0,100));
  return project;
}

export function deleteProject(id:string){
  writeProjects(listProjects().filter(project=>project.id!==id));
}

export function renameProject(id:string,name:string){
  const projects=listProjects();
  const project=projects.find(item=>item.id===id);
  if(!project)return null;
  return saveProject(name,project.state,id);
}

export function getProject(id:string){
  return listProjects().find(project=>project.id===id)||null;
}
