import { cloneElement, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Download, Menu, Music2, Pause, Play, Save, SlidersHorizontal, Sparkles, Subtitles, Upload, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, MediaClip, RenderJob, SavedVisualPreset, Song, StudioSnapshot, TimelineTrackState } from './types';
import { colors, v24 } from './theme';
import { safeFilename, saveExportedAsset, shareTextFile } from './file-actions';
import { exportAudio, exportVisualizer } from './render-engine';
import { useStudioPlayback } from './useStudioPlayback';
import { useSubtitleSync } from './useSubtitleSync';
import { SuggestedBackground } from './SuggestedBackground';
import { findHighlight } from './highlight-engine';
import { DEFAULT_VISUAL_CONFIG, V24StudioControls, applyPresetConfig, recommendPresets, V24_PRESETS, type StudioPanel, type StudioVisualConfig } from './V24StudioControls';
import { UniversalEditorTimeline } from './UniversalEditorTimeline';
import { storage } from './storage';
import { backgroundPresetColors } from './background-presets';
import { parseSubtitleText, toSrt } from './subtitle-files';
import { musicAudioUrl } from './api';

type Tool=StudioPanel|null;

const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const aspectValue=(value:StudioVisualConfig['aspect'])=>{
  const map:Record<StudioVisualConfig['aspect'],number>={'9:16':9/16,'16:9':16/9,'1:1':1,'4:5':4/5,'4:3':4/3};
  return map[value];
};

export function StudioScreen({
  song,compact,onSave,onBack,onRenderJob,initialStudio,
}:{
  song:Song;
  compact:boolean;
  onSave:(snapshot:StudioSnapshot)=>void;
  onBack:()=>void;
  onRenderJob:(job:RenderJob)=>void;
  initialStudio?:StudioSnapshot;
}){
  const {height}=useWindowDimensions();
  const [config,setConfig]=useState<StudioVisualConfig>(initialStudio?.config||{...DEFAULT_VISUAL_CONFIG,trimEnd:song.duration||0});
  const [background,setBackground]=useState<string|undefined>(initialStudio?.background||song.picture);
  const [clips,setClips]=useState<MediaClip[]>(initialStudio?.clips||((initialStudio?.background||song.picture)?[{
    id:'default-cover',
    type:'image',
    uri:initialStudio?.background||song.picture||'',
    name:'Ảnh bìa',
    start:0,
    end:Math.max(1,song.duration||1),
    isDefault:true,
  }]:[]));
  const [trackState,setTrackState]=useState<TimelineTrackState>(initialStudio?.trackState||{
    audio:{hidden:false,muted:false,locked:false},
    visual:{hidden:false,muted:false,locked:false},
    subtitle:{hidden:false,muted:false,locked:false},
    effects:{hidden:false,muted:false,locked:false},
  });
  const {timeline,setTimeline,status:subtitleStatus,message:subtitleMessage,error:subError,regenerating:subLoading,reget}=useSubtitleSync(song,initialStudio?.timeline||[]);
  const [saved,setSaved]=useState(false);
  const [customPresets,setCustomPresets]=useState<SavedVisualPreset[]>([]);
  const [quickMode,setQuickMode]=useState(true);
  const [tool,setTool]=useState<Tool>(null);
  const [rendering,setRendering]=useState(false);
  const [renderProgress,setRenderProgress]=useState(0);
  const [renderStage,setRenderStage]=useState<'idle'|'validation'|'prepare'|'render'|'finalize'>('idle');
  const [renderMessage,setRenderMessage]=useState('');
  const [highlightNotice,setHighlightNotice]=useState('');
  const [downloadBusy,setDownloadBusy]=useState('');
  const playback=useStudioPlayback(song,trackState.audio.muted);
  const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,14)||[],[song.lyrics]);
  const quickPresets=useMemo(()=>recommendPresets(song),[song]);
  const selectedPreset=V24_PRESETS.find(item=>item.id===config.presetId)||V24_PRESETS[0]!;
  const stageHeight=Math.max(420,height-330);
  const seekPercent=playback.duration>0?Math.max(0,Math.min(100,playback.current/playback.duration*100)):0;
  useEffect(()=>{void storage.getVisualPresets().then(setCustomPresets)},[]);

  useEffect(()=>{
    if(playback.duration>0&&config.trimEnd<=0){
      setConfig(prev=>({...prev,trimEnd:playback.duration}));
    }
  },[playback.duration,config.trimEnd]);

  const save=()=>{
    onSave({schemaVersion:1,config,timeline,background,clips,trackState});
    setSaved(true);
    setTimeout(()=>setSaved(false),1500);
  };
  const saveVisualPreset=()=>{
    const preset:SavedVisualPreset={
      id:'custom-'+Date.now().toString(36),
      name:`Mẫu ${customPresets.length+1} · ${song.title}`,
      createdAt:Date.now(),
      config:{...config,effects:[...config.effects]},
    };
    setCustomPresets(current=>{
      const next=[preset,...current].slice(0,30);
      void storage.setVisualPresets(next);
      return next;
    });
  };
  const deleteVisualPreset=(id:string)=>{
    setCustomPresets(current=>{
      const next=current.filter(item=>item.id!==id);
      void storage.setVisualPresets(next);
      return next;
    });
  };

  const applyBackground=(uri:string)=>{
    setBackground(uri);
    setConfig(prev=>({...prev,backgroundMode:'image'}));
    setClips(current=>{
      const duration=Math.max(1,song.duration||1);
      const next=current.filter(clip=>!clip.isDefault);
      return [{id:'default-cover',type:'image',uri,name:'Ảnh bìa',start:0,end:duration,isDefault:true},...next];
    });
  };

  const pickBackground=async()=>{
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9});
    if(result.canceled)return;
    const asset=result.assets[0];
    if(asset?.uri)applyBackground(asset.uri);
  };

  const addTimelineMedia=async()=>{
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9,allowsMultipleSelection:true});
    if(result.canceled||!result.assets.length)return;
    const start=Math.max(0,Math.min(song.duration||0,playback.current));
    const added:MediaClip[]=result.assets.map((asset,index)=>{
      const clipStart=Math.min(Math.max(0,(song.duration||1)-.1),start+index*5);
      return {
        id:'media-'+Date.now().toString(36)+'-'+index,
        type:asset.type==='video'?'video':'image',
        uri:asset.uri,
        name:asset.fileName||('Media '+(index+1)),
        start:clipStart,
        end:Math.min(song.duration||clipStart+5,clipStart+5),
      };
    });
    setClips(current=>[...current,...added]);
    if(!background&&added[0]?.uri)applyBackground(added[0].uri);
  };

  const exportVideo=async(durationSeconds?:number)=>{
    if(rendering)return;
    const jobId='local-'+Date.now().toString(36);
    const started=Date.now();
    setRendering(true);
    setRenderProgress(0);
    setRenderMessage('');
    setRenderStage('validation');
    onRenderJob({id:jobId,title:song.title,progress:0,status:'queued',createdAt:started});
    try{
      await new Promise<void>(resolve=>setTimeout(resolve,40));
      setRenderStage('prepare');
      setRenderProgress(4);
      let startSeconds=config.trimStart;
      let duration=durationSeconds||Math.max(0,(config.trimEnd||song.duration||0)-config.trimStart);
      if(durationSeconds===30){
        setHighlightNotice('Đang phân tích toàn bài để tìm đoạn cao trào…');
        const highlight=await findHighlight(song,timeline,config.trimStart,config.trimEnd||song.duration||0,30);
        startSeconds=highlight.startSeconds;
        duration=Math.max(1,highlight.endSeconds-highlight.startSeconds);
        setHighlightNotice('Đã chọn cao trào '+fmt(highlight.startSeconds)+' – '+fmt(highlight.endSeconds)+' · '+Math.round(highlight.confidence*100)+'% confidence');
      }else{
        setHighlightNotice('');
      }
      setRenderStage('render');
      const asset=await exportVisualizer(song,{
        presetId:config.presetId,
        durationSeconds:duration,
        startSeconds,
        aspect:config.aspect,
        wave:config.wave,
        waveGlow:config.waveGlow,
        waveHeight:config.waveHeight,
        waveColor:config.waveColor,
        waveColor2:config.waveColor2,
        waveThickness:config.waveThickness,
        waveOpacity:config.waveOpacity,
        waveDensity:config.waveDensity,
        waveRotation:config.waveRotation,
        backgroundUri:background,
        backgroundMode:config.backgroundMode,
        backgroundPreset:config.backgroundPreset,
        lyricsMode:config.lyrics,
        timeline,
        mediaClips:clips,
        visualVisible:!trackState.visual.hidden,
        subtitleVisible:!trackState.subtitle.hidden,
        effectsVisible:!trackState.effects.hidden,
        effects:config.effects,
        effectSpeed:config.effectSpeed,
        effectAngle:config.effectAngle,
        effectDensity:config.effectDensity,
        effectSize:config.effectSize,
        audioMuted:trackState.audio.muted,
        eqBass:config.eqBass,
        eqVocal:config.eqVocal,
        eqTreble:config.eqTreble,
        titleColor:config.titleColor,
        creatorColor:config.creatorColor,
        subtitleColor:config.subtitleColor,
        subtitleActiveColor:config.subtitleActiveColor,
        titleScale:config.titleScale,
        creatorScale:config.creatorScale,
        subtitleScale:config.subtitleScale,
        quality:config.quality,
      },progress=>{
        setRenderProgress(progress);
        onRenderJob({id:jobId,title:song.title,progress,status:'rendering',createdAt:started});
      });
      setRenderStage('finalize');
      setRenderProgress(99);
      await saveExportedAsset(asset);
      setRenderProgress(100);
      onRenderJob({id:jobId,title:song.title,progress:100,status:'completed',createdAt:started});
      setRenderMessage('Video ready · đã mở lưu/chia sẻ.');
    }catch(e){
      const message=e instanceof Error?e.message:'Không thể xuất video.';
      onRenderJob({id:jobId,title:song.title,progress:renderProgress,status:'failed',createdAt:started,error:message});
      setRenderMessage(message);
    }finally{
      setRendering(false);
      setRenderStage('idle');
    }
  };

  const downloadAudio=async(format:'m4a'|'mp3'|'wav')=>{
    if(downloadBusy)return;
    setDownloadBusy(format);
    setRenderMessage('');
    try{
      const asset=await exportAudio(song,format);
      await saveExportedAsset(asset);
    }catch(e){
      setRenderMessage(e instanceof Error?e.message:'Không thể xuất audio.');
    }finally{
      setDownloadBusy('');
    }
  };

  const exportSrtText=()=>toSrt(timeline);

  const importSubtitles=async()=>{
    try{
      const result=await DocumentPicker.getDocumentAsync({type:['application/x-subrip','text/vtt','text/plain'],multiple:false,copyToCacheDirectory:true});
      if(result.canceled)return;
      const asset=result.assets[0];if(!asset?.uri)return;
      const response=await fetch(asset.uri);
      const text=await response.text();
      const lines=parseSubtitleText(text);
      if(!lines.length)throw new Error('File không có cue SRT/VTT hợp lệ.');
      setTimeline(lines);
      setRenderMessage('Đã nhập '+lines.length+' cue subtitle.');
    }catch(e){
      setRenderMessage(e instanceof Error?e.message:'Không nhập được subtitle.');
    }
  };

  const downloadText=async(format:'txt'|'srt')=>{
    try{
      const text=format==='srt'?exportSrtText():(song.lyrics||'');
      if(!text.trim())throw new Error(format==='srt'?'Subtitle chưa có timestamp.':'Bài hát chưa có lyrics.');
      await shareTextFile(text,safeFilename(song.title)+'-lyrics.'+format,format==='srt'?'application/x-subrip':'text/plain');
    }catch(e){
      setRenderMessage(e instanceof Error?e.message:'Không thể lưu file lời.');
    }
  };

  const preview=<PreviewStage
    compact={compact}
    song={song}
    config={config}
    background={background}
    selectedPreset={selectedPreset}
    lyricLines={lyricLines}
    timeline={timeline}
    clips={clips}
    trackState={trackState}
    currentTime={playback.current}
    duration={playback.duration}
    seekPercent={seekPercent}
    playing={playback.playing}
    onToggle={playback.toggle}
    onSeek={playback.seekTo}
    desktopHeight={stageHeight}
  />;

  const subtitleBlock=<SubtitleBlock
    compact={compact}
    song={song}
    status={subtitleStatus}
    message={subtitleMessage}
    error={subError}
    busy={subLoading}
    onReget={()=>void reget()}
  />;

  const backgroundBlock=<SuggestedBackground
    song={song}
    aspect={config.aspect}
    selectedUri={background}
    disabled={rendering}
    onApply={applyBackground}
    onBrowse={()=>void pickBackground()}
  />;

  const quickBlock=<QuickCreate
    compact={compact}
    song={song}
    config={config}
    quickPresets={quickPresets}
    rendering={rendering}
    renderProgress={renderProgress}
    renderStage={renderStage}
    renderMessage={renderMessage}
    highlightNotice={highlightNotice}
    onPreset={item=>setConfig(applyPresetConfig(config,item,song.duration||0))}
    onExport={()=>void exportVideo()}
    onHighlight={()=>void exportVideo(30)}
  />;

  const controls=<V24StudioControls
    song={song}
    config={config}
    onChange={setConfig}
    timeline={timeline}
    onTimelineChange={setTimeline}
    onImportSubtitles={()=>void importSubtitles()}
    onExportSubtitles={()=>void downloadText('srt')}
    subtitleLoading={subLoading}
    subtitleError={subError}
    onReget={()=>void reget()}
    onPickBackground={()=>void pickBackground()}
    customPresets={customPresets}
    onSavePreset={saveVisualPreset}
    onDeletePreset={deleteVisualPreset}
    panel={compact&&tool?tool:undefined}
    onPanelChange={panel=>{if(compact)setTool(panel)}}
  />;

  if(compact){
    return <View style={styles.mobileRoot}>
      <ScrollView style={styles.mobileScroll} contentContainerStyle={styles.mobileContent}>
        <View style={styles.mobileTitleBar}>
          <Pressable onPress={onBack} style={styles.mobileBack}><Text style={styles.mobileBackText}>‹</Text></Pressable>
          {song.picture?<Image source={{uri:song.picture}} style={styles.mobileCover}/>:<LocalAudioCover title={song.title} style={styles.mobileCover}/>} 
          <View style={styles.mobileTitleCopy}><Text numberOfLines={1} style={styles.mobileTitle}>{song.title}</Text><Text style={styles.mobileMeta}>{fmt(playback.duration||song.duration)} · Suno song</Text></View>
          <View style={styles.mobileMenu}><Menu size={20} color="#d7dde6"/></View>
        </View>

        {preview}
        {subtitleBlock}
        {backgroundBlock}
        {quickBlock}
        <Pressable onPress={save} style={[styles.mobileSave,saved&&styles.saveDone]}>
          <Save size={16} color={saved?'#8ff0bd':'#c8baff'}/>
          <Text style={[styles.mobileSaveText,saved&&styles.saveTextDone]}>{saved?'Đã lưu dự án':'Lưu dự án'}</Text>
        </Pressable>

        {!!renderMessage&&<Text style={styles.mobileRenderMessage}>{renderMessage}</Text>}
        <Pressable style={[styles.mobileExport,rendering&&styles.disabled]} disabled={rendering} onPress={()=>void exportVideo()}>
          <Upload size={19} color="#fff"/>
          <Text style={styles.mobileExportText}>{rendering?stageLabel(renderStage)+' '+Math.round(renderProgress)+'%':'Create & export video'}</Text>
        </Pressable>
        <View style={{height:108}}/>
      </ScrollView>

      <View style={styles.mobileBottomNav}>
        <ToolButton active={tool==='presets'} icon={<Sparkles size={20}/>} label="Mẫu" onPress={()=>setTool(tool==='presets'?null:'presets')}/>
        <ToolButton active={tool==='style'} icon={<SlidersHorizontal size={20}/>} label="Tùy chỉnh" onPress={()=>setTool(tool==='style'?null:'style')}/>
        <ToolButton active={tool==='lyrics'} icon={<Subtitles size={20}/>} label="Lời" onPress={()=>setTool(tool==='lyrics'?null:'lyrics')}/>
        <ToolButton active={false} icon={<Upload size={20}/>} label="Xuất" onPress={()=>void exportVideo()}/>
      </View>

      {tool&&<View style={styles.mobileSheet}>
        <View style={styles.mobileSheetHead}>
          <View><Text style={styles.mobileSheetKicker}>CREATOR STUDIO</Text><Text style={styles.mobileSheetTitle}>Điều khiển video</Text></View>
          <Pressable onPress={()=>setTool(null)} style={styles.mobileClose}><X size={20} color="#fff"/></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.mobileSheetBody}>
          {controls}
          <View style={styles.mobileDownloads}>
            {(['m4a','mp3','wav'] as const).map(format=><Pressable key={format} disabled={!!downloadBusy} style={styles.mobileDownloadBtn} onPress={()=>void downloadAudio(format)}><Text style={styles.mobileDownloadText}>{downloadBusy===format?'Đang tạo…':format.toUpperCase()}</Text></Pressable>)}
          </View>
          <View style={styles.mobileDownloads}>
            <Pressable style={styles.mobileDownloadBtn} onPress={()=>void downloadText('txt')}><Text style={styles.mobileDownloadText}>LYRICS</Text></Pressable>
            <Pressable style={styles.mobileDownloadBtn} onPress={()=>void downloadText('srt')}><Text style={styles.mobileDownloadText}>SRT</Text></Pressable>
          </View>
        </ScrollView>
      </View>}
    </View>;
  }

  return <View style={styles.root}>
    <View style={styles.desktopCanvasSlot}>
      <ScrollView
        style={[styles.canvasScroll,quickMode&&styles.canvasScrollQuick]}
        contentContainerStyle={[styles.canvasColumn,quickMode&&styles.canvasColumnQuick]}
      >
        {preview}
        {subtitleBlock}
        {backgroundBlock}
        <QuickCreate
          compact={false}
          song={song}
          config={config}
          quickPresets={quickPresets}
          rendering={rendering}
          renderProgress={renderProgress}
          renderStage={renderStage}
          renderMessage={renderMessage}
          highlightNotice={highlightNotice}
          onPreset={item=>setConfig(applyPresetConfig(config,item,playback.duration||song.duration||0))}
          onExport={()=>void exportVideo()}
          onHighlight={()=>void exportVideo(30)}
          onCustomize={()=>setQuickMode(false)}
        />
        {!quickMode&&<UniversalEditorTimeline
          duration={playback.duration||song.duration||0}
          playhead={playback.current}
          onSeek={playback.seekTo}
          subtitles={timeline}
          onSubtitlesChange={setTimeline}
          clips={clips}
          onClipsChange={setClips}
          effects={config.effects}
          trackState={trackState}
          onTrackStateChange={setTrackState}
          onAddMedia={()=>void addTimelineMedia()}
          audioSource={musicAudioUrl(song)}
          trimStart={config.trimStart}
          trimEnd={config.trimEnd||playback.duration||song.duration||0}
          onTrimChange={(trimStart,trimEnd)=>setConfig(prev=>({...prev,trimStart,trimEnd}))}
        />}
      </ScrollView>
    </View>

    {quickMode
      ? <View style={styles.quickDesktopSpacer}/>
      : <ScrollView style={styles.inspector} contentContainerStyle={styles.inspectorContent}>
          <View style={styles.song}>
            {song.picture?<Image source={{uri:song.picture}} style={styles.cover}/>:<LocalAudioCover title={song.title} style={styles.cover}/>} 
            <View style={styles.songCopy}>
              <Text numberOfLines={2} style={styles.songTitle}>{song.title}</Text>
              <Text style={styles.songMeta}>Created by {song.creator||'Suno'}</Text>
              <Text style={styles.songMeta}>{fmt(playback.duration||song.duration)}</Text>
            </View>
          </View>
          <Pressable style={[styles.save,saved&&styles.saveDone]} onPress={save}>
            <Save size={16} color={saved?'#8ff0bd':'#c8baff'}/>
            <Text style={[styles.saveText,saved&&styles.saveTextDone]}>{saved?'Đã lưu dự án':'Lưu dự án'}</Text>
          </Pressable>
          <View style={styles.divider}/>
          {controls}
          <View style={styles.visualSync}><Text style={styles.visualSyncLabel}>UNIVERSAL UI</Text><Text style={styles.visualSyncHash}>WEB · IOS · ANDROID</Text></View>
          <View style={{height:270}}/>
        </ScrollView>}

    {!quickMode&&<View style={styles.actions}>
      {!!renderMessage&&<Text style={styles.renderMessage}>{renderMessage}</Text>}
      <Pressable style={[styles.export,rendering&&styles.disabled]} disabled={rendering} onPress={()=>void exportVideo()}>
        <Upload size={20} color="#fff"/>
        <Text style={styles.exportText}>{rendering?stageLabel(renderStage)+' '+Math.round(renderProgress)+'%':'Export '+fmt(Math.max(0,(config.trimEnd||playback.duration||song.duration||0)-config.trimStart))+' video'}</Text>
      </Pressable>
      <View style={styles.downloads}>
        <Pressable style={styles.downloadBtn} disabled={rendering} onPress={()=>void exportVideo(30)}><Play size={15} color="#cfc5ff"/><Text style={styles.downloadText}>30s</Text></Pressable>
        <Pressable style={styles.downloadBtn} disabled={!!downloadBusy} onPress={()=>void downloadAudio('mp3')}><Download size={15} color="#cfc5ff"/><Text style={styles.downloadText}>{downloadBusy==='mp3'?'…':'MP3'}</Text></Pressable>
        <Pressable style={styles.downloadBtn} disabled={!!downloadBusy} onPress={()=>void downloadAudio('wav')}><Download size={15} color="#cfc5ff"/><Text style={styles.downloadText}>{downloadBusy==='wav'?'…':'WAV'}</Text></Pressable>
        <Pressable style={styles.downloadBtn} disabled={!!downloadBusy} onPress={()=>void downloadAudio('m4a')}><Music2 size={15} color="#cfc5ff"/><Text style={styles.downloadText}>M4A</Text></Pressable>
        <Pressable style={styles.downloadBtn} onPress={()=>void downloadText('txt')}><Subtitles size={15} color="#cfc5ff"/><Text style={styles.downloadText}>Lyrics</Text></Pressable>
        <Pressable style={styles.downloadBtn} onPress={()=>void downloadText('srt')}><Subtitles size={15} color="#cfc5ff"/><Text style={styles.downloadText}>SRT</Text></Pressable>
      </View>
    </View>}
  </View>;
}

function LocalAudioCover({title,style}:{title:string;style:any}){
  return <View style={[style,styles.localCoverWrap]}>
    <LinearGradient colors={['#17112d','#5234b8','#111827']} locations={[0,.52,1]} style={StyleSheet.absoluteFill}/>
    <View style={styles.localCoverOrb}/>
    <Music2 size={24} color="#f5f1ff"/>
    <Text numberOfLines={1} style={styles.localCoverTitle}>{title}</Text>
  </View>;
}

function stageLabel(stage:'idle'|'validation'|'prepare'|'render'|'finalize'){
  if(stage==='validation')return 'Checking';
  if(stage==='prepare')return 'Preparing';
  if(stage==='finalize')return 'Finalizing';
  if(stage==='render')return 'Rendering';
  return 'Ready';
}

function PreviewStage({
  compact,song,config,background,selectedPreset,lyricLines,timeline,clips,trackState,currentTime,duration,seekPercent,playing,onToggle,onSeek,desktopHeight,
}:{
  compact:boolean; song:Song; config:StudioVisualConfig; background?:string; selectedPreset:(typeof V24_PRESETS)[number];
  lyricLines:string[]; timeline:KaraokeLine[]; clips:MediaClip[]; trackState:TimelineTrackState; currentTime:number; duration:number; seekPercent:number;
  playing:boolean; onToggle:()=>void; onSeek:(value:number)=>void; desktopHeight:number;
}){
  const [seekWidth,setSeekWidth]=useState(1);
  const [stageBox,setStageBox]=useState({width:1,height:1});
  const ratio=aspectValue(config.aspect);
  const innerH=Math.max(1,Math.min(stageBox.height,stageBox.width/ratio));
  const innerW=Math.max(1,Math.min(stageBox.width,innerH*ratio));
  const activeClip=[...clips].reverse().find(clip=>currentTime>=clip.start&&currentTime<clip.end);
  const sourceVisual=config.backgroundMode==='suno'?song.picture:config.backgroundMode==='preset'?undefined:background;
  const activeVisual=trackState.visual.hidden?undefined:(activeClip?.type==='image'?activeClip.uri:sourceVisual);
  const presetColors=backgroundPresetColors(config.backgroundPreset);
  const barCount=Math.max(18,Math.round((compact?38:54)*((config.waveDensity??72)/72)));

  return <View>
    <View style={styles.previewHead}>
      <Text style={styles.previewHeadTitle}>Xem trước trực tiếp</Text>
      <Pressable style={styles.previewPause} onPress={onToggle}><Text style={styles.previewPauseText}>{playing?'Tạm dừng':'Phát'}</Text></Pressable>
    </View>
    <View
      style={[styles.stage,compact&&styles.stageCompact,!compact&&{height:desktopHeight}]}
      onLayout={e=>setStageBox({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height})}
    >
      <View style={[styles.visualFrame,{width:innerW,height:innerH}]}>
        {activeVisual?<ImageBackground source={{uri:activeVisual}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<LinearGradient colors={trackState.visual.hidden?['#080c12','#080c12']:[selectedPreset.accent,selectedPreset.secondary]} style={StyleSheet.absoluteFill}/>}
        <LinearGradient colors={['rgba(4,7,11,0)','rgba(4,7,11,.08)','rgba(4,7,11,.72)']} locations={[0,.62,1]} style={StyleSheet.absoluteFill}/>
        {!trackState.visual.hidden&&!activeVisual&&<View style={styles.localAudioVisual}>
          <Music2 size={compact?54:68} color="rgba(255,255,255,.82)"/>
          <Text style={[styles.localAudioTitle,compact&&styles.localAudioTitleCompact]}>{song.title}</Text>
          <Text style={styles.localAudioCreator}>{(song.creator||'Local audio').toUpperCase()}</Text>
        </View>}
        {!trackState.visual.hidden&&<View style={styles.titleOverlay}>
          <Text numberOfLines={2} style={[styles.previewTitle,{color:config.titleColor,fontSize:Math.round(24*((config.titleScale??100)/100))}]}>{song.title}</Text>
          <Text numberOfLines={1} style={[styles.previewCreator,{color:config.creatorColor,fontSize:Math.round(12*((config.creatorScale??100)/100))}]}>{song.creator||'Suno'}</Text>
        </View>}
        {!compact&&!trackState.subtitle.hidden&&config.lyrics!=='off'&&timeline.length>0&&<View style={styles.karaoke}>
          <Text style={[styles.karaokeMain,{color:config.subtitleActiveColor,fontSize:Math.round(29*((config.subtitleScale??100)/100))}]}>{timeline.find(line=>currentTime>=line.start&&currentTime<line.end)?.text||lyricLines[0]}</Text>
          <Text style={[styles.karaokeNext,{color:config.subtitleColor}]}>{timeline.find(line=>line.start>currentTime)?.text||lyricLines[1]||''}</Text>
        </View>}
        {!trackState.visual.hidden&&<View style={[styles.wave,compact&&styles.waveCompact,{opacity:(config.waveOpacity??92)/100,transform:[{rotate:(config.waveRotation??0)+'deg'}]}]}>
          {Array.from({length:barCount}).map((_,i)=><View key={i} style={[styles.bar,{width:Math.max(1,Math.round((config.waveThickness??46)/23)),backgroundColor:i%2?(config.waveColor2||'#60a5fa'):(config.waveColor||'#d946ef'),height:Math.max(4,((compact?6:8)+((i*(compact?13:17))%(compact?31:48)))*((config.waveHeight??108)/108))}]}/>)}
        </View>}
        <Pressable style={[styles.centerPlay,compact&&styles.centerPlayCompact,playing&&styles.centerPlayPlaying]} onPress={onToggle}>
          {playing?<Pause size={compact?22:25} color="#fff" fill="#fff"/>:<Play size={compact?24:27} color="#fff" fill="#fff"/>}
        </Pressable>
      </View>
    </View>

    <View style={[styles.player,compact&&styles.playerCompact]}>
      <Pressable style={styles.playerBtn} onPress={onToggle}>{playing?<Pause size={compact?20:22} color="#61d9ea" fill="#61d9ea"/>:<Play size={compact?21:23} color="#fff" fill="#fff"/>}</Pressable>
      {!compact&&<Text style={styles.playerTime}>{fmt(currentTime)} / {fmt(duration)}</Text>}
      <Pressable
        style={styles.seek}
        onLayout={e=>setSeekWidth(Math.max(1,e.nativeEvent.layout.width))}
        onPress={e=>onSeek(((e.nativeEvent as any).locationX||0)/seekWidth*Math.max(0,duration))}
      >
        <View style={styles.seekTrack}/>
        <View style={[styles.seekFill,{width:(seekPercent+'%') as any}]}/>
        <View style={[styles.seekKnob,{left:(seekPercent+'%') as any}]}/>
      </Pressable>
      {compact&&<Text style={styles.playerTimeCompact}>{fmt(currentTime)} / {fmt(duration)}</Text>}
      <Music2 size={compact?17:19} color="#d7dde7"/>
      {!compact&&<SlidersHorizontal size={18} color="#aeb7c5"/>}
    </View>
    <Text style={styles.previewHint}>Preview dùng audio thật làm clock. Nắm trực tiếp sóng hoặc subtitle trên video để kéo tới vị trí mong muốn.</Text>
  </View>;
}

function SubtitleBlock({
  compact,song,status,message,error,busy,onReget,
}:{
  compact:boolean; song:Song; status:'idle'|'syncing'|'synced'|'fallback'; message:string; error:string; busy:boolean; onReget:()=>void;
}){
  return <View>
    {status!=='idle'&&<View style={[styles.subtitleJob,compact&&styles.subtitleJobCompact,status==='synced'&&styles.subtitleJobSynced,status==='fallback'&&styles.subtitleJobFallback]}>
      {status==='syncing'?<ActivityIndicator size="small" color="#22d3ee"/>:<View style={[styles.subtitleDot,status==='synced'&&styles.subtitleDotSynced]}/>}
      <View style={{flex:1}}>
        <Text style={styles.subtitleJobTitle}>{status==='syncing'?(busy?'Đang lấy lại subtitle…':'Đang tìm subtitle…'):status==='synced'?'Subtitle đã sẵn sàng':'Subtitle cần kiểm tra timing'}</Text>
        <Text style={styles.subtitleJobText}>{status==='syncing'&&!busy?'Bạn vẫn có thể chỉnh sửa trong khi chạy nền.':message}</Text>
        {!!error&&status==='fallback'&&<Text style={styles.subtitleError}>{error}</Text>}
      </View>
    </View>}
    {song.id&&<View style={[styles.subtitleRefresh,compact&&styles.subtitleRefreshCompact]}>
      <Pressable style={styles.subtitleRefreshBtn} disabled={busy||status==='syncing'} onPress={onReget}>
        {busy?<ActivityIndicator size="small" color="#fff"/>:<Sparkles size={15} color="#d9ceff"/>}
        <Text style={styles.subtitleRefreshText}>{busy?'Đang lấy lại…':'Lấy lại subtitle'}</Text>
      </Pressable>
      <Text style={styles.subtitleRefreshHint}>Bỏ cache và tạo subtitle mới từ audio hiện tại.</Text>
    </View>}
  </View>;
}

function QuickCreate({
  compact,song,config,quickPresets,rendering,renderProgress,renderStage,renderMessage,highlightNotice,onPreset,onExport,onHighlight,onCustomize,
}:{
  compact:boolean; song:Song; config:StudioVisualConfig; quickPresets:(typeof V24_PRESETS)[number][]; rendering:boolean; renderProgress:number;
  renderStage:'idle'|'validation'|'prepare'|'render'|'finalize'; renderMessage:string; highlightNotice:string;
  onPreset:(item:(typeof V24_PRESETS)[number])=>void; onExport:()=>void; onHighlight:()=>void; onCustomize?:()=>void;
}){
  const cards=quickPresets.map((item,index)=><Pressable key={item.id} onPress={()=>onPreset(item)} style={[styles.quickPreset,compact&&styles.quickPresetCompact,config.presetId===item.id&&{borderColor:item.accent}]}>
    <View style={[styles.quickPresetArt,compact&&styles.quickPresetArtCompact,{backgroundColor:item.accent+'22'}]}>
      {song.picture&&<Image source={{uri:song.picture}} style={StyleSheet.absoluteFill}/>}
      <View style={styles.quickShade}/>
      <Text style={styles.quickBadge}>{index===0?'ĐỀ XUẤT':item.badge}</Text>
    </View>
    <Text numberOfLines={1} style={styles.quickPresetName}>{item.name}</Text>
    <Text style={styles.quickPresetMeta}>{item.aspect} · {item.lyrics==='off'?'Visualizer':'Lyrics'}</Text>
  </Pressable>);

  return <View style={[styles.quickCreate,compact&&styles.quickCreateCompact]}>
    <View style={styles.quickHead}>
      <View><Text style={styles.quickKicker}>QUICK CREATE</Text><Text style={styles.quickTitle}>{compact?'Tạo nhanh':'Tạo nhanh từ preset phù hợp'}</Text></View>
      {compact?<Text style={styles.quickHint}>Preset phù hợp bài này</Text>:<Pressable style={styles.quickCustomize} onPress={onCustomize}><SlidersHorizontal size={14} color="#cbd3df"/><Text style={styles.quickCustomizeText}>Customize</Text></Pressable>}
    </View>
    {compact
      ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPresetScroll}>{cards}</ScrollView>
      : <View style={styles.quickPresetRow}>{cards}</View>}
    <View style={styles.quickActions}>
      <Pressable disabled={rendering} onPress={onExport} style={[styles.quickAction,styles.quickActionPrimary,rendering&&styles.disabled]}><Upload size={compact?15:16} color="#fff"/><Text style={styles.quickActionPrimaryText}>{rendering?stageLabel(renderStage)+' '+Math.round(renderProgress)+'%':'Create video'}</Text></Pressable>
      <Pressable disabled={rendering} onPress={onHighlight} style={[styles.quickAction,rendering&&styles.disabled]}><Play size={15} color="#cfc5ff"/><Text style={styles.quickActionText}>Tạo 30s cao trào</Text></Pressable>
    </View>
    {!!highlightNotice&&<View style={styles.highlightStatus}><Sparkles size={13} color="#c4b5fd"/><Text style={styles.highlightText}>{highlightNotice}</Text></View>}
    {(rendering||!!renderMessage)&&<View style={[styles.quickStatus,!!renderMessage&&!rendering&&styles.quickStatusDone]}><Text style={styles.quickStatusTitle}>{rendering?(renderStage==='validation'?'Đang kiểm tra video…':renderStage==='prepare'?'Đang chuẩn bị media…':renderStage==='finalize'?'Đang hoàn tất video…':'Đang tạo video…'):'Hoàn tất'}</Text><Text style={styles.quickStatusText}>{rendering?Math.round(renderProgress)+'% · Không đóng ứng dụng trong khi đang xử lý.':renderMessage}</Text></View>}
  </View>;
}

function ToolButton({active,icon,label,onPress}:{active:boolean;icon:ReactElement<any>;label:string;onPress:()=>void}){
  const color=active?'#a98bff':'#c2c9d4';
  return <Pressable style={styles.mobileNavBtn} onPress={onPress}>{cloneElement(icon,{color})}<Text style={[styles.mobileNavText,active&&styles.mobileNavTextActive]}>{label}</Text></Pressable>;
}

const styles=StyleSheet.create({
  root:{flex:1,paddingTop:v24.headerHeight,flexDirection:'row',backgroundColor:'#080c12'},
  desktopCanvasSlot:{flex:1,minWidth:0},
  quickDesktopSpacer:{width:v24.inspectorWidth,backgroundColor:'#080c12'},
  canvasScroll:{flex:1,backgroundColor:'#080c12'},
  canvasScrollQuick:{maxWidth:980,width:'100%',alignSelf:'center'},
  canvasColumn:{padding:18,paddingBottom:50,borderRightWidth:1,borderColor:'#202630'},
  canvasColumnQuick:{borderRightWidth:0},

  previewHead:{height:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  previewHeadTitle:{color:'#eff4fa',fontSize:13,fontWeight:'800'},
  previewPause:{height:30,borderRadius:999,backgroundColor:'#171c25',paddingHorizontal:13,alignItems:'center',justifyContent:'center'},
  previewPauseText:{color:'#d9dee8',fontSize:10,fontWeight:'700'},
  stage:{position:'relative',width:'100%',minHeight:420,borderRadius:7,overflow:'hidden',backgroundColor:'#000',alignItems:'center',justifyContent:'center'},
  stageCompact:{minHeight:0,height:372,borderRadius:8},
  visualFrame:{position:'relative',overflow:'hidden',backgroundColor:'#25165c'},
  localAudioVisual:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',paddingTop:'24%' as any},
  localAudioTitle:{color:'#f1ecff',fontSize:30,fontWeight:'800',marginTop:48,textAlign:'center'},
  localAudioTitleCompact:{fontSize:20,marginTop:34},
  localAudioCreator:{color:'rgba(226,217,255,.72)',fontSize:10,fontWeight:'800',letterSpacing:1,marginTop:8},
  stageRatio:{position:'absolute',right:12,top:12,zIndex:5,borderWidth:1,borderColor:'rgba(255,255,255,.16)',borderRadius:8,backgroundColor:'rgba(7,10,15,.55)',paddingHorizontal:8,paddingVertical:5},
  stageRatioText:{color:'#fff',fontSize:9,fontWeight:'800'},
  titleOverlay:{position:'absolute',zIndex:4,left:'8%',right:'8%',top:'8%',alignItems:'center'},previewTitle:{color:'#fff',fontSize:24,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:10},previewCreator:{color:'#d1d5db',fontSize:12,marginTop:5,textShadowColor:'#000',textShadowRadius:8},
  karaoke:{position:'absolute',zIndex:3,left:'8%',right:'8%',bottom:'8%',alignItems:'center'},
  karaokeMain:{color:'#fff',fontSize:29,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:8},
  karaokeNext:{color:'#e1e3e7',fontSize:21,marginTop:8,textAlign:'center',textShadowColor:'#000',textShadowRadius:8},
  wave:{position:'absolute',zIndex:3,left:25,right:25,bottom:22,height:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between',opacity:.82},
  waveCompact:{left:18,right:18,bottom:58,height:28},
  bar:{width:3,borderRadius:3,backgroundColor:'#a47cff'},
  centerPlay:{position:'absolute',zIndex:35,left:'50%',top:'50%',marginLeft:-32,marginTop:-32,width:64,height:64,borderWidth:1,borderColor:'rgba(255,255,255,.45)',borderRadius:32,backgroundColor:'rgba(8,11,18,.72)',alignItems:'center',justifyContent:'center'},
  centerPlayCompact:{marginLeft:-28,marginTop:-28,width:56,height:56,borderRadius:28},
  centerPlayPlaying:{opacity:.18},
  player:{height:72,flexDirection:'row',alignItems:'center',gap:12,borderBottomLeftRadius:7,borderBottomRightRadius:7,backgroundColor:'#0d1219',paddingHorizontal:22},
  playerCompact:{height:50,marginTop:-64,marginHorizontal:13,zIndex:6,backgroundColor:'transparent',paddingHorizontal:4},
  playerBtn:{width:34,alignItems:'center'},
  playerTime:{width:105,color:'#c6ccd6',fontSize:12},
  playerTimeCompact:{width:67,color:'#fff',fontSize:9},
  seek:{flex:1,height:14,justifyContent:'center',position:'relative'},
  seekTrack:{position:'absolute',left:0,right:0,height:4,borderRadius:99,backgroundColor:'#6e7074'},
  seekFill:{position:'absolute',left:0,height:4,borderRadius:99,backgroundColor:'#55d9e8'},
  seekKnob:{position:'absolute',top:1,width:12,height:12,marginLeft:-6,borderRadius:6,backgroundColor:'#55d9e8'},
  previewHint:{color:'#4f5867',fontSize:8,marginTop:6},

  subtitleJob:{minHeight:48,marginTop:10,borderWidth:1,borderColor:'rgba(34,211,238,.2)',borderRadius:12,backgroundColor:'rgba(8,18,27,.92)',paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:11},
  subtitleJobCompact:{marginTop:18},
  subtitleJobSynced:{borderColor:'rgba(74,222,128,.2)',backgroundColor:'rgba(10,28,21,.82)'},
  subtitleJobFallback:{borderColor:'rgba(245,158,11,.24)',backgroundColor:'rgba(35,24,8,.76)'},
  subtitleDot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:'#f59e0b'},
  subtitleDotSynced:{borderWidth:0,backgroundColor:'#22c55e'},
  subtitleJobTitle:{color:'#e6faff',fontSize:10,fontWeight:'800'},
  subtitleJobText:{color:'#8292a6',fontSize:9,marginTop:3,lineHeight:13},
  subtitleError:{color:'#c99574',fontSize:8,marginTop:3},
  subtitleRefresh:{minHeight:46,marginTop:10,flexDirection:'row',alignItems:'center',gap:10},
  subtitleRefreshCompact:{flexWrap:'wrap'},
  subtitleRefreshBtn:{height:34,borderWidth:1,borderColor:'#5b438f',borderRadius:8,backgroundColor:'#211a3b',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7},
  subtitleRefreshText:{color:'#d9ceff',fontSize:10,fontWeight:'700'},
  subtitleRefreshHint:{color:'#778395',fontSize:9,flexShrink:1},

  quickCreate:{marginTop:10,borderWidth:1,borderColor:'#27303d',borderRadius:14,backgroundColor:'#0d131c',padding:12},
  quickCreateCompact:{borderRadius:12,padding:10},
  quickHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},
  quickKicker:{color:'#8d72ff',fontSize:8,fontWeight:'900',letterSpacing:1.3},
  quickTitle:{color:'#f3f5f9',fontSize:12,fontWeight:'800',marginTop:4},
  quickHint:{color:'#727e90',fontSize:8,textAlign:'right'},
  quickCustomize:{height:34,borderWidth:1,borderColor:'#303a49',borderRadius:10,backgroundColor:'#121925',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:6},
  quickCustomizeText:{color:'#cbd3df',fontSize:10},
  quickPresetRow:{flexDirection:'row',gap:8,marginTop:11},
  quickPresetScroll:{gap:8,paddingTop:10,paddingBottom:2},
  quickPreset:{flex:1,overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:10,backgroundColor:'#0b1017'},
  quickPresetCompact:{width:145,flex:0},
  quickPresetArt:{height:66,overflow:'hidden',position:'relative'},
  quickPresetArtCompact:{height:70},
  quickShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},
  quickBadge:{position:'absolute',left:7,top:7,color:'#eee8ff',fontSize:7,fontWeight:'900'},
  quickPresetName:{color:'#f5f7fb',fontSize:9,fontWeight:'800',paddingHorizontal:8,paddingTop:7},
  quickPresetMeta:{color:'#727e90',fontSize:7,paddingHorizontal:8,paddingTop:3,paddingBottom:8},
  quickActions:{flexDirection:'row',gap:8,marginTop:10},
  quickAction:{flex:1,minHeight:42,borderWidth:1,borderColor:'#5b49ba',borderRadius:9,backgroundColor:'rgba(112,85,225,.12)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  quickActionPrimary:{backgroundColor:'#7058ed'},
  quickActionText:{color:'#cfc5ff',fontSize:10,fontWeight:'800'},
  quickActionPrimaryText:{color:'#fff',fontSize:10,fontWeight:'800'},
  highlightStatus:{marginTop:8,minHeight:34,borderRadius:8,backgroundColor:'rgba(139,92,246,.08)',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:7},
  highlightText:{flex:1,color:'#bcb2d4',fontSize:8,lineHeight:12},
  quickStatus:{marginTop:9,borderWidth:1,borderColor:'rgba(139,92,246,.24)',borderRadius:9,backgroundColor:'rgba(55,42,92,.34)',padding:9},
  quickStatusDone:{borderColor:'rgba(74,222,128,.18)',backgroundColor:'rgba(15,65,45,.25)'},
  quickStatusTitle:{color:'#eee9ff',fontSize:9,fontWeight:'800'},
  quickStatusText:{color:'#8793a4',fontSize:8,marginTop:3},

  inspector:{width:v24.inspectorWidth,backgroundColor:'#0a0e14'},
  inspectorContent:{paddingTop:30,paddingHorizontal:25,paddingBottom:80},
  song:{flexDirection:'row',gap:20,alignItems:'center'},
  cover:{width:125,height:125,borderWidth:1,borderColor:'#394352',borderRadius:9,backgroundColor:'#151c26'},
  coverEmpty:{alignItems:'center',justifyContent:'center'},
  localCoverWrap:{position:'relative',overflow:'hidden',alignItems:'center',justifyContent:'center'},
  localCoverOrb:{position:'absolute',right:-11,top:-10,width:46,height:46,borderRadius:23,backgroundColor:'rgba(255,255,255,.12)'},
  localCoverTitle:{position:'absolute',left:5,right:5,bottom:5,color:'rgba(255,255,255,.78)',fontSize:6,fontWeight:'800',textAlign:'center'},
  songCopy:{flex:1,minWidth:0},
  songTitle:{color:'#f5f7fb',fontSize:25,fontWeight:'700',marginBottom:5},
  songMeta:{color:'#9ba5b5',fontSize:12,marginTop:8},
  save:{width:'100%',height:42,marginTop:12,borderWidth:1,borderColor:'#7355dc',borderRadius:10,backgroundColor:'#241d45',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  saveDone:{borderColor:'#38c784',backgroundColor:'#143528'},
  saveText:{color:'#c8baff',fontSize:12,fontWeight:'700'},
  saveTextDone:{color:'#8ff0bd'},
  divider:{height:1,backgroundColor:'#252b34',marginVertical:30},
  visualSync:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8,borderWidth:1,borderColor:'rgba(74,222,128,.18)',borderRadius:9,backgroundColor:'rgba(34,197,94,.07)',paddingHorizontal:9,paddingVertical:7},
  visualSyncLabel:{color:'#9ca3af',fontSize:9,fontWeight:'700',letterSpacing:.4},
  visualSyncHash:{color:'#86efac',fontSize:9,fontWeight:'700'},

  actions:{position:'absolute',right:0,bottom:0,zIndex:26,width:v24.inspectorWidth,borderTopWidth:1,borderColor:'#29313e',backgroundColor:'#0a0e14',paddingTop:14,paddingHorizontal:25,paddingBottom:18},
  renderMessage:{color:'#c7bedf',fontSize:9,lineHeight:14,marginBottom:8},
  disabled:{opacity:.55},
  export:{height:58,borderRadius:9,backgroundColor:'#7057f8',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},
  exportText:{color:'#fff',fontSize:13,fontWeight:'700'},
  downloads:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:9},
  downloadBtn:{flex:1,minHeight:42,borderWidth:1,borderColor:'#6f57dd',borderRadius:8,backgroundColor:'rgba(114,83,230,.15)',alignItems:'center',justifyContent:'center',gap:4},
  downloadText:{color:'#cfc5ff',fontSize:9,textAlign:'center'},

  editorTimeline:{marginTop:18,borderWidth:1,borderColor:'#202735',borderRadius:14,backgroundColor:'#090d14',overflow:'hidden'},
  editorTimelineCompact:{marginTop:12},
  timelineHead:{height:52,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,borderBottomWidth:1,borderColor:'#202735'},
  timelineHeadTitle:{color:'#f4f6fb',fontSize:12,fontWeight:'800'},
  timelineHeadSub:{flex:1,color:'#727d90',fontSize:11},
  timelineIcon:{width:32,height:32,borderWidth:1,borderColor:'#313a49',borderRadius:9,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},
  timelineCanvas:{height:205,paddingTop:30,position:'relative',backgroundColor:'#070a10'},
  timelineCanvasCompact:{height:180},
  ruler:{position:'absolute',left:0,right:0,top:0,height:30,flexDirection:'row',borderBottomWidth:1,borderColor:'#28303d'},
  rulerText:{color:'#8792a5',fontSize:10,marginLeft:4,marginTop:3},
  rulerTick:{height:13,borderLeftWidth:1,borderColor:'#3b4556',marginTop:4},
  trackRow:{height:76,borderBottomWidth:1,borderColor:'#171d27',paddingTop:7,position:'relative'},
  trackLabel:{position:'absolute',left:6,top:5,zIndex:8,color:'#818da1',fontSize:9,backgroundColor:'rgba(17,23,34,.85)',paddingHorizontal:6,paddingVertical:3,borderRadius:5},
  videoClip:{position:'absolute',left:'7%',right:'4%',top:31,height:46,borderWidth:1,borderColor:'#3d485a',borderRadius:5,overflow:'hidden',backgroundColor:'#161d29',flexDirection:'row'},
  clipThumb:{width:54,height:46,borderRightWidth:1,borderColor:'#2a3240'},
  clipTitle:{position:'absolute',left:60,top:16,right:8,color:'#e9edf5',fontSize:10,fontWeight:'700'},
  subClip:{position:'absolute',left:'12%',right:'18%',top:32,height:38,borderWidth:1,borderColor:'#6948b4',borderRadius:5,backgroundColor:'#352366',justifyContent:'center',paddingHorizontal:12},
  subClipText:{color:'#e9e0ff',fontSize:10},
  playhead:{position:'absolute',zIndex:12,left:'27%',top:18,bottom:0,width:1,backgroundColor:'#fff'},
  playheadDot:{width:9,height:9,marginLeft:-4,borderRadius:5,backgroundColor:'#fff'},

  mobileRoot:{flex:1,backgroundColor:'#080c12'},
  mobileScroll:{flex:1},
  mobileContent:{paddingHorizontal:18,paddingBottom:145},
  mobileTitleBar:{height:110,flexDirection:'row',alignItems:'flex-end',gap:13,paddingBottom:14},
  mobileBack:{width:30,alignItems:'flex-start',justifyContent:'center'},
  mobileBackText:{color:'#fff',fontSize:38,lineHeight:42},
  mobileCover:{width:62,height:62,borderRadius:8,backgroundColor:'#151c26'},
  mobileTitleCopy:{flex:1,paddingBottom:6,gap:7},
  mobileTitle:{color:'#f5f7fb',fontSize:14,fontWeight:'700'},
  mobileMeta:{color:'#8f98a8',fontSize:12},
  mobileMenu:{width:25,alignSelf:'center',marginTop:34},
  mobileSave:{height:42,marginTop:12,borderWidth:1,borderColor:'#7355dc',borderRadius:10,backgroundColor:'#241d45',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  mobileSaveText:{color:'#c8baff',fontSize:11,fontWeight:'700'},
  mobileRenderMessage:{color:'#c9bfdf',fontSize:10,lineHeight:16,marginTop:13},
  mobileExport:{height:58,marginTop:16,borderRadius:14,backgroundColor:'#7359f6',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  mobileExportText:{color:'#fff',fontSize:13,fontWeight:'700'},
  mobileBottomNav:{position:'absolute',zIndex:20,left:0,right:0,bottom:0,height:80,borderTopWidth:1,borderColor:'#242a34',backgroundColor:'#0c1118',flexDirection:'row'},
  mobileNavBtn:{flex:1,alignItems:'center',justifyContent:'center',gap:5},
  mobileNavText:{color:'#c2c9d4',fontSize:10},
  mobileNavTextActive:{color:'#a98bff'},
  mobileSheet:{position:'absolute',zIndex:80,left:0,right:0,bottom:0,maxHeight:'74%',borderTopLeftRadius:22,borderTopRightRadius:22,borderWidth:1,borderColor:'#303744',backgroundColor:'#0e141d',paddingHorizontal:16,paddingTop:8,paddingBottom:92},
  mobileSheetHead:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  mobileSheetKicker:{color:'#8d72ff',fontSize:8,fontWeight:'800',letterSpacing:1.5},
  mobileSheetTitle:{color:'#fff',fontSize:15,fontWeight:'800',marginTop:3},
  mobileClose:{width:36,height:36,borderWidth:1,borderColor:'#343b47',borderRadius:10,backgroundColor:'#141923',alignItems:'center',justifyContent:'center'},
  mobileSheetBody:{paddingBottom:30},
  mobileDownloads:{flexDirection:'row',gap:8,marginTop:16},
  mobileDownloadBtn:{flex:1,height:42,borderWidth:1,borderColor:'#684fd2',borderRadius:9,backgroundColor:'rgba(112,85,225,.15)',alignItems:'center',justifyContent:'center'},
  mobileDownloadText:{color:'#cfc5ff',fontSize:10,fontWeight:'800'},
});
