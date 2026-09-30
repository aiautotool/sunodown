import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, Download, Image as ImageIcon, Music2, Palette, Play, RefreshCw, Save, SlidersHorizontal, Sparkles, Subtitles, Upload, Wand2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, Song, StudioPreset } from './types';
import { colors, v24 } from './theme';
import { regenerateSubtitle } from './api';

const presets:StudioPreset[]=[
  {id:'cinematic',name:'Cinematic',subtitle:'Điện ảnh cảm xúc',colors:['#241d3d','#8b6cff'],waveform:'bars',lyrics:'karaoke'},
  {id:'minimal',name:'Minimal',subtitle:'Tối giản hiện đại',colors:['#10151d','#444f60'],waveform:'line',lyrics:'classic'},
  {id:'neon',name:'Neon',subtitle:'Ánh sáng sân khấu',colors:['#16112c','#b148ff'],waveform:'spectrum',lyrics:'karaoke'},
  {id:'vintage',name:'Vintage',subtitle:'Film ấm cổ điển',colors:['#342219','#a06c43'],waveform:'line',lyrics:'classic'},
  {id:'aesthetic',name:'Aesthetic',subtitle:'Mềm và nghệ thuật',colors:['#2c1c31','#cc74bd'],waveform:'circle',lyrics:'karaoke'},
  {id:'visualizer',name:'Visualizer',subtitle:'Tập trung waveform',colors:['#0d1125','#6556e8'],waveform:'spectrum',lyrics:'off'},
];

const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
type Fold='background'|'style'|'subtitle'|'audio'|null;

export function StudioScreen({song,onSave}:{song:Song;onSave:()=>void}){
  const {height}=useWindowDimensions();
  const [preset,setPreset]=useState(presets[0]!);
  const [background,setBackground]=useState<string|undefined>(song.picture);
  const [timeline,setTimeline]=useState<KaraokeLine[]>([]);
  const [subLoading,setSubLoading]=useState(false);
  const [subError,setSubError]=useState('');
  const [fold,setFold]=useState<Fold>('style');
  const [saved,setSaved]=useState(false);
  const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,14)||[],[song.lyrics]);
  const stageHeight=Math.max(420,height-240);

  const save=()=>{onSave();setSaved(true);setTimeout(()=>setSaved(false),1600)};
  const pickBackground=async()=>{
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:0.9});
    if(!result.canceled) setBackground(result.assets[0]?.uri);
  };
  const reget=async()=>{
    if(!song.id){setSubError('Bài hát chưa có song id.');return}
    setSubLoading(true);setSubError('');
    try{setTimeline(await regenerateSubtitle(song))}
    catch(e){setSubError(e instanceof Error?e.message:'Không lấy lại được subtitle')}
    finally{setSubLoading(false)}
  };

  return <View style={styles.root}>
    <ScrollView style={styles.canvasScroll} contentContainerStyle={styles.canvasColumn}>
      <View style={[styles.stage,{height:stageHeight}]}>
        {background?<ImageBackground source={{uri:background}} resizeMode="cover" style={StyleSheet.absoluteFillObject}/>:<LinearGradient colors={preset.colors} style={StyleSheet.absoluteFillObject}/>}
        <LinearGradient colors={['rgba(4,7,11,0)','rgba(4,7,11,.08)','rgba(4,7,11,.72)']} locations={[0,.62,1]} style={StyleSheet.absoluteFillObject}/>
        <View style={styles.stageRatio}><Text style={styles.stageRatioText}>9:16</Text></View>
        <View style={styles.karaoke}>
          <Text style={styles.karaokeMain}>{timeline[0]?.text||lyricLines[0]||song.title}</Text>
          <Text style={styles.karaokeNext}>{timeline[1]?.text||lyricLines[1]||'SunoDown Creator Studio'}</Text>
        </View>
        <View style={styles.wave}>
          {Array.from({length:54}).map((_,i)=><View key={i} style={[styles.bar,{height:8+((i*17)%48)}]}/>)}
        </View>
        <Pressable style={styles.centerPlay}><Play size={27} color="#fff" fill="#fff"/></Pressable>
      </View>

      <View style={styles.player}>
        <Pressable style={styles.playerBtn}><Play size={23} color="#fff" fill="#fff"/></Pressable>
        <Text style={styles.playerTime}>0:00 / {fmt(song.duration)}</Text>
        <View style={styles.seek}><View style={styles.seekFill}/><View style={styles.seekKnob}/></View>
        <Music2 size={19} color="#d7dde7"/>
        <SlidersHorizontal size={18} color="#aeb7c5"/>
      </View>

      {song.id&&<View style={styles.subtitleRefresh}>
        <Pressable style={styles.subtitleRefreshBtn} disabled={subLoading} onPress={reget}>
          {subLoading?<ActivityIndicator size="small" color="#fff"/>:<Sparkles size={15} color="#d9ceff"/>}
          <Text style={styles.subtitleRefreshText}>{subLoading?'Đang lấy lại…':'Lấy lại subtitle'}</Text>
        </Pressable>
        <Text style={styles.subtitleRefreshHint}>Bỏ cache và tạo subtitle mới từ audio hiện tại.</Text>
      </View>}

      <View style={styles.firstRun}>
        <Pressable style={[styles.firstRunItem,styles.firstRunPrimary]} onPress={()=>setFold('style')}><Text style={styles.firstRunStrong}>1 · Chọn mẫu</Text><Text style={styles.firstRunSub}>Mẫu hoàn chỉnh</Text></Pressable>
        <View style={styles.firstRunItem}><Text style={styles.firstRunStrong}>2 · Xem preview</Text><Text style={styles.firstRunSub}>Chạm Play để kiểm tra</Text></View>
        <Pressable style={styles.firstRunItem}><Text style={styles.firstRunStrong}>3 · Xuất video</Text><Text style={styles.firstRunSub}>Tạo video</Text></Pressable>
      </View>

      <EditorTimeline song={song} background={background} preset={preset} timeline={timeline}/>
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

      <View style={styles.presetSystem}>
        <View style={styles.presetHead}>
          <View><View style={styles.presetKickerRow}><Sparkles size={13} color="#a78bfa"/><Text style={styles.presetKicker}>PRESET SYSTEM</Text></View><Text style={styles.presetHeadTitle}>Mẫu video</Text></View>
          <Pressable style={styles.presetHeadBtn}><Text style={styles.presetHeadBtnText}>Lưu mẫu</Text></Pressable>
        </View>
        <View style={styles.presetTabs}><View style={[styles.pill,styles.pillActive]}><Text style={styles.pillActiveText}>Nổi bật</Text></View><View style={styles.pill}><Text style={styles.pillText}>Social</Text></View><View style={styles.pill}><Text style={styles.pillText}>Lyrics</Text></View></View>
        <View style={styles.presetGrid}>
          {presets.map((item,index)=><Pressable key={item.id} onPress={()=>setPreset(item)} style={[styles.presetCard,preset.id===item.id&&{borderColor:item.colors[1]}]}>
            <LinearGradient colors={item.colors} style={styles.presetArt}>
              {song.picture&&<Image source={{uri:song.picture}} style={StyleSheet.absoluteFillObject} resizeMode="cover"/>}
              <LinearGradient colors={['rgba(7,10,16,.05)','rgba(7,10,16,.7)']} style={StyleSheet.absoluteFillObject}/>
              <Text style={styles.presetBadge}>{index===0?'HOT':'STYLE'}</Text>
              <View style={[styles.presetDisc,{borderColor:item.colors[1]}]}><View style={[styles.presetDiscIn,{backgroundColor:item.colors[1]}]}/></View>
            </LinearGradient>
            <View style={styles.presetCopy}><Text numberOfLines={1} style={styles.presetName}>{item.name}</Text><Text numberOfLines={2} style={styles.presetDesc}>{item.subtitle}</Text></View>
          </Pressable>)}
        </View>
      </View>

      <FoldRow icon={<ImageIcon size={20} color="#b9c2cf"/>} title="Background" open={fold==='background'} onPress={()=>setFold(fold==='background'?null:'background')}>
        <Pressable onPress={pickBackground} style={styles.uploadBg}><Upload size={18} color="#b9a7ff"/><View><Text style={styles.uploadTitle}>Ảnh / video của bạn</Text><Text style={styles.uploadSub}>Chọn background từ thiết bị</Text></View></Pressable>
      </FoldRow>
      <FoldRow icon={<Palette size={20} color="#b9c2cf"/>} title="Style & Visualizer" open={fold==='style'} onPress={()=>setFold(fold==='style'?null:'style')}>
        <View style={styles.optionWrap}>{['Bars','Spectrum','Circle','Line','Glow','Film'].map((x,i)=><Pressable key={x} style={[styles.option,i===0&&styles.optionActive]}><Text style={[styles.optionText,i===0&&styles.optionTextActive]}>{x}</Text></Pressable>)}</View>
      </FoldRow>
      <FoldRow icon={<Subtitles size={20} color="#b9c2cf"/>} title="Subtitle & Lyrics" open={fold==='subtitle'} onPress={()=>setFold(fold==='subtitle'?null:'subtitle')}>
        <Pressable onPress={reget} style={styles.regen} disabled={subLoading}>{subLoading?<ActivityIndicator color="#fff"/>:<RefreshCw size={15} color="#fff"/>}<Text style={styles.regenText}>Lấy subtitle mới</Text></Pressable>
        {!!subError&&<Text style={styles.error}>{subError}</Text>}
        {(timeline.length?timeline:lyricLines.slice(0,5).map((text,i)=>({text,start:i*4,end:i*4+3}))).slice(0,5).map((line,i)=><View style={styles.cue} key={i}><Text style={styles.cueTime}>{fmt(line.start)}</Text><Text style={styles.cueText}>{line.text}</Text></View>)}
      </FoldRow>
      <FoldRow icon={<Music2 size={20} color="#b9c2cf"/>} title="Audio" open={fold==='audio'} onPress={()=>setFold(fold==='audio'?null:'audio')}>
        <View style={styles.optionWrap}>{['Original','Clean','Vocal','Punchy','Bass+','Wide','Immersive'].map((x,i)=><Pressable key={x} style={[styles.option,i===0&&styles.optionActive]}><Text style={[styles.optionText,i===0&&styles.optionTextActive]}>{x}</Text></Pressable>)}</View>
      </FoldRow>

      <View style={styles.visualSync}><Text style={styles.visualSyncLabel}>VISUAL SYNC</Text><Text style={styles.visualSyncHash}>V24-RN</Text></View>
      <View style={{height:270}}/>
    </ScrollView>

    <View style={styles.actions}>
      <Pressable style={styles.export}><Upload size={20} color="#fff"/><Text style={styles.exportText}>Export {fmt(song.duration)} video</Text></Pressable>
      <View style={styles.downloads}>
        <Pressable style={styles.downloadBtn}><Play size={15} color="#cfc5ff"/><Text style={styles.downloadText}>30s cao trào</Text></Pressable>
        <Pressable style={styles.downloadBtn}><Download size={15} color="#cfc5ff"/><Text style={styles.downloadText}>MP3</Text></Pressable>
        <Pressable style={styles.downloadBtn}><Download size={15} color="#cfc5ff"/><Text style={styles.downloadText}>WAV</Text></Pressable>
      </View>
    </View>
  </View>
}

function FoldRow({icon,title,open,onPress,children}:{icon:React.ReactNode;title:string;open:boolean;onPress:()=>void;children:React.ReactNode}){
  return <View style={styles.fold}><Pressable style={styles.foldButton} onPress={onPress}>{icon}<Text style={styles.foldTitle}>{title}</Text><ChevronDown size={18} color="#7f8999" style={{transform:[{rotate:open?'180deg':'0deg'}]}}/></Pressable>{open&&<View style={styles.foldContent}>{children}</View>}</View>
}

function EditorTimeline({song,background,preset,timeline}:{song:Song;background?:string;preset:StudioPreset;timeline:KaraokeLine[]}){
  return <View style={styles.editorTimeline}>
    <View style={styles.timelineHead}><Text style={styles.timelineHeadTitle}>Timeline</Text><Text style={styles.timelineHeadSub}>Video · Subtitle · Audio</Text><Pressable style={styles.timelineIcon}><SlidersHorizontal size={15} color="#d8deea"/></Pressable></View>
    <View style={styles.timelineCanvas}>
      <View style={styles.ruler}>{['00:00','00:15','00:30','00:45','01:00'].map((x,i)=><View key={x} style={{flex:1}}><Text style={styles.rulerText}>{x}</Text><View style={styles.rulerTick}/></View>)}</View>
      <View style={styles.trackRow}><Text style={styles.trackLabel}>VIDEO</Text><View style={styles.videoClip}>{Array.from({length:6}).map((_,i)=><View key={i} style={styles.clipThumb}>{background?<Image source={{uri:background}} style={StyleSheet.absoluteFillObject}/>:<LinearGradient colors={preset.colors} style={StyleSheet.absoluteFillObject}/>}</View>)}<Text numberOfLines={1} style={styles.clipTitle}>{preset.name} · background</Text></View></View>
      <View style={styles.trackRow}><Text style={styles.trackLabel}>SUB</Text><View style={styles.subClip}><Text numberOfLines={1} style={styles.subClipText}>{timeline[0]?.text||song.lyrics?.split(/\n/)[0]||'Subtitle track'}</Text></View></View>
      <View style={styles.playhead}><View style={styles.playheadDot}/></View>
    </View>
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
  subtitleRefresh:{minHeight:46,marginTop:10,flexDirection:'row',alignItems:'center',gap:10},subtitleRefreshBtn:{height:34,borderWidth:1,borderColor:'#5b438f',borderRadius:8,backgroundColor:'#211a3b',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7},subtitleRefreshText:{color:'#d9ceff',fontSize:10,fontWeight:'700'},subtitleRefreshHint:{color:'#778395',fontSize:9},
  firstRun:{minHeight:70,marginTop:8,borderWidth:1,borderColor:'#27303d',borderRadius:12,backgroundColor:'#0d131c',padding:7,flexDirection:'row',gap:7},firstRunItem:{flex:1,borderRadius:9,backgroundColor:'#111925',padding:10,justifyContent:'center'},firstRunPrimary:{borderWidth:1,borderColor:'#6e52db',backgroundColor:'#211a3d'},firstRunStrong:{color:'#e9edf4',fontSize:10,fontWeight:'800'},firstRunSub:{color:'#7f8a9b',fontSize:8,marginTop:4},

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
  export:{height:58,borderRadius:9,backgroundColor:'#7057f8',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},exportText:{color:'#fff',fontSize:13,fontWeight:'700'},downloads:{flexDirection:'row',gap:8,marginTop:9},downloadBtn:{flex:1,minHeight:42,borderWidth:1,borderColor:'#6f57dd',borderRadius:8,backgroundColor:'rgba(114,83,230,.15)',alignItems:'center',justifyContent:'center',gap:4},downloadText:{color:'#cfc5ff',fontSize:9,textAlign:'center'},
  editorTimeline:{marginTop:18,borderWidth:1,borderColor:'#202735',borderRadius:14,backgroundColor:'#090d14',overflow:'hidden'},timelineHead:{height:52,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,borderBottomWidth:1,borderColor:'#202735'},timelineHeadTitle:{color:'#f4f6fb',fontSize:12,fontWeight:'800'},timelineHeadSub:{flex:1,color:'#727d90',fontSize:11},timelineIcon:{width:32,height:32,borderWidth:1,borderColor:'#313a49',borderRadius:9,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},
  timelineCanvas:{height:205,paddingTop:30,position:'relative',backgroundColor:'#070a10'},ruler:{position:'absolute',left:0,right:0,top:0,height:30,flexDirection:'row',borderBottomWidth:1,borderColor:'#28303d'},rulerText:{color:'#8792a5',fontSize:10,marginLeft:4,marginTop:3},rulerTick:{height:13,borderLeftWidth:1,borderColor:'#3b4556',marginTop:4},
  trackRow:{height:76,borderBottomWidth:1,borderColor:'#171d27',paddingTop:7,position:'relative'},trackLabel:{position:'absolute',left:6,top:5,zIndex:8,color:'#818da1',fontSize:9,backgroundColor:'rgba(17,23,34,.85)',paddingHorizontal:6,paddingVertical:3,borderRadius:5},
  videoClip:{position:'absolute',left:'7%',right:'4%',top:31,height:46,borderWidth:1,borderColor:'#3d485a',borderRadius:5,overflow:'hidden',backgroundColor:'#161d29',flexDirection:'row'},clipThumb:{width:54,height:46,borderRightWidth:1,borderColor:'#2a3240'},clipTitle:{position:'absolute',left:60,top:16,right:8,color:'#e9edf5',fontSize:10,fontWeight:'700'},
  subClip:{position:'absolute',left:'12%',right:'18%',top:32,height:38,borderWidth:1,borderColor:'#6948b4',borderRadius:5,backgroundColor:'#352366',justifyContent:'center',paddingHorizontal:12},subClipText:{color:'#e9e0ff',fontSize:10},
  playhead:{position:'absolute',zIndex:12,left:'27%',top:18,bottom:0,width:1,backgroundColor:'#fff'},playheadDot:{width:9,height:9,marginLeft:-4,borderRadius:5,backgroundColor:'#fff'},
});
