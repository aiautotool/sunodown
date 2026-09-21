'use client';
import {BookOpen,FolderOpen,Home,Layers3,Menu,Music2,Settings,SlidersHorizontal,Sparkles,WandSparkles} from 'lucide-react';

const nav=[
  {href:'#create',label:'Home',icon:Home},
  {href:'#project',label:'Project',icon:FolderOpen},
  {href:'#library',label:'Library',icon:BookOpen},
  {href:'#render-zone',label:'Queue',icon:Layers3},
  {href:'#presets',label:'Presets',icon:Sparkles},
  {href:'#video-effects',label:'Effects',icon:WandSparkles},
  {href:'#studio-editor',label:'Tools',icon:SlidersHorizontal},
  {href:'#help',label:'Settings',icon:Settings},
];

export function V7AppShell({children}:{children:React.ReactNode}){
 return <div className="min-h-screen bg-[#050b15] text-white">
  <header className="sticky top-0 z-50 border-b border-white/[.07] bg-[#07101d]/95 backdrop-blur-xl">
   <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-3 sm:px-5">
    <a href="#create" className="flex shrink-0 items-center gap-2.5">
     <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 shadow-lg shadow-violet-500/20"><Music2 className="size-5"/></div>
     <div><b className="text-base sm:text-lg">SunoDown <span className="text-violet-400">v10</span></b><p className="hidden text-[9px] text-white/35 xl:block">Turn Your Suno Music Into Stunning Videos</p></div>
    </a>
    <a href="#create" className="ml-auto hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[.08] bg-[#0b1728] px-4 py-2.5 text-xs text-white/35 md:flex md:max-w-2xl"><span className="text-violet-300">🔗</span> Dán liên kết Suno để bắt đầu…</a>
    <a href="#create" className="hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-xs font-bold shadow-lg shadow-violet-500/15 md:block">Phân tích</a>
    <a href="#help" className="rounded-xl border border-white/10 p-2 text-white/60"><Settings className="size-5"/></a>
   </div>
  </header>
  <div className="mx-auto flex max-w-[1600px]">
   <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-44 shrink-0 border-r border-white/[.06] bg-[#07101b]/70 p-3 lg:flex lg:flex-col">
    <nav className="space-y-1">{nav.map(({href,label,icon:Icon},i)=><a key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold transition ${i===0?'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-violet-500/15':'text-white/55 hover:bg-white/[.05] hover:text-white'}`}><Icon className="size-4"/>{label}</a>)}</nav>
    <div className="mt-auto rounded-2xl border border-violet-400/15 bg-violet-500/[.06] p-3"><p className="text-[10px] font-bold text-violet-200">SunoDown v10</p><p className="mt-1 text-[9px] leading-4 text-white/35">Create. Customize. Loop Forever.</p></div>
   </aside>
   <div className="min-w-0 flex-1 bg-[radial-gradient(circle_at_45%_-5%,rgba(99,102,241,.12),transparent_30%)]">
    <div id="create" className="v7-workspace px-2 pb-28 pt-3 sm:px-4 md:pb-10 xl:px-5">{children}</div>
   </div>
  </div>
  <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/[.08] bg-[#07111f]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
   {nav.slice(0,5).map(({href,label,icon:Icon},i)=><a key={label} href={href} className={`flex min-w-0 flex-col items-center gap-1 text-[9px] ${i===0?'font-bold text-violet-300':'text-white/45'}`}><Icon className="size-5"/><span className="truncate">{label}</span></a>)}
  </nav>
 </div>
}