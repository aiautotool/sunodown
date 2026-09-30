import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { Song } from './types';
import { colors } from './theme';
import { musicAudioUrl, trackMusicEvent } from './api';

const fmt=(n=0)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function MusicPlayer({song}:{song:Song|null}) {
  const player=useAudioPlayer(null,{updateInterval:250});
  const status=useAudioPlayerStatus(player);

  useEffect(()=>{ void setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'}); },[]);
  useEffect(()=>{
    if(!song) return;
    player.replace(musicAudioUrl(song));
    if (song.id) void trackMusicEvent(song.id,'start');
    try {
      player.setActiveForLockScreen(true,{title:song.title,artist:song.creator||'Suno',artworkUrl:song.picture});
    } catch {}
  },[song?.id,song?.audio]);

  if(!song) return null;
  const duration=status.duration||song.duration||0;
  const current=status.currentTime||0;
  const pct=duration?Math.min(100,current/duration*100):0;
  return <View style={styles.wrap}>
    <View style={styles.progress}><View style={[styles.progressFill,{width:`${pct}%`}]} /></View>
    <View style={styles.inner}>
      {song.picture?<Image source={{uri:song.picture}} style={styles.thumb}/>:<View style={[styles.thumb,styles.placeholder]}><Volume2 size={18} color={colors.violet}/></View>}
      <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{song.title}</Text><Text numberOfLines={1} style={styles.artist}>{song.creator||'Suno'} · {fmt(current)} / {fmt(duration)}</Text></View>
      <View style={styles.controls}>
        <Pressable style={styles.iconBtn} onPress={()=>void player.seekTo(Math.max(0,current-10))}><SkipBack size={19} color={colors.text}/></Pressable>
        <Pressable style={styles.play} onPress={()=>status.playing?player.pause():player.play()}>{status.playing?<Pause size={21} fill="#fff" color="#fff"/>:<Play size={21} fill="#fff" color="#fff"/>}</Pressable>
        <Pressable style={styles.iconBtn} onPress={()=>void player.seekTo(Math.min(duration||current+10,current+10))}><SkipForward size={19} color={colors.text}/></Pressable>
      </View>
    </View>
  </View>
}
const styles=StyleSheet.create({
  wrap:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#0b1017',borderTopWidth:1,borderColor:colors.border,zIndex:50},
  progress:{height:2,backgroundColor:'#202733'},progressFill:{height:2,backgroundColor:colors.violet},
  inner:{minHeight:74,flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:10,gap:12},
  thumb:{width:46,height:46,borderRadius:9,backgroundColor:'#171e29'},placeholder:{alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0},title:{color:colors.text,fontWeight:'700',fontSize:14},artist:{color:colors.muted,fontSize:11,marginTop:4},
  controls:{flexDirection:'row',alignItems:'center',gap:6},iconBtn:{width:34,height:34,alignItems:'center',justifyContent:'center'},play:{width:42,height:42,borderRadius:21,backgroundColor:colors.violet,alignItems:'center',justifyContent:'center'}
});
