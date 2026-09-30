import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music2 } from 'lucide-react-native';
import { colors } from './theme';

const BAR_HEIGHTS=[22,42,72,42,22] as const;
const BAR_DELAYS=[0,0,0,150,300] as const;

export function StartupScreen() {
  const {width}=useWindowDimensions();
  const mobile=width<=600;
  const [visible,setVisible]=useState(true);
  const [progress,setProgress]=useState(8);
  const opacity=useRef(new Animated.Value(1)).current;
  const pulse=useRef(new Animated.Value(0)).current;
  const waveValues=useRef(BAR_HEIGHTS.map(()=>new Animated.Value(0))).current;

  useEffect(()=>{
    let cancelled=false;
    const started=Date.now();

    const glowMotion=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1,duration:1200,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:0,duration:1200,useNativeDriver:true}),
    ]));
    const waveMotions=waveValues.map((value,index)=>Animated.loop(Animated.sequence([
      Animated.delay(BAR_DELAYS[index]??0),
      Animated.timing(value,{toValue:1,duration:400,useNativeDriver:true}),
      Animated.timing(value,{toValue:0,duration:400,useNativeDriver:true}),
    ])));
    glowMotion.start();
    waveMotions.forEach(motion=>motion.start());

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

    return()=>{
      cancelled=true;
      clearInterval(timer);
      glowMotion.stop();
      waveMotions.forEach(motion=>motion.stop());
    };
  },[opacity,pulse,waveValues]);

  if(!visible)return null;

  const glowOpacity=pulse.interpolate({inputRange:[0,1],outputRange:[1,.65]});
  const glowScale=pulse.interpolate({inputRange:[0,1],outputRange:[1,1.08]});
  const webGlow=Platform.OS==='web'
    ? ({backgroundImage:'radial-gradient(circle at 50% 45%,rgba(119,82,255,.22),transparent 28%),radial-gradient(circle at 50% 50%,rgba(58,129,255,.08),transparent 48%)'} as any)
    : null;
  const webGrid=Platform.OS==='web'
    ? ({backgroundImage:'linear-gradient(rgba(139,108,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(139,108,255,.13) 1px,transparent 1px)',backgroundSize:mobile?'40px 40px':'54px 54px',maskImage:'radial-gradient(circle at center,#000,transparent 70%)'} as any)
    : null;

  return <Animated.View accessibilityRole="progressbar" accessibilityLabel={`Đang khởi động SunoDown, ${progress}%`} style={[styles.overlay,{opacity}]}>
    <Animated.View style={[styles.glow,webGlow,{opacity:glowOpacity,transform:[{scale:glowScale}]}]}>
      {Platform.OS!=='web'&&<>
        <View style={styles.nativeGlowPrimary}/>
        <View style={styles.nativeGlowSecondary}/>
      </>}
    </Animated.View>

    <View pointerEvents="none" style={[styles.grid,webGrid,mobile&&styles.gridMobile]}>
      {Platform.OS!=='web'&&<>
        {Array.from({length:15}).map((_,i)=><View key={'v'+i} style={[styles.gridV,{left:(i/14*100)+'%' as any}]}/>)}
        {Array.from({length:15}).map((_,i)=><View key={'h'+i} style={[styles.gridH,{top:(i/14*100)+'%' as any}]}/>)}
      </>}
    </View>

    <View style={[styles.content,mobile&&styles.contentMobile]}>
      <View style={styles.mark}>
        <LinearGradient colors={['#8567ff','#5436d4']} style={styles.logo}>
          <Music2 size={31} color="#fff" strokeWidth={2.25}/>
        </LinearGradient>
        {BAR_HEIGHTS.map((height,index)=>{
          const waveValue=waveValues[index]??waveValues[0]!;
          const scaleY=waveValue.interpolate({inputRange:[0,1],outputRange:[1,14/height]});
          return <Animated.View
            key={index}
            style={[
              styles.waveBar,
              {height,transform:[{scaleY}]},
              index===1&&styles.waveGap,
            ]}
          />;
        })}
      </View>

      <Text style={styles.kicker}>CREATOR ENGINE · V23</Text>
      <Text style={[styles.title,mobile&&styles.titleMobile]}>Suno<Text style={{color:colors.violet}}>Down</Text></Text>
      <Text style={styles.copy}>Biến âm nhạc thành nội dung.</Text>

      <View style={[styles.loader,mobile&&styles.loaderMobile]}>
        <View style={styles.track}>
          <LinearGradient colors={['#5d43d6','#9e7cff','#69a5ff']} style={[styles.fill,{width:(progress+'%') as any}]}/>
        </View>
        <View style={styles.loaderMeta}>
          <Text style={styles.loaderText}>ĐANG KHỞI TẠO STUDIO</Text>
          <Text style={styles.loaderValue}>{String(progress).padStart(2,'0')}%</Text>
        </View>
      </View>
    </View>

    <View style={[styles.footer,mobile&&styles.footerMobile]}>
      <Text style={[styles.footerText,mobile&&styles.footerTextMobile]}>AI AUDIO</Text><View style={styles.dot}/>
      <Text style={[styles.footerText,mobile&&styles.footerTextMobile]}>LYRICS SYNC</Text><View style={styles.dot}/>
      <Text style={[styles.footerText,mobile&&styles.footerTextMobile]}>VIDEO ENGINE</Text>
    </View>
  </Animated.View>
}

const styles=StyleSheet.create({
  overlay:{...StyleSheet.absoluteFill,zIndex:9999,alignItems:'center',justifyContent:'center',backgroundColor:'#070a10',overflow:'hidden'},
  glow:{position:'absolute',left:'-30%',right:'-30%',top:'-30%',bottom:'-30%',alignItems:'center',justifyContent:'center'},
  nativeGlowPrimary:{position:'absolute',width:520,height:520,borderRadius:260,backgroundColor:'rgba(119,82,255,.12)'},
  nativeGlowSecondary:{position:'absolute',width:820,height:820,borderRadius:410,backgroundColor:'rgba(58,129,255,.035)'},
  grid:{position:'absolute',left:'-25%',right:'-25%',top:'-42%',bottom:'-18%',opacity:.18,transform:[{perspective:500},{rotateX:'62deg'},{scale:1.5},{translateY:130}]},
  gridMobile:{transform:[{perspective:500},{rotateX:'62deg'},{scale:1.5},{translateY:105}]},
  gridV:{position:'absolute',top:0,bottom:0,width:1,backgroundColor:'rgba(139,108,255,.13)'},
  gridH:{position:'absolute',left:0,right:0,height:1,backgroundColor:'rgba(139,108,255,.13)'},
  content:{width:'100%',maxWidth:470,paddingHorizontal:0,alignItems:'center'},
  contentMobile:{width:'100%',paddingHorizontal:28},
  mark:{height:88,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginBottom:28,position:'relative'},
  waveBar:{width:4,borderRadius:99,backgroundColor:'#8062ef',opacity:.55},
  waveGap:{marginRight:65},
  logo:{position:'absolute',zIndex:2,width:62,height:62,borderWidth:1,borderColor:'rgba(192,177,255,.4)',borderRadius:18,alignItems:'center',justifyContent:'center',shadowColor:'#7b56ff',shadowOpacity:.42,shadowRadius:27,shadowOffset:{width:0,height:0},elevation:16},
  kicker:{color:'#9883eb',fontSize:10,fontWeight:'700',letterSpacing:3.4,marginBottom:13},
  title:{color:'#f7f8fc',fontSize:66,lineHeight:66,fontWeight:'800',letterSpacing:-3.6},
  titleMobile:{fontSize:44,lineHeight:44,letterSpacing:-2.4},
  copy:{color:'#838da0',fontSize:13,letterSpacing:.52,marginTop:16},
  loader:{width:'100%',marginTop:64},
  loaderMobile:{marginTop:54},
  track:{height:3,borderRadius:99,backgroundColor:'#1a202c',overflow:'hidden'},
  fill:{height:3,borderRadius:99,shadowColor:'#8b6cff',shadowOpacity:.8,shadowRadius:8,shadowOffset:{width:0,height:0}},
  loaderMeta:{marginTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  loaderText:{color:'#697488',fontSize:9,fontWeight:'700',letterSpacing:1.26},
  loaderValue:{color:'#9a86ec',fontSize:10,fontWeight:'700',letterSpacing:.8},
  footer:{position:'absolute',bottom:34,flexDirection:'row',alignItems:'center',gap:11},
  footerMobile:{bottom:24,gap:8},
  footerText:{color:'#4f596b',fontSize:8,fontWeight:'700',letterSpacing:1.44},
  footerTextMobile:{fontSize:7},
  dot:{width:3,height:3,borderRadius:2,backgroundColor:'#6d58c8'},
});
