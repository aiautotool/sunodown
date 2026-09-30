import { cloneElement, useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, Image as ImageIcon, Menu, Music2, Play, RefreshCw, Save, SlidersHorizontal, Sparkles, Subtitles, Upload, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, RenderJob, Song, StudioSnapshot } from './types';
import { colors } from './theme';
import { saveExportedAsset } from './file-actions';
import { exportAudio, exportVisualizer } from './render-engine';
import { useStudioPlayback } from './useStudioPlayback';
import { useSubtitleSync } from './useSubtitleSync';
import { SuggestedBackground } from './SuggestedBackground';
import { findHighlight } from './highlight-engine';
import { DEFAULT_VISUAL_CONFIG, V24StudioControls, applyPresetConfig, recommendPresets, V24_PRESETS, type StudioVisualConfig } from './V24StudioControls';

type Tool='presets'|'style'|'lyrics'|null;
const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function MobileStudioScreen({song,onSave,onBack,onRenderJob,initialStudio}:{song:Song;onSave:(snapshot:StudioSnapshot)=>void;onBack:()=>void;onRenderJob:(job:RenderJob)=>void;initialStudio?:StudioSnapshot}) {
  const [background,setBackground]=useState<string|undefined>(initialStudio?.background||song.picture);
  const {timeline,setTimeline,status:subtitleStatus,message:subtitleMessage,error,regenerating:busy,reget}=useSubtitleSync(song,initialStudio?.timeline||[]);
  const [tool,setTool]=useState<Tool>(null);
  const [saved,setSaved]=useState(false);
  const [config,setConfig]=useState<StudioVisualConfig>(initialStudio?.config||{...DEFAULT_VISUAL_CONFIG,trimEnd:song.duration||0});
  const [rendering,setRendering]=useState(false);
  const [renderProgress,setRenderProgress]=useState(0);
  const [renderStage,setRenderStage]=useState<'idle'|'validation'|'prepare'|'render'|'finalize'>('idle');
  const [renderMessage,setRenderMessage]=useState('');
  const [highlightNotice,setHighlightNotice]=useState('');
  const [downloadBusy,setDownloadBusy]=useState('');
  const playback=useStudioPlayback(song);
  const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean)||[],[song.lyrics]);
  const quickPresets=useMemo(()=>recommendPresets(song),[song]);
  const selectedPreset=V24_PRESETS.find(item=>item.id===config.presetId)||V24_PRESETS[0]!;

  const pick=async()=>{
    const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9});
    if(!r.canceled)setBackground(r.assets[0]?.uri);
  };

  const save=()=>{onSave({schemaVersion:1,config,timeline,background});setSaved(true);setTimeout(()=>setSaved(false),1400)};

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

  return <View style={styles.root}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.titleBar}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        {song.picture?<Image source={{uri:song.picture}} style={styles.cover}/>:<View style={[styles.cover,styles.coverEmpty]}><Music2 color={colors.violet}/></View>}
        <View style={styles.titleCopy}><Text numberOfLines={1} style={styles.title}>{song.title}</Text><Text style={styles.meta}>{fmt(song.duration)} · Suno song</Text></View>
        <Pressable style={styles.menu}><Menu size={20} color="#d7dde6"/></Pressable>
      </View>

      <View style={styles.stage}>
        {background?<ImageBackground source={{uri:background}} style={StyleSheet.absoluteFill} resizeMode="cover"/>:<LinearGradient colors={[selectedPreset.accent,selectedPreset.secondary]} style={StyleSheet.absoluteFill}/>}
        <LinearGradient colors={['rgba(4,7,11,0)','rgba(4,7,11,.72)']} style={StyleSheet.absoluteFill}/>
        <View style={styles.ratio}><Text style={styles.ratioText}>{config.aspect}</Text></View>
        <View style={styles.wave}>{Array.from({length:38}).map((_,i)=><View key={i} style={[styles.bar,{height:6+((i*13)%31)}]}/>)}</View>
        <Pressable style={styles.centerPlay} onPress={playback.toggle}><Play size={24} color="#fff" fill="#fff"/></Pressable>
      </View>

      <View style={styles.playerOverlay}>
        <Pressable onPress={playback.toggle}><Play size={22} color="#fff" fill="#fff"/></Pressable>
        <View style={styles.seek}><View style={styles.seekFill}/><View style={styles.knob}/></View>
        <Text style={styles.time}>{fmt(playback.current)} / {fmt(playback.duration)}</Text>
        <Music2 size={18} color="#fff"/>
      </View>

      {subtitleStatus!=='idle'&&<View style={[styles.subtitleJob,subtitleStatus==='synced'&&styles.subtitleJobSynced,subtitleStatus==='fallback'&&styles.subtitleJobFallback]}>
        {subtitleStatus==='syncing'?<ActivityIndicator size="small" color="#22d3ee"/>:<View style={[styles.subtitleDot,subtitleStatus==='synced'&&styles.subtitleDotSynced]}/>}
        <View style={{flex:1}}><Text style={styles.subtitleJobTitle}>{subtitleStatus==='syncing'?(busy?'Đang lấy lại subtitle…':'Đang tìm subtitle…'):subtitleStatus==='synced'?'Subtitle đã sẵn sàng':'Subtitle cần kiểm tra timing'}</Text><Text style={styles.subtitleJobText}>{subtitleStatus==='syncing'&&!busy?'Bạn vẫn có thể chỉnh sửa trong khi chạy nền.':subtitleMessage}</Text></View>
      </View>}
      {song.id&&<View style={styles.subtitleRefresh}>
        <Pressable onPress={()=>void reget()} disabled={busy||subtitleStatus==='syncing'} style={styles.subtitleBtn}>
          {busy?<ActivityIndicator size="small" color="#fff"/>:<Sparkles size={15} color="#d8ccff"/>}
          <Text style={styles.subtitleBtnText}>{busy?'Đang lấy lại…':'Lấy lại subtitle'}</Text>
        </Pressable>
        <Text style={styles.subtitleHint}>Bỏ cache và tạo subtitle mới từ audio hiện tại.</Text>
      </View>}

      <SuggestedBackground
        song={song}
        aspect={config.aspect}
        selectedUri={background}
        disabled={rendering}
        onApply={uri=>{setBackground(uri);setConfig({...config,backgroundMode:'image'})}}
        onBrowse={()=>void pick()}
      />

      <View style={styles.quickCreate}>
        <View style={styles.quickHead}><View><Text style={styles.quickKicker}>QUICK CREATE</Text><Text style={styles.quickTitle}>Tạo nhanh</Text></View><Text style={styles.quickHint}>Preset phù hợp bài này</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPresetRow}>
          {quickPresets.map((item,index)=><Pressable key={item.id} onPress={()=>setConfig(applyPresetConfig(config,item,song.duration||0))} style={[styles.quickPreset,config.presetId===item.id&&{borderColor:item.accent}]}>
            <View style={[styles.quickPresetArt,{backgroundColor:item.accent+'22'}]}>{song.picture&&<Image source={{uri:song.picture}} style={StyleSheet.absoluteFill}/>}<View style={styles.quickShade}/><Text style={styles.quickBadge}>{index===0?'ĐỀ XUẤT':item.badge}</Text></View>
            <Text numberOfLines={1} style={styles.quickPresetName}>{item.name}</Text><Text style={styles.quickPresetMeta}>{item.aspect} · {item.lyrics==='off'?'Visualizer':'Lyrics'}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={styles.quickActions}><Pressable disabled={rendering} onPress={()=>void exportVideo()} style={[styles.quickAction,styles.quickPrimary,rendering&&styles.disabled]}><Upload size={15} color="#fff"/><Text style={styles.quickPrimaryText}>{rendering?(renderStage==='validation'?'Checking ':renderStage==='prepare'?'Preparing ':renderStage==='finalize'?'Finalizing ':'Rendering ')+Math.round(renderProgress)+'%':'Create video'}</Text></Pressable><Pressable disabled={rendering} onPress={()=>void exportVideo(30)} style={styles.quickAction}><Play size={14} color="#cfc5ff"/><Text style={styles.quickActionText}>Tạo 30s cao trào</Text></Pressable></View>
        {!!highlightNotice&&<View style={styles.highlightStatus}><Sparkles size={13} color="#c4b5fd"/><Text style={styles.highlightText}>{highlightNotice}</Text></View>}
        {rendering&&<View style={styles.quickStatus}><Text style={styles.quickStatusTitle}>{renderStage==='validation'?'Đang kiểm tra video…':renderStage==='prepare'?'Đang chuẩn bị media…':renderStage==='finalize'?'Đang hoàn tất video…':'Đang tạo video…'}</Text><Text style={styles.quickStatusText}>{Math.round(renderProgress)}% · Không đóng app trong khi đang xử lý.</Text></View>}
      </View>

      <Pressable onPress={save} style={[styles.save,saved&&styles.saveDone]}><Save size={16} color={saved?'#8ff0bd':'#c8baff'}/><Text style={[styles.saveText,saved&&{color:'#8ff0bd'}]}>{saved?'Đã lưu dự án':'Lưu dự án'}</Text></Pressable>

      {!!renderMessage&&<Text style={styles.renderMessage}>{renderMessage}</Text>}
      <Pressable style={[styles.export,rendering&&styles.disabled]} disabled={rendering} onPress={()=>void exportVideo()}><Upload size={19} color="#fff"/><Text style={styles.exportText}>{rendering?(renderStage==='validation'?'Checking ':renderStage==='prepare'?'Preparing ':renderStage==='finalize'?'Finalizing ':'Rendering ')+Math.round(renderProgress)+'%':'Create & export video'}</Text></Pressable>
      <View style={{height:100}}/>
    </ScrollView>

    <View style={styles.bottomNav}>
      <ToolButton active={tool==='presets'} icon={<Sparkles size={20}/>} label="Mẫu" onPress={()=>setTool(tool==='presets'?null:'presets')}/>
      <ToolButton active={tool==='style'} icon={<SlidersHorizontal size={20}/>} label="Tùy chỉnh" onPress={()=>setTool(tool==='style'?null:'style')}/>
      <ToolButton active={tool==='lyrics'} icon={<Subtitles size={20}/>} label="Lời" onPress={()=>setTool(tool==='lyrics'?null:'lyrics')}/>
      <ToolButton active={false} icon={<Upload size={20}/>} label="Xuất" onPress={()=>void exportVideo()}/>
    </View>

    {tool&&<View style={styles.sheet}>
      <View style={styles.sheetHead}><View><Text style={styles.sheetKicker}>CREATOR STUDIO</Text><Text style={styles.sheetTitle}>Điều khiển video</Text></View><Pressable onPress={()=>setTool(null)} style={styles.close}><X size={20} color="#fff"/></Pressable></View>
      <ScrollView contentContainerStyle={styles.sheetBody}>
        <V24StudioControls song={song} config={config} onChange={setConfig} timeline={timeline} subtitleLoading={busy} subtitleError={error} onReget={()=>void reget()} onPickBackground={()=>void pick()}/>
        <View style={styles.mobileDownloads}>{(['m4a','mp3','wav'] as const).map(format=><Pressable key={format} disabled={!!downloadBusy} style={styles.audioDownloadBtn} onPress={()=>void downloadAudio(format)}><Text style={styles.audioDownloadText}>{downloadBusy===format?'Đang tạo…':format.toUpperCase()}</Text></Pressable>)}</View>
      </ScrollView>
    </View>}
  </View>
}

function ToolButton({active,icon,label,onPress}:{active:boolean;icon:ReactElement<any>;label:string;onPress:()=>void}){
  const color=active?'#a98bff':'#c2c9d4';
  return <Pressable style={styles.navBtn} onPress={onPress}>{cloneElement(icon,{color})}<Text style={[styles.navText,active&&styles.navTextActive]}>{label}</Text></Pressable>
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#080c12'},scroll:{flex:1},content:{paddingHorizontal:18,paddingBottom:145},
  titleBar:{height:110,flexDirection:'row',alignItems:'flex-end',gap:13,paddingBottom:14},
  back:{width:30,alignItems:'flex-start',justifyContent:'center'},backText:{color:'#fff',fontSize:38,lineHeight:42},
  cover:{width:62,height:62,borderRadius:8,backgroundColor:'#151c26'},coverEmpty:{alignItems:'center',justifyContent:'center'},
  titleCopy:{flex:1,paddingBottom:6,gap:7},title:{color:'#f5f7fb',fontSize:14,fontWeight:'700'},meta:{color:'#8f98a8',fontSize:12},menu:{width:25,alignSelf:'center',marginTop:34},
  stage:{width:'100%',aspectRatio:.72,borderRadius:8,overflow:'hidden',backgroundColor:'#141b24',position:'relative'},
  ratio:{position:'absolute',right:10,top:10,zIndex:4,borderWidth:1,borderColor:'rgba(255,255,255,.14)',borderRadius:8,backgroundColor:'rgba(7,10,15,.58)',paddingHorizontal:7,paddingVertical:4},ratioText:{color:'#fff',fontSize:8,fontWeight:'800'},
  wave:{position:'absolute',zIndex:3,left:18,right:18,bottom:58,height:28,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},bar:{width:3,borderRadius:3,backgroundColor:'#b17cff'},
  centerPlay:{position:'absolute',zIndex:5,left:'50%',top:'50%',marginLeft:-28,marginTop:-28,width:56,height:56,borderWidth:1,borderColor:'rgba(255,255,255,.45)',borderRadius:28,backgroundColor:'rgba(8,11,18,.72)',alignItems:'center',justifyContent:'center'},
  playerOverlay:{height:50,marginTop:-64,marginHorizontal:13,zIndex:6,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:4},seek:{height:4,flex:1,borderRadius:99,backgroundColor:'rgba(255,255,255,.22)',position:'relative'},seekFill:{width:'24%',height:4,borderRadius:99,backgroundColor:'#8b6cff'},knob:{position:'absolute',left:'24%',top:-4,width:12,height:12,borderRadius:6,backgroundColor:'#fff'},time:{width:67,color:'#fff',fontSize:9},
  subtitleJob:{minHeight:48,marginTop:18,borderWidth:1,borderColor:'rgba(34,211,238,.2)',borderRadius:12,backgroundColor:'rgba(8,18,27,.92)',paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:10},subtitleJobSynced:{borderColor:'rgba(74,222,128,.2)',backgroundColor:'rgba(10,28,21,.82)'},subtitleJobFallback:{borderColor:'rgba(245,158,11,.24)',backgroundColor:'rgba(35,24,8,.76)'},subtitleDot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:'#f59e0b'},subtitleDotSynced:{borderWidth:0,backgroundColor:'#22c55e'},subtitleJobTitle:{color:'#e6faff',fontSize:10,fontWeight:'800'},subtitleJobText:{color:'#8292a6',fontSize:9,marginTop:3,lineHeight:13},
  subtitleRefresh:{marginTop:10,flexDirection:'row',alignItems:'center',gap:9,flexWrap:'wrap'},subtitleBtn:{height:36,borderWidth:1,borderColor:'#5c458e',borderRadius:8,backgroundColor:'#211a3b',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},subtitleBtnText:{color:'#d8ccff',fontSize:10,fontWeight:'700'},subtitleHint:{color:'#7d8899',fontSize:9,flexShrink:1},
  quickCreate:{marginTop:12,borderWidth:1,borderColor:'#27303d',borderRadius:12,backgroundColor:'#0d131c',padding:10},quickHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},quickKicker:{color:'#8d72ff',fontSize:8,fontWeight:'900',letterSpacing:1.2},quickTitle:{color:'#f3f5f9',fontSize:12,fontWeight:'800',marginTop:3},quickHint:{color:'#727e90',fontSize:8},quickPresetRow:{gap:8,paddingTop:10,paddingBottom:2},quickPreset:{width:145,overflow:'hidden',borderWidth:1,borderColor:'#29313d',borderRadius:10,backgroundColor:'#0b1017'},quickPresetArt:{height:70,position:'relative',overflow:'hidden'},quickShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},quickBadge:{position:'absolute',left:7,top:7,color:'#eee8ff',fontSize:7,fontWeight:'900'},quickPresetName:{color:'#f5f7fb',fontSize:9,fontWeight:'800',paddingHorizontal:8,paddingTop:7},quickPresetMeta:{color:'#727e90',fontSize:7,paddingHorizontal:8,paddingTop:3,paddingBottom:8},quickActions:{flexDirection:'row',gap:7,marginTop:9},quickAction:{flex:1,minHeight:42,borderWidth:1,borderColor:'#5b49ba',borderRadius:9,backgroundColor:'rgba(112,85,225,.12)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},quickPrimary:{backgroundColor:'#7058ed'},quickActionText:{color:'#cfc5ff',fontSize:9,fontWeight:'800'},quickPrimaryText:{color:'#fff',fontSize:9,fontWeight:'800'},highlightStatus:{marginTop:8,minHeight:34,borderRadius:8,backgroundColor:'rgba(139,92,246,.08)',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:7},highlightText:{flex:1,color:'#bcb2d4',fontSize:8,lineHeight:12},quickStatus:{marginTop:8,borderWidth:1,borderColor:'rgba(139,92,246,.24)',borderRadius:9,backgroundColor:'rgba(55,42,92,.34)',padding:9},quickStatusTitle:{color:'#eee9ff',fontSize:9,fontWeight:'800'},quickStatusText:{color:'#8793a4',fontSize:8,marginTop:3},
  save:{height:42,marginTop:12,borderWidth:1,borderColor:'#7355dc',borderRadius:10,backgroundColor:'#241d45',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},saveDone:{borderColor:'#38c784',backgroundColor:'#143528'},saveText:{color:'#c8baff',fontSize:11,fontWeight:'700'},
  renderMessage:{color:'#c9bfdf',fontSize:10,lineHeight:16,marginTop:13},disabled:{opacity:.55},
  export:{height:58,marginTop:16,borderRadius:14,backgroundColor:'#7359f6',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},exportText:{color:'#fff',fontSize:13,fontWeight:'700'},
  bottomNav:{position:'absolute',zIndex:20,left:0,right:0,bottom:0,height:80,borderTopWidth:1,borderColor:'#242a34',backgroundColor:'#0c1118',flexDirection:'row'},
  navBtn:{flex:1,alignItems:'center',justifyContent:'center',gap:5},navText:{color:'#c2c9d4',fontSize:10},navTextActive:{color:'#a98bff'},
  sheet:{position:'absolute',zIndex:80,left:0,right:0,bottom:0,maxHeight:'74%',borderTopLeftRadius:22,borderTopRightRadius:22,borderWidth:1,borderColor:'#303744',backgroundColor:'#0e141d',paddingHorizontal:16,paddingTop:8,paddingBottom:92},
  sheetHead:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sheetKicker:{color:'#8d72ff',fontSize:8,fontWeight:'800',letterSpacing:1.5},sheetTitle:{color:'#fff',fontSize:15,fontWeight:'800',marginTop:3},close:{width:36,height:36,borderWidth:1,borderColor:'#343b47',borderRadius:10,backgroundColor:'#141923',alignItems:'center',justifyContent:'center'},sheetBody:{paddingBottom:30},
  presetGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},preset:{width:'48.5%',borderWidth:1,borderColor:'#29313d',borderRadius:12,overflow:'hidden',backgroundColor:'#0b1017'},presetActive:{borderColor:'#8b5cf6'},presetThumb:{height:92},presetName:{color:'#e9edf3',fontSize:11,fontWeight:'700',padding:9},
  upload:{minHeight:64,borderWidth:1,borderStyle:'dashed',borderColor:'#49576c',borderRadius:10,backgroundColor:'#111823',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},uploadTitle:{color:'#e5eaf2',fontSize:11,fontWeight:'700'},uploadSub:{color:'#788496',fontSize:9,marginTop:3},
  optionWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},option:{minHeight:40,borderWidth:1,borderColor:'#303947',borderRadius:8,backgroundColor:'#151c27',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},optionActive:{borderColor:'#8a67ff',backgroundColor:'rgba(125,91,255,.18)'},optionText:{color:'#aeb8c7',fontSize:11},optionTextActive:{color:'#fff'},
  regen:{height:42,borderRadius:9,backgroundColor:'#7658e9',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:10},regenText:{color:'#fff',fontSize:11,fontWeight:'700'},error:{color:'#ff9da5',fontSize:10,marginBottom:8},cue:{minHeight:42,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderColor:'#1e2630'},cueTime:{width:40,color:'#9478ff',fontSize:9},cueText:{flex:1,color:'#d5dbe4',fontSize:10},
  mobileDownloads:{flexDirection:'row',gap:8,marginTop:16},audioDownloadBtn:{flex:1,height:42,borderWidth:1,borderColor:'#684fd2',borderRadius:9,backgroundColor:'rgba(112,85,225,.15)',alignItems:'center',justifyContent:'center'},audioDownloadText:{color:'#cfc5ff',fontSize:10,fontWeight:'800'},
});
