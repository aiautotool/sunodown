import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music2 } from 'lucide-react-native';

export type SongInitState={
  visible:boolean;
  progress:number;
  title:string;
  detail:string;
};

export function SongInitScreen({state}:{state:SongInitState}){
  const {width}=useWindowDimensions();
  const mobile=width<=800;
  const rotate=useRef(new Animated.Value(0)).current;
  const pulse=useRef(new Animated.Value(1)).current;
  const shine=useRef(new Animated.Value(-1)).current;

  useEffect(()=>{
    if(!state.visible)return;
    const spin=Animated.loop(Animated.timing(rotate,{toValue:1,duration:7000,easing:Easing.linear,useNativeDriver:true}));
    const beat=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1.06,duration:1100,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(pulse,{toValue:1,duration:1100,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    const glint=Animated.loop(Animated.sequence([
      Animated.timing(shine,{toValue:1,duration:900,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.delay(700),
      Animated.timing(shine,{toValue:-1,duration:0,useNativeDriver:true}),
    ]));
    spin.start();beat.start();glint.start();
    return()=>{spin.stop();beat.stop();glint.stop()};
  },[state.visible,rotate,pulse,shine]);

  if(!state.visible)return null;
  const rotateDeg=rotate.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
  const phase=state.progress<25?'Metadata':state.progress<82?'Audio':'Studio';

  return <View style={[styles.root,mobile&&styles.rootMobile]}>
    <LinearGradient colors={['#090d14','#070a0f']} style={StyleSheet.absoluteFill}/>
    <View style={styles.radial}/>

    <View style={[styles.stage,mobile&&styles.stageMobile]}>
      <View style={[styles.orbit,mobile&&styles.orbitMobile]}>
        <View style={styles.orbitOuter}/>
        <Animated.View style={[styles.orbitDash,{transform:[{rotate:rotateDeg}]}]}>
          {Array.from({length:16}).map((_,i)=><View key={i} style={[styles.dash,{transform:[{rotate:(i*22.5)+'deg'},{translateY:-54}]}]}/>)}
        </Animated.View>
        <Animated.View style={[styles.orbitCore,{transform:[{scale:pulse}]}]}>
          <LinearGradient colors={['#8b74ff','#5849cd','#211a52']} locations={[0,.55,1]} style={StyleSheet.absoluteFill}/>
        </Animated.View>
        <Animated.View style={[styles.orbitDot,{transform:[{rotate:rotateDeg},{translateY:-(mobile?50:60)}]}]}/>
        <Music2 size={mobile?30:34} color="#fff"/>
      </View>

      <Text style={styles.kicker}>CREATOR STUDIO</Text>
      <Text style={[styles.title,mobile&&styles.titleMobile]}>{state.title}</Text>
      <Text style={styles.detail}>{state.detail}</Text>

      <View style={styles.progress}>
        <LinearGradient colors={['#6554e8','#9b70ff','#c17eff']} style={[styles.progressFill,{width:(Math.max(0,Math.min(100,state.progress))+'%') as any}]}>
          <Animated.View style={[styles.shine,{transform:[{translateX:shine.interpolate({inputRange:[-1,1],outputRange:[-520,520]})}]}]}/>
        </LinearGradient>
      </View>
      <View style={styles.meta}><Text style={styles.percent}>{Math.round(state.progress)}%</Text><Text style={styles.phase}>{phase}</Text></View>

      <View style={styles.steps}>
        <Step label="01 · Bài hát" state={state.progress>=24?'done':'active'}/>
        <Step label="02 · Audio" state={state.progress>=82?'done':state.progress>=24?'active':'idle'}/>
        <Step label="03 · Studio" state={state.progress>=100?'done':state.progress>=82?'active':'idle'}/>
      </View>
    </View>
  </View>
}

function Step({label,state}:{label:string;state:'idle'|'active'|'done'}){
  return <View style={[styles.step,state==='active'&&styles.stepActive,state==='done'&&styles.stepDone]}><Text style={[styles.stepText,state==='active'&&styles.stepTextActive,state==='done'&&styles.stepTextDone]}>{label}</Text></View>
}

const styles=StyleSheet.create({
  root:{flex:1,minHeight:'100%',alignItems:'center',justifyContent:'center',padding:28,backgroundColor:'#080c12'},
  rootMobile:{padding:18},
  radial:{position:'absolute',top:'17%',width:520,height:520,borderRadius:260,backgroundColor:'rgba(117,87,255,.09)'},
  stage:{width:'92%',maxWidth:560,alignItems:'center',gap:12},
  stageMobile:{gap:10},
  orbit:{width:132,height:132,alignItems:'center',justifyContent:'center',marginBottom:10,position:'relative'},
  orbitMobile:{width:112,height:112},
  orbitOuter:{...StyleSheet.absoluteFill,borderWidth:1,borderColor:'#403a62',borderRadius:999,shadowColor:'#795bff',shadowOpacity:.16,shadowRadius:45},
  orbitDash:{position:'absolute',width:104,height:104,borderRadius:52,borderWidth:1,borderStyle:'dashed',borderColor:'#5b4f83'},
  dash:{position:'absolute',left:'50%',top:'50%',width:2,height:4,marginLeft:-1,marginTop:-2,backgroundColor:'#6f6395',borderRadius:2},
  orbitCore:{position:'absolute',width:78,height:78,borderRadius:39,overflow:'hidden',shadowColor:'#7d5dff',shadowOpacity:.34,shadowRadius:42},
  orbitDot:{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:'#9c8cff',shadowColor:'#8b7cff',shadowOpacity:1,shadowRadius:18},
  kicker:{marginTop:4,color:'#8f7cff',fontSize:9,fontWeight:'900',letterSpacing:2.2},
  title:{marginTop:0,color:'#f6f7fb',fontSize:38,lineHeight:42,fontWeight:'800',letterSpacing:-1.3,textAlign:'center'},
  titleMobile:{fontSize:27,lineHeight:31},
  detail:{minHeight:20,color:'#8894a6',fontSize:11,lineHeight:17,textAlign:'center'},
  progress:{width:'100%',height:9,marginTop:10,overflow:'hidden',borderWidth:1,borderColor:'#292f3c',borderRadius:999,backgroundColor:'#10151e'},
  progressFill:{height:'100%',borderRadius:999,overflow:'hidden'},
  shine:{position:'absolute',top:0,bottom:0,width:170,backgroundColor:'rgba(255,255,255,.24)',transform:[{skewX:'-18deg'}]},
  meta:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  percent:{color:'#dcd8ff',fontSize:11,fontWeight:'800'},phase:{color:'#717d8f',fontSize:9},
  steps:{width:'100%',flexDirection:'row',gap:6,marginTop:3},
  step:{flex:1,minHeight:34,borderWidth:1,borderColor:'#202735',borderRadius:9,backgroundColor:'#0c1118',alignItems:'center',justifyContent:'center',paddingHorizontal:5},
  stepActive:{borderColor:'#6655e8',backgroundColor:'#17142b',shadowColor:'#6d57e8',shadowOpacity:.12,shadowRadius:18},
  stepDone:{borderColor:'#2f5948',backgroundColor:'#0d1b16'},
  stepText:{color:'#515d6d',fontSize:8,fontWeight:'700'},stepTextActive:{color:'#bdb2ff'},stepTextDone:{color:'#75c9a2'},
});
