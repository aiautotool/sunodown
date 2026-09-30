import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function V23SceneThumb({
  template,picture,accent='#8b5cf6',secondary='#22d3ee',badge,
}:{
  template:string;picture?:string;accent?:string;secondary?:string;badge?:string;
}){
  return <View style={styles.root}>
    {picture&&<Image source={{uri:picture}} resizeMode="cover" style={StyleSheet.absoluteFill}/>}
    <View style={styles.shade}/>
    {template==='vinyl'&&<>
      <View style={styles.vinylDisc}/>
      <View style={styles.vinylCore}><View style={styles.vinylHole}/></View>
    </>}
    {template==='gold-record'&&<>
      <View style={styles.goldDisc}/>
      <View style={styles.goldPlaque}/>
    </>}
    {template==='glass-card'&&<>
      <View style={[styles.glassOrb,{backgroundColor:accent+'55'}]}/>
      <LinearGradient colors={['rgba(255,255,255,.13)',secondary+'18','rgba(8,17,29,.72)']} style={styles.glassCard}/>
    </>}
    {template==='editorial'&&<>
      <View style={styles.editorialFrame}/>
      <View style={styles.editorialLine}/>
      <Text style={styles.editorialText}>MUSIC</Text>
    </>}
    {template==='spotlight'&&<>
      <View style={styles.spotHalo}/>
      <LinearGradient colors={[secondary+'88',secondary+'08']} style={styles.spotCone}/>
    </>}
    {template==='lyrics-focus'&&<>
      <View style={styles.lyricsCard}/>
      <Text style={styles.lyricsText}>LYRICS</Text>
    </>}
    {template==='cover-motion'&&<LinearGradient colors={['transparent','rgba(255,255,255,.07)','transparent']} start={{x:.12,y:.12}} end={{x:.88,y:.88}} style={StyleSheet.absoluteFill}/>}
    {!!badge&&<Text style={styles.badge}>{badge}</Text>}
  </View>;
}

const styles=StyleSheet.create({
  root:{width:'100%',height:'100%',position:'relative',overflow:'hidden',backgroundColor:'#0b1017'},
  shade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(7,10,16,.42)'},
  badge:{position:'absolute',zIndex:8,left:7,top:7,color:'#dce3ef',fontSize:7,fontWeight:'800'},

  vinylDisc:{position:'absolute',zIndex:3,width:'54%',aspectRatio:1,left:'23%',top:'21%',borderRadius:999,borderWidth:7,borderColor:'#0d0f15',backgroundColor:'#20232d',shadowColor:'#7756ff',shadowOpacity:.35,shadowRadius:10,elevation:5},
  vinylCore:{position:'absolute',zIndex:4,width:'17%',aspectRatio:1,left:'41.5%',top:'39.5%',borderRadius:999,backgroundColor:'#7e61cf',borderWidth:4,borderColor:'#d6c8ff',alignItems:'center',justifyContent:'center'},
  vinylHole:{width:'28%',aspectRatio:1,borderRadius:99,backgroundColor:'#161822'},
  goldDisc:{position:'absolute',zIndex:3,width:'56%',aspectRatio:1,left:'22%',top:'18%',borderRadius:999,borderWidth:7,borderColor:'#d7a02f',backgroundColor:'#7a4b0e',shadowColor:'#f5c451',shadowOpacity:.35,shadowRadius:12,elevation:5},
  goldPlaque:{position:'absolute',zIndex:4,width:'40%',height:'13%',left:'30%',bottom:'12%',borderWidth:1,borderColor:'rgba(249,220,139,.54)',borderRadius:4,backgroundColor:'#6d4817'},
  glassOrb:{position:'absolute',zIndex:2,width:'30%',aspectRatio:1,right:'4%',top:'8%',borderRadius:999,opacity:.8},
  glassCard:{position:'absolute',zIndex:3,left:'15%',right:'15%',top:'17%',bottom:'17%',borderWidth:1,borderColor:'rgba(255,255,255,.33)',borderRadius:14,shadowColor:'#5a41d6',shadowOpacity:.35,shadowRadius:12,elevation:5},
  editorialFrame:{position:'absolute',zIndex:3,left:'8%',right:'8%',top:'8%',bottom:'8%',borderWidth:1,borderColor:'rgba(241,226,191,.67)'},
  editorialLine:{position:'absolute',zIndex:4,left:'49.5%',top:'8%',bottom:'8%',width:1,backgroundColor:'rgba(241,226,191,.13)'},
  editorialText:{position:'absolute',zIndex:5,left:'12%',top:'13%',color:'#f0dfba',fontFamily:'Georgia',fontSize:14,fontWeight:'900',letterSpacing:1.1},
  spotCone:{position:'absolute',zIndex:3,left:'30%',top:'4%',width:'40%',height:'78%',transform:[{perspective:200},{scaleX:1.6}]},
  spotHalo:{position:'absolute',zIndex:2,left:'34%',bottom:'18%',width:'32%',height:'12%',borderRadius:999,backgroundColor:'rgba(142,106,255,.40)',shadowColor:'#8e6aff',shadowOpacity:.55,shadowRadius:9,elevation:4},
  lyricsCard:{position:'absolute',zIndex:3,left:'8%',right:'8%',top:'38%',height:'26%',borderWidth:1,borderColor:'rgba(164,134,255,.33)',borderRadius:12,backgroundColor:'rgba(9,13,24,.67)'},
  lyricsText:{position:'absolute',zIndex:4,left:'14%',top:'45%',color:'rgba(233,228,255,.80)',fontSize:11,fontWeight:'800',letterSpacing:2},
});
