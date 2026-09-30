import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, Download, Image as ImageIcon, Music2, RefreshCw, Save, Sparkles, Subtitles, Wand2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, Song, StudioPreset } from './types';
import { colors, radii } from './theme';
import { regenerateSubtitle } from './api';

const presets:StudioPreset[]=[
 {id:'cinematic',name:'Cinematic',subtitle:'Tím điện ảnh',colors:['#241d3d','#8b6cff'],waveform:'bars',lyrics:'karaoke'},
 {id:'midnight',name:'Midnight',subtitle:'Xanh đêm',colors:['#07121f','#1b5e91'],waveform:'line',lyrics:'classic'},
 {id:'sunset',name:'Sunset',subtitle:'Cam tím',colors:['#2a1322','#e46978'],waveform:'circle',lyrics:'karaoke'},
 {id:'mono',name:'Mono',subtitle:'Tối giản',colors:['#111318','#444b58'],waveform:'spectrum',lyrics:'classic'},
];

const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function StudioScreen({song,onSave}:{song:Song,onSave:()=>void}){
 const [preset,setPreset]=useState(presets[0]!);
 const [background,setBackground]=useState<string|undefined>(song.picture);
 const [timeline,setTimeline]=useState<KaraokeLine[]>([]);
 const [subLoading,setSubLoading]=useState(false);
 const [subError,setSubError]=useState('');
 const [activePanel,setActivePanel]=useState<'style'|'subtitle'|'audio'>('style');
 const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,12)||[],[song.lyrics]);

 const pickBackground=async()=>{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:0.9});
   if(!result.canceled) setBackground(result.assets[0]?.uri);
 };
 const reget=async()=>{
   if(!song.id){setSubError('Bài hát chưa có song id để gọi subtitle cloud.');return}
   setSubLoading(true);setSubError('');
   try{setTimeline(await regenerateSubtitle(song))}catch(e){setSubError(e instanceof Error?e.message:'Không lấy lại được subtitle')}finally{setSubLoading(false)}
 };
 return <View style={styles.root}>
   <View style={styles.canvasColumn}>
     <View style={styles.stage}>
       {background?<ImageBackground source={{uri:background}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<LinearGradient colors={preset.colors} style={StyleSheet.absoluteFill}/>}
       <LinearGradient colors={['transparent','rgba(4,7,11,.82)']} style={StyleSheet.absoluteFill}/>
       <View style={styles.previewBadge}><Sparkles size={13} color="#c9b9ff"/><Text style={styles.previewBadgeText}>LIVE PREVIEW · 9:16</Text></View>
       <View style={styles.karaoke}>
         <Text style={styles.karaokeMain}>{timeline[0]?.text||lyricLines[0]||song.title}</Text>
         <Text style={styles.karaokeNext}>{timeline[1]?.text||lyricLines[1]||'SunoDown Creator Studio'}</Text>
       </View>
       <View style={styles.wave}>
         {Array.from({length:34}).map((_,i)=><View key={i} style={[styles.bar,{height:10+((i*17)%42)}]}/>)}
       </View>
     </View>

     <View style={styles.transport}>
       <Music2 size={20} color="#ddd"/>
       <Text style={styles.time}>0:00</Text>
       <View style={styles.seek}><View style={[styles.seekFill,{width:'28%'}]}/></View>
       <Text style={styles.time}>{fmt(song.duration)}</Text>
     </View>

     <View style={styles.timelineWrap}>
       <View style={styles.ruler}><Text style={styles.rulerText}>00:00</Text><Text style={styles.rulerText}>00:15</Text><Text style={styles.rulerText}>00:30</Text><Text style={styles.rulerText}>00:45</Text></View>
       <View style={styles.track}>
         {Array.from({length:6}).map((_,i)=><View key={i} style={styles.clip}>{background?<Image source={{uri:background}} style={StyleSheet.absoluteFill}/>:<LinearGradient colors={preset.colors} style={StyleSheet.absoluteFill}/>}</View>)}
         <View style={styles.playhead}/>
       </View>
       <View style={styles.subtitleTrack}><Subtitles size={14} color="#baa8ff"/><Text numberOfLines={1} style={styles.subtitleTrackText}>{timeline.length?`${timeline.length} cue đã sync`:'Subtitle timeline — nhấn Lấy subtitle mới để tạo cue'}</Text></View>
     </View>
   </View>

   <ScrollView style={styles.inspector} contentContainerStyle={styles.inspectorContent}>
     <View style={styles.songRow}>
       {song.picture?<Image source={{uri:song.picture}} style={styles.cover}/>:<View style={[styles.cover,styles.coverEmpty]}><Music2 color={colors.violet}/></View>}
       <View style={{flex:1}}><Text numberOfLines={2} style={styles.songTitle}>{song.title}</Text><Text style={styles.songMeta}>{song.creator||'Suno'}</Text><Text style={styles.songMeta}>{fmt(song.duration)}</Text></View>
     </View>

     <View style={styles.tabs}>
       <Tab label="STYLE" active={activePanel==='style'} onPress={()=>setActivePanel('style')}/>
       <Tab label="SUBTITLE" active={activePanel==='subtitle'} onPress={()=>setActivePanel('subtitle')}/>
       <Tab label="AUDIO" active={activePanel==='audio'} onPress={()=>setActivePanel('audio')}/>
     </View>

     {activePanel==='style'&&<>
       <SectionTitle icon={<Wand2 size={17} color="#b9a9ff"/>} title="Preset hình ảnh"/>
       <View style={styles.presetGrid}>{presets.map(item=><Pressable key={item.id} onPress={()=>setPreset(item)} style={[styles.presetCard,preset.id===item.id&&styles.presetActive]}><LinearGradient colors={item.colors} style={styles.presetThumb}/><Text style={styles.presetName}>{item.name}</Text><Text style={styles.presetSub}>{item.subtitle}</Text></Pressable>)}</View>
       <Pressable onPress={pickBackground} style={styles.actionRow}><ImageIcon size={19} color="#d6dbe4"/><View style={{flex:1}}><Text style={styles.actionTitle}>Background riêng</Text><Text style={styles.actionSub}>Chọn ảnh hoặc video từ thiết bị</Text></View><ChevronDown size={18} color="#7d8798"/></Pressable>
     </>}

     {activePanel==='subtitle'&&<>
       <SectionTitle icon={<Subtitles size={17} color="#b9a9ff"/>} title="Karaoke subtitle"/>
       <Text style={styles.help}>Subtitle được gọi qua backend v24 hiện tại. “Lấy subtitle mới” gửi force + noCache để không dùng lại cue cũ.</Text>
       <Pressable onPress={reget} disabled={subLoading} style={styles.primarySmall}>{subLoading?<ActivityIndicator color="#fff"/>:<RefreshCw size={17} color="#fff"/>}<Text style={styles.primarySmallText}>Lấy subtitle mới</Text></Pressable>
       {!!subError&&<Text style={styles.error}>{subError}</Text>}
       <View style={styles.lyricList}>{(timeline.length?timeline.slice(0,8):lyricLines.slice(0,8).map((text,i)=>({text,start:i*4,end:i*4+3}))).map((line,i)=><View key={i} style={styles.lyricItem}><Text style={styles.lyricTime}>{fmt(line.start)}</Text><Text style={styles.lyricText}>{line.text}</Text></View>)}</View>
     </>}

     {activePanel==='audio'&&<>
       <SectionTitle icon={<Music2 size={17} color="#b9a9ff"/>} title="Audio mastering"/>
       <Text style={styles.help}>Native playback dùng expo-audio để giữ background audio/lock-screen. Mastering/export nặng tiếp tục gọi engine backend v24 để Android, iOS và Web cho kết quả đồng nhất.</Text>
       {['Original','Clean','Vocal','Punchy','Bass+','Wide','Immersive'].map((name,i)=><View key={name} style={styles.audioPreset}><View style={styles.radio}>{i===0&&<View style={styles.radioIn}/>}</View><Text style={styles.audioPresetText}>{name}</Text><Text style={styles.db}>{i===0?'0 dB':i<4?'+1.2 dB':'+2.0 dB'}</Text></View>)}
     </>}

     <View style={styles.footerActions}>
       <Pressable style={styles.secondaryBtn} onPress={onSave}><Save size={17} color="#e5e8ee"/><Text style={styles.secondaryText}>Lưu project</Text></Pressable>
       <Pressable style={styles.exportBtn}><Download size={17} color="#fff"/><Text style={styles.exportText}>Xuất video</Text></Pressable>
     </View>
   </ScrollView>
 </View>
}

function Tab({label,active,onPress}:{label:string,active:boolean,onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.tab,active&&styles.tabActive]}><Text style={[styles.tabText,active&&styles.tabTextActive]}>{label}</Text></Pressable>}
function SectionTitle({icon,title}:{icon:React.ReactNode,title:string}){return <View style={styles.sectionTitle}>{icon}<Text style={styles.sectionTitleText}>{title}</Text></View>}

const styles=StyleSheet.create({
 root:{flex:1,flexDirection:'row'},
 canvasColumn:{flex:1,minWidth:0,padding:16,borderRightWidth:1,borderColor:colors.border},
 stage:{flex:1,minHeight:370,borderRadius:10,overflow:'hidden',backgroundColor:'#141b24',position:'relative'},
 previewBadge:{position:'absolute',left:12,top:12,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(9,13,19,.72)',borderWidth:1,borderColor:'rgba(255,255,255,.08)',paddingHorizontal:10,paddingVertical:7,borderRadius:99},
 previewBadgeText:{color:'#c8c2dd',fontSize:9,fontWeight:'800',letterSpacing:1},
 karaoke:{position:'absolute',left:'8%',right:'8%',bottom:58,alignItems:'center'},
 karaokeMain:{color:'#fff',fontWeight:'800',fontSize:25,textAlign:'center',textShadowColor:'#000',textShadowRadius:8},karaokeNext:{color:'#d9dce3',fontSize:16,marginTop:8,textAlign:'center'},
 wave:{position:'absolute',left:20,right:20,bottom:18,height:28,flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:3,opacity:.72},
 bar:{width:3,borderRadius:3,backgroundColor:'#b7a3ff'},
 transport:{height:66,backgroundColor:'#0d1219',flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18,borderBottomLeftRadius:9,borderBottomRightRadius:9},
 time:{color:'#9ba5b5',fontSize:11},seek:{height:4,backgroundColor:'#29313e',borderRadius:99,flex:1},seekFill:{height:4,backgroundColor:colors.violet,borderRadius:99},
 timelineWrap:{marginTop:16},ruler:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:3,marginBottom:5},rulerText:{color:'#778292',fontSize:9},
 track:{height:72,flexDirection:'row',borderWidth:1,borderColor:'#343a44',borderRadius:7,overflow:'hidden',position:'relative'},clip:{flex:1,borderRightWidth:1,borderColor:'#272f39',overflow:'hidden'},playhead:{position:'absolute',left:'28%',top:0,bottom:0,width:2,backgroundColor:'#fff'},
 subtitleTrack:{height:36,marginTop:6,borderRadius:6,backgroundColor:'#19162b',borderWidth:1,borderColor:'#3d315f',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:8},
 subtitleTrackText:{color:'#b9afcf',fontSize:10,flex:1},
 inspector:{width:410,backgroundColor:'#0a0e14'},inspectorContent:{padding:24,paddingBottom:110},
 songRow:{flexDirection:'row',gap:15,alignItems:'center'},cover:{width:92,height:92,borderRadius:10,backgroundColor:'#151c26'},coverEmpty:{alignItems:'center',justifyContent:'center'},songTitle:{color:colors.text,fontSize:20,fontWeight:'800'},songMeta:{color:colors.muted,fontSize:12,marginTop:7},
 tabs:{height:46,flexDirection:'row',borderBottomWidth:1,borderColor:colors.border,marginTop:24,marginBottom:20},tab:{flex:1,alignItems:'center',justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent'},tabActive:{borderBottomColor:colors.violet},tabText:{color:'#737e8e',fontSize:10,fontWeight:'800',letterSpacing:1},tabTextActive:{color:'#c8b9ff'},
 sectionTitle:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:14},sectionTitleText:{color:'#e8eaf0',fontSize:14,fontWeight:'800'},
 presetGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},presetCard:{width:'48%',padding:7,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:'#10161f'},presetActive:{borderColor:colors.violet},presetThumb:{height:72,borderRadius:8},presetName:{color:'#eceef3',fontSize:12,fontWeight:'700',marginTop:7},presetSub:{color:'#778293',fontSize:9,marginTop:2},
 actionRow:{height:66,flexDirection:'row',alignItems:'center',gap:11,borderTopWidth:1,borderColor:colors.border,marginTop:20},actionTitle:{color:'#e4e7ed',fontSize:13,fontWeight:'700'},actionSub:{color:'#768192',fontSize:10,marginTop:3},
 help:{color:'#8f99a9',fontSize:11,lineHeight:18,marginBottom:14},primarySmall:{height:44,borderRadius:11,backgroundColor:colors.violet,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},primarySmallText:{color:'#fff',fontWeight:'800',fontSize:12},error:{color:colors.red,fontSize:11,marginTop:10},
 lyricList:{marginTop:14,gap:6},lyricItem:{flexDirection:'row',gap:10,paddingVertical:9,borderBottomWidth:1,borderColor:'#1c2330'},lyricTime:{color:'#8e74e7',width:38,fontSize:10},lyricText:{color:'#d9dde5',fontSize:11,flex:1},
 audioPreset:{height:46,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#1c2330'},radio:{width:15,height:15,borderRadius:8,borderWidth:1,borderColor:'#6c7584',alignItems:'center',justifyContent:'center'},radioIn:{width:8,height:8,borderRadius:4,backgroundColor:colors.violet},audioPresetText:{color:'#dce0e7',fontSize:12,marginLeft:10,flex:1},db:{color:'#707b8b',fontSize:10},
 footerActions:{flexDirection:'row',gap:9,marginTop:24},secondaryBtn:{height:46,flex:1,borderRadius:11,borderWidth:1,borderColor:'#343b47',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},secondaryText:{color:'#e5e8ee',fontSize:11,fontWeight:'700'},exportBtn:{height:46,flex:1.15,borderRadius:11,backgroundColor:colors.violet,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},exportText:{color:'#fff',fontSize:11,fontWeight:'800'}
});
