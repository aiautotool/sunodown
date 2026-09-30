import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music2 } from 'lucide-react-native';
import { colors } from './theme';

export function StartupScreen() {
  const [visible,setVisible]=useState(true);
  const [progress,setProgress]=useState(8);
  const opacity=useRef(new Animated.Value(1)).current;
  const wave=useRef(new Animated.Value(0)).current;
  const glow=useRef(new Animated.Value(.72)).current;

  useEffect(()=>{
    let cancelled=false;
    const started=Date.now();
    const motion=Animated.loop(Animated.sequence([
      Animated.timing(wave,{toValue:1,duration:420,useNativeDriver:true}),
      Animated.timing(wave,{toValue:0,duration:420,useNativeDriver:true}),
    ]));
    const pulse=Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:1,duration:1200,useNativeDriver:true}),
      Animated.timing(glow,{toValue:.72,duration:1200,useNativeDriver:true}),
    ]));
    motion.start();pulse.start();
    const timer=setInterval(()=>setProgress(value=>Math.min(88,value+Math.max(1,Math.round((92-value)*.08)))),120);
    const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
    const pageReady=Platform.OS==='web'
      ? new Promise<void>(resolve=>{
          const doc=(globalThis as any).document;
          const win=(globalThis as any).window;
          if(!doc||doc.readyState==='complete')resolve();
          else win?.addEventListener?.('load',()=>resolve(),{once:true});
        })
      : Promise.resolve();
    const fontsReady=Platform.OS==='web'
      ? Promise.resolve((globalThis as any).document?.fonts?.ready).then(()=>undefined).catch(()=>undefined)
      : Promise.resolve();
    void Promise.race([
      Promise.all([pageReady,fontsReady,delay(1450)]).then(()=>undefined),
      delay(4500),
    ]).then(async()=>{
      if(cancelled)return;
      clearInterval(timer);
      setProgress(100);
      const remaining=Math.max(0,1650-(Date.now()-started));
      await delay(remaining+180);
      if(cancelled)return;
      Animated.timing(opacity,{toValue:0,duration:520,useNativeDriver:true}).start(()=>{if(!cancelled)setVisible(false)});
    });
    return()=>{cancelled=true;clearInterval(timer);motion.stop();pulse.stop()};
  },[opacity,wave,glow]);

  if(!visible)return null;
  const scale=wave.interpolate({inputRange:[0,1],outputRange:[.72,1.14]});
  return <Animated.View style={[styles.overlay,{opacity}]}>
    <LinearGradient colors={['#070a10','#070a10']} style={StyleSheet.absoluteFill}/>
    <Animated.View style={[styles.glowA,{opacity:glow}]}/>
    <Animated.View style={[styles.glowB,{opacity:glow}]}/>
    <View style={styles.grid}>
      {Array.from({length:12}).map((_,i)=><View key={'v'+i} style={[styles.gridV,{left:(i/11*100)+'%' as any}]}/>)}
      {Array.from({length:12}).map((_,i)=><View key={'h'+i} style={[styles.gridH,{top:(i/11*100)+'%' as any}]}/>)}
    </View>

    <View style={styles.content}>
      <View style={styles.mark}>
        <Animated.View style={[styles.waveBar,{height:22,transform:[{scaleY:scale}]}]}/>
        <Animated.View style={[styles.waveBar,{height:42,transform:[{scaleY:scale}]}]}/>
        <Animated.View style={[styles.waveBar,{height:72,transform:[{scaleY:scale}]}]}/>
        <Animated.View style={[styles.waveBar,{height:42,transform:[{scaleY:scale}]}]}/>
        <Animated.View style={[styles.waveBar,{height:22,transform:[{scaleY:scale}]}]}/>
        <LinearGradient colors={['#8567ff','#5436d4']} style={styles.logo}>
          <Music2 size={31} color="#fff" strokeWidth={2.25}/>
        </LinearGradient>
      </View>

      <Text style={styles.kicker}>CREATOR ENGINE · V23</Text>
      <Text style={styles.title}>Suno<Text style={{color:colors.violet}}>Down</Text></Text>
      <Text style={styles.copy}>Biến âm nhạc thành nội dung.</Text>

      <View style={styles.loader}>
        <View style={styles.track}><LinearGradient colors={['#5d43d6','#9e7cff','#69a5ff']} style={[styles.fill,{width:(progress+'%') as any}]}/></View>
        <View style={styles.loaderMeta}><Text style={styles.loaderText}>ĐANG KHỞI TẠO STUDIO</Text><Text style={styles.loaderValue}>{String(progress).padStart(2,'0')}%</Text></View>
      </View>
    </View>

    <View style={styles.footer}><Text style={styles.footerText}>AI AUDIO</Text><View style={styles.dot}/><Text style={styles.footerText}>LYRICS SYNC</Text><View style={styles.dot}/><Text style={styles.footerText}>VIDEO ENGINE</Text></View>
  </Animated.View>
}

const styles=StyleSheet.create({
  overlay:{...StyleSheet.absoluteFill,zIndex:9999,alignItems:'center',justifyContent:'center',backgroundColor:'#070a10',overflow:'hidden'},
  glowA:{position:'absolute',width:540,height:540,borderRadius:270,backgroundColor:'rgba(119,82,255,.12)',top:'17%'},
  glowB:{position:'absolute',width:760,height:760,borderRadius:380,backgroundColor:'rgba(58,129,255,.035)',top:'5%'},
  grid:{...StyleSheet.absoluteFill,opacity:.10,transform:[{scale:1.25},{rotate:'0deg'}]},gridV:{position:'absolute',top:0,bottom:0,width:1,backgroundColor:'rgba(139,108,255,.22)'},gridH:{position:'absolute',left:0,right:0,height:1,backgroundColor:'rgba(139,108,255,.22)'},
  content:{width:'100%',maxWidth:470,paddingHorizontal:24,alignItems:'center'},
  mark:{height:88,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginBottom:28,position:'relative'},
  waveBar:{width:4,borderRadius:99,backgroundColor:'#8062ef',opacity:.55},
  logo:{position:'absolute',zIndex:2,width:62,height:62,borderWidth:1,borderColor:'rgba(192,177,255,.4)',borderRadius:18,alignItems:'center',justifyContent:'center'},
  kicker:{color:'#9883eb',fontSize:10,fontWeight:'700',letterSpacing:3.4,marginBottom:13},
  title:{color:'#f7f8fc',fontSize:58,lineHeight:62,fontWeight:'800',letterSpacing:-3.2},
  copy:{color:'#838da0',fontSize:13,letterSpacing:.5,marginTop:16},
  loader:{width:'100%',marginTop:64},
  track:{height:3,borderRadius:99,backgroundColor:'#1a202c',overflow:'hidden'},
  fill:{height:3,borderRadius:99},
  loaderMeta:{marginTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  loaderText:{color:'#697488',fontSize:9,fontWeight:'700',letterSpacing:1.2},
  loaderValue:{color:'#9a86ec',fontSize:10,fontWeight:'700',letterSpacing:.8},
  footer:{position:'absolute',bottom:34,flexDirection:'row',alignItems:'center',gap:11},
  footerText:{color:'#4f596b',fontSize:8,fontWeight:'700',letterSpacing:1.4},
  dot:{width:3,height:3,borderRadius:2,backgroundColor:'#6d58c8'},
});
