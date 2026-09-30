import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music2 } from 'lucide-react-native';
import { colors } from './theme';

export function StartupScreen() {
  const [visible,setVisible]=useState(true);
  const [progress,setProgress]=useState(8);
  const opacity=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    const timer=setInterval(()=>setProgress(value=>Math.min(92,value+Math.max(1,Math.round((92-value)*.08)))),120);
    const done=setTimeout(()=>{
      clearInterval(timer);
      setProgress(100);
      setTimeout(()=>Animated.timing(opacity,{toValue:0,duration:520,useNativeDriver:true}).start(()=>setVisible(false)),180);
    },1650);
    return()=>{clearInterval(timer);clearTimeout(done)};
  },[opacity]);

  if(!visible)return null;
  return <Animated.View style={[styles.overlay,{opacity}]}>
    <LinearGradient colors={['#0d0a17','#070a10','#070a10']} style={StyleSheet.absoluteFill}/>
    <View style={styles.glowA}/>
    <View style={styles.glowB}/>

    <View style={styles.content}>
      <View style={styles.mark}>
        <View style={[styles.waveBar,{height:22}]}/>
        <View style={[styles.waveBar,{height:42}]}/>
        <View style={[styles.waveBar,{height:72}]}/>
        <View style={[styles.waveBar,{height:42}]}/>
        <View style={[styles.waveBar,{height:22}]}/>
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
