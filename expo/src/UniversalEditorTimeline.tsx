import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  ChevronDown, Copy, Eye, EyeOff, Focus, ImagePlus, Lock, Magnet, Minus,
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
const cloneLines=(items:KaraokeLine[])=>items.map(line=>({...line,words:line.words?.map(word=>({...word}))}));
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
  audioSource,
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
  const [selected,setSelected]=useState<string|null>(null);
  const [expandedTrack,setExpandedTrack]=useState<TimelineTrackName>('subtitle');
  const [waveform,setWaveform]=useState<number[]>([]);
  const [snapHint,setSnapHint]=useState<number|null>(null);
  const [undoStack,setUndoStack]=useState<Snapshot[]>([]);
  const [redoStack,setRedoStack]=useState<Snapshot[]>([]);
  const [trackHeight,setTrackHeight]=useState(1);
  const [viewportWidth,setViewportWidth]=useState(320);
  const [scrollX,setScrollX]=useState(0);
  const clipboard=useRef<ClipboardItem|null>(null);
  const tracks=trackState||defaultTracks;
  const safeDuration=Math.max(1,duration||1);
  const width=Math.max(viewportWidth,Math.max(900,safeDuration*22*zoom));
  const px=width/safeDuration;
  const grid=zoom>=2?.1:zoom>=1?.25:.5;
  const scrollRef=useRef<ScrollView>(null);

  useEffect(()=>{
    let cancelled=false;
    if(!audioSource){setWaveform([]);return}
    void extractWaveform(audioSource,320)
      .then(peaks=>{if(!cancelled)setWaveform(peaks)})
      .catch(()=>{if(!cancelled)setWaveform([])});
    return()=>{cancelled=true};
  },[audioSource]);

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
    const points=new Set<number>([0,safeDuration,playhead]);
    clips.forEach(clip=>{points.add(clip.start);points.add(clip.end)});
    subtitles.forEach(line=>{points.add(line.start);points.add(line.end)});
    return [...points];
  },[clips,subtitles,playhead,safeDuration]);

  const snap=(value:number,extra:number[]=[]):number=>{
    const bounded=clamp(value,0,safeDuration);
    if(!snapping)return bounded;
    const threshold=Math.max(.06,9/px);
    let best=clamp(Math.round(bounded/grid)*grid,0,safeDuration);
    let distance=Math.abs(best-bounded);
    for(const point of [...snapPoints,...extra]){
      const nextDistance=Math.abs(point-bounded);
      if(nextDistance<=threshold&&nextDistance<distance){best=point;distance=nextDistance}
    }
    setSnapHint(distance<=threshold?best:null);
    return best;
  };

  const updateTrack=(name:TimelineTrackName,patch:Partial<TimelineTrackState[TimelineTrackName]>)=>{
    onTrackStateChange({...tracks,[name]:{...tracks[name],...patch}});
  };

  const splitSelected=(at=playhead,target=selected)=>{
    if(!target)return;
    if(target.startsWith('sub-')){
      const index=Number(target.slice(4)),line=subtitles[index];
      if(!line||at<=line.start+.08||at>=line.end-.08)return;
      pushHistory();
      const words=line.words||[];
      const next=[...subtitles];
      next.splice(index,1,
        {...line,end:at,words:words.filter(word=>word.start<at)},
        {...line,start:at,words:words.filter(word=>word.end>at)},
      );
      onSubtitlesChange(next);
      setSelected('sub-'+(index+1));
      return;
    }
    const index=clips.findIndex(clip=>clip.id===target),clip=clips[index];
    if(!clip||at<=clip.start+.08||at>=clip.end-.08)return;
    pushHistory();
    const right={...clip,id:'clip-'+Date.now().toString(36),start:at,name:clip.name+' · 2'};
    const next=[...clips];
    next.splice(index,1,{...clip,end:at},right);
    onClipsChange(next);
    setSelected(right.id);
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
      const value=subtitles[Number(selected.slice(4))];
      if(value)clipboard.current={kind:'subtitle',value:cloneLines([value])[0]!};
    }else{
      const value=clips.find(clip=>clip.id===selected);
      if(value)clipboard.current={kind:'clip',value:{...value}};
    }
  };
  const paste=()=>{
    const copied=clipboard.current;if(!copied)return;
    pushHistory();
    if(copied.kind==='clip'){
      const source=copied.value,length=source.end-source.start;
      const start=clamp(playhead,0,Math.max(0,safeDuration-length));
      const value={...source,id:'clip-'+Date.now().toString(36),start,end:start+length,name:source.name+' · copy'};
      onClipsChange([...clips,value]);setSelected(value.id);
    }else{
      const source=copied.value,length=source.end-source.start;
      const start=clamp(playhead,0,Math.max(0,safeDuration-length)),delta=start-source.start;
      const value={...source,start:source.start+delta,end:source.end+delta,words:source.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))};
      onSubtitlesChange([...subtitles,value].sort((a,b)=>a.start-b.start));
    }
  };
  const duplicateSelected=()=>{copySelected();paste()};

  useEffect(()=>{
    if(Platform.OS!=='web')return;
    const root=globalThis as any;
    const keydown=(event:any)=>{
      const tag=(event.target?.tagName||'').toLowerCase();
      if(['input','textarea','select'].includes(tag)||event.target?.isContentEditable)return;
      const mod=event.metaKey||event.ctrlKey;
      const key=String(event.key||'').toLowerCase();
      if(mod&&key==='z'){event.preventDefault();event.shiftKey?redo():undo()}
      else if(mod&&key==='c'){event.preventDefault();copySelected()}
      else if(mod&&key==='v'){event.preventDefault();paste()}
      else if(mod&&key==='d'){event.preventDefault();duplicateSelected()}
      else if(key==='b')setTool('razor');
      else if(key==='v')setTool('select');
      else if(key==='s'){event.preventDefault();splitSelected()}
      else if(key==='delete'||key==='backspace'){event.preventDefault();deleteSelected()}
      else if(key==='arrowleft'||key==='arrowright'){
        event.preventDefault();onSeek(clamp(playhead+(key==='arrowleft'?-1:1)*(event.shiftKey?1:.1),0,safeDuration));
      }
    };
    root.addEventListener?.('keydown',keydown);
    return()=>root.removeEventListener?.('keydown',keydown);
  });

  const selectedSubtitleIndex=selected?.startsWith('sub-')?Number(selected.slice(4)):-1;
  const shiftSubtitles=(index:number,requestedDelta:number,following:boolean)=>{
    if(index<0||index>=subtitles.length)return;
    const affected=subtitles.slice(index,following?undefined:index+1);
    if(!affected.length)return;
    const minStart=Math.min(...affected.map(line=>line.start));
    const maxEnd=Math.max(...affected.map(line=>line.end));
    const delta=clamp(requestedDelta,-minStart,safeDuration-maxEnd);
    if(Math.abs(delta)<.0001)return;
    pushHistory();
    onSubtitlesChange(subtitles.map((line,lineIndex)=>{
      if(lineIndex<index||(!following&&lineIndex!==index))return line;
      return {...line,start:line.start+delta,end:line.end+delta,words:line.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))};
    }));
  };

  const rowHeight=(name:TimelineTrackName)=>{
    const base=name==='effects'?64:76;
    if(compact&&expandedTrack===name)return name==='effects'?74:86;
    return base*trackHeight;
  };
  const audioTop=30;
  const visualTop=audioTop+rowHeight('audio');
  const subtitleTop=visualTop+rowHeight('visual');
  const effectsTop=subtitleTop+rowHeight('subtitle');
  const canvasHeight=effectsTop+rowHeight('effects');

  const onCanvasLayout=(event:LayoutChangeEvent)=>setViewportWidth(Math.max(280,event.nativeEvent.layout.width));
  const rulerStep=Math.max(1,10/zoom);
  const ticks=Array.from({length:Math.ceil(safeDuration/rulerStep)+1},(_,i)=>i*rulerStep);

  const rulerStart=useRef(0);
  const rulerResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dx)>2,
    onPanResponderGrant:event=>{
      rulerStart.current=(event.nativeEvent as any).locationX||0;
      onSeek(snap(rulerStart.current/px));
    },
    onPanResponderMove:(_,gesture)=>onSeek(snap((rulerStart.current+gesture.dx)/px)),
    onPanResponderRelease:()=>setSnapHint(null),
    onPanResponderTerminate:()=>setSnapHint(null),
  }),[px,onSeek,snapping,zoom,snapPoints]);

  return <View style={[styles.root,compact&&styles.rootCompact]}>
    <View style={[styles.header,compact&&styles.headerCompact]}>
      <View style={styles.headerTop}>
        <View style={styles.timelineTitle}>
          <Text style={styles.title}>Creator Timeline</Text>
          <Text style={styles.time}>{stamp(playhead)} / {stamp(safeDuration)}</Text>
        </View>
        <View style={styles.history}>
          <Tool icon={<Undo2 size={14}/>} disabled={!undoStack.length} onPress={undo}/>
          <Tool icon={<Redo2 size={14}/>} disabled={!redoStack.length} onPress={redo}/>
        </View>
        <Pressable onPress={onAddMedia} style={[styles.addMedia,compact&&styles.addMediaCompact]}>
          <ImagePlus size={15} color="#d8deea"/>
          {!compact&&<Text style={styles.addMediaText}>Thêm ảnh/video</Text>}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tools,compact&&styles.toolsCompact]}>
        <Tool active={tool==='select'} onPress={()=>setTool('select')} icon={<MousePointer2 size={14}/>} />
        <Tool active={tool==='razor'} onPress={()=>setTool('razor')} icon={<Scissors size={14}/>} />
        <Tool active={snapping} onPress={()=>setSnapping(value=>!value)} icon={<Magnet size={14}/>} />
        <View style={styles.toolDivider}/>
        <Tool disabled={!selected} onPress={()=>splitSelected()} icon={<Scissors size={14}/>} />
        <Tool disabled={!selected} onPress={duplicateSelected} icon={<Copy size={14}/>} />
        <Tool disabled={!selected} onPress={deleteSelected} icon={<Trash2 size={14}/>} />
      </ScrollView>

      <View style={[styles.zoom,compact&&styles.zoomCompact]}>
        <Pressable disabled={zoom<=MIN_ZOOM} onPress={()=>setZoom(z=>Math.max(MIN_ZOOM,z-.25))} style={[styles.zoomBtn,zoom<=MIN_ZOOM&&styles.disabled]}><Minus size={13} color="#cdd4df"/></Pressable>
        <Text style={styles.zoomBound}>MIN {MIN_ZOOM}×</Text>
        <View style={styles.zoomTrack}><View style={[styles.zoomFill,{width:(((zoom-MIN_ZOOM)/(MAX_ZOOM-MIN_ZOOM)*100)+'%') as any}]}/></View>
        <Text style={styles.zoomValue}>{zoom.toFixed(zoom%1===0?0:2)}×</Text>
        <Text style={styles.zoomBound}>MAX {MAX_ZOOM}×</Text>
        <Pressable disabled={zoom>=MAX_ZOOM} onPress={()=>setZoom(z=>Math.min(MAX_ZOOM,z+.25))} style={[styles.zoomBtn,zoom>=MAX_ZOOM&&styles.disabled]}><Plus size={13} color="#cdd4df"/></Pressable>
        <Pressable onPress={()=>setZoom(clamp(viewportWidth/Math.max(900,safeDuration*22),MIN_ZOOM,MAX_ZOOM))} style={styles.zoomBtn}><Focus size={13} color="#cdd4df"/></Pressable>
      </View>
    </View>

    {selectedSubtitleIndex>=0&&subtitles[selectedSubtitleIndex]&&<View style={styles.nudge}>
      <Text style={styles.nudgeLabel}>Chỉnh timing:</Text>
      <Pressable onPress={()=>shiftSubtitles(selectedSubtitleIndex,playhead-subtitles[selectedSubtitleIndex]!.start,false)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Đặt đầu câu tại playhead</Text></Pressable>
      {[-.5,-.1,.1,.5].map(delta=><Pressable key={delta} onPress={()=>shiftSubtitles(selectedSubtitleIndex,delta,false)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>{delta>0?'+':''}{delta.toFixed(1)}s</Text></Pressable>)}
      <View style={styles.nudgeDivider}/>
      {[-.1,.1,-.5,.5].map(delta=><Pressable key={'following-'+delta} onPress={()=>shiftSubtitles(selectedSubtitleIndex,delta,true)} style={styles.nudgeBtn}><Text style={styles.nudgeText}>Từ đây {delta>0?'+':''}{delta.toFixed(1)}s</Text></Pressable>)}
    </View>}

    <View onLayout={onCanvasLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        scrollEventThrottle={32}
        onScroll={event=>setScrollX(event.nativeEvent.contentOffset.x)}
        contentContainerStyle={{width}}
        style={styles.timelineScroll}
      >
        <Pressable
          style={[styles.canvas,{width,height:canvasHeight}]}
          onPress={event=>{
            const x=(event.nativeEvent as any).locationX||0;
            onSeek(snap(x/px));
            if(tool==='razor'&&selected)splitSelected(snap(x/px));
            setSnapHint(null);
          }}
        >
          <View {...rulerResponder.panHandlers} style={styles.ruler}>
            {ticks.map(value=><View key={value} style={[styles.tick,{left:value*px}]}><Text style={styles.tickText}>{stamp(value)}</Text></View>)}
          </View>

          <TrackRow
            compact={compact} name="audio" top={audioTop} height={rowHeight('audio')} expanded={expandedTrack==='audio'} state={tracks.audio}
            label="Audio" icon={<Waves size={14}/>} onToggle={()=>setExpandedTrack(current=>current==='audio'?'subtitle':'audio')}
            onUpdate={patch=>updateTrack('audio',patch)}
          >
            {!tracks.audio.hidden&&<View style={[styles.waveformClip,{top:compact?34:26,left:0,width}]}>
              <View style={styles.waveformBars}>
                {(waveform.length?waveform:Array.from({length:80},(_,index)=>(22+((index*17)%52))/100)).map((peak,index)=>{
                  const count=waveform.length||80;
                  const barW=Math.max(1,(width-8)/count-1);
                  return <View key={index} style={[styles.waveformBar,{width:barW,height:Math.max(4,Math.round((waveform.length?Math.max(.08,peak):peak)*36))},!waveform.length&&styles.waveformLoading]}/>;
                })}
              </View>
            </View>}
          </TrackRow>

          <TrackRow
            compact={compact} name="visual" top={visualTop} height={rowHeight('visual')} expanded={expandedTrack==='visual'} state={tracks.visual}
            label="Visual" icon={<Video size={14}/>} onToggle={()=>setExpandedTrack(current=>current==='visual'?'audio':'visual')}
            onUpdate={patch=>updateTrack('visual',patch)}
          >
            {!tracks.visual.hidden&&clips.map((clip,index)=><MovableClip
              key={clip.id} id={clip.id} selected={selected===clip.id} top={compact?34:27}
              start={clip.start} end={clip.end} px={px} duration={safeDuration}
              locked={tracks.visual.locked} tool={tool} snap={snap} color="#161d29" border="#3d485a"
              label={clip.isDefault?'Ảnh bìa · '+clip.name:clip.name}
              thumbnail={clip.type==='image'?clip.uri:undefined} video={clip.type==='video'}
              onSelect={()=>setSelected(clip.id)} onHistory={pushHistory}
              onSplitAt={at=>{onSeek(at);splitSelected(at,clip.id)}}
              onMove={(start,end)=>onClipsChange(clips.map((item,i)=>i===index?{...item,start,end}:item))}
            />)}
          </TrackRow>

          <TrackRow
            compact={compact} name="subtitle" top={subtitleTop} height={rowHeight('subtitle')} expanded={expandedTrack==='subtitle'} state={tracks.subtitle}
            label={'CC Subtitle'} count={subtitles.length} icon={null} onToggle={()=>setExpandedTrack(current=>current==='subtitle'?'audio':'subtitle')}
            onUpdate={patch=>updateTrack('subtitle',patch)}
          >
            {!tracks.subtitle.hidden&&!subtitles.length&&expandedTrack==='subtitle'&&<Text style={[styles.emptySub,{top:compact?41:35}]}>Chưa có cue subtitle được căn thời gian</Text>}
            {!tracks.subtitle.hidden&&subtitles.map((line,index)=><MovableClip
              key={'sub-'+index+'-'+line.text} id={'sub-'+index} selected={selected==='sub-'+index} top={compact?34:27}
              start={line.start} end={line.end} px={px} duration={safeDuration}
              locked={tracks.subtitle.locked} tool={tool} snap={snap} minLength={.08}
              color="#352366" border="#6948b4" label={line.text} subtitle
              onSelect={()=>setSelected('sub-'+index)} onHistory={pushHistory}
              onSplitAt={at=>{onSeek(at);splitSelected(at,'sub-'+index)}}
              onMove={(start,end)=>{
                const origin=line;
                const duration0=Math.max(.01,origin.end-origin.start);
                onSubtitlesChange(subtitles.map((item,i)=>{
                  if(i!==index)return item;
                  return {...item,start,end,words:item.words?.map(word=>{
                    const rs=(word.start-origin.start)/duration0,re=(word.end-origin.start)/duration0;
                    return {...word,start:start+rs*(end-start),end:start+re*(end-start)};
                  })};
                }));
              }}
            />)}
          </TrackRow>

          <TrackRow
            compact={compact} name="effects" top={effectsTop} height={rowHeight('effects')} expanded={expandedTrack==='effects'} state={tracks.effects}
            label="Effects" icon={<Sparkles size={14}/>} onToggle={()=>setExpandedTrack(current=>current==='effects'?'audio':'effects')}
            onUpdate={patch=>updateTrack('effects',patch)}
          >
            {!tracks.effects.hidden&&(effects.length?effects:['Không có effect']).map((effect,index)=><View key={effect+'-'+index} style={[styles.effectClip,{top:compact?36:26,left:index*6,width:Math.max(90,width-index*12)}]}><Text style={styles.effectText}>{effect}</Text></View>)}
          </TrackRow>

          {snapHint!==null&&<View pointerEvents="none" style={[styles.snapGuide,{left:snapHint*px}]}><Text style={styles.snapGuideText}>{stamp(snapHint)}</Text></View>}
          <View pointerEvents="none" style={[styles.playhead,{left:playhead*px}]}><View style={styles.playheadDot}/>{!compact&&<Text style={styles.playheadText}>{stamp(playhead)}</Text>}</View>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

function Tool({active=false,disabled=false,onPress,icon}:{active?:boolean;disabled?:boolean;onPress:()=>void;icon:React.ReactNode}){
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.tool,active&&styles.toolActive,disabled&&styles.disabled]}>{icon}</Pressable>;
}

function TrackRow({compact,name,top,height,expanded,state,label,count,icon,onToggle,onUpdate,children}:{
  compact:boolean;name:TimelineTrackName;top:number;height:number;expanded:boolean;
  state:{hidden:boolean;muted:boolean;locked:boolean};label:string;count?:number;icon:React.ReactNode;
  onToggle:()=>void;onUpdate:(patch:Partial<{hidden:boolean;muted:boolean;locked:boolean}>)=>void;children:React.ReactNode;
}){
  return <View style={[styles.track,{top,height},state.hidden&&styles.trackHidden]}>
    <Pressable onPress={event=>{event.stopPropagation?.();onToggle()}} style={[styles.trackLabel,{top:compact?(expanded?5:8):7}]}>
      {icon}<Text style={styles.trackLabelText}>{label}</Text>
      {count!==undefined&&<View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>}
      <ChevronDown size={10} color="#8895a8" style={{transform:[{rotate:expanded?'180deg':'0deg'}]}}/>
    </Pressable>
    <View style={[styles.trackActions,{top:compact?(expanded?6:9):8}]}>
      <Pressable onPress={event=>{event.stopPropagation?.();onUpdate({hidden:!state.hidden})}} style={styles.trackAction}>{state.hidden?<EyeOff size={11} color="#758196"/>:<Eye size={11} color="#a8b2c1"/>}</Pressable>
      {(name==='audio'||name==='visual')&&<Pressable onPress={event=>{event.stopPropagation?.();onUpdate({muted:!state.muted})}} style={styles.trackAction}>{state.muted?<VolumeX size={11} color="#758196"/>:<Volume2 size={11} color="#a8b2c1"/>}</Pressable>}
      <Pressable onPress={event=>{event.stopPropagation?.();onUpdate({locked:!state.locked})}} style={styles.trackAction}>{state.locked?<Lock size={11} color="#a58aff"/>:<Unlock size={11} color="#a8b2c1"/>}</Pressable>
    </View>
    {children}
  </View>;
}

function MovableClip({
  selected,top,start,end,px,duration,locked,tool,snap,minLength=.25,color,border,label,thumbnail,video,subtitle=false,
  onSelect,onHistory,onSplitAt,onMove,
}:{
  id:string;selected:boolean;top:number;start:number;end:number;px:number;duration:number;locked:boolean;tool:Tool;
  snap:(value:number)=>number;minLength?:number;color:string;border:string;label:string;thumbnail?:string;video?:boolean;subtitle?:boolean;
  onSelect:()=>void;onHistory:()=>void;onSplitAt:(at:number)=>void;onMove:(start:number,end:number)=>void;
}){
  const origin=useRef({start,end});origin.current={start,end};
  const moveResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!locked&&tool==='select',
    onMoveShouldSetPanResponder:(_,gesture)=>!locked&&tool==='select'&&Math.abs(gesture.dx)>3,
    onPanResponderGrant:()=>{onSelect();onHistory()},
    onPanResponderMove:(_,gesture)=>{
      const length=origin.current.end-origin.current.start;
      const rawStart=clamp(origin.current.start+gesture.dx/px,0,Math.max(0,duration-length));
      const rawEnd=rawStart+length;
      const snappedStart=snap(rawStart),snappedEnd=snap(rawEnd);
      const nextStart=Math.abs(snappedEnd-rawEnd)<Math.abs(snappedStart-rawStart)?snappedEnd-length:snappedStart;
      onMove(clamp(nextStart,0,Math.max(0,duration-length)),clamp(nextStart,0,Math.max(0,duration-length))+length);
    },
  }),[locked,tool,px,duration,onSelect,onHistory,onMove,snap]);
  const leftResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!locked&&tool==='select',
    onMoveShouldSetPanResponder:()=>!locked&&tool==='select',
    onPanResponderGrant:()=>{onSelect();onHistory()},
    onPanResponderMove:(_,gesture)=>onMove(clamp(snap(origin.current.start+gesture.dx/px),0,origin.current.end-minLength),origin.current.end),
  }),[locked,tool,px,minLength,onSelect,onHistory,onMove,snap]);
  const rightResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!locked&&tool==='select',
    onMoveShouldSetPanResponder:()=>!locked&&tool==='select',
    onPanResponderGrant:()=>{onSelect();onHistory()},
    onPanResponderMove:(_,gesture)=>onMove(origin.current.start,clamp(snap(origin.current.end+gesture.dx/px),origin.current.start+minLength,duration)),
  }),[locked,tool,px,minLength,duration,onSelect,onHistory,onMove,snap]);

  return <Pressable
    {...moveResponder.panHandlers}
    onPress={event=>{
      event.stopPropagation?.();onSelect();
      if(tool==='razor'){
        const local=(event.nativeEvent as any).locationX||0;
        onSplitAt(snap(start+local/px));
      }
    }}
    style={[
      styles.clip,subtitle&&styles.subtitleClip,selected&&styles.clipSelected,
      {top,left:start*px,width:Math.max(subtitle?20:24,(end-start)*px),backgroundColor:color,borderColor:selected?'#8b5cf6':border},
    ]}
  >
    <View {...leftResponder.panHandlers} style={[styles.edge,selected&&styles.edgeActive]}/>
    {!subtitle&&thumbnail&&<Image source={{uri:thumbnail}} style={styles.clipThumb}/>}
    {!subtitle&&video&&<View style={styles.clipThumb}><Video size={14} color="#cbd5e1"/></View>}
    <Text numberOfLines={1} style={[styles.clipText,subtitle&&styles.subtitleText]}>{label}</Text>
    <View {...rightResponder.panHandlers} style={[styles.edge,styles.edgeRight,selected&&styles.edgeActive]}/>
  </Pressable>;
}

const styles=StyleSheet.create({
  root:{marginTop:18,minWidth:0,borderWidth:1,borderColor:'#202735',borderRadius:14,backgroundColor:'#090d14',overflow:'hidden'},
  rootCompact:{borderRadius:12},
  header:{minHeight:52,borderBottomWidth:1,borderColor:'#202735',paddingHorizontal:14,paddingVertical:9,gap:7},
  headerCompact:{paddingHorizontal:8,paddingVertical:8,gap:6},
  headerTop:{minHeight:32,flexDirection:'row',alignItems:'center',gap:8},
  timelineTitle:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8},
  title:{color:'#f4f6fb',fontSize:11,fontWeight:'800'},
  time:{color:'#727d90',fontSize:9},
  history:{flexDirection:'row',gap:4},
  tools:{gap:4,alignItems:'center'},
  toolsCompact:{width:'100%',justifyContent:'center',paddingTop:1,paddingBottom:1},
  toolDivider:{width:1,height:20,backgroundColor:'#2a3341',marginHorizontal:2},
  tool:{width:32,height:32,borderWidth:1,borderColor:'#313a49',borderRadius:9,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},
  toolActive:{borderColor:'#8b5cf6',backgroundColor:'#2a2050'},
  disabled:{opacity:.35},
  addMedia:{height:32,borderWidth:1,borderColor:'#313a49',borderRadius:9,backgroundColor:'#111722',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:6},
  addMediaCompact:{width:34,paddingHorizontal:0,justifyContent:'center'},
  addMediaText:{color:'#d8deea',fontSize:10},
  zoom:{flexDirection:'row',alignItems:'center',gap:6},
  zoomCompact:{width:'100%',justifyContent:'flex-end'},
  zoomBtn:{width:30,height:30,borderWidth:1,borderColor:'#313a49',borderRadius:8,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},
  zoomBound:{color:'#657185',fontSize:7},
  zoomValue:{minWidth:34,color:'#f1f4f9',fontSize:8,fontWeight:'800',textAlign:'center'},
  zoomTrack:{width:92,height:3,borderRadius:2,backgroundColor:'#2b3341',overflow:'hidden'},
  zoomFill:{height:3,backgroundColor:'#8b5cf6'},
  nudge:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,padding:8,borderBottomWidth:1,borderColor:'rgba(217,70,239,.16)',backgroundColor:'rgba(217,70,239,.05)'},
  nudgeLabel:{color:'#d8dce5',fontSize:9,fontWeight:'800',marginRight:4},
  nudgeBtn:{minHeight:29,borderWidth:1,borderColor:'#3a3248',borderRadius:8,backgroundColor:'#121019',paddingHorizontal:8,alignItems:'center',justifyContent:'center'},
  nudgeText:{color:'#c5bed0',fontSize:8},
  nudgeDivider:{width:1,height:20,backgroundColor:'rgba(148,163,184,.18)',marginHorizontal:2},
  timelineScroll:{backgroundColor:'#070a10'},
  canvas:{position:'relative',backgroundColor:'#070a10'},
  ruler:{position:'absolute',left:0,right:0,top:0,height:30,borderBottomWidth:1,borderColor:'#28303d',backgroundColor:'#090e15',zIndex:5},
  tick:{position:'absolute',top:17,height:13,borderLeftWidth:1,borderColor:'#3b4556'},
  tickText:{position:'absolute',bottom:13,left:4,color:'#8792a5',fontSize:8,width:48},
  track:{position:'absolute',left:0,right:0,borderBottomWidth:1,borderColor:'#171d27',backgroundColor:'rgba(12,17,25,.32)'},
  trackHidden:{opacity:.5},
  trackLabel:{position:'absolute',left:6,zIndex:10,height:24,borderWidth:1,borderColor:'#293240',borderRadius:6,backgroundColor:'rgba(17,23,34,.94)',paddingHorizontal:7,flexDirection:'row',alignItems:'center',gap:5},
  trackLabelText:{color:'#8895a8',fontSize:8,fontWeight:'700'},
  countBadge:{minWidth:17,height:17,borderRadius:9,backgroundColor:'#2b2247',alignItems:'center',justifyContent:'center',paddingHorizontal:4},
  countText:{color:'#bcaeff',fontSize:7,fontWeight:'800'},
  trackActions:{position:'absolute',left:77,zIndex:11,flexDirection:'row',gap:2},
  trackAction:{width:22,height:22,borderRadius:5,backgroundColor:'rgba(16,22,32,.9)',alignItems:'center',justifyContent:'center'},
  waveformClip:{position:'absolute',height:44,borderWidth:1,borderColor:'#244257',borderRadius:7,backgroundColor:'#102432',overflow:'hidden'},
  waveformBars:{height:'100%',paddingHorizontal:4,flexDirection:'row',alignItems:'center',gap:1},
  waveformBar:{borderRadius:99,backgroundColor:'#63d4ff',opacity:.92},
  waveformLoading:{opacity:.2},
  clip:{position:'absolute',height:42,borderWidth:1,borderRadius:7,overflow:'hidden',backgroundColor:'#161d29',flexDirection:'row',alignItems:'center'},
  subtitleClip:{height:36,backgroundColor:'#352366'},
  clipSelected:{shadowColor:'#8b5cf6',shadowOpacity:.25,shadowRadius:10,elevation:3},
  clipThumb:{height:'100%',width:54,flexShrink:0,alignItems:'center',justifyContent:'center',backgroundColor:'#121924'},
  clipText:{flex:1,color:'#e9edf5',fontSize:8,fontWeight:'700',paddingHorizontal:8},
  subtitleText:{paddingHorizontal:12,fontWeight:'500'},
  edge:{position:'absolute',zIndex:12,left:0,top:0,bottom:0,width:9,backgroundColor:'#9d7bff',opacity:.0},
  edgeRight:{left:undefined,right:0},
  edgeActive:{opacity:1},
  emptySub:{position:'absolute',left:150,color:'#667286',fontSize:8},
  effectClip:{position:'absolute',height:30,borderWidth:1,borderColor:'#5d4930',borderRadius:7,backgroundColor:'#372817',paddingHorizontal:10,justifyContent:'center'},
  effectText:{color:'#f3c989',fontSize:8},
  snapGuide:{position:'absolute',zIndex:29,top:30,bottom:0,borderLeftWidth:1,borderStyle:'dashed',borderColor:'#a78bfa'},
  snapGuideText:{position:'absolute',top:2,left:4,borderRadius:4,backgroundColor:'#6d55d7',color:'#fff',paddingHorizontal:4,paddingVertical:2,fontSize:7},
  playhead:{position:'absolute',zIndex:30,top:18,bottom:0,width:1,backgroundColor:'#fff',shadowColor:'#fff',shadowOpacity:.35,shadowRadius:9,elevation:5},
  playheadDot:{width:10,height:10,marginLeft:-5,borderRadius:5,backgroundColor:'#fff'},
  playheadText:{position:'absolute',top:-14,left:6,borderRadius:4,backgroundColor:'#fff',color:'#0a0d12',paddingHorizontal:4,paddingVertical:2,fontSize:7,fontWeight:'700'},
});
