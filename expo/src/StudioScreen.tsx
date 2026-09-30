import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, Download, Image as ImageIcon, Music2, Palette, Play, RefreshCw, Save, SlidersHorizontal, Sparkles, Subtitles, Upload, Wand2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, RenderJob, Song, StudioSnapshot } from './types';
import { colors, v24 } from './theme';
import { safeFilename, saveExportedAsset, shareTextFile } from './file-actions';
import { exportAudio, exportVisualizer } from './render-engine';
import { useStudioPlayback } from './useStudioPlayback';
import { useSubtitleSync } from './useSubtitleSync';
import { SuggestedBackground } from './SuggestedBackground';
import { findHighlight } from './highlight-engine';
import { DEFAULT_VISUAL_CONFIG, V24StudioControls, applyPresetConfig, recommendPresets, V24_PRESETS, type StudioVisualConfig } from './V24StudioControls';

const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function StudioScreen({song,onSave,onRenderJob,initialStudio}:{song:Song;onSave:(snapshot:StudioSnapshot)=>void;onRenderJob:(job:RenderJob)=>void;initialStudio?:StudioSnapshot}){
  const {height}=useWindowDimensions();
  const [config,setConfig]=useState<StudioVisualConfig>(initialStudio?.config||{...DEFAULT_VISUAL_CONFIG,trimEnd:song.duration||0});
  const [background,setBackground]=useState<string|undefined>(initialStudio?.background||song.picture);
  const {timeline,setTimeline,status:subtitleStatus,message:subtitleMessage,error:subError,regenerating:subLoading,reget}=useSubtitleSync(song,initialStudio?.timeline||[]);
  const [saved,setSaved]=useState(false);
  const [rendering,setRendering]=useState(false);
  const [renderProgress,setRenderProgress]=useState(0);
  const [renderStage,setRenderStage]=useState<'idle'|'validation'|'prepare'|'render'|'finalize'>('idle');
  const [renderMessage,setRenderMessage]=useState('');
  const [highlightNotice,setHighlightNotice]=useState('');
  const [downloadBusy,setDownloadBusy]=useState('');
  const playback=useStudioPlayback(song);
  const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,14)||[],[song.lyrics]);
  const stageHeight=Math.max(420,height-240);
  const quickPresets=useMemo(()=>recommendPresets(song),[song]);
  const selectedPreset=V24_PRESETS.find(item=>item.id===config.presetId)||V24_PRESETS[0]!;

  const save=()=>{onSave({schemaVersion:1,config,timeline,background});setSaved(true);setTimeout(()=>setSaved(false),1600)};
  const pickBackground=async()=>{
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:0.9});
    if(!result.canceled) setBackground(result.assets[0]?.uri);
  };
  const exportVideo=async(durationSeconds?:number)=>{
    if(rendering)return;
    const jobId='local-'+Date.now().toString(36);
    const started=Date.now();
    setRendering(true);setRenderProgress(0);setRenderMessage('');setRenderStage('validation');
    onRenderJob({id:jobId,title:song.title,progress:0,status:'queued',createdAt:started});
    try{
      await new Promise<void>(resolve=>setTimeout(resolve,40));
      setRenderStage('prepare');setRenderProgress(4);
      let startSeconds=config.trimStart;
      let duration=durationSeconds||Math.max(0,(config.trimEnd||song.duration||0)-config.trimStart);
      if(durationSeconds===30){
        setHighlightNotice('Đang phân tích toàn bài để tìm đoạn cao trào…');
        const highlight=await findHighlight(song,timeline,config.trimStart,config.trimEnd||song.duration||0,30);
        startSeconds=highlight.startSeconds;
        duration=Math.max(1,highlight.endSeconds-highlight.startSeconds);
        setHighlightNotice('Đã chọn cao trào '+fmt(highlight.startSeconds)+' – '+fmt(highlight.endSeconds)+' · '+Math.round(highlight.confidence*100)+'% confidence');
      }else setHighlightNotice('');
      setRenderStage('render');
      const asset=await exportVisualizer(song,{
        presetId:config.presetId,
        durationSeconds:duration,
        startSeconds,
        aspect:config.aspect,
        wave:config.wave,
        waveGlow:config.waveGlow,
        waveHeight:config.waveHeight,
        backgroundUri:background,
        lyricsMode:config.lyrics,
        timeline,
        titleColor:config.titleColor,
        subtitleColor:config.subtitleColor,
        subtitleActiveColor:config.subtitleActiveColor,
        quality:config.quality,
      },(progress)=>{
        setRenderProgress(progress);
        onRenderJob({id:jobId,title:song.title,progress,status:'rendering',createdAt:started});
      });
      setRenderStage('finalize');setRenderProgress(99);
      await saveExportedAsset(asset);
      onRenderJob({id:jobId,title:song.title,progress:100,status:'completed',createdAt:started});
      setRenderProgress(100);setRenderMessage('Video ready · đã mở lưu/chia sẻ.');
    }catch(e){
      const message=e instanceof Error?e.message:'Không thể xuất video.';
      onRenderJob({id:jobId,title:song.title,progress:renderProgress,status:'failed',createdAt:started,error:message});
      setRenderMessage(message);
    }finally{setRendering(false);setRenderStage('idle')}
  };
  const downloadAudio=async(format:'m4a'|'mp3'|'wav')=>{
    if(downloadBusy)return;
    setDownloadBusy(format);setRenderMessage('');
    try{
      const asset=await exportAudio(song,format);
      await saveExportedAsset(asset);
    }catch(e){setRenderMessage(e instanceof Error?e.message:'Không thể xuất audio.')}
    finally{setDownloadBusy('')}
  };
  const exportSrtText=()=>timeline.map((line,index)=>{
    const stamp=(seconds:number)=>{const ms=Math.max(0,Math.round(seconds*1000));const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(x).padStart(3,'0')};
    return String(index+1)+'\n'+stamp(line.start)+' --> '+stamp(line.end)+'\n'+line.text+'\n';
  }).join('\n');
  const downloadText=async(format:'txt'|'srt')=>{
    try{
      const text=format==='srt'?exportSrtText():(song.lyrics||'');
      if(!text.trim())throw new Error(format==='srt'?'Subtitle chưa có timestamp.':'Bài hát chưa có lyrics.');
      await shareTextFile(text,safeFilename(song.title)+'-lyrics.'+format,format==='srt'?'application/x-subrip':'text/plain');
    }catch(e){setRenderMessage(e instanceof Error?e.message:'Không thể lưu file lời.')}
  };

  return <View style={styles.root}>
    <ScrollView style={styles.canvasScroll} contentContainerStyle={styles.canvasColumn}>
      <View style={[styles.stage,{height:stageHeight}]}>
        {background?<ImageBackground source={{uri:background}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<LinearGradient colors={[selectedPreset.accent,selectedPreset.secondary]} style={StyleSheet.absoluteFill}/>}
        <LinearGradient colors={['rgba(4,7,11,0)','rgba(4,7,11,.08)','rgba(4,7,11,.72)']} locations={[0,.62,1]} style={StyleSheet.absoluteFill}/>
        <View style={styles.stageRatio}><Text style={styles.stageRatioText}>{config.aspect}</Text></View>
        {config.lyrics!=='off'&&<View style={styles.karaoke}>
          <Text style={[styles.karaokeMain,{color:config.subtitleActiveColor}]}>{timeline[0]?.text||lyricLines[0]||song.title}</Text>
          <Text style={[styles.karaokeNext,{color:config.subtitleColor}]}>{timeline[1]?.text||lyricLines[1]||'SunoDown Creator Studio'}</Text>
        </View>}
        <View style={styles.wave}>
          {Array.from({length:54}).map((_,i)=><View key={i} style={[styles.bar,{height:8+((i*17)%48)}]}/>)}
        </View>
        <Pressable style={styles.centerPlay} onPress={playback.toggle}><Play size={27} color="#fff" fill="#fff"/></Pressable>
      </View>

      <View style={styles.player}>
        <Pressable style={styles.playerBtn} onPress={playback.toggle}><Play size={23} color="#fff" fill="#fff"/></Pressable>
        <Text style={styles.playerTime}>{fmt(playback.current)} / {fmt(playback.duration)}</Text>
        <View style={styles.seek}><View style={styles.seekFill}/><View style={styles.seekKnob}/></View>
        <Music2 size={19} color="#d7dde7"/>
        <SlidersHorizontal size={18} color="#aeb7c5"/>
      </View>

      {subtitleStatus!=='idle'&&<View style={[styles.subtitleJob,subtitleStatus==='synced'&&styles.subtitleJobSynced,subtitleStatus==='fallback'&&styles.subtitleJobFallback]}>
        {subtitleStatus==='syncing'?<ActivityIndicator size="small" color="#22d3ee"/>:<View style={[styles.subtitleDot,subtitleStatus==='synced'&&styles.subtitleDotSynced]}/>}
        <View style={{flex:1}}><Text style={styles.subtitleJobTitle}>{subtitleStatus==='syncing'?(subLoading?'Đang lấy lại subtitle…':'Đang tìm subtitle…'):subtitleStatus==='synced'?'Subtitle đã sẵn sàng':'Subtitle cần kiểm tra timing'}</Text><Text style={styles.subtitleJobText}>{subtitleStatus==='syncing'&&!subLoading?'Bạn vẫn có thể chỉnh sửa trong khi chạy nền.':subtitleMessage}</Text></View>
      </View>}
      {song.id&&<View style={styles.subtitleRefresh}>
        <Pressable style={styles.subtitleRefreshBtn} disabled={subLoading||subtitleStatus==='syncing'} onPress={()=>void reget()}>
          {subLoading?<ActivityIndicator size="small" color="#fff"/>:<Sparkles size={15} color="#d9ceff"/>}
          <Text style={styles.subtitleRefreshText}>{subLoading?'Đang lấy lại…':'Lấy lại subtitle'}</Text>
        </Pressable>
        <Text style={styles.subtitleRefreshHint}>Bỏ cache và tạo subtitle mới từ audio hiện tại.</Text>
      </View>}

      <SuggestedBackground
        song={song}
        aspect={config.aspect}
        selectedUri={background}
        disabled={rendering}
        onApply={uri=>{setBackground(uri);setConfig({...config,backgroundMode:'image'})}}
        onBrowse={()=>void pickBackground()}
      />

      <View style={styles.quickCreate}>
        <View style={styles.quickHead}><View><Text style={styles.quickKicker}>QUICK CREATE</Text><Text style={styles.quickTitle}>Tạo nhanh từ preset phù hợp</Text></View><Text style={styles.quickHint}>Gợi ý theo style & lyrics của bài</Text></View>
        <View style={styles.quickPresetRow}>
          {quickPresets.map((item,index)=><Pressable key={item.id} onPress={()=>setConfig(applyPresetConfig(config,item,song.duration||0))} style={[styles.quickPreset,config.presetId===item.id&&{borderColor:item.accent}]}>
            <View style={[styles.quickPresetArt,{backgroundColor:item.accent+'22'}]}>{song.picture&&<Image source={{uri:song.picture}} style={StyleSheet.absoluteFill}/>}<View style={styles.quickShade}/><Text style={styles.quickBadge}>{index===0?'ĐỀ XUẤT':item.badge}</Text></View>
            <Text numberOfLines={1} style={styles.quickPresetName}>{item.name}</Text>
            <Text style={styles.quickPresetMeta}>{item.aspect} · {item.lyrics==='off'?'Visualizer':'Lyrics'}</Text>
          </Pressable>)}
        </View>
        <View style={styles.quickActions}>
          <Pressable disabled={rendering} onPress={()=>void exportVideo()} style={[styles.quickAction,styles.quickActionPrimary,rendering&&styles.disabled]}><Upload size={16} color="#fff"/><Text style={styles.quickActionPrimaryText}>{rendering?renderStage==='validation'?'Checking '+Math.round(renderProgress)+'%':renderStage==='prepare'?'Preparing '+Math.round(renderProgress)+'%':renderStage==='finalize'?'Finalizing '+Math.round(renderProgress)+'%':'Rendering '+Math.round(renderProgress)+'%':'Create video'}</Text></Pressable>
          <Pressable disabled={rendering} onPress={()=>void exportVideo(30)} style={[styles.quickAction,rendering&&styles.disabled]}><Play size={15} color="#cfc5ff"/><Text style={styles.quickActionText}>Tạo 30s cao trào</Text></Pressable>
        </View>
        {!!highlightNotice&&<View style={styles.highlightStatus}><Sparkles size={13} color="#c4b5fd"/><Text style={styles.highlightText}>{highlightNotice}</Text></View>}
        {(rendering||!!renderMessage)&&<View style={[styles.quickStatus,!!renderMessage&&!rendering&&styles.quickStatusDone]}><Text style={styles.quickStatusTitle}>{rendering?(renderStage==='validation'?'Đang kiểm tra video…':renderStage==='prepare'?'Đang chuẩn bị media…':renderStage==='finalize'?'Đang hoàn tất video…':'Đang tạo video…'):'Hoàn tất'}</Text><Text style={styles.quickStatusText}>{rendering?Math.round(renderProgress)+'% · Không đóng trang trong khi đang xử lý.':renderMessage}</Text></View>}
      </View>

      <EditorTimeline song={song} background={background} config={config} timeline={timeline} currentTime={playback.current} onSeek={playback.seekTo}/>
    </ScrollView>

    <ScrollView style={styles.inspector} contentContainerStyle={styles.inspectorContent}>
      <View style={styles.song}>
        {song.picture?<Image source={{uri:song.picture}} style={styles.cover}/>:<View style={[styles.cover,styles.coverEmpty]}><Music2 size={34} color={colors.violet}/></View>}
        <View style={styles.songCopy}>
          <Text numberOfLines={2} style={styles.songTitle}>{song.title}</Text>
          <Text style={styles.songMeta}>Created by {song.creator||'Suno'}</Text>
          <Text style={styles.songMeta}>{fmt(song.duration)}</Text>
        </View>
      </View>

      <Pressable style={[styles.save,saved&&styles.saveDone]} onPress={save}>
        <Save size={16} color={saved?'#8ff0bd':'#c8baff'}/>
        <Text style={[styles.saveText,saved&&styles.saveTextDone]}>{saved?'Đã lưu dự án':'Lưu dự án'}</Text>
      </Pressable>

      <View style={styles.divider}/>

      <V24StudioControls song={song} config={config} onChange={setConfig} timeline={timeline} subtitleLoading={subLoading} subtitleError={subError} onReget={()=>void reget()} onPickBackground={()=>void pickBackground()}/>

      <View style={styles.visualSync}><Text style={styles.visualSyncLabel}>VISUAL SYNC</Text><Text style={styles.visualSyncHash}>V24-RN</Text></View>
      <View style={{height:270}}/>
    </ScrollView>

    <View style={styles.actions}>
      {!!renderMessage&&<Text style={styles.renderMessage}>{renderMessage}</Text>}
      <Pressable style={[styles.export,rendering&&styles.disabled]} disabled={rendering} onPress={()=>void exportVideo()}><Upload size={20} color="#fff"/><Text style={styles.exportText}>{rendering?(renderStage==='validation'?'Checking ':renderStage==='prepare'?'Preparing ':renderStage==='finalize'?'Finalizing ':'Rendering ')+Math.round(renderProgress)+'%':'Export '+fmt(Math.max(0,(config.trimEnd||song.duration||0)-config.trimStart))+' video'}</Text></Pressable>
      <View style={styles.downloads}>
        <Pressable style={styles.downloadBtn} disabled={rendering} onPress={()=>void exportVideo(30)}><Play size={15} color="#cfc5ff"/><Text style={styles.downloadText}>30s</Text></Pressable>
        <Pressable style={styles.downloadBtn} disabled={!!downloadBusy} onPress={()=>void downloadAudio('mp3')}><Download size={15} color="#cfc5ff"/><Text style={styles.downloadText}>{downloadBusy==='mp3'?'…':'MP3'}</Text></Pressable>
        <Pressable style={styles.downloadBtn} disabled={!!downloadBusy} onPress={()=>void downloadAudio('wav')}><Download size={15} color="#cfc5ff"/><Text style={styles.downloadText}>{downloadBusy==='wav'?'…':'WAV'}</Text></Pressable>
        <Pressable style={styles.downloadBtn} disabled={!!downloadBusy} onPress={()=>void downloadAudio('m4a')}><Music2 size={15} color="#cfc5ff"/><Text style={styles.downloadText}>M4A</Text></Pressable>
        <Pressable style={styles.downloadBtn} onPress={()=>void downloadText('txt')}><Subtitles size={15} color="#cfc5ff"/><Text style={styles.downloadText}>Lyrics</Text></Pressable>
        <Pressable style={styles.downloadBtn} onPress={()=>void downloadText('srt')}><Subtitles size={15} color="#cfc5ff"/><Text style={styles.downloadText}>SRT</Text></Pressable>
      </View>
    </View>
  </View>
}

function EditorTimeline({song,background,config,timeline,currentTime,onSeek}:{song:Song;background?:string;config:StudioVisualConfig;timeline:KaraokeLine[];currentTime:number;onSeek:(value:number)=>void}){
  const [width,setWidth]=useState(1);
  return <View style={styles.editorTimeline}>
    <View style={styles.timelineHead}><Text style={styles.timelineHeadTitle}>Timeline</Text><Text style={styles.timelineHeadSub}>Video · Subtitle · Audio</Text><Pressable style={styles.timelineIcon}><SlidersHorizontal size={15} color="#d8deea"/></Pressable></View>
    <Pressable style={styles.timelineCanvas} onLayout={event=>setWidth(Math.max(1,event.nativeEvent.layout.width))} onPress={event=>{const x=(event.nativeEvent as any)?.locationX||0;onSeek((x/width)*(song.duration||0))}}>
      <View style={styles.ruler}>{['00:00','00:15','00:30','00:45','01:00'].map((x,i)=><View key={x} style={{flex:1}}><Text style={styles.rulerText}>{x}</Text><View style={styles.rulerTick}/></View>)}</View>
      <View style={styles.trackRow}><Text style={styles.trackLabel}>VIDEO</Text><View style={styles.videoClip}>{Array.from({length:6}).map((_,i)=><View key={i} style={styles.clipThumb}>{background?<Image source={{uri:background}} style={StyleSheet.absoluteFill}/>:<LinearGradient colors={['#241d3d','#8b6cff']} style={StyleSheet.absoluteFill}/>}</View>)}<Text numberOfLines={1} style={styles.clipTitle}>{config.presetId} · {config.backgroundMode}</Text></View></View>
      <View style={styles.trackRow}><Text style={styles.trackLabel}>SUB</Text><View style={styles.subClip}><Text numberOfLines={1} style={styles.subClipText}>{timeline[0]?.text||song.lyrics?.split(/\n/)[0]||'Subtitle track'}</Text></View></View>
      <View style={[styles.playhead,{left:((song.duration||1)>0?Math.min(100,Math.max(0,currentTime/(song.duration||1)*100)):0)+'%' as any}]}><View style={styles.playheadDot}/></View>
    </Pressable>
  </View>
}

const styles=StyleSheet.create({
  root:{flex:1,marginLeft:v24.railWidth,paddingTop:v24.headerHeight,flexDirection:'row',backgroundColor:'#080c12'},
  canvasScroll:{flex:1,backgroundColor:'#080c12'},canvasColumn:{padding:18,paddingBottom:50,borderRightWidth:1,borderColor:'#202630'},
  stage:{position:'relative',width:'100%',minHeight:420,borderRadius:7,overflow:'hidden',backgroundColor:'#141b24'},
  stageRatio:{position:'absolute',right:12,top:12,zIndex:5,borderWidth:1,borderColor:'rgba(255,255,255,.16)',borderRadius:8,backgroundColor:'rgba(7,10,15,.55)',paddingHorizontal:8,paddingVertical:5},stageRatioText:{color:'#fff',fontSize:9,fontWeight:'800'},
  karaoke:{position:'absolute',zIndex:3,left:'8%',right:'8%',bottom:'8%',alignItems:'center'},karaokeMain:{color:'#fff',fontSize:29,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:8},karaokeNext:{color:'#e1e3e7',fontSize:21,marginTop:8,textAlign:'center',textShadowColor:'#000',textShadowRadius:8},
  wave:{position:'absolute',zIndex:3,left:25,right:25,bottom:22,height:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between',opacity:.82},bar:{width:3,borderRadius:3,backgroundColor:'#a47cff'},
  centerPlay:{position:'absolute',zIndex:35,left:'50%',top:'50%',marginLeft:-32,marginTop:-32,width:64,height:64,borderWidth:1,borderColor:'rgba(255,255,255,.45)',borderRadius:32,backgroundColor:'rgba(8,11,18,.72)',alignItems:'center',justifyContent:'center'},
  player:{height:72,flexDirection:'row',alignItems:'center',gap:12,borderBottomLeftRadius:7,borderBottomRightRadius:7,backgroundColor:'#0d1219',paddingHorizontal:22},playerBtn:{width:34,alignItems:'center'},playerTime:{width:105,color:'#c6ccd6',fontSize:12},seek:{flex:1,height:4,borderRadius:99,backgroundColor:'#2a313d',position:'relative'},seekFill:{width:'27%',height:4,borderRadius:99,backgroundColor:'#8967ff'},seekKnob:{position:'absolute',left:'27%',top:-4,width:12,height:12,borderRadius:6,backgroundColor:'#fff'},
  subtitleJob:{minHeight:48,marginTop:10,borderWidth:1,borderColor:'rgba(34,211,238,.2)',borderRadius:12,backgroundColor:'rgba(8,18,27,.92)',paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:11},subtitleJobSynced:{borderColor:'rgba(74,222,128,.2)',backgroundColor:'rgba(10,28,21,.82)'},subtitleJobFallback:{borderColor:'rgba(245,158,11,.24)',backgroundColor:'rgba(35,24,8,.76)'},subtitleDot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:'#f59e0b'},subtitleDotSynced:{borderWidth:0,backgroundColor:'#22c55e'},subtitleJobTitle:{color:'#e6faff',fontSize:10,fontWeight:'800'},subtitleJobText:{color:'#8292a6',fontSize:9,marginTop:3},
  subtitleRefresh:{minHeight:46,marginTop:10,flexDirection:'row',alignItems:'center',gap:10},subtitleRefreshBtn:{height:34,borderWidth:1,borderColor:'#5b438f',borderRadius:8,backgroundColor:'#211a3b',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7},subtitleRefreshText:{color:'#d9ceff',fontSize:10,fontWeight:'700'},subtitleRefreshHint:{color:'#778395',fontSize:9},
  quickCreate:{marginTop:10,borderWidth:1,borderColor:'#27303d',borderRadius:14,backgroundColor:'#0d131c',padding:12},quickHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},quickKicker:{color:'#8d72ff',fontSize:8,fontWeight:'900',letterSpacing:1.3},quickTitle:{color:'#f3f5f9',fontSize:12,fontWeight:'800',marginTop:4},quickHint:{color:'#727e90',fontSize:8,textAlign:'right'},quickPresetRow:{flexDirection:'row',gap:8,marginTop:11},quickPreset:{flex:1,overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:10,backgroundColor:'#0b1017'},quickPresetArt:{height:66,overflow:'hidden',position:'relative'},quickShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},quickBadge:{position:'absolute',left:7,top:7,color:'#eee8ff',fontSize:7,fontWeight:'900'},quickPresetName:{color:'#f5f7fb',fontSize:9,fontWeight:'800',paddingHorizontal:8,paddingTop:7},quickPresetMeta:{color:'#727e90',fontSize:7,paddingHorizontal:8,paddingTop:3,paddingBottom:8},quickActions:{flexDirection:'row',gap:8,marginTop:10},quickAction:{flex:1,minHeight:42,borderWidth:1,borderColor:'#5b49ba',borderRadius:9,backgroundColor:'rgba(112,85,225,.12)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},quickActionPrimary:{backgroundColor:'#7058ed'},quickActionText:{color:'#cfc5ff',fontSize:10,fontWeight:'800'},quickActionPrimaryText:{color:'#fff',fontSize:10,fontWeight:'800'},highlightStatus:{marginTop:8,minHeight:34,borderRadius:8,backgroundColor:'rgba(139,92,246,.08)',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:7},highlightText:{flex:1,color:'#bcb2d4',fontSize:8,lineHeight:12},quickStatus:{marginTop:9,borderWidth:1,borderColor:'rgba(139,92,246,.24)',borderRadius:9,backgroundColor:'rgba(55,42,92,.34)',padding:9},quickStatusDone:{borderColor:'rgba(74,222,128,.18)',backgroundColor:'rgba(15,65,45,.25)'},quickStatusTitle:{color:'#eee9ff',fontSize:9,fontWeight:'800'},quickStatusText:{color:'#8793a4',fontSize:8,marginTop:3},

  inspector:{width:v24.inspectorWidth,backgroundColor:'#0a0e14'},inspectorContent:{paddingTop:30,paddingHorizontal:25,paddingBottom:80},
  song:{flexDirection:'row',gap:20,alignItems:'center'},cover:{width:125,height:125,borderWidth:1,borderColor:'#394352',borderRadius:9,backgroundColor:'#151c26'},coverEmpty:{alignItems:'center',justifyContent:'center'},songCopy:{flex:1,minWidth:0},songTitle:{color:'#f5f7fb',fontSize:25,fontWeight:'700',marginBottom:5},songMeta:{color:'#9ba5b5',fontSize:12,marginTop:8},
  save:{width:'100%',height:42,marginTop:12,borderWidth:1,borderColor:'#7355dc',borderRadius:10,backgroundColor:'#241d45',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},saveDone:{borderColor:'#38c784',backgroundColor:'#143528'},saveText:{color:'#c8baff',fontSize:12,fontWeight:'700'},saveTextDone:{color:'#8ff0bd'},
  divider:{height:1,backgroundColor:'#252b34',marginVertical:30},
  presetSystem:{borderWidth:1,borderColor:'#29313d',borderRadius:16,backgroundColor:'#0f151e',padding:14,marginBottom:18},
  presetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},presetKickerRow:{flexDirection:'row',alignItems:'center',gap:6},presetKicker:{color:'#a78bfa',fontSize:9,fontWeight:'800',letterSpacing:1.2},presetHeadTitle:{color:'#f4f6fb',fontSize:13,fontWeight:'700',marginTop:4},presetHeadBtn:{height:31,borderWidth:1,borderColor:'#303a48',borderRadius:8,backgroundColor:'#151c26',paddingHorizontal:9,justifyContent:'center'},presetHeadBtnText:{color:'#aeb8c7',fontSize:10},
  presetTabs:{flexDirection:'row',gap:6,marginVertical:12},pill:{height:29,borderWidth:1,borderColor:'#2d3542',borderRadius:99,backgroundColor:'#111722',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},pillActive:{borderColor:'#7c5ce8',backgroundColor:'rgba(124,92,232,.16)'},pillText:{color:'#8f99aa',fontSize:9,fontWeight:'700'},pillActiveText:{color:'#eee9ff',fontSize:9,fontWeight:'700'},
  presetGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},presetCard:{width:'48.5%',overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:12,backgroundColor:'#0b1017'},presetArt:{height:82,position:'relative',alignItems:'center',justifyContent:'center'},presetBadge:{position:'absolute',left:7,top:7,color:'#dce3ef',fontSize:7,fontWeight:'800'},presetDisc:{width:48,height:48,borderWidth:1,borderRadius:24,alignItems:'center',justifyContent:'center'},presetDiscIn:{width:12,height:12,borderRadius:6},presetCopy:{minHeight:65,padding:9},presetName:{color:'#f5f7fb',fontSize:11,fontWeight:'700'},presetDesc:{color:'#778396',fontSize:8,lineHeight:12,marginTop:4},
  fold:{borderTopWidth:1,borderColor:'#252b34'},foldButton:{height:70,flexDirection:'row',alignItems:'center',gap:12},foldTitle:{flex:1,color:'#e5e8ed',fontSize:13,fontWeight:'700'},foldContent:{paddingLeft:29,paddingBottom:18},
  uploadBg:{minHeight:58,borderWidth:1,borderStyle:'dashed',borderColor:'#49576c',borderRadius:10,backgroundColor:'#111823',padding:10,flexDirection:'row',alignItems:'center',gap:10},uploadTitle:{color:'#e5eaf2',fontSize:10,fontWeight:'700'},uploadSub:{color:'#788496',fontSize:8,marginTop:4},
  optionWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},option:{borderWidth:1,borderColor:'#303947',borderRadius:8,backgroundColor:'#151c27',paddingHorizontal:10,paddingVertical:8},optionActive:{borderColor:'#8a67ff',backgroundColor:'rgba(125,91,255,.18)'},optionText:{color:'#aeb8c7',fontSize:11},optionTextActive:{color:'#fff'},regen:{height:38,borderRadius:8,backgroundColor:'#7658e9',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginBottom:8},regenText:{color:'#fff',fontSize:10,fontWeight:'700'},error:{color:'#ff9da5',fontSize:9,marginBottom:7},cue:{minHeight:34,flexDirection:'row',gap:8,alignItems:'center',borderBottomWidth:1,borderColor:'#1f2631'},cueTime:{width:35,color:'#9478ff',fontSize:8},cueText:{flex:1,color:'#b9c1cd',fontSize:9},
  visualSync:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8,borderWidth:1,borderColor:'rgba(74,222,128,.18)',borderRadius:9,backgroundColor:'rgba(34,197,94,.07)',paddingHorizontal:9,paddingVertical:7},visualSyncLabel:{color:'#9ca3af',fontSize:9,fontWeight:'700',letterSpacing:.4},visualSyncHash:{color:'#86efac',fontSize:9,fontWeight:'700'},
  actions:{position:'absolute',right:0,bottom:0,zIndex:26,width:v24.inspectorWidth,borderTopWidth:1,borderColor:'#29313e',backgroundColor:'#0a0e14',paddingTop:14,paddingHorizontal:25,paddingBottom:18},
  renderMessage:{color:'#c7bedf',fontSize:9,lineHeight:14,marginBottom:8},disabled:{opacity:.55},
  export:{height:58,borderRadius:9,backgroundColor:'#7057f8',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},exportText:{color:'#fff',fontSize:13,fontWeight:'700'},downloads:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:9},downloadBtn:{flex:1,minHeight:42,borderWidth:1,borderColor:'#6f57dd',borderRadius:8,backgroundColor:'rgba(114,83,230,.15)',alignItems:'center',justifyContent:'center',gap:4},downloadText:{color:'#cfc5ff',fontSize:9,textAlign:'center'},
  editorTimeline:{marginTop:18,borderWidth:1,borderColor:'#202735',borderRadius:14,backgroundColor:'#090d14',overflow:'hidden'},timelineHead:{height:52,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,borderBottomWidth:1,borderColor:'#202735'},timelineHeadTitle:{color:'#f4f6fb',fontSize:12,fontWeight:'800'},timelineHeadSub:{flex:1,color:'#727d90',fontSize:11},timelineIcon:{width:32,height:32,borderWidth:1,borderColor:'#313a49',borderRadius:9,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},
  timelineCanvas:{height:205,paddingTop:30,position:'relative',backgroundColor:'#070a10'},ruler:{position:'absolute',left:0,right:0,top:0,height:30,flexDirection:'row',borderBottomWidth:1,borderColor:'#28303d'},rulerText:{color:'#8792a5',fontSize:10,marginLeft:4,marginTop:3},rulerTick:{height:13,borderLeftWidth:1,borderColor:'#3b4556',marginTop:4},
  trackRow:{height:76,borderBottomWidth:1,borderColor:'#171d27',paddingTop:7,position:'relative'},trackLabel:{position:'absolute',left:6,top:5,zIndex:8,color:'#818da1',fontSize:9,backgroundColor:'rgba(17,23,34,.85)',paddingHorizontal:6,paddingVertical:3,borderRadius:5},
  videoClip:{position:'absolute',left:'7%',right:'4%',top:31,height:46,borderWidth:1,borderColor:'#3d485a',borderRadius:5,overflow:'hidden',backgroundColor:'#161d29',flexDirection:'row'},clipThumb:{width:54,height:46,borderRightWidth:1,borderColor:'#2a3240'},clipTitle:{position:'absolute',left:60,top:16,right:8,color:'#e9edf5',fontSize:10,fontWeight:'700'},
  subClip:{position:'absolute',left:'12%',right:'18%',top:32,height:38,borderWidth:1,borderColor:'#6948b4',borderRadius:5,backgroundColor:'#352366',justifyContent:'center',paddingHorizontal:12},subClipText:{color:'#e9e0ff',fontSize:10},
  playhead:{position:'absolute',zIndex:12,left:'27%',top:18,bottom:0,width:1,backgroundColor:'#fff'},playheadDot:{width:9,height:9,marginLeft:-4,borderRadius:5,backgroundColor:'#fff'},
});
