'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {V9ProjectState} from './project-store';

const MAX_HISTORY=50;

function cloneState(state:V9ProjectState):V9ProjectState{return JSON.parse(JSON.stringify(state)) as V9ProjectState;}

export function useEditorHistory(state:V9ProjectState,apply:(state:V9ProjectState)=>void){
  const signature=useMemo(()=>JSON.stringify(state),[state]);
  const past=useRef<V9ProjectState[]>([]);
  const future=useRef<V9ProjectState[]>([]);
  const current=useRef<V9ProjectState>(cloneState(state));
  const applying=useRef(false);
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    if(applying.current){applying.current=false;current.current=cloneState(state);setVersion(v=>v+1);return;}
    const previous=current.current;
    if(JSON.stringify(previous)===signature)return;
    past.current.push(cloneState(previous));
    if(past.current.length>MAX_HISTORY)past.current.shift();
    future.current=[];
    current.current=cloneState(state);
    setVersion(v=>v+1);
  },[signature,state]);

  const undo=useCallback(()=>{
    const previous=past.current.pop();if(!previous)return;
    future.current.push(cloneState(current.current));
    applying.current=true;current.current=cloneState(previous);apply(previous);setVersion(v=>v+1);
  },[apply]);
  const redo=useCallback(()=>{
    const next=future.current.pop();if(!next)return;
    past.current.push(cloneState(current.current));
    applying.current=true;current.current=cloneState(next);apply(next);setVersion(v=>v+1);
  },[apply]);
  const reset=useCallback((next:V9ProjectState)=>{past.current=[];future.current=[];current.current=cloneState(next);applying.current=true;setVersion(v=>v+1);},[]);

  return {undo,redo,reset,canUndo:past.current.length>0,canRedo:future.current.length>0,version};
}
