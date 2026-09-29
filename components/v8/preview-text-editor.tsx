'use client';
// Inline editor contains native controls; its wrapper only isolates canvas events.
// Focus enters the text field after the user explicitly requests editing.
/* oxlint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-autofocus */
import {useEffect,useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import type {OverlayTextStyles} from '../v4/renderer-safe';
import type {KaraokeDrawStyle,KaraokeLine} from '../../app/lib/karaoke';
import type {OverlayLayout} from '../v9/overlay-layout-panel';

type Props={target:'title'|'creator'|'subtitle';title:string;creator:string;time:number;styles:OverlayTextStyles;subtitle:KaraokeDrawStyle;layout:OverlayLayout;lines:KaraokeLine[];onStyles:(s:OverlayTextStyles)=>void;onSubtitle:(s:KaraokeDrawStyle)=>void;onLayout:(s:OverlayLayout)=>void;onLines:(s:KaraokeLine[])=>void;onClose:()=>void;onDelete:()=>void};
const subtitleFonts=[
 ['system','Modern','system-ui, sans-serif'],
 ['serif','Cinematic','Georgia, serif'],
 ['rounded','Rounded',"'Trebuchet MS', sans-serif"],
 ['mono','Mono',"'Courier New', monospace"],
 ['impact','Impact','Impact, sans-serif'],
] as const;

const titleFonts=[
 ['system-ui, sans-serif','Modern'],
 ['Georgia, serif','Cinematic Serif'],
 ['Impact, sans-serif','Impact'],
 ['"Great Vibes", cursive','Great Vibes'],
 ['Allura, cursive','Allura'],
 ['"Alex Brush", cursive','Alex Brush'],
 ['Italianno, cursive','Italianno'],
 ['"Pinyon Script", cursive','Pinyon Script'],
 ['Ephesis, cursive','Ephesis'],
 ['Birthstone, cursive','Birthstone'],
 ['"Mea Culpa", cursive','Mea Culpa'],
 ['"Lavishly Yours", cursive','Lavishly Yours'],
] as const;
export function PreviewTextEditor(p:Props){
 const root=useRef<HTMLDivElement>(null);
 const close=useRef(p.onClose);
 useEffect(()=>{close.current=p.onClose;});
 const [lineIndex,setLineIndex]=useState(()=>Math.max(0,p.lines.findIndex(line=>p.time>=line.start&&p.time<line.end)));
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close.current();};
  document.addEventListener('pointerdown',outside,true);
  return()=>document.removeEventListener('pointerdown',outside,true);
 },[]);
 const isSubtitle=p.target==='subtitle',key=p.target==='creator'?'creator':'title';
 const style=isSubtitle?p.subtitle:p.styles[key];
 const text=isSubtitle?p.lines[lineIndex]?.text||'':p.styles[key].text??(key==='title'?p.title:p.creator);
 function updateStyle(change:Omit<Partial<KaraokeDrawStyle>,'font'>&{font?:string}){
  if(isSubtitle)p.onSubtitle({...p.subtitle,...change,font:(change.font??p.subtitle.font) as KaraokeDrawStyle['font']});
  else p.onStyles({...p.styles,[key]:{...p.styles[key],...change}});
 }
 function updateText(value:string){
  if(!isSubtitle){p.onStyles({...p.styles,[key]:{...p.styles[key],text:value}});return;}
  p.onLines(p.lines.map((line,index)=>{
   if(index!==lineIndex)return line;
   const words=value.trim().split(/\s+/).filter(Boolean),step=(line.end-line.start)/Math.max(1,words.length);
   return {...line,text:value,words:words.map((text,i)=>({text,start:line.start+i*step,end:line.start+(i+1)*step})),timingSource:'estimated' as const,anchorCount:0,anchorDensity:0};
  }));
 }
 const position=p.layout[p.target];
 const font=isSubtitle?subtitleFonts.find(([id])=>id===(p.subtitle.font||'system'))?.[2]:p.styles[key].font;
 return <div ref={root} className="absolute inset-0 z-40 pointer-events-none" onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')p.onClose();}}>
  <div role="toolbar" aria-label="Chỉnh chữ trên preview" className="pointer-events-auto absolute left-2 right-2 top-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-zinc-950/95 p-2 text-xs text-white shadow-xl">
   {isSubtitle ? (
    <select
      aria-label="Font"
      className="min-w-0 rounded bg-zinc-800 p-1"
      value={p.subtitle.font||'system'}
      onChange={event=>updateStyle({font:event.target.value})}
    >
      {subtitleFonts.map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select>
   ) : (
    <select
      aria-label="Font title"
      className="min-w-0 rounded bg-zinc-800 p-1"
      value={p.styles[key].font}
      onChange={event=>{
        const next=event.target.value;
        void document.fonts?.load(`32px ${next}`).catch(()=>{});
        updateStyle({font:next});
      }}
    >
      <optgroup label="Cơ bản">
        {titleFonts.slice(0,3).map(([font,label])=><option key={font} value={font}>{label}</option>)}
      </optgroup>
      <optgroup label="Calligraphy · Việt">
        {titleFonts.slice(3).map(([font,label])=><option key={font} value={font}>{label}</option>)}
      </optgroup>
    </select>
   )}
   <input aria-label="Màu chữ" title="Màu chữ" type="color" className="h-7 w-8" value={style.color||'#ffffff'} onChange={e=>updateStyle({color:e.target.value})}/>
   <button type="button" aria-label="Đậm" aria-pressed={style.bold!==false} className="rounded bg-white/10 px-2 py-1 font-bold" onClick={()=>updateStyle({bold:style.bold===false})}>B</button>
   <button type="button" aria-label="Nghiêng" aria-pressed={!!style.italic} className="rounded bg-white/10 px-2 py-1 italic" onClick={()=>updateStyle({italic:!style.italic})}>I</button>
   <label className="flex items-center gap-1">Cỡ<input aria-label="Kích thước chữ" type="number" min="40" max="180" className="w-14 rounded bg-zinc-800 p-1" value={position.scale} onChange={e=>p.onLayout({...p.layout,[p.target]:{...position,scale:Math.max(40,Math.min(180,Number(e.target.value)||40))}})}/>%</label>
   <button type="button" aria-label="Xóa đối tượng chữ" title="Xóa khỏi video" onClick={p.onDelete} className="rounded bg-red-500/20 p-1.5 text-red-300"><Trash2 size={16}/></button>
   <button type="button" aria-label="Kết thúc sửa chữ" onClick={p.onClose} className="rounded bg-white/10 px-2 py-1">✓</button>
   {isSubtitle&&<select aria-label="Dòng lời bài hát" className="w-full rounded bg-zinc-800 p-1" value={lineIndex} onChange={e=>setLineIndex(Number(e.target.value))}>{p.lines.map((line,i)=><option key={i} value={i}>{Math.floor(line.start)}s · {line.text.slice(0,45)}</option>)}</select>}
  </div>
  <textarea autoFocus aria-label="Nội dung chữ trên preview" value={text} disabled={isSubtitle&&!p.lines.length} onChange={e=>updateText(e.target.value)} rows={2} className="pointer-events-auto absolute resize-none rounded border-2 border-violet-400 bg-zinc-950/85 p-1 text-center outline-none" style={{left:`${Math.max(40,Math.min(60,position.x))}%`,top:`${position.y}%`,transform:'translate(-50%,-50%)',width:'80%',color:style.color||'#fff',fontFamily:font,fontWeight:style.bold===false?400:700,fontStyle:style.italic?'italic':'normal',fontSize:`${Math.max(12,18*position.scale/100)}px`}}/>
 </div>;
}
