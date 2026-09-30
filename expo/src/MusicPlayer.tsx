import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ListMusic, Pause, Play, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { Song } from './types';
import { musicAudioUrl, trackMusicEvent } from './api';

const fmt=(n=0)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');

export function MusicPlayer({song}:{song:Song|null}) {
  const {width}=useWindowDimensions();
  const compact=width<=800;
  const player=useAudioPlayer(null,{updateInterval:250});
  const status=useAudioPlayerStatus(player);

  useEffect(()=>{void setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'});},[]);
  useEffect(()=>{
    if(!song)return;
    player.replace(musicAudioUrl(song));
    if(song.id)void trackMusicEvent(song.id,'start');
    try{player.setActiveForLockScreen(true,{title:song.title,artist:song.creator||'Suno',artworkUrl:song.picture})}catch{}
  },[song?.id,song?.audio]);

  if(!song)return null;
  const duration=status.duration||song.duration||0;
  const current=status.currentTime||0;
  const pct=duration?Math.min(100,current/duration*100):0;

  return <View style={[styles.root,compact&&styles.rootCompact]}>
    <View style={styles.progressTrack}><View style={[styles.progressFill,{width:(pct+'%') as any}]}/></View>

    <View style={styles.summary}>
      {song.picture?<Image source={{uri:song.picture}} style={[styles.cover,compact&&styles.coverCompact]}/>:<View style={[styles.cover,styles.coverEmpty,compact&&styles.coverCompact]}><Volume2 size={18} color="#69768a"/></View>}
      <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{song.title}</Text><Text numberOfLines={1} style={styles.artist}>{song.creator||'Suno'} · {fmt(current)} / {fmt(duration)}</Text></View>
    </View>

    <View style={styles.transport}>
      {!compact&&<Pressable style={styles.secondary}><Shuffle size={15} color="#8893a4"/></Pressable>}
      <Pressable style={styles.secondary} onPress={()=>void player.seekTo(Math.max(0,current-10))}><SkipBack size={17} color="#8893a4"/></Pressable>
      <Pressable style={styles.primary} onPress={()=>status.playing?player.pause():player.play()}>
        {status.playing?<Pause size={18} color="#0b0f16" fill="#0b0f16"/>:<Play size={18} color="#0b0f16" fill="#0b0f16"/>}
      </Pressable>
      <Pressable style={styles.secondary} onPress={()=>void player.seekTo(Math.min(duration||current+10,current+10))}><SkipForward size={17} color="#8893a4"/></Pressable>
    </View>

    {!compact&&<View style={styles.tools}>
      <View style={styles.volume}><Volume2 size={15} color="#8893a4"/><View style={styles.volumeTrack}><View style={styles.volumeFill}/></View></View>
      <Pressable style={styles.toolBtn}><ListMusic size={17} color="#8893a4"/></Pressable>
    </View>}
  </View>
}

const styles=StyleSheet.create({
  root:{position:'absolute',zIndex:78,left:0,right:0,bottom:0,height:82,borderTopWidth:1,borderColor:'rgba(255,255,255,.065)',backgroundColor:'rgba(8,10,15,.96)',paddingHorizontal:28,paddingTop:8,paddingBottom:10,flexDirection:'row',alignItems:'center',gap:18},
  rootCompact:{height:72,paddingHorizontal:12,gap:8},
  progressTrack:{position:'absolute',top:0,left:0,right:0,height:3,backgroundColor:'rgba(255,255,255,.10)'},progressFill:{height:3,backgroundColor:'#b7a3ff'},
  summary:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:12},cover:{width:52,height:52,borderRadius:10,backgroundColor:'#171b25'},coverCompact:{width:44,height:44,borderRadius:9},coverEmpty:{alignItems:'center',justifyContent:'center'},copy:{flex:1,minWidth:0},title:{color:'#f4f6fa',fontSize:12,fontWeight:'700'},artist:{color:'#7e899a',fontSize:9,marginTop:4},
  transport:{flex:1.1,minWidth:170,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},secondary:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},primary:{width:44,height:44,borderRadius:22,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  tools:{flex:1,flexDirection:'row',justifyContent:'flex-end',alignItems:'center',gap:5},volume:{flexDirection:'row',alignItems:'center',gap:7,marginRight:6},volumeTrack:{width:78,height:3,borderRadius:99,backgroundColor:'#303640',overflow:'hidden'},volumeFill:{width:'72%',height:3,backgroundColor:'#d6cdfa'},toolBtn:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},
});
