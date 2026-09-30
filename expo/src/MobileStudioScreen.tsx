import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Download, Image as ImageIcon, Music2, RefreshCw, Save, Sparkles, Subtitles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaraokeLine, Song } from './types';
import { colors } from './theme';
import { regenerateSubtitle } from './api';

export function MobileStudioScreen({song,onSave}:{song:Song,onSave:()=>void}) {
  const [background,setBackground]=useState<string|undefined>(song.picture);
  const [timeline,setTimeline]=useState<KaraokeLine[]>([]);
  const [tab,setTab]=useState<'style'|'subtitle'|'audio'>('style');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const lyricLines=useMemo(()=>song.lyrics?.split(/\n+/).map(v=>v.trim()).filter(Boolean)||[],[song.lyrics]);

  const pick=async()=>{const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9});if(!r.canceled)setBackground(r.assets[0]?.uri)};
  const reget=async()=>{setBusy(true);setError('');try{setTimeline(await regenerateSubtitle(song))}catch(e){setError(e instanceof Error?e.message:'Không lấy được subtitle')}finally{setBusy(false)}};

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={styles.songRow}>
      {song.picture?<Image source={{uri:song.picture}} style={styles.cover}/>:<View style={[styles.cover,styles.empty]}><Music2 color={colors.violet}/></View>}
      <View style={{flex:1}}><Text numberOfLines={2} style={styles.title}>{song.title}</Text><Text style={styles.meta}>{song.creator||'Suno'}</Text></View>
    </View>

    <View style={styles.stage}>
      {background?<ImageBackground source={{uri:background}} style={StyleSheet.absoluteFill}/>:<LinearGradient colors={['#1b1731','#6d51db']} style={StyleSheet.absoluteFill}/>}
      <LinearGradient colors={['transparent','rgba(5,8,12,.88)']} style={StyleSheet.absoluteFill}/>
      <View style={styles.badge}><Sparkles size={12} color="#c9b9ff"/><Text style={styles.badgeText}>PREVIEW · 9:16</Text></View>
      <View style={styles.karaoke}><Text style={styles.line}>{timeline[0]?.text||lyricLines[0]||song.title}</Text><Text style={styles.line2}>{timeline[1]?.text||lyricLines[1]||'SunoDown Creator Studio'}</Text></View>
      <View style={styles.wave}>{Array.from({length:28}).map((_,i)=><View key={i} style={[styles.bar,{height:8+((i*13)%34)}]}/>)}</View>
    </View>

    <View style={styles.tabs}>
      {(['style','subtitle','audio'] as const).map(x=><Pressable key={x} onPress={()=>setTab(x)} style={[styles.tab,tab===x&&styles.tabActive]}><Text style={[styles.tabText,tab===x&&styles.tabTextActive]}>{x==='style'?'STYLE':x==='subtitle'?'SUBTITLE':'AUDIO'}</Text></Pressable>)}
    </View>

    {tab==='style'&&<View style={styles.panel}>
      <Pressable onPress={pick} style={styles.row}><ImageIcon size={19} color="#dfe3ea"/><View style={{flex:1}}><Text style={styles.rowTitle}>Background riêng</Text><Text style={styles.rowSub}>Chọn ảnh/video từ thiết bị</Text></View></Pressable>
      {['Cinematic','Midnight','Sunset','Mono'].map((x,i)=><View key={x} style={styles.preset}><LinearGradient colors={i===0?['#271d42','#8b6cff']:i===1?['#07121f','#1b5e91']:i===2?['#2a1322','#e46978']:['#111318','#444b58']} style={styles.swatch}/><Text style={styles.presetText}>{x}</Text></View>)}
    </View>}

    {tab==='subtitle'&&<View style={styles.panel}>
      <Text style={styles.help}>Lấy subtitle mới sẽ bỏ cache cũ và gọi lại engine v24.</Text>
      <Pressable onPress={reget} disabled={busy} style={styles.primary}>{busy?<ActivityIndicator color="#fff"/>:<RefreshCw size={17} color="#fff"/>}<Text style={styles.primaryText}>Lấy subtitle mới</Text></Pressable>
      {!!error&&<Text style={styles.error}>{error}</Text>}
      {(timeline.length?timeline:lyricLines.slice(0,8).map((text,i)=>({text,start:i*4,end:i*4+3}))).slice(0,8).map((l,i)=><View key={i} style={styles.lyric}><Text style={styles.time}>{Math.floor(l.start/60)}:{String(Math.floor(l.start%60)).padStart(2,'0')}</Text><Text style={styles.lyricText}>{l.text}</Text></View>)}
    </View>}

    {tab==='audio'&&<View style={styles.panel}>
      <Text style={styles.help}>Playback native dùng expo-audio. Mastering/export giữ ở backend để kết quả giống nhau trên Android, iOS và Web.</Text>
      {['Original','Clean','Vocal','Punchy','Bass+','Wide','Immersive'].map((x,i)=><View key={x} style={styles.audio}><View style={[styles.radio,i===0&&styles.radioOn]}/><Text style={styles.audioText}>{x}</Text></View>)}
    </View>}

    <View style={styles.actions}><Pressable onPress={onSave} style={styles.secondary}><Save size={17} color="#fff"/><Text style={styles.secondaryText}>Lưu</Text></Pressable><Pressable style={styles.export}><Download size={17} color="#fff"/><Text style={styles.exportText}>Xuất video</Text></Pressable></View>
  </ScrollView>
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.bg},content:{padding:14,paddingBottom:170},songRow:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:14},cover:{width:58,height:58,borderRadius:10,backgroundColor:'#141b24'},empty:{alignItems:'center',justifyContent:'center'},title:{color:colors.text,fontSize:17,fontWeight:'800'},meta:{color:colors.muted,fontSize:11,marginTop:5},
 stage:{width:'100%',aspectRatio:9/13,borderRadius:14,overflow:'hidden',backgroundColor:'#141b24'},badge:{position:'absolute',top:10,left:10,flexDirection:'row',gap:6,alignItems:'center',paddingHorizontal:9,paddingVertical:6,borderRadius:99,backgroundColor:'rgba(7,10,15,.72)'},badgeText:{color:'#c9c1da',fontSize:8,fontWeight:'800',letterSpacing:1},
 karaoke:{position:'absolute',left:18,right:18,bottom:58,alignItems:'center'},line:{color:'#fff',fontSize:21,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:8},line2:{color:'#d7dbe3',fontSize:13,textAlign:'center',marginTop:7},
 wave:{position:'absolute',left:18,right:18,bottom:18,height:28,flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:3},bar:{width:3,backgroundColor:'#b7a3ff',borderRadius:4},
 tabs:{height:48,flexDirection:'row',borderBottomWidth:1,borderColor:colors.border,marginTop:14},tab:{flex:1,alignItems:'center',justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent'},tabActive:{borderBottomColor:colors.violet},tabText:{color:'#6f7a8a',fontSize:10,fontWeight:'800'},tabTextActive:{color:'#bcaaff'},
 panel:{paddingTop:15},row:{height:62,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:colors.border},rowTitle:{color:'#e7e9ef',fontSize:13,fontWeight:'700'},rowSub:{color:'#778293',fontSize:10,marginTop:3},
 preset:{height:48,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderColor:'#1c2330'},swatch:{width:34,height:34,borderRadius:8},presetText:{color:'#d8dce4',fontSize:12,fontWeight:'600'},
 help:{color:'#8490a0',fontSize:11,lineHeight:17,marginBottom:12},primary:{height:44,borderRadius:11,backgroundColor:colors.violet,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},primaryText:{color:'#fff',fontWeight:'800',fontSize:12},error:{color:colors.red,fontSize:10,marginTop:8},
 lyric:{minHeight:44,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderColor:'#1c2330'},time:{color:'#8e74e7',fontSize:9,width:34},lyricText:{color:'#d7dbe3',fontSize:11,flex:1},
 audio:{height:44,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderColor:'#1c2330'},radio:{width:14,height:14,borderRadius:7,borderWidth:1,borderColor:'#6d7787'},radioOn:{borderWidth:4,borderColor:colors.violet},audioText:{color:'#dce0e7',fontSize:12},
 actions:{flexDirection:'row',gap:10,marginTop:20},secondary:{height:46,flex:1,borderRadius:11,borderWidth:1,borderColor:'#343b47',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},secondaryText:{color:'#fff',fontSize:11,fontWeight:'700'},export:{height:46,flex:1.4,borderRadius:11,backgroundColor:colors.violet,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},exportText:{color:'#fff',fontSize:11,fontWeight:'800'}
});
