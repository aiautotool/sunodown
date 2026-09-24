'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudioSize, StudioTone } from './tokens';

export function StudioButton({tone='default',size='md',className,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{tone?:StudioTone;size?:StudioSize}){
 return <button data-studio="button" data-tone={tone} data-size={size} className={cn('studio-button',className)} {...props}/>;
}
export function StudioPanel({className,...props}:HTMLAttributes<HTMLDivElement>){return <div data-studio="panel" className={cn('studio-panel',className)} {...props}/>;}
export function StudioBadge({tone='default',className,...props}:HTMLAttributes<HTMLSpanElement>&{tone?:StudioTone}){return <span data-studio="badge" data-tone={tone} className={cn('studio-badge',className)} {...props}/>;}
export function StudioToggle({checked,onChange,label,description}:{checked:boolean;onChange:(v:boolean)=>void;label:string;description?:string}){return <StudioButton className="studio-toggle-row" aria-pressed={checked} onClick={()=>onChange(!checked)}><span><b>{label}</b>{description&&<small>{description}</small>}</span><i data-checked={checked}/></StudioButton>;}
export function StudioControlRow({label,value,children}: {label:string;value?:ReactNode;children:ReactNode}){return <div className="studio-control-row"><div><b>{label}</b>{value&&<span>{value}</span>}</div>{children}</div>;}
export function StudioAccordion({icon,title,open,onToggle,children}: {icon?:ReactNode;title:string;open:boolean;onToggle:()=>void;children?:ReactNode}){return <section data-studio="accordion" className="studio-accordion"><button className="studio-accordion-trigger" aria-expanded={open} onClick={onToggle}>{icon}<b>{title}</b><ChevronDown/></button>{open&&<div className="studio-accordion-content">{children}</div>}</section>;}
export function StudioSheet({title,onClose,children,className}: {title:string;onClose:()=>void;children:ReactNode;className?:string}){return <div data-studio="sheet" className={cn('studio-sheet',className)}><header><b>{title}</b><StudioButton size="sm" aria-label="Close" onClick={onClose}><X/></StudioButton></header><div className="studio-sheet-body">{children}</div></div>;}
