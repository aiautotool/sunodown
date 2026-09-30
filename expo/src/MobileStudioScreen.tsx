import { cloneElement, useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, Image as ImageIcon, Menu, Music2, Play, RefreshCw, Save, SlidersHorizontal, Sparkles, Subtitles, Upload, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, RenderJob, Song } from './types';
import { colors } from './theme';
import { regenerateSubtitle } from './api';
import { saveExportedAsset } from './file-actions';
import { exportAudio, exportVisualizer } from './render-engine';
import { useStudioPlayback } from './useStudioPlayback';

type Tool='presets'|'style'|'lyrics'|'audio'|null;
const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function MobileStudioScreen({song,onSave,onBack,onRenderJob}:{song:Song;onSave:()=>void;onBack:()=>void;onRenderJob:(job:RenderJob)=>void}) {
  const [background,setBackground]=useState<string|undefined>(song.picture);
  const [timeline,setTimeline]=useState<KaraokeLine[]>([]);
  const [tool,setTool]=useState<Tool>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [rendering,setRendering]=useState(false);
  const [renderProgress,setRenderProgress]=useState(0);
  const [renderMessage,setRenderMessage]=useState('');
  const [downloadBusy,setDownloadBusy]=useState('');
  const playback=useStudioPlayback(song);
  const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean)||[],[song.lyrics]);

  const pick=async()=>{
    const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9});
    if(!r.canceled)setBackground(r.assets[0]?.uri);
  };
  const reget=async()=>{
    if(!song.id){setError('Bài hát chưa có songId.');return}
    setBusy(true);setError('');
    try{setTimeline(await regenerateSubtitle(song))}
    catch(e){setError(e instanceof Error?e.message:'Không lấy được subtitle')}
    finally{setBusy(false)}
  };
  const save=()=>{onSave();setSaved(true);setTimeout(()=>setSaved(false),1400)};

  const exportVideo=async(durationSeconds?:number)=>{
    if(rendering)return;
    const jobId='local-'+Date.now().toString(36);
    const started=Date.now();
    setRendering(true);setRenderProgress(0);setRenderMessage('');
    onRenderJob({id:jobId,title:song.title,progress:0,status:'queued',createdAt:started});
    try{
      const asset=await exportVisualizer(song,'cinematic',durationSeconds,(progress)=>{
        setRenderProgress(progress);
        onRenderJob({id:jobId,title:song.title,progress,status:'rendering',createdAt:started});
      });
      await saveExportedAsset(asset);
      onRenderJob({id:jobId,title:song.title,progress:100,status:'completed',createdAt:started});
      setRenderMessage('Video ready · đã mở lưu/chia sẻ.');
    }catch(e){
      const message=e instanceof Error?e.message:'Không thể xuất video.';
      onRenderJob({id:jobId,title:song.title,progress:renderProgress,status:'failed',createdAt:started,error:message});
      setRenderMessage(message);
    }finally{setRendering(false)}
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
        {background?<ImageBackground source={{uri:background}} style={StyleSheet.absoluteFill} resizeMode="cover"/>:<LinearGradient colors={['#211838','#7758ef']} style={StyleSheet.absoluteFill}/>}
        <LinearGradient colors={['rgba(4,7,11,0)','rgba(4,7,11,.72)']} style={StyleSheet.absoluteFill}/>
        <View style={styles.ratio}><Text style={styles.ratioText}>9:16</Text></View>
        <View style={styles.wave}>{Array.from({length:38}).map((_,i)=><View key={i} style={[styles.bar,{height:6+((i*13)%31)}]}/>)}</View>
        <Pressable style={styles.centerPlay} onPress={playback.toggle}><Play size={24} color="#fff" fill="#fff"/></Pressable>
      </View>

      <View style={styles.playerOverlay}>
        <Pressable onPress={playback.toggle}><Play size={22} color="#fff" fill="#fff"/></Pressable>
        <View style={styles.seek}><View style={styles.seekFill}/><View style={styles.knob}/></View>
        <Text style={styles.time}>{fmt(playback.current)} / {fmt(playback.duration)}</Text>
        <Music2 size={18} color="#fff"/>
      </View>

      {song.id&&<View style={styles.subtitleRefresh}>
        <Pressable onPress={reget} disabled={busy} style={styles.subtitleBtn}>
          {busy?<ActivityIndicator size="small" color="#fff"/>:<Sparkles size={15} color="#d8ccff"/>}
          <Text style={styles.subtitleBtnText}>{busy?'Đang lấy lại…':'Lấy lại subtitle'}</Text>
        </Pressable>
        <Text style={styles.subtitleHint}>Bỏ cache và tạo subtitle mới từ audio hiện tại.</Text>
      </View>}

      <View style={styles.quickFlow}>
        <Pressable style={[styles.flowItem,styles.flowPrimary]} onPress={()=>setTool('presets')}><Text style={styles.flowTitle}>1 · Chọn mẫu</Text><Text style={styles.flowSub}>Mẫu hoàn chỉnh</Text></Pressable>
        <View style={styles.flowItem}><Text style={styles.flowTitle}>2 · Xem preview</Text><Text style={styles.flowSub}>Chạm Play để kiểm tra</Text></View>
        <Pressable style={styles.flowItem} onPress={()=>void exportVideo()}><Text style={styles.flowTitle}>3 · Xuất video</Text><Text style={styles.flowSub}>{rendering?Math.round(renderProgress)+'%':'Tạo video'}</Text></Pressable>
      </View>

      <Pressable onPress={save} style={[styles.save,saved&&styles.saveDone]}><Save size={16} color={saved?'#8ff0bd':'#c8baff'}/><Text style={[styles.saveText,saved&&{color:'#8ff0bd'}]}>{saved?'Đã lưu dự án':'Lưu dự án'}</Text></Pressable>

      {!!renderMessage&&<Text style={styles.renderMessage}>{renderMessage}</Text>}
      <Pressable style={[styles.export,rendering&&styles.disabled]} disabled={rendering} onPress={()=>void exportVideo()}><Upload size={19} color="#fff"/><Text style={styles.exportText}>{rendering?'Rendering '+Math.round(renderProgress)+'%':'Create & export video'}</Text></Pressable>
      <View style={{height:100}}/>
    </ScrollView>

    <View style={styles.bottomNav}>
      <ToolButton active={tool==='presets'} icon={<Sparkles size={20}/>} label="Mẫu" onPress={()=>setTool(tool==='presets'?null:'presets')}/>
      <ToolButton active={tool==='style'} icon={<SlidersHorizontal size={20}/>} label="Tùy chỉnh" onPress={()=>setTool(tool==='style'?null:'style')}/>
      <ToolButton active={tool==='lyrics'} icon={<Subtitles size={20}/>} label="Lyrics" onPress={()=>setTool(tool==='lyrics'?null:'lyrics')}/>
      <ToolButton active={tool==='audio'} icon={<Music2 size={20}/>} label="Audio" onPress={()=>setTool(tool==='audio'?null:'audio')}/>
    </View>

    {tool&&<View style={styles.sheet}>
      <View style={styles.sheetHead}><View><Text style={styles.sheetKicker}>CREATOR TOOLS</Text><Text style={styles.sheetTitle}>{tool==='presets'?'Mẫu video':tool==='style'?'Tùy chỉnh':tool==='lyrics'?'Subtitle & Lyrics':'Audio'}</Text></View><Pressable onPress={()=>setTool(null)} style={styles.close}><X size={20} color="#fff"/></Pressable></View>
      <ScrollView contentContainerStyle={styles.sheetBody}>
        {tool==='presets'&&<View style={styles.presetGrid}>
          {['Cinematic','Minimal','Neon','Vintage','Aesthetic','Visualizer'].map((name,i)=><Pressable key={name} style={[styles.preset,i===0&&styles.presetActive]}>
            <LinearGradient colors={i===0?['#271d42','#8b6cff']:i===1?['#111820','#455162']:i===2?['#171231','#ad43fa']:i===3?['#30231b','#9f7048']:i===4?['#2c1f35','#cf7cc0']:['#0d1228','#655bf0']} style={styles.presetThumb}>
              {song.picture&&<Image source={{uri:song.picture}} style={StyleSheet.absoluteFill}/>}
              <LinearGradient colors={['transparent','rgba(5,8,13,.72)']} style={StyleSheet.absoluteFill}/>
            </LinearGradient>
            <Text style={styles.presetName}>{name}</Text>
          </Pressable>)}
        </View>}
        {tool==='style'&&<>
          <Pressable style={styles.upload} onPress={pick}><ImageIcon size={20} color="#b9a7ff"/><View><Text style={styles.uploadTitle}>Background riêng</Text><Text style={styles.uploadSub}>Ảnh hoặc video từ thiết bị</Text></View></Pressable>
          <View style={styles.optionWrap}>{['Bars','Spectrum','Circle','Line','Glow','Film'].map((x,i)=><Pressable key={x} style={[styles.option,i===0&&styles.optionActive]}><Text style={[styles.optionText,i===0&&styles.optionTextActive]}>{x}</Text></Pressable>)}</View>
        </>}
        {tool==='lyrics'&&<>
          <Pressable style={styles.regen} onPress={reget} disabled={busy}>{busy?<ActivityIndicator color="#fff"/>:<RefreshCw size={16} color="#fff"/>}<Text style={styles.regenText}>Lấy subtitle mới</Text></Pressable>
          {!!error&&<Text style={styles.error}>{error}</Text>}
          {(timeline.length?timeline:lyricLines.slice(0,8).map((text,i)=>({text,start:i*4,end:i*4+3}))).slice(0,8).map((line,i)=><View key={i} style={styles.cue}><Text style={styles.cueTime}>{fmt(line.start)}</Text><Text style={styles.cueText}>{line.text}</Text></View>)}
        </>}
        {tool==='audio'&&<><View style={styles.audioList}>{['Original','Clean','Vocal','Punchy','Bass+','Wide','Immersive'].map((x,i)=><Pressable key={x} style={styles.audioRow}><View style={[styles.radio,i===0&&styles.radioActive]}/><Text style={styles.audioText}>{x}</Text><Text style={styles.audioDb}>{i===0?'0 dB':'+1.2 dB'}</Text></Pressable>)}</View><View style={styles.audioDownloads}>{(['m4a','mp3','wav'] as const).map(format=><Pressable key={format} disabled={!!downloadBusy} style={styles.audioDownloadBtn} onPress={()=>void downloadAudio(format)}><Text style={styles.audioDownloadText}>{downloadBusy===format?'Đang tạo…':format.toUpperCase()}</Text></Pressable>)}</View></>}
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
  subtitleRefresh:{marginTop:18,flexDirection:'row',alignItems:'center',gap:9,flexWrap:'wrap'},subtitleBtn:{height:36,borderWidth:1,borderColor:'#5c458e',borderRadius:8,backgroundColor:'#211a3b',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},subtitleBtnText:{color:'#d8ccff',fontSize:10,fontWeight:'700'},subtitleHint:{color:'#7d8899',fontSize:9,flexShrink:1},
  quickFlow:{marginTop:12,minHeight:74,borderWidth:1,borderColor:'#27303d',borderRadius:12,backgroundColor:'#0d131c',padding:7,flexDirection:'row',gap:6},flowItem:{flex:1,borderRadius:9,backgroundColor:'#111925',padding:8,justifyContent:'center'},flowPrimary:{borderWidth:1,borderColor:'#6e52db',backgroundColor:'#211a3d'},flowTitle:{color:'#e8ecf3',fontSize:9,fontWeight:'800'},flowSub:{color:'#788496',fontSize:7,marginTop:4},
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
  audioList:{borderTopWidth:1,borderColor:'#252b34'},audioRow:{height:46,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#1e2630'},radio:{width:14,height:14,borderRadius:7,borderWidth:1,borderColor:'#6d7787'},radioActive:{borderWidth:4,borderColor:'#8b6cff'},audioText:{flex:1,color:'#dce0e7',fontSize:11,marginLeft:10},audioDb:{color:'#727e8f',fontSize:9},audioDownloads:{flexDirection:'row',gap:8,marginTop:14},audioDownloadBtn:{flex:1,height:42,borderWidth:1,borderColor:'#684fd2',borderRadius:9,backgroundColor:'rgba(112,85,225,.15)',alignItems:'center',justifyContent:'center'},audioDownloadText:{color:'#cfc5ff',fontSize:10,fontWeight:'800'},
});
