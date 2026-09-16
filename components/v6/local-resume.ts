'use client';

export type LocalRenderCheckpoint={
 version:1; key:string; songId:string; songTitle:string; aspect:string; wave:string; template:string; motion:string; lyrics:string;
 duration:number; segmentSeconds:number; completedSeconds:number; createdAt:number; updatedAt:number;
};
const DB='suno-render-v6',STORE='checkpoints';
function openDB(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function saveCheckpoint(c:LocalRenderCheckpoint){const db=await openDB();await new Promise<void>((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(c);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)});db.close()}
export async function loadCheckpoint(key:string){const db=await openDB();const v=await new Promise<LocalRenderCheckpoint|undefined>((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return v}
export async function removeCheckpoint(key:string){const db=await openDB();await new Promise<void>((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)});db.close()}
export function checkpointKey(songId:string,aspect:string,wave:string,template:string,motion:string,lyrics:string){return [songId,aspect,wave,template,motion,lyrics].join('|')}
