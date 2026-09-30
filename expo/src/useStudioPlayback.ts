import { useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { Song } from './types';
import { musicAudioUrl } from './api';

export function useStudioPlayback(song:Song,muted=false){
  const player=useAudioPlayer(null,{updateInterval:250});
  const status=useAudioPlayerStatus(player);

  useEffect(()=>{void setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'});},[]);
  useEffect(()=>{
    player.replace(musicAudioUrl(song));
    try{player.setActiveForLockScreen(true,{title:song.title,artist:song.creator||'Suno',artworkUrl:song.picture})}catch{}
    const timer=setTimeout(()=>{try{player.play()}catch{}},120);
    return()=>{clearTimeout(timer);try{player.pause()}catch{}};
  },[song.id,song.audio]);

  useEffect(()=>{player.muted=muted},[muted,player]);

  const duration=status.duration||song.duration||0;
  const current=status.currentTime||0;
  return {
    current,duration,playing:Boolean(status.playing),
    toggle:()=>status.playing?player.pause():player.play(),
    seekTo:(value:number)=>void player.seekTo(Math.max(0,Math.min(duration||value,value))),
    seekBy:(delta:number)=>void player.seekTo(Math.max(0,Math.min(duration||current+delta,current+delta))),
  };
}
