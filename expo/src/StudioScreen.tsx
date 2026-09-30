import { cloneElement, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, ImageBackground, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Download, Menu, Music2, Pause, Play, Save, SlidersHorizontal, Sparkles, Subtitles, Upload, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
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
import { extractWaveform } from './waveform-engine';
import { V23SceneThumb } from './V23SceneThumb';

type Tool=StudioPanel|null;

const V23_LOCAL_AUDIO_COVER='v23-local-audio-cover:';
const localAudioCoverUri=(title:string)=>V23_LOCAL_AUDIO_COVER+encodeURIComponent(title);
const isLocalAudioCoverUri=(uri?:string)=>Boolean(uri?.startsWith(V23_LOCAL_AUDIO_COVER));

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
  const defaultVisualUri=initialStudio?.background||song.picture||(song.creator==='Local audio'?localAudioCoverUri(song.title):undefined);
  const [clips,setClips]=useState<MediaClip[]>(initialStudio?.clips||(defaultVisualUri?[{
    id:'default-cover',
    type:'image',
    uri:defaultVisualUri,
    name:song.creator==='Local audio'?song.title:'Ảnh bìa',
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
  const [focusTimeline,setFocusTimeline]=useState(false);
  const mobileScrollRef=useRef<ScrollView|null>(null);
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
  const openMobileTimeline=()=>{
    setTool(null);
    setQuickMode(false);
    setFocusTimeline(true);
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
        masteringProfile:config.masteringProfile,
        masterTargetLufs:config.masterTargetLufs,
        masterCeilingDb:config.masterCeilingDb,
        masterThresholdDb:config.masterThresholdDb,
        masterRatio:config.masterRatio,
        masterAttackMs:config.masterAttackMs,
        masterReleaseMs:config.masterReleaseMs,
        masterDrive:config.masterDrive,
        masterEqBands:config.masterEqBands,
        spatialEnabled:config.spatialEnabled,
        spatialMode:config.spatialMode,
        spatialAmount:config.spatialAmount,
        titleColor:config.titleColor,
        creatorColor:config.creatorColor,
        subtitleColor:config.subtitleColor,
        subtitleActiveColor:config.subtitleActiveColor,
        titleScale:config.titleScale,
        creatorScale:config.creatorScale,
        subtitleScale:config.subtitleScale,
        titleX:config.titleX,
        titleY:config.titleY,
        creatorX:config.creatorX,
        creatorY:config.creatorY,
        subtitleX:config.subtitleX,
        subtitleY:config.subtitleY,
        waveX:config.waveX,
        waveY:config.waveY,
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
    onSeek={value=>{playback.pause();playback.seekTo(value)}}
    desktopHeight={stageHeight}
    editable={!rendering}
    onConfigChange={setConfig}
    onEditOverlay={key=>{
      setQuickMode(false);
      setTool(key==='wave'?'wave':key==='subtitle'?'lyrics':'text');
    }}
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
    onCustomize={compact?openMobileTimeline:()=>setQuickMode(false)}
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
    panel={tool||undefined}
    onPanelChange={setTool}
  />;

  if(compact){
    return <View style={styles.mobileRoot}>
      <ScrollView ref={mobileScrollRef} style={styles.mobileScroll} contentContainerStyle={styles.mobileContent}>
        <View style={styles.mobileTitleBar}>
          <Pressable onPress={onBack} style={styles.mobileBack}><Text style={styles.mobileBackText}>‹</Text></Pressable>
          {song.picture?<Image source={{uri:song.picture}} style={styles.mobileCover}/>:<LocalAudioCover title={song.title} style={styles.mobileCover}/>} 
          <View style={styles.mobileTitleCopy}><Text numberOfLines={1} style={styles.mobileTitle}>{song.title}</Text><Text style={styles.mobileMeta}>{fmt(playback.duration||song.duration)} · Suno song</Text></View>
          <View style={styles.mobileMenu}><Menu size={20} color="#d7dde6"/></View>
        </View>

        {preview}
        {subtitleBlock}
        {backgroundBlock}
        {quickMode&&quickBlock}
        {!quickMode&&<View
          onLayout={event=>{
            if(!focusTimeline)return;
            mobileScrollRef.current?.scrollTo({y:Math.max(0,event.nativeEvent.layout.y-10),animated:true});
            setFocusTimeline(false);
          }}
        >
          <UniversalEditorTimeline
            compact
            duration={playback.duration||song.duration||0}
            playhead={playback.current}
            onSeek={value=>{playback.pause();playback.seekTo(value)}}
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
          />
        </View>}
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
        {quickMode&&<QuickCreate
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
        />}
        {!quickMode&&<UniversalEditorTimeline
          duration={playback.duration||song.duration||0}
          playhead={playback.current}
          onSeek={value=>{playback.pause();playback.seekTo(value)}}
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
  compact,song,config,background,selectedPreset,lyricLines,timeline,clips,trackState,currentTime,duration,seekPercent,playing,onToggle,onSeek,desktopHeight,editable,onConfigChange,
}:{
  compact:boolean; song:Song; config:StudioVisualConfig; background?:string; selectedPreset:(typeof V24_PRESETS)[number];
  lyricLines:string[]; timeline:KaraokeLine[]; clips:MediaClip[]; trackState:TimelineTrackState; currentTime:number; duration:number; seekPercent:number;
  playing:boolean; onToggle:()=>void; onSeek:(value:number)=>void; desktopHeight:number; editable:boolean;
  onConfigChange:(next:StudioVisualConfig)=>void; onEditOverlay:(key:'title'|'creator'|'subtitle'|'wave')=>void;
}){
  type OverlayKey='title'|'creator'|'subtitle'|'wave';
  const [seekWidth,setSeekWidth]=useState(1);
  const [stageBox,setStageBox]=useState({width:1,height:1});
  const [selectedOverlay,setSelectedOverlay]=useState<OverlayKey|null>(null);
  const [waveform,setWaveform]=useState<number[]>([]);
  const dragOrigin=useRef({x:50,y:50});
  const ratio=aspectValue(config.aspect);
  const innerH=Math.max(1,Math.min(stageBox.height,stageBox.width/ratio));
  const innerW=Math.max(1,Math.min(stageBox.width,innerH*ratio));
  const activeClip=[...clips].reverse().find(clip=>currentTime>=clip.start&&currentTime<clip.end);
  const sourceVisual=config.backgroundMode==='suno'?song.picture:config.backgroundMode==='preset'?undefined:background;
  const activeClipVisual=activeClip?.type==='image'&&!isLocalAudioCoverUri(activeClip.uri)?activeClip.uri:undefined;
  const activeVisual=trackState.visual.hidden?undefined:(activeClipVisual||sourceVisual);
  const presetColors=backgroundPresetColors(config.backgroundPreset);
  const frameColors=config.backgroundMode==='preset'?[...presetColors]:[selectedPreset.accent,selectedPreset.secondary];
  const titleX=config.titleX??50,titleY=config.titleY??67;
  const creatorX=config.creatorX??50,creatorY=config.creatorY??75;
  const subtitleX=config.subtitleX??50,subtitleY=config.subtitleY??58;
  const waveX=config.waveX??50,waveY=config.waveY??86;
  const clampPct=(value:number)=>Math.max(0,Math.min(100,value));

  useEffect(()=>{
    let cancelled=false;
    void extractWaveform(musicAudioUrl(song),320)
      .then(values=>{if(!cancelled)setWaveform(values)})
      .catch(()=>{if(!cancelled)setWaveform([])});
    return()=>{cancelled=true};
  },[song.audio,song.id]);

  const buildResponder=(key:OverlayKey,xKey:'titleX'|'creatorX'|'subtitleX'|'waveX',yKey:'titleY'|'creatorY'|'subtitleY'|'waveY',x:number,y:number)=>PanResponder.create({
    onStartShouldSetPanResponder:()=>editable,
    onMoveShouldSetPanResponder:(_,gesture)=>editable&&(Math.abs(gesture.dx)>2||Math.abs(gesture.dy)>2),
    onPanResponderGrant:()=>{setSelectedOverlay(key);dragOrigin.current={x,y}},
    onPanResponderMove:(_,gesture)=>{
      if(!editable)return;
      const nextX=clampPct(dragOrigin.current.x+gesture.dx/Math.max(1,innerW)*100);
      const nextY=clampPct(dragOrigin.current.y+gesture.dy/Math.max(1,innerH)*100);
      onConfigChange({...config,[xKey]:nextX,[yKey]:nextY});
    },
    onPanResponderTerminationRequest:()=>false,
  });
  const titleResponder=useMemo(()=>buildResponder('title','titleX','titleY',titleX,titleY),[editable,innerW,innerH,titleX,titleY,config]);
  const creatorResponder=useMemo(()=>buildResponder('creator','creatorX','creatorY',creatorX,creatorY),[editable,innerW,innerH,creatorX,creatorY,config]);
  const subtitleResponder=useMemo(()=>buildResponder('subtitle','subtitleX','subtitleY',subtitleX,subtitleY),[editable,innerW,innerH,subtitleX,subtitleY,config]);
  const waveResponder=useMemo(()=>buildResponder('wave','waveX','waveY',waveX,waveY),[editable,innerW,innerH,waveX,waveY,config]);
  const editStyle=(key:OverlayKey)=>editable&&selectedOverlay===key?styles.overlaySelected:undefined;
  const activeLine=timeline.find(line=>currentTime>=line.start&&currentTime<line.end)?.text||lyricLines[0]||'';
  const nextLine=timeline.find(line=>line.start>currentTime)?.text||lyricLines[1]||'';

  return <View>
    <View style={styles.previewHead}>
      <Text style={styles.previewHeadTitle}>Xem trước trực tiếp</Text>
      <Pressable style={styles.previewPause} onPress={onToggle}><Text style={styles.previewPauseText}>{playing?'Tạm dừng':'Phát preview'}</Text></Pressable>
    </View>

    <View
      style={[styles.stage,compact&&styles.stageCompact,!compact&&{height:desktopHeight}]}
      onLayout={e=>setStageBox({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height})}
    >
      <View style={[styles.visualFrame,{width:innerW,height:innerH}]}>
        {activeVisual
          ? <ImageBackground
              source={{uri:activeVisual}}
              resizeMode="cover"
              blurRadius={Math.max(0,config.backgroundBlur??0)}
              style={StyleSheet.absoluteFill}
              imageStyle={{opacity:config.template==='cover-motion'?.96:config.template==='lyrics-focus'?.42:.56}}
            />
          : song.creator==='Local audio'
            ? <V23LocalAudioCover title={song.title}/>
            : <LinearGradient colors={trackState.visual.hidden?['#080c12','#080c12']:(frameColors as any)} style={StyleSheet.absoluteFill}/>}
        <View style={[StyleSheet.absoluteFill,{backgroundColor:`rgba(0,0,0,${Math.max(0,Math.min(70,config.backgroundDim??0))/100})`}]}/>
        <View style={[StyleSheet.absoluteFill,{backgroundColor:config.template==='cover-motion'?'rgba(3,4,12,.15)':config.template==='editorial'?'rgba(7,8,14,.50)':'rgba(3,4,12,.43)',opacity:1-Math.max(0,Math.min(60,config.backgroundOverlayOpacity??0))/180}]}/>

        {!trackState.visual.hidden&&<V23TemplateLayer template={config.template} visual={activeVisual||song.picture} song={song} currentTime={currentTime} accent={selectedPreset.accent} secondary={selectedPreset.secondary}/>}

        {!trackState.visual.hidden&&<Pressable
          {...titleResponder.panHandlers}
          onPress={event=>{event.stopPropagation?.();setSelectedOverlay('title')}}
          style={[styles.titleOverlay,editStyle('title'),{top:(titleY+'%') as any,transform:[{translateX:(titleX-50)*innerW/100},{translateY:-12}]}]}
        >
          <Text numberOfLines={2} style={[styles.previewTitle,{
            color:config.titleColor,
            fontFamily:config.titleFont||'Georgia',
            fontSize:Math.round((compact?18:24)*((config.titleScale??100)/100)),
          }]}>{song.title}</Text>
        </Pressable>}

        {!trackState.visual.hidden&&<Pressable
          {...creatorResponder.panHandlers}
          onPress={event=>{event.stopPropagation?.();setSelectedOverlay('creator')}}
          style={[styles.creatorOverlay,editStyle('creator'),{top:(creatorY+'%') as any,transform:[{translateX:(creatorX-50)*innerW/100},{translateY:-7}]}]}
        >
          <Text numberOfLines={1} style={[styles.previewCreator,{
            color:config.creatorColor,
            fontSize:Math.round((compact?9:12)*((config.creatorScale??100)/100)),
          }]}>{song.creator||'Suno'}</Text>
        </Pressable>}

        {!trackState.subtitle.hidden&&config.lyrics!=='off'&&!!activeLine&&<Pressable
          {...subtitleResponder.panHandlers}
          onPress={event=>{event.stopPropagation?.();setSelectedOverlay('subtitle')}}
          style={[styles.karaoke,editStyle('subtitle'),{top:(subtitleY+'%') as any,transform:[{translateX:(subtitleX-50)*innerW/100},{translateY:-15}]}]}
        >
          <View style={[styles.karaokeFocus,config.lyrics==='scroll'&&styles.karaokeFocusClear]}>
            <Text style={[styles.karaokeMain,{color:config.subtitleActiveColor,fontSize:Math.round((compact?16:22)*((config.subtitleScale??100)/100))}]}>{activeLine}</Text>
            {config.lyrics==='scroll'&&!!nextLine&&<Text style={[styles.karaokeNext,{color:config.subtitleColor}]}>{nextLine}</Text>}
          </View>
        </Pressable>}

        {!trackState.visual.hidden&&<Pressable
          {...waveResponder.panHandlers}
          onPress={event=>{event.stopPropagation?.();setSelectedOverlay('wave')}}
          style={[styles.waveV23,editStyle('wave'),{
            top:(waveY+'%') as any,
            opacity:(config.waveOpacity??94)/100,
            transform:[
              {translateX:(waveX-50)*innerW/100},
              {translateY:-Math.max(24,innerH*.075)},
              {scale:(config.waveScale??100)/100},
              {rotate:(config.waveRotation??0)+'deg'},
            ],
          }]}
        >
          <V23Waveform
            styleName={config.wave}
            values={waveform}
            currentTime={currentTime}
            duration={Math.max(1,duration||song.duration||1)}
            color={config.waveColor||'#8b5cf6'}
            color2={config.waveColor2||'#22d3ee'}
            density={config.waveDensity??72}
            thickness={config.waveThickness??54}
            height={config.waveHeight??78}
          />
        </Pressable>}

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

function V23LocalAudioCover({title}:{title:string}){
  const label=title.length>28?title.slice(0,27)+'…':title;
  return <Svg viewBox="0 0 1200 1200" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <SvgLinearGradient id="v23-local-cover" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#17112d"/>
        <Stop offset=".52" stopColor="#5234b8"/>
        <Stop offset="1" stopColor="#111827"/>
      </SvgLinearGradient>
    </Defs>
    <Rect x="0" y="0" width="1200" height="1200" fill="url(#v23-local-cover)"/>
    <Circle cx="920" cy="220" r="280" fill="rgba(255,255,255,.12)"/>
    <SvgText x="600" y="570" fill="#ffffff" fontSize="210" fontWeight="700" textAnchor="middle">♫</SvgText>
    <SvgText x="600" y="760" fill="#ffffff" fontSize="58" fontWeight="700" textAnchor="middle">{label}</SvgText>
    <SvgText x="600" y="825" fill="rgba(255,255,255,.62)" fontSize="25" fontWeight="600" textAnchor="middle">SUNODOWN · LOCAL AUDIO</SvgText>
  </Svg>;
}

function V23TemplateLayer({template,visual,song,currentTime,accent,secondary}:{template:string;visual?:string;song:Song;currentTime:number;accent:string;secondary:string}){
  if(template==='vinyl'||template==='gold-record'){
    const gold=template==='gold-record';
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.v23Disc,{borderColor:gold?'#e6b94a':'#252734',backgroundColor:gold?'#9a6a1a':'#090a0f',transform:[{rotate:(currentTime*(gold?19:33))+'deg'}]}]}>
        {visual&&<Image source={{uri:visual}} style={styles.v23DiscCover}/>}
        <View style={[styles.v23DiscCore,{backgroundColor:gold?'#f5d56b':'#d9d0ff'}]}/>
      </View>
      {gold&&<View style={styles.v23GoldPlaque}><Text style={styles.v23GoldPlaqueText}>GOLD RECORD</Text></View>}
    </View>;
  }
  if(template==='glass-card'){
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.v23Orb,styles.v23OrbLeft,{backgroundColor:accent+'33'}]}/>
      <View style={[styles.v23Orb,styles.v23OrbRight,{backgroundColor:secondary+'2A'}]}/>
      <View style={styles.v23GlassBack}/>
      <View style={[styles.v23GlassCard,{borderColor:'rgba(255,255,255,.30)'}]}>
        {visual&&<Image source={{uri:visual}} resizeMode="cover" style={StyleSheet.absoluteFill}/>}
        <LinearGradient colors={['rgba(255,255,255,.18)','rgba(255,255,255,.02)','rgba(255,255,255,0)']} style={StyleSheet.absoluteFill}/>
      </View>
    </View>;
  }
  if(template==='editorial'){
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.v23EditorialBorder}/>
      <View style={styles.v23EditorialV}/>
      <View style={styles.v23EditorialH}/>
      <Text style={styles.v23EditorialMusic}>MUSIC</Text>
      <Text style={styles.v23EditorialIssue}>EDITORIAL / VISUAL ISSUE</Text>
      <View style={styles.v23EditorialImageWrap}>{visual&&<Image source={{uri:visual}} resizeMode="cover" style={StyleSheet.absoluteFill}/>}</View>
      <Text style={styles.v23EditorialCreator}>{(song.creator||'MUSIC').toUpperCase()}</Text>
      <Text style={styles.v23EditorialFeature}>01  /  FEATURE STORY</Text>
    </View>;
  }
  if(template==='spotlight'){
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[accent+'66','transparent']} start={{x:.25,y:0}} end={{x:.5,y:.7}} style={styles.v23SpotLeft}/>
      <LinearGradient colors={[secondary+'55','transparent']} start={{x:.75,y:0}} end={{x:.5,y:.7}} style={styles.v23SpotRight}/>
      <View style={styles.v23SpotImage}>{visual&&<Image source={{uri:visual}} resizeMode="cover" style={StyleSheet.absoluteFill}/>}</View>
    </View>;
  }
  if(template==='lyrics-focus'){
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['rgba(4,7,15,.10)','rgba(3,6,14,.68)','rgba(3,6,14,.68)','rgba(3,6,14,.12)']} locations={[0,.32,.68,1]} style={styles.v23LyricsShade}/>
      <View style={[styles.v23LyricsWindow,{borderColor:secondary+'44'}]}/>
      <Text style={[styles.v23Quote,{color:secondary+'22'}]}>“</Text>
    </View>;
  }
  return null;
}

function V23Waveform({styleName,values,currentTime,duration,color,color2,density,thickness,height}:{styleName:string;values:number[];currentTime:number;duration:number;color:string;color2:string;density:number;thickness:number;height:number}){
  const count=Math.max(34,Math.min(96,Math.round(30+density*.7)));
  const source=values.length?values:Array.from({length:320},(_,i)=>(.12+((i*37)%83)/100));
  const center=Math.floor((currentTime/Math.max(1,duration))*source.length);
  const windowValues=Array.from({length:count},(_,i)=>{
    const offset=i-Math.floor(count/2);
    return source[(center+offset+source.length*4)%source.length]||.08;
  });
  const maxAmp=Math.max(11,22+(height/100)*32);
  const top=windowValues.map((v,i)=>{
    const x=7+(i/Math.max(1,count-1))*86;
    const centerBias=.58+.42*Math.sin((i/Math.max(1,count-1))*Math.PI);
    const amp=Math.max(1,(Math.max(.035,v)*centerBias)*maxAmp);
    return [x,50-amp] as const;
  });
  const bottom=top.map(([x,y])=>[x,100-y] as const);
  const path=(pts:readonly (readonly [number,number])[])=>pts.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ');
  const circular=/circle|orbit|radial|ring|mandala|pinwheel/.test(styleName);
  const spectrum=/spectrum|bars|blocks|equalizer|needles|rounded/.test(styleName);
  if(circular){
    const bars=Math.max(30,Math.min(74,Math.round(28+density*.5)));
    return <Svg viewBox="0 0 100 100" width="100%" height="100%" pointerEvents="none">
      <Defs><SvgLinearGradient id="v23wg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={color}/><Stop offset="1" stopColor={color2}/></SvgLinearGradient></Defs>
      <Circle cx="50" cy="50" r="20" stroke="url(#v23wg)" strokeWidth={Math.max(1,thickness/34)} fill="rgba(8,10,18,.28)"/>
      {Array.from({length:bars},(_,i)=>{
        const a=i/bars*Math.PI*2,v=windowValues[i%windowValues.length]||.08;
        const r=22,len=2+v*10,x1=50+Math.cos(a)*r,y1=50+Math.sin(a)*r,x2=50+Math.cos(a)*(r+len),y2=50+Math.sin(a)*(r+len);
        return <Path key={i} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={i%2?color2:color} strokeWidth={Math.max(.7,thickness/45)} strokeLinecap="round"/>;
      })}
    </Svg>;
  }
  if(spectrum){
    const bars=Math.max(24,Math.min(64,Math.round(20+density*.5)));
    return <Svg viewBox="0 0 100 100" width="100%" height="100%" pointerEvents="none">
      <Defs><SvgLinearGradient id="v23wg2" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={color}/><Stop offset="1" stopColor={color2}/></SvgLinearGradient></Defs>
      {Array.from({length:bars},(_,i)=>{
        const v=windowValues[Math.floor(i/bars*windowValues.length)]||.08,h=Math.max(5,v*48*(height/78)),x=7+(i/Math.max(1,bars-1))*86,w=Math.max(.7,thickness/45);
        return <Rect key={i} x={x-w/2} y={50-h/2} width={w} height={h} rx={w/2} fill="url(#v23wg2)"/>;
      })}
    </Svg>;
  }
  return <Svg viewBox="0 0 100 100" width="100%" height="100%" pointerEvents="none">
    <Defs><SvgLinearGradient id="v23wg3" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={color}/><Stop offset=".5" stopColor={color2}/><Stop offset="1" stopColor={color}/></SvgLinearGradient></Defs>
    <Path d={path(top)} stroke="url(#v23wg3)" strokeWidth={Math.max(1.1,thickness/30)} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d={path(bottom)} stroke="url(#v23wg3)" strokeWidth={Math.max(1.1,thickness/30)} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".82"/>
    <Path d={`M 7 50 ${top.map(([x,y])=>'L '+x+' '+y).join(' ')} L 93 50 Z`} fill={color2} opacity=".12"/>
    <Path d={`M 7 50 ${bottom.map(([x,y])=>'L '+x+' '+y).join(' ')} L 93 50 Z`} fill={color} opacity=".10"/>
  </Svg>;
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
  const cards=quickPresets.map((item,index)=><Pressable
    key={item.id}
    onPress={()=>onPreset(item)}
    style={[
      styles.quickPreset,
      compact?styles.quickPresetCompact:styles.quickPresetDesktop,
      config.presetId===item.id&&{borderColor:item.accent},
    ]}
  >
    <View style={[styles.quickPresetArt,compact&&styles.quickPresetArtCompact]}>
      <V23SceneThumb
        template={item.template}
        picture={song.picture}
        accent={item.accent}
        secondary={item.secondary}
        badge={!compact?(index===0?'ĐỀ XUẤT':item.badge):undefined}
      />
    </View>
    <View style={[styles.quickPresetCopy,compact&&styles.quickPresetCopyCompact]}>
      {compact&&<Text style={styles.quickBadgeCompact}>{index===0?'ĐỀ XUẤT':item.badge}</Text>}
      <Text numberOfLines={1} style={[styles.quickPresetName,compact&&styles.quickPresetNameCompact]}>{item.name}</Text>
      <Text numberOfLines={1} style={[styles.quickPresetMeta,compact&&styles.quickPresetMetaCompact]}>{item.aspect} · {item.lyrics==='off'?'Visualizer':'Lyrics'}</Text>
    </View>
  </Pressable>);

  return <View style={[styles.quickCreate,compact&&styles.quickCreateCompact]}>
    <View style={styles.quickHead}>
      <View><Text style={styles.quickKicker}>QUICK CREATE</Text><Text style={styles.quickTitle}>{compact?'Tạo nhanh':'Tạo nhanh từ preset phù hợp'}</Text></View>
      {onCustomize
        ? <Pressable style={[styles.quickCustomize,compact&&styles.quickCustomizeCompact]} onPress={onCustomize}><SlidersHorizontal size={14} color="#cbd3df"/><Text style={styles.quickCustomizeText}>Customize</Text></Pressable>
        : compact?<Text style={styles.quickHint}>Preset phù hợp bài này</Text>:null}
    </View>
    {compact
      ? <View style={styles.quickPresetList}>{cards}</View>
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
  overlaySelected:{borderWidth:1,borderColor:'rgba(167,139,250,.9)',borderRadius:7,backgroundColor:'rgba(139,92,246,.06)'},
  waveV23:{position:'absolute',zIndex:3,left:'7%',right:'7%',height:'15.5%' as any,minHeight:48},
  karaokeFocus:{minWidth:'82%' as any,maxWidth:'94%' as any,borderRadius:10,backgroundColor:'rgba(5,5,16,.48)',paddingHorizontal:10,paddingVertical:8,alignItems:'center'},
  karaokeFocusClear:{backgroundColor:'transparent'},
  v23Disc:{position:'absolute',left:'16%',top:'17%',width:'68%',aspectRatio:1,borderRadius:999,borderWidth:3,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:'#000',shadowOpacity:.45,shadowRadius:18,elevation:8},
  v23DiscCover:{width:'31%',aspectRatio:1,borderRadius:999},
  v23DiscCore:{position:'absolute',width:'7%',aspectRatio:1,borderRadius:999},
  v23GoldPlaque:{position:'absolute',left:'27%',right:'27%',top:'58%',height:'6%',borderWidth:1,borderColor:'rgba(255,224,151,.68)',backgroundColor:'#5e421d',alignItems:'center',justifyContent:'center'},
  v23GoldPlaqueText:{color:'#fff0ae',fontFamily:'Georgia',fontWeight:'700',fontSize:9},
  v23Orb:{position:'absolute',width:'44%',aspectRatio:1,borderRadius:999},
  v23OrbLeft:{left:'6%',top:'14%'},v23OrbRight:{right:'4%',top:'35%'},
  v23GlassBack:{position:'absolute',left:'11%',top:'21%',width:'72%',height:'34%',borderWidth:1,borderColor:'rgba(255,255,255,.12)',borderRadius:18,backgroundColor:'rgba(255,255,255,.045)',transform:[{rotate:'-2deg'}]},
  v23GlassCard:{position:'absolute',left:'14%',top:'20%',width:'72%',height:'34%',borderWidth:1,borderRadius:18,backgroundColor:'rgba(12,18,34,.48)',overflow:'hidden',shadowColor:'#8b5cf6',shadowOpacity:.32,shadowRadius:20,elevation:6},
  v23EditorialBorder:{position:'absolute',left:'5.5%',right:'5.5%',top:'7%',bottom:'9%',borderWidth:1,borderColor:'rgba(242,228,196,.78)'},
  v23EditorialV:{position:'absolute',left:'51%',top:'8%',bottom:'10%',width:1,backgroundColor:'rgba(242,228,196,.28)'},
  v23EditorialH:{position:'absolute',left:'5.5%',right:'5.5%',top:'28%',height:1,backgroundColor:'rgba(242,228,196,.28)'},
  v23EditorialMusic:{position:'absolute',left:'7%',top:'10%',color:'rgba(244,232,202,.96)',fontFamily:'Georgia',fontSize:28,fontWeight:'900'},
  v23EditorialIssue:{position:'absolute',left:'7.5%',top:'22%',color:'rgba(244,232,202,.84)',fontSize:7,fontWeight:'700',letterSpacing:1.3},
  v23EditorialImageWrap:{position:'absolute',left:'22%',top:'27%',width:'56%',aspectRatio:1,borderWidth:4,borderColor:'#efe6d3',overflow:'hidden',transform:[{rotate:'-3deg'}]},
  v23EditorialCreator:{position:'absolute',left:'7%',top:'61%',color:'rgba(244,232,202,.88)',fontFamily:'Georgia',fontSize:12,fontWeight:'700',fontStyle:'italic'},
  v23EditorialFeature:{position:'absolute',left:'7%',top:'65%',color:'rgba(244,232,202,.56)',fontSize:7,fontWeight:'600'},
  v23SpotLeft:{position:'absolute',left:'7%',top:'4.5%',width:'43%',height:'64%'},
  v23SpotRight:{position:'absolute',right:'7%',top:'4.5%',width:'43%',height:'64%'},
  v23SpotImage:{position:'absolute',left:'23%',top:'24%',width:'54%',aspectRatio:1,backgroundColor:'#101521',overflow:'hidden',shadowColor:'#8b5cf6',shadowOpacity:.48,shadowRadius:24,elevation:7},
  v23LyricsShade:{position:'absolute',left:0,right:0,top:'14%',height:'68%'},
  v23LyricsWindow:{position:'absolute',left:'7%',right:'7%',top:'36%',height:'28%',borderWidth:1,borderRadius:18,backgroundColor:'rgba(10,13,26,.34)'},
  v23Quote:{position:'absolute',left:'5.5%',top:'31%',fontFamily:'Georgia',fontSize:64,fontWeight:'900'},
  localAudioVisual:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',paddingTop:'24%' as any},
  localAudioTitle:{color:'#f1ecff',fontSize:30,fontWeight:'800',marginTop:48,textAlign:'center'},
  localAudioTitleCompact:{fontSize:20,marginTop:34},
  localAudioCreator:{color:'rgba(226,217,255,.72)',fontSize:10,fontWeight:'800',letterSpacing:1,marginTop:8},
  stageRatio:{position:'absolute',right:12,top:12,zIndex:5,borderWidth:1,borderColor:'rgba(255,255,255,.16)',borderRadius:8,backgroundColor:'rgba(7,10,15,.55)',paddingHorizontal:8,paddingVertical:5},
  stageRatioText:{color:'#fff',fontSize:9,fontWeight:'800'},
  titleOverlay:{position:'absolute',zIndex:4,left:'8%',right:'8%',alignItems:'center',transform:[{translateY:-12}]},creatorOverlay:{position:'absolute',zIndex:4,left:'8%',right:'8%',alignItems:'center',transform:[{translateY:-7}]},previewTitle:{color:'#fff',fontSize:24,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:10},previewCreator:{color:'#d1d5db',fontSize:12,textShadowColor:'#000',textShadowRadius:8,textTransform:'uppercase',letterSpacing:1},
  karaoke:{position:'absolute',zIndex:3,left:'8%',right:'8%',alignItems:'center',transform:[{translateY:-15}]},
  karaokeMain:{color:'#fff',fontSize:29,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:8},
  karaokeNext:{color:'#e1e3e7',fontSize:21,marginTop:8,textAlign:'center',textShadowColor:'#000',textShadowRadius:8},
  wave:{position:'absolute',zIndex:3,left:'8%',right:'8%',height:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',opacity:.82,transform:[{translateY:-26}]},
  waveCompact:{left:'7%',right:'7%',height:34,transform:[{translateY:-17}]},mirrorBar:{height:'100%',alignItems:'center',justifyContent:'center'},
  bar:{width:2,borderRadius:3,backgroundColor:'#a47cff'},barMirror:{opacity:.52,transform:[{scaleY:-1}]},
  centerPlay:{position:'absolute',zIndex:35,left:'50%',top:'50%',marginLeft:-32,marginTop:-32,width:64,height:64,borderWidth:1,borderColor:'rgba(255,255,255,.45)',borderRadius:32,backgroundColor:'rgba(8,11,18,.72)',alignItems:'center',justifyContent:'center'},
  centerPlayCompact:{marginLeft:-28,marginTop:-28,width:56,height:56,borderRadius:28},
  centerPlayPlaying:{opacity:.18},
  player:{height:72,flexDirection:'row',alignItems:'center',gap:12,borderBottomLeftRadius:7,borderBottomRightRadius:7,backgroundColor:'#0d1219',paddingHorizontal:22},
  playerCompact:{height:50,marginTop:0,marginHorizontal:13,zIndex:6,backgroundColor:'transparent',paddingHorizontal:4},
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
  quickCustomizeCompact:{height:32,paddingHorizontal:9},
  quickCustomizeText:{color:'#cbd3df',fontSize:10},
  quickPresetRow:{flexDirection:'row',gap:8,marginTop:11},
  quickPresetList:{gap:8,marginTop:10},
  quickPreset:{overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:10,backgroundColor:'#0b1017'},
  quickPresetDesktop:{flex:1},
  quickPresetCompact:{width:'100%',minHeight:64,flexDirection:'row',alignItems:'stretch',flexGrow:0,flexShrink:0},
  quickPresetArt:{height:66,overflow:'hidden',position:'relative'},
  quickPresetArtCompact:{width:62,height:62,flexShrink:0},
  quickShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},
  quickBadge:{position:'absolute',left:7,top:7,color:'#eee8ff',fontSize:7,fontWeight:'900'},
  quickPresetCopy:{minWidth:0},
  quickPresetCopyCompact:{flex:1,justifyContent:'center',paddingHorizontal:9,paddingVertical:6},
  quickBadgeCompact:{color:'#8d72ff',fontSize:7,fontWeight:'900',letterSpacing:.5,marginBottom:2},
  quickPresetName:{color:'#f5f7fb',fontSize:9,fontWeight:'800',paddingHorizontal:8,paddingTop:7},
  quickPresetNameCompact:{paddingHorizontal:0,paddingTop:0,fontSize:10},
  quickPresetMeta:{color:'#727e90',fontSize:7,paddingHorizontal:8,paddingTop:3,paddingBottom:8},
  quickPresetMetaCompact:{paddingHorizontal:0,paddingTop:3,paddingBottom:0,fontSize:8},
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
