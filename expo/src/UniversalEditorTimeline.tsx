import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Copy, Eye, EyeOff, Focus, ImagePlus, Lock, Magnet, Minus,
  MousePointer2, Plus, Redo2, Scissors, Sparkles, Trash2,
  Undo2, Unlock, Video, Volume2, VolumeX, Waves,
} from 'lucide-react-native';
import type {
  KaraokeLine, MediaClip, TimelineTrackName, TimelineTrackState,
} from './types';
import { extractWaveform } from './waveform-engine';

type Tool='select'|'razor';
type Snapshot={subtitles:KaraokeLine[];clips:MediaClip[]};
type ClipboardItem={kind:'clip';value:MediaClip}|{kind:'subtitle';value:KaraokeLine};

const MIN_ZOOM=.5;
const MAX_ZOOM=5;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const stamp=(value:number)=>{
  const safe=Math.max(0,value);
  const minutes=Math.floor(safe/60);
  const seconds=Math.floor(safe%60);
  const tenths=Math.floor((safe%1)*10);
  return `${minutes}:${String(seconds).padStart(2,'0')}.${tenths}`;
};
const cloneLines=(items:KaraokeLine[])=>items.map(line=>({
  ...line,
  words:line.words?.map(word=>({...word})),
}));
const cloneClips=(items:MediaClip[])=>items.map(clip=>({...clip}));
const defaultTracks:TimelineTrackState={
  audio:{hidden:false,muted:false,locked:false},
  visual:{hidden:false,muted:false,locked:false},
  subtitle:{hidden:false,muted:false,locked:false},
  effects:{hidden:false,muted:false,locked:false},
};

export function UniversalEditorTimeline({
  compact=false,duration,playhead,onSeek,subtitles,onSubtitlesChange,
  clips,onClipsChange,effects,trackState,onTrackStateChange,onAddMedia,
  audioSource,trimStart=0,trimEnd,onTrimChange,
}:{
  compact?:boolean;
  duration:number;
  playhead:number;
  onSeek:(value:number)=>void;
  subtitles:KaraokeLine[];
  onSubtitlesChange:(lines:KaraokeLine[])=>void;
  clips:MediaClip[];
  onClipsChange:(clips:MediaClip[])=>void;
  effects:string[];
  trackState?:TimelineTrackState;
  onTrackStateChange:(state:TimelineTrackState)=>void;
  onAddMedia:()=>void;
  audioSource?:string;
  trimStart?:number;
  trimEnd?:number;
  onTrimChange?:(start:number,end:number)=>void;
}){
  const [zoom,setZoom]=useState(1);
  const [tool,setTool]=useState<Tool>('select');
  const [snapping,setSnapping]=useState(true);
  const [followPlayhead,setFollowPlayhead]=useState(true);
  const [scrollX,setScrollX]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [viewportWidth,setViewportWidth]=useState(320);
  const [waveform,setWaveform]=useState<number[]>([]);
  const [undoStack,setUndoStack]=useState<Snapshot[]>([]);
  const [redoStack,setRedoStack]=useState<Snapshot[]>([]);
  const [clipboard,setClipboard]=useState<ClipboardItem|null>(null);
  const tracks=trackState||defaultTracks;
  const safeDuration=Math.max(1,duration||1);
  const safeTrimStart=clamp(trimStart,0,Math.max(0,safeDuration-.1));
  const safeTrimEnd=clamp(trimEnd??safeDuration,safeTrimStart+.1,safeDuration);
  const setTrim=(start:number,end:number)=>onTrimChange?.(
    clamp(start,0,Math.max(0,safeDuration-.1)),
    clamp(end,Math.min(safeDuration,start+.1),safeDuration),
  );
  const canvasWidth=Math.max(viewportWidth,Math.max(900,safeDuration*22)*zoom);
  const px=canvasWidth/safeDuration;
  const scrollRef=useRef<ScrollView>(null);

  useEffect(()=>{
    let cancelled=false;
    if(!audioSource){setWaveform([]);return}
    void extractWaveform(audioSource,320).then(peaks=>{if(!cancelled)setWaveform(peaks)}).catch(()=>{if(!cancelled)setWaveform([])});
    return()=>{cancelled=true};
  },[audioSource]);

  useEffect(()=>{
    if(!followPlayhead||!scrollRef.current)return;
    const x=playhead*px;
    const left=scrollX+viewportWidth*.14;
    const right=scrollX+viewportWidth*.82;
    if(x<left||x>right){
      const target=clamp(x-viewportWidth*.34,0,Math.max(0,canvasWidth-viewportWidth));
      scrollRef.current.scrollTo({x:target,y:0,animated:true});
      setScrollX(target);
    }
  },[playhead,px,followPlayhead,viewportWidth,canvasWidth,scrollX]);

  const snapshot=():Snapshot=>({subtitles:cloneLines(subtitles),clips:cloneClips(clips)});
  const pushHistory=()=>{
    setUndoStack(items=>[...items.slice(-39),snapshot()]);
    setRedoStack([]);
  };
  const restore=(value:Snapshot)=>{
    onSubtitlesChange(cloneLines(value.subtitles));
    onClipsChange(cloneClips(value.clips));
  };
  const undo=()=>{
    const previous=undoStack.at(-1);if(!previous)return;
    setRedoStack(items=>[...items.slice(-39),snapshot()]);
    setUndoStack(items=>items.slice(0,-1));
    restore(previous);
  };
  const redo=()=>{
    const next=redoStack.at(-1);if(!next)return;
    setUndoStack(items=>[...items.slice(-39),snapshot()]);
    setRedoStack(items=>items.slice(0,-1));
    restore(next);
  };

  const snapPoints=useMemo(()=>{
    const points=[0,safeDuration,playhead];
    for(const clip of clips)points.push(clip.start,clip.end);
    for(const line of subtitles)points.push(line.start,line.end);
    return points;
  },[clips,subtitles,playhead,safeDuration]);
  const snap=(value:number)=>{
    const bounded=clamp(value,0,safeDuration);
    if(!snapping)return bounded;
    const grid=zoom>=2?.1:zoom>=1?.25:.5;
    let best=clamp(Math.round(bounded/grid)*grid,0,safeDuration);
    let distance=Math.abs(best-bounded);
    const threshold=Math.max(.06,9/px);
    for(const point of snapPoints){
      const nextDistance=Math.abs(point-bounded);
      if(nextDistance<=threshold&&nextDistance<distance){best=point;distance=nextDistance}
    }
    return best;
  };
  const updateTrack=(name:TimelineTrackName,patch:Partial<TimelineTrackState[TimelineTrackName]>)=>{
    onTrackStateChange({...tracks,[name]:{...tracks[name],...patch}});
  };

  const splitSelected=(at=playhead)=>{
    if(!selected)return;
    if(selected.startsWith('sub-')){
      const index=Number(selected.slice(4)),line=subtitles[index];
      if(!line||at<=line.start+.08||at>=line.end-.08)return;
      pushHistory();
      const next=cloneLines(subtitles);
      const leftWords=line.words?.filter(word=>word.start<at);
      const rightWords=line.words?.filter(word=>word.end>at);
      next.splice(index,1,{...line,end:at,words:leftWords},{...line,start:at,words:rightWords});
      onSubtitlesChange(next);setSelected('sub-'+(index+1));return;
    }
    const index=clips.findIndex(clip=>clip.id===selected),clip=clips[index];
    if(!clip||at<=clip.start+.08||at>=clip.end-.08)return;
    pushHistory();
    const right:{[K in keyof MediaClip]:MediaClip[K]}={...clip,id:'clip-'+Date.now().toString(36),start:at,name:clip.name+' · 2'};
    const next=cloneClips(clips);next.splice(index,1,{...clip,end:at},right as MediaClip);
    onClipsChange(next);setSelected((right as MediaClip).id);
  };
  const deleteSelected=()=>{
    if(!selected)return;
    pushHistory();
    if(selected.startsWith('sub-')){
      const index=Number(selected.slice(4));
      onSubtitlesChange(subtitles.filter((_,i)=>i!==index));
    }else onClipsChange(clips.filter(clip=>clip.id!==selected));
    setSelected(null);
  };
  const copySelected=()=>{
    if(!selected)return;
    if(selected.startsWith('sub-')){
      const source=subtitles[Number(selected.slice(4))];
      if(source)setClipboard({kind:'subtitle',value:cloneLines([source])[0]!});
    }else{
      const source=clips.find(clip=>clip.id===selected);
      if(source)setClipboard({kind:'clip',value:{...source}});
    }
  };
  const pasteClipboard=()=>{
    if(!clipboard)return;
    pushHistory();
    if(clipboard.kind==='subtitle'){
      const source=clipboard.value;
      const len=Math.max(.12,source.end-source.start);
      const start=clamp(playhead,0,Math.max(0,safeDuration-len)),delta=start-source.start;
      const value={...source,start,end:start+len,words:source.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))};
      onSubtitlesChange([...cloneLines(subtitles),value].sort((a,b)=>a.start-b.start));
      setSelected(null);
    }else{
      const source=clipboard.value,len=Math.max(.25,source.end-source.start);
      const start=clamp(playhead,0,Math.max(0,safeDuration-len));
      const value={...source,id:'clip-'+Date.now().toString(36),start,end:start+len,name:source.name+' · copy',isDefault:false};
      onClipsChange([...cloneClips(clips),value]);
      setSelected(value.id);
    }
  };
  const duplicateSelected=()=>{
    if(!selected)return;
    let item:ClipboardItem|null=null;
    if(selected.startsWith('sub-')){
      const source=subtitles[Number(selected.slice(4))];
      if(source)item={kind:'subtitle',value:cloneLines([source])[0]!};
    }else{
      const source=clips.find(clip=>clip.id===selected);
      if(source)item={kind:'clip',value:{...source}};
    }
    if(!item)return;
    setClipboard(item);
    pushHistory();
    if(item.kind==='subtitle'){
      const source=item.value,len=Math.max(.12,source.end-source.start);
      const start=clamp(playhead,0,Math.max(0,safeDuration-len)),delta=start-source.start;
      const value={...source,start,end:start+len,words:source.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))};
      onSubtitlesChange([...cloneLines(subtitles),value].sort((a,b)=>a.start-b.start));
    }else{
      const source=item.value,len=Math.max(.25,source.end-source.start);
      const start=clamp(playhead,0,Math.max(0,safeDuration-len));
      const value={...source,id:'clip-'+Date.now().toString(36),start,end:start+len,name:source.name+' · copy',isDefault:false};
      onClipsChange([...cloneClips(clips),value]);setSelected(value.id);
    }
  };
  const retimeSubtitle=(line:KaraokeLine,start:number,end:number)=>{
    const previousLength=Math.max(.001,line.end-line.start);
    const nextLength=Math.max(.001,end-start);
    const shifted=Math.abs(nextLength-previousLength)<.002;
    const delta=start-line.start;
    const words=line.words?.map(word=>{
      if(shifted)return {...word,start:word.start+delta,end:word.end+delta};
      return {...word,start:clamp(word.start,start,end),end:clamp(word.end,start,end)};
    }).filter(word=>word.end-word.start>.01);
    return {...line,start,end,words};
  };

  const shiftSubtitle=(index:number,requested:number,following=false)=>{
    if(index<0||index>=subtitles.length)return;
    const affected=subtitles.slice(index,following?undefined:index+1);
    if(!affected.length)return;
    const minStart=Math.min(...affected.map(line=>line.start));
    const maxEnd=Math.max(...affected.map(line=>line.end));
    const delta=clamp(requested,-minStart,safeDuration-maxEnd);
    if(Math.abs(delta)<.0001)return;
    pushHistory();
    onSubtitlesChange(subtitles.map((line,lineIndex)=>{
      if(lineIndex<index||(!following&&lineIndex!==index))return line;
      return {...line,start:line.start+delta,end:line.end+delta,words:line.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))};
    }));
  };

  const onCanvasLayout=(event:LayoutChangeEvent)=>setViewportWidth(Math.max(280,event.nativeEvent.layout.width));
  const rulerStep=zoom>=2?5:zoom>=1?10:20;
  const ticks=Array.from({length:Math.ceil(safeDuration/rulerStep)+1},(_,i)=>i*rulerStep);
  const selectedSubtitle=selected?.startsWith('sub-')?Number(selected.slice(4)):-1;
  const selectedClip=selected&&!selected.startsWith('sub-')?clips.find(clip=>clip.id===selected):undefined;
  const rulerStartX=useRef(0);
  const rulerResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dx)>2,
    onPanResponderGrant:event=>{
      rulerStartX.current=(event.nativeEvent as any).locationX||0;
      onSeek(snap(rulerStartX.current/px));
    },
    onPanResponderMove:(_,gesture)=>onSeek(snap((rulerStartX.current+gesture.dx)/px)),
  }),[px,onSeek,snap]);

  return <View style={[styles.root,compact&&styles.rootCompact]}>
    <View style={[styles.header,compact&&styles.headerCompact]}>
      <View style={styles.headerTitle}><Text style={styles.title}>Creator Timeline</Text><Text style={styles.time}>{stamp(playhead)} / {stamp(safeDuration)}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
        <Tool active={tool==='select'} onPress={()=>setTool('select')} icon={<MousePointer2 size={14}/>} label="V"/>
        <Tool active={tool==='razor'} onPress={()=>setTool('razor')} icon={<Scissors size={14}/>} label="B"/>
        <Tool active={snapping} onPress={()=>setSnapping(value=>!value)} icon={<Magnet size={14}/>} label="Snap"/>
        <Tool active={followPlayhead} onPress={()=>setFollowPlayhead(value=>!value)} icon={<Focus size={14}/>} label="Follow"/>
        <Tool disabled={!selected} onPress={splitSelected} icon={<Scissors size={14}/>} label="Split"/>
        <Tool disabled={!selected} onPress={copySelected} icon={<Copy size={14}/>} label="Copy"/>
        <Tool disabled={!clipboard} onPress={pasteClipboard} icon={<Copy size={14}/>} label="Paste"/>
        <Tool disabled={!selected} onPress={duplicateSelected} icon={<Copy size={14}/>} label="Duplicate"/>
        <Tool disabled={!selected} onPress={deleteSelected} icon={<Trash2 size={14}/>} label="Delete"/>
        <Tool disabled={!undoStack.length} onPress={undo} icon={<Undo2 size={14}/>} label="Undo"/>
        <Tool disabled={!redoStack.length} onPress={redo} icon={<Redo2 size={14}/>} label="Redo"/>
        <Tool onPress={onAddMedia} icon={<ImagePlus size={14}/>} label="Media"/>
        <Tool onPress={()=>setTrim(Math.min(playhead,safeTrimEnd-.1),safeTrimEnd)} icon={<Scissors size={14}/>} label="Set IN"/>
        <Tool onPress={()=>setTrim(safeTrimStart,Math.max(playhead,safeTrimStart+.1))} icon={<Scissors size={14}/>} label="Set OUT"/>
        <Tool onPress={()=>setTrim(0,safeDuration)} icon={<Focus size={14}/>} label="Full"/>
      </ScrollView>
      <View style={styles.zoom}>
        <Pressable disabled={zoom<=MIN_ZOOM} onPress={()=>setZoom(value=>clamp(value-.25,MIN_ZOOM,MAX_ZOOM))} style={styles.zoomBtn}><Minus size={13} color="#cdd4df"/></Pressable>
        <Text style={styles.zoomBound}>MIN .5×</Text>
        <Text style={styles.zoomValue}>{zoom.toFixed(zoom%1===0?0:2)}×</Text>
        <Text style={styles.zoomBound}>MAX 5×</Text>
        <Pressable disabled={zoom>=MAX_ZOOM} onPress={()=>setZoom(value=>clamp(value+.25,MIN_ZOOM,MAX_ZOOM))} style={styles.zoomBtn}><Plus size={13} color="#cdd4df"/></Pressable>
        <Pressable onPress={()=>setZoom(clamp(viewportWidth/Math.max(900,safeDuration*22),MIN_ZOOM,MAX_ZOOM))} style={styles.zoomBtn}><Focus size={13} color="#cdd4df"/></Pressable>
      </View>
    </View>

    {selectedSubtitle>=0&&subtitles[selectedSubtitle]&&<View style={styles.nudge}>
      <Text style={styles.nudgeLabel}>Chỉnh timing</Text>
      {[-.5,-.1,.1,.5].map(delta=><Pressable key={delta} onPress={()=>shiftSubtitle(selectedSubtitle,delta)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>{delta>0?'+':''}{delta.toFixed(1)}s</Text></Pressable>)}
      <Pressable onPress={()=>shiftSubtitle(selectedSubtitle,playhead-subtitles[selectedSubtitle]!.start)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Đặt đầu tại playhead</Text></Pressable>
      <Pressable onPress={()=>shiftSubtitle(selectedSubtitle,-.1,true)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Từ đây −.1s</Text></Pressable>
      <Pressable onPress={()=>shiftSubtitle(selectedSubtitle,.1,true)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Từ đây +.1s</Text></Pressable>
    </View>}
    {selectedClip&&<View style={styles.nudge}>
      <Text style={styles.nudgeLabel}>Clip · {selectedClip.name}</Text>
      {[-.5,-.1,.1,.5].map(delta=><Pressable key={delta} onPress={()=>{
        const length=selectedClip.end-selectedClip.start;
        const start=clamp(selectedClip.start+delta,0,Math.max(0,safeDuration-length));
        pushHistory();
        onClipsChange(clips.map(clip=>clip.id===selectedClip.id?{...clip,start,end:start+length}:clip));
      }} style={styles.nudgeBtn}><Text style={styles.nudgeText}>{delta>0?'+':''}{delta.toFixed(1)}s</Text></Pressable>)}
      <Pressable onPress={()=>{
        const length=selectedClip.end-selectedClip.start;
        const start=clamp(playhead,0,Math.max(0,safeDuration-length));
        pushHistory();
        onClipsChange(clips.map(clip=>clip.id===selectedClip.id?{...clip,start,end:start+length}:clip));
      }} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Đặt đầu tại playhead</Text></Pressable>
      <Pressable onPress={()=>splitSelected(playhead)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Split tại playhead</Text></Pressable>
    </View>}

    <View onLayout={onCanvasLayout}>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator scrollEventThrottle={32} onScroll={event=>setScrollX(event.nativeEvent.contentOffset.x)} contentContainerStyle={{width:canvasWidth}}>
        <Pressable
          style={[styles.canvas,{width:canvasWidth,height:compact?340:370}]}
          onPress={event=>{
            const x=(event.nativeEvent as any).locationX||0;
            const value=snap(x/px);
            onSeek(value);
            if(tool==='razor'&&selected)splitSelected(value);
          }}
        >
          <View {...rulerResponder.panHandlers} style={styles.ruler}>
            {ticks.map(value=><View key={value} style={[styles.tick,{left:value*px}]}><Text style={styles.tickText}>{stamp(value)}</Text></View>)}
          </View>
          {safeTrimStart>0&&<View pointerEvents="none" style={[styles.trimOutside,{left:0,width:safeTrimStart*px}]}/>}
          {safeTrimEnd<safeDuration&&<View pointerEvents="none" style={[styles.trimOutside,{left:safeTrimEnd*px,width:Math.max(0,(safeDuration-safeTrimEnd)*px)}]}/>}
          <View pointerEvents="none" style={[styles.trimRegion,{left:safeTrimStart*px,width:Math.max(2,(safeTrimEnd-safeTrimStart)*px)}]}>
            <Text style={styles.trimRegionText}>WORK AREA · {stamp(safeTrimStart)} → {stamp(safeTrimEnd)}</Text>
          </View>
          <TrimHandle side="start" value={safeTrimStart} other={safeTrimEnd} px={px} duration={safeDuration} snap={snap} onChange={(value)=>setTrim(value,safeTrimEnd)}/>
          <TrimHandle side="end" value={safeTrimEnd} other={safeTrimStart} px={px} duration={safeDuration} snap={snap} onChange={(value)=>setTrim(safeTrimStart,value)}/>

          <TrackHeader name="audio" label="Audio" icon={<Waves size={14}/>} state={tracks.audio} onUpdate={patch=>updateTrack('audio',patch)}/>
          {!tracks.audio.hidden&&<View style={[styles.audioLane,{top:62,width:canvasWidth}]}>
            <View style={[styles.waveBars,{width:Math.max(1,canvasWidth-58)}]}>
              {(waveform.length?waveform:Array.from({length:180},(_,index)=>(9+((index*37)%43))/52)).map((value,index)=>{
                const count=waveform.length||180;
                const barWidth=Math.max(1,(canvasWidth-58)/count-1);
                return <View key={index} style={[styles.waveBar,{width:barWidth,height:Math.max(3,Math.round(5+value*43))}]}/>;
              })}
            </View>
          </View>}

          <TrackHeader name="visual" label="Visual" icon={<Video size={14}/>} state={tracks.visual} onUpdate={patch=>updateTrack('visual',patch)} top={126}/>
          {!tracks.visual.hidden&&clips.map((clip,index)=><MovableClip
            key={clip.id}
            id={clip.id}
            selected={selected===clip.id}
            top={151}
            start={clip.start}
            end={clip.end}
            px={px}
            duration={safeDuration}
            locked={tracks.visual.locked}
            tool={tool}
            snap={snap}
            color="#273345"
            border="#56657a"
            label={clip.name}
            onSelect={()=>setSelected(clip.id)}
            onHistory={pushHistory}
            onSplitAt={at=>{setSelected(clip.id);splitSelected(at)}}
            onMove={(start,end)=>onClipsChange(clips.map((item,i)=>i===index?{...item,start,end}:item))}
          />)}

          <TrackHeader name="subtitle" label={'CC Subtitle · '+subtitles.length} icon={<Text style={styles.cc}>CC</Text>} state={tracks.subtitle} onUpdate={patch=>updateTrack('subtitle',patch)} top={204}/>
          {!tracks.subtitle.hidden&&subtitles.map((line,index)=><MovableClip
            key={'sub-'+index+'-'+line.start}
            id={'sub-'+index}
            selected={selected==='sub-'+index}
            top={230}
            start={line.start}
            end={line.end}
            px={px}
            duration={safeDuration}
            locked={tracks.subtitle.locked}
            tool={tool}
            snap={snap}
            minLength={.12}
            color="#352366"
            border="#6948b4"
            label={line.text}
            onSelect={()=>setSelected('sub-'+index)}
            onHistory={pushHistory}
            onSplitAt={at=>{setSelected('sub-'+index);splitSelected(at)}}
            onMove={(start,end)=>onSubtitlesChange(subtitles.map((item,i)=>i===index?retimeSubtitle(item,start,end):item))}
          />)}

          <TrackHeader name="effects" label="Effects" icon={<Sparkles size={14}/>} state={tracks.effects} onUpdate={patch=>updateTrack('effects',patch)} top={282}/>
          {!tracks.effects.hidden&&<View style={[styles.effects,{left:58,top:307,width:Math.max(120,canvasWidth-70)}]}><Text numberOfLines={1} style={styles.effectText}>{effects.length?effects.join(' · '):'Không có effect'}</Text></View>}

          <View pointerEvents="none" style={[styles.playhead,{left:playhead*px}]}><View style={styles.playheadDot}/><Text style={styles.playheadText}>{stamp(playhead)}</Text></View>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

function TrimHandle({side,value,other,px,duration,snap,onChange}:{side:'start'|'end';value:number;other:number;px:number;duration:number;snap:(value:number)=>number;onChange:(value:number)=>void}){
  const origin=useRef(value);
  origin.current=value;
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:()=>{origin.current=value},
    onPanResponderMove:(_,gesture)=>{
      const raw=snap(origin.current+gesture.dx/px);
      const next=side==='start'?clamp(raw,0,other-.1):clamp(raw,other+.1,duration);
      onChange(next);
    },
  }),[side,value,other,px,duration,snap,onChange]);
  return <View
    {...responder.panHandlers}
    style={[styles.trimHandle,{left:value*px},side==='start'?styles.trimHandleStart:styles.trimHandleEnd]}
  ><View style={styles.trimHandleGrip}/></View>;
}

function Tool({active=false,disabled=false,onPress,icon,label}:{active?:boolean;disabled?:boolean;onPress:()=>void;icon:React.ReactNode;label:string}){
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.tool,active&&styles.toolActive,disabled&&styles.disabled]}>{icon}<Text style={[styles.toolText,active&&styles.toolTextActive]}>{label}</Text></Pressable>;
}
function TrackHeader({name,label,icon,state,onUpdate,top=38}:{name:TimelineTrackName;label:string;icon:React.ReactNode;state:{hidden:boolean;muted:boolean;locked:boolean};onUpdate:(patch:Partial<{hidden:boolean;muted:boolean;locked:boolean}>)=>void;top?:number}){
  return <View style={[styles.trackHeader,{top}]}>
    <View style={styles.trackLabel}>{icon}<Text numberOfLines={1} style={styles.trackText}>{label}</Text></View>
    <View style={styles.trackActions}>
      <Pressable onPress={()=>onUpdate({hidden:!state.hidden})}>{state.hidden?<EyeOff size={13} color="#758196"/>:<Eye size={13} color="#a8b2c1"/>}</Pressable>
      {name!=='subtitle'&&name!=='effects'&&<Pressable onPress={()=>onUpdate({muted:!state.muted})}>{state.muted?<VolumeX size={13} color="#758196"/>:<Volume2 size={13} color="#a8b2c1"/>}</Pressable>}
      <Pressable onPress={()=>onUpdate({locked:!state.locked})}>{state.locked?<Lock size={13} color="#a58aff"/>:<Unlock size={13} color="#a8b2c1"/>}</Pressable>
    </View>
  </View>;
}
function MovableClip({selected,top,start,end,px,duration,locked,tool,snap,minLength=.25,color,border,label,onSelect,onHistory,onSplitAt,onMove}:{id:string;selected:boolean;top:number;start:number;end:number;px:number;duration:number;locked:boolean;tool:Tool;snap:(value:number)=>number;minLength?:number;color:string;border:string;label:string;onSelect:()=>void;onHistory:()=>void;onSplitAt:(at:number)=>void;onMove:(start:number,end:number)=>void}){
  const origin=useRef({start,end});
  origin.current={start,end};
  const moveResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!locked&&tool==='select',
    onMoveShouldSetPanResponder:(_,gesture)=>!locked&&tool==='select'&&Math.abs(gesture.dx)>3,
    onPanResponderGrant:()=>{onSelect();onHistory()},
    onPanResponderMove:(_,gesture)=>{
      const length=origin.current.end-origin.current.start;
      const rawStart=origin.current.start+gesture.dx/px;
      const nextStart=clamp(snap(rawStart),0,Math.max(0,duration-length));
      onMove(nextStart,nextStart+length);
    },
  }),[locked,tool,px,duration,onSelect,onHistory,onMove,snap]);

  const leftResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!locked&&tool==='select',
    onMoveShouldSetPanResponder:()=>!locked&&tool==='select',
    onPanResponderGrant:()=>{onSelect();onHistory()},
    onPanResponderMove:(_,gesture)=>{
      const next=snap(origin.current.start+gesture.dx/px);
      onMove(clamp(next,0,origin.current.end-minLength),origin.current.end);
    },
  }),[locked,tool,px,minLength,onSelect,onHistory,onMove,snap]);
  const rightResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!locked&&tool==='select',
    onMoveShouldSetPanResponder:()=>!locked&&tool==='select',
    onPanResponderGrant:()=>{onSelect();onHistory()},
    onPanResponderMove:(_,gesture)=>{
      const next=snap(origin.current.end+gesture.dx/px);
      onMove(origin.current.start,clamp(next,origin.current.start+minLength,duration));
    },
  }),[locked,tool,px,minLength,duration,onSelect,onHistory,onMove,snap]);

  return <Pressable
    {...moveResponder.panHandlers}
    onPress={event=>{
      onSelect();
      if(tool==='razor'){
        const local=(event.nativeEvent as any).locationX||0;
        onSplitAt(snap(start+local/px));
      }
    }}
    style={[styles.clip,{top,left:start*px,width:Math.max(22,(end-start)*px),backgroundColor:color,borderColor:selected?'#9d7bff':border}]}
  >
    <View {...leftResponder.panHandlers} style={[styles.edge,selected&&styles.edgeActive]}/>
    <Text numberOfLines={1} style={styles.clipText}>{label}</Text>
    <View {...rightResponder.panHandlers} style={[styles.edge,styles.edgeRight,selected&&styles.edgeActive]}/>
  </Pressable>;
}

const styles=StyleSheet.create({
  root:{marginTop:18,minWidth:0,borderWidth:1,borderColor:'#202735',borderRadius:14,backgroundColor:'#090d14',overflow:'hidden'},
  rootCompact:{borderRadius:10},
  header:{minHeight:52,borderBottomWidth:1,borderColor:'#202735',paddingHorizontal:10,paddingVertical:8,gap:7},
  headerCompact:{paddingHorizontal:8},
  headerTitle:{flexDirection:'row',alignItems:'center',gap:9},
  title:{color:'#f4f6fb',fontSize:11,fontWeight:'800'},time:{color:'#727d90',fontSize:9},
  tools:{gap:5,alignItems:'center'},tool:{height:31,borderWidth:1,borderColor:'#313a49',borderRadius:8,backgroundColor:'#111722',paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:5},
  toolActive:{borderColor:'#725be1',backgroundColor:'#211a3c'},toolText:{color:'#aab4c3',fontSize:8,fontWeight:'700'},toolTextActive:{color:'#fff'},disabled:{opacity:.35},
  zoom:{flexDirection:'row',alignItems:'center',gap:6},zoomBtn:{width:29,height:29,borderWidth:1,borderColor:'#313a49',borderRadius:8,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},zoomBound:{color:'#616e81',fontSize:7},zoomValue:{minWidth:37,color:'#d6deea',fontSize:8,textAlign:'center',fontWeight:'800'},
  nudge:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,padding:8,borderBottomWidth:1,borderColor:'rgba(217,70,239,.12)',backgroundColor:'rgba(217,70,239,.04)'},nudgeLabel:{color:'#d8dce5',fontSize:9,fontWeight:'800',marginRight:4},nudgeBtn:{minHeight:29,borderWidth:1,borderColor:'#3a3248',borderRadius:7,backgroundColor:'#121019',paddingHorizontal:8,alignItems:'center',justifyContent:'center'},nudgeText:{color:'#c5bed0',fontSize:8},
  canvas:{position:'relative',backgroundColor:'#070a10'},ruler:{position:'absolute',left:0,right:0,top:0,height:30,borderBottomWidth:1,borderColor:'#28303d'},tick:{position:'absolute',top:16,height:14,borderLeftWidth:1,borderColor:'#3b4556'},tickText:{position:'absolute',bottom:12,left:4,color:'#8792a5',fontSize:8,width:42},
  trimOutside:{position:'absolute',zIndex:3,top:30,bottom:0,backgroundColor:'rgba(0,0,0,.42)'},trimRegion:{position:'absolute',zIndex:4,top:30,bottom:0,borderLeftWidth:1,borderRightWidth:1,borderColor:'rgba(139,108,255,.6)',backgroundColor:'rgba(123,91,255,.045)'},trimRegionText:{position:'absolute',top:4,left:5,color:'#9f8cf4',fontSize:7,fontWeight:'800',letterSpacing:.4},
  trimHandle:{position:'absolute',zIndex:40,top:20,bottom:0,width:14,marginLeft:-7,alignItems:'center'},trimHandleStart:{},trimHandleEnd:{},trimHandleGrip:{width:9,height:24,borderWidth:1,borderColor:'#cabdff',borderRadius:4,backgroundColor:'#7258e8',shadowColor:'#7c5cff',shadowOpacity:.45,shadowRadius:6,elevation:4},
  trackHeader:{position:'absolute',left:6,width:120,height:25,zIndex:10,borderRadius:6,backgroundColor:'rgba(17,23,34,.94)',paddingHorizontal:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},trackLabel:{flex:1,flexDirection:'row',alignItems:'center',gap:4},trackText:{flex:1,color:'#818da1',fontSize:8,fontWeight:'700'},trackActions:{flexDirection:'row',alignItems:'center',gap:5},cc:{color:'#aa97ff',fontSize:7,fontWeight:'900'},
  audioLane:{position:'absolute',left:0,height:58,borderBottomWidth:1,borderColor:'#171d27',justifyContent:'center',paddingLeft:58},waveBars:{height:46,flexDirection:'row',alignItems:'center',overflow:'hidden'},waveBar:{borderRadius:2,backgroundColor:'#765cec',opacity:.78},
  clip:{position:'absolute',height:44,borderWidth:1,borderRadius:5,overflow:'hidden',justifyContent:'center',paddingHorizontal:12},clipText:{color:'#e9edf5',fontSize:8,fontWeight:'700'},edge:{position:'absolute',zIndex:6,left:0,top:0,bottom:0,width:8,backgroundColor:'#9d7bff',opacity:.38},edgeRight:{left:undefined,right:0},edgeActive:{opacity:.95},
  effects:{position:'absolute',height:38,borderWidth:1,borderColor:'#40516b',borderRadius:5,backgroundColor:'#172335',justifyContent:'center',paddingHorizontal:10},effectText:{color:'#9cb0cc',fontSize:8},
  playhead:{position:'absolute',zIndex:30,top:18,bottom:0,width:1,backgroundColor:'#fff'},playheadDot:{width:9,height:9,marginLeft:-4,borderRadius:5,backgroundColor:'#fff'},playheadText:{position:'absolute',left:5,top:-4,width:48,color:'#fff',fontSize:7},
});
