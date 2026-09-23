'use client';

import {BookOpen, FolderOpen, Layers3, Music2, Plus, Settings2, Sparkles} from 'lucide-react';

const nav = [
  {href:'#create', label:'Tạo mới', icon:Plus},
  {href:'#project', label:'Dự án', icon:FolderOpen},
  {href:'#library', label:'Thư viện', icon:BookOpen},
  {href:'#render-zone', label:'Tác vụ', icon:Layers3},
];

export function V7AppShell({children}:{children:React.ReactNode}) {
  return <div className="creator-app min-h-screen bg-[#07070b] text-white">
    <header className="sticky top-0 z-50 border-b border-white/[.07] bg-[#09090e]/90 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <a href="#create" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-violet-500 shadow-lg shadow-violet-500/25"><Music2 className="size-5"/></span><span className="font-semibold tracking-tight">SunoDown</span></a>
        <div className="ml-auto flex items-center gap-2"><a href="#presets" className="hidden items-center gap-2 rounded-xl border border-white/[.08] px-3 py-2 text-xs text-white/60 sm:flex"><Sparkles className="size-4"/> Mẫu</a><a href="#advanced-tools" aria-label="Cài đặt nâng cao" className="rounded-xl border border-white/[.08] p-2.5 text-white/55"><Settings2 className="size-4"/></a></div>
      </div>
    </header>
    <div className="flex">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-white/[.07] bg-[#09090e] p-4 lg:flex lg:flex-col">
        <nav className="space-y-1.5">{nav.map(({href,label,icon:Icon},i)=><a key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${i===0?'bg-violet-500 text-white shadow-lg shadow-violet-500/15':'text-white/45 hover:bg-white/[.05] hover:text-white/80'}`}><Icon className="size-4"/>{label}</a>)}</nav>
        <div className="mt-auto rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-xs font-semibold text-white/75">Creator Studio</p><p className="mt-1.5 text-[11px] leading-5 text-white/35">Từ liên kết Suno đến nội dung sẵn sàng đăng.</p></div>
      </aside>
      <div id="create" className="v7-workspace min-w-0 flex-1 px-3 pb-28 pt-4 sm:px-5 lg:px-7 lg:pb-10">{children}</div>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-white/[.08] bg-[#0b0b11]/94 px-3 pb-[max(9px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl lg:hidden">
      {nav.map(({href,label,icon:Icon},i)=><a key={label} href={href} className={`flex flex-col items-center gap-1 text-[10px] ${i===0?'font-semibold text-violet-300':'text-white/40'}`}><Icon className="size-5"/><span>{label}</span></a>)}
    </nav>
  </div>;
}
