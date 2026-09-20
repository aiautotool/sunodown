'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {FolderOpen,Save,Trash2} from 'lucide-react';
import {deleteProject,listProjects,renameProject,saveProject,type V9Project,type V9ProjectState} from './project-store';

type Props={state:V9ProjectState;defaultName?:string;activeProjectId:string|null;onActiveProject:(project:V9Project|null)=>void;onOpen:(project:V9Project)=>void;};
function stamp(value:number){try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(value)}catch{return ''}}

export function ProjectPanel({state,defaultName='Dự án Suno',activeProjectId,onActiveProject,onOpen}:Props){
  const [projects,setProjects]=useState<V9Project[]>([]);const [name,setName]=useState(defaultName);const [message,setMessage]=useState('');
  const active=useMemo(()=>projects.find(item=>item.id===activeProjectId)||null,[projects,activeProjectId]);
  const skipAutosave=useRef(true);const refresh=()=>setProjects(listProjects());
  useEffect(()=>{refresh()},[]);
  useEffect(()=>{if(!activeProjectId&&!name.trim())setName(defaultName)},[activeProjectId,defaultName,name]);
  useEffect(()=>{if(active)setName(active.name)},[active]);

  // Autosave only an explicitly saved/opened project. New unsaved work remains a draft until the user names/saves it.
  // Debouncing prevents karaoke dragging, sliders and effect controls from hammering localStorage.
  useEffect(()=>{
    if(!activeProjectId){skipAutosave.current=true;return;}
    if(skipAutosave.current){skipAutosave.current=false;return;}
    const timer=window.setTimeout(()=>{
      try{
        const project=saveProject(name||defaultName,state,activeProjectId);
        onActiveProject(project);refresh();setMessage('Đã tự động lưu');
      }catch{setMessage('Tự động lưu thất bại')}
    },900);
    return()=>window.clearTimeout(timer);
  },[state,activeProjectId,name,defaultName,onActiveProject]);

  function save(){try{const project=saveProject(name||defaultName,state,activeProjectId||undefined);skipAutosave.current=true;onActiveProject(project);refresh();setName(project.name);setMessage('Đã lưu dự án')}catch{setMessage('Không lưu được dự án trên thiết bị này')}}
  function createNew(){skipAutosave.current=true;onActiveProject(null);setName(defaultName);setMessage('Dự án mới — chỉnh sửa rồi bấm Lưu')}
  function open(project:V9Project){skipAutosave.current=true;onOpen(project);onActiveProject(project);setName(project.name);setMessage(`Đã mở “${project.name}”`)}
  function remove(project:V9Project){deleteProject(project.id);if(activeProjectId===project.id){skipAutosave.current=true;onActiveProject(null);setName(defaultName)}refresh();setMessage('Đã xóa dự án')}
  function rename(){if(!activeProjectId||!name.trim())return;const project=renameProject(activeProjectId,name.trim());if(project){skipAutosave.current=true;onActiveProject(project);refresh();setMessage('Đã đổi tên')}}

  return <section className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[.025] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-300">V9 · Project / Draft</p><b className="text-sm">Lưu và mở lại phiên chỉnh sửa</b></div><button type="button" onClick={createNew} className="rounded-lg bg-white/[.06] px-3 py-2 text-xs font-semibold">Dự án mới</button></div>
    <div className="mt-3 flex gap-2"><input value={name} onChange={event=>setName(event.target.value)} onBlur={rename} maxLength={80} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs" aria-label="Tên dự án"/><button type="button" onClick={save} className="shrink-0 rounded-xl bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-100"><Save className="mr-1 inline size-3.5"/>Lưu</button></div>
    {message&&<p role="status" className="mt-2 text-[10px] text-white/40">{message}</p>}
    {projects.length>0&&<div className="mt-3 max-h-52 space-y-1 overflow-auto rounded-xl border border-white/[.06] bg-black/10 p-1.5">{projects.map(project=><div key={project.id} className={`flex items-center gap-2 rounded-lg px-2 py-2 ${project.id===activeProjectId?'bg-emerald-300/[.08]':'hover:bg-white/[.035]'}`}><button type="button" onClick={()=>open(project)} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold"><FolderOpen className="mr-1 inline size-3.5"/>{project.name}</span><span className="block text-[9px] text-white/30">{stamp(project.updatedAt)}</span></button><button type="button" onClick={()=>remove(project)} className="rounded-lg p-2 text-white/35 hover:bg-red-400/10 hover:text-red-200" aria-label={`Xóa ${project.name}`}><Trash2 className="size-3.5"/></button></div>)}</div>}
  </section>;
}
