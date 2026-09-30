import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music2 } from 'lucide-react-native';
import { colors } from './theme';

export function StartupScreen() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(8);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((value) => Math.min(96, value + Math.max(1, Math.round((100 - value) * 0.08))));
    }, 90);
    const done = setTimeout(() => {
      clearInterval(timer);
      setProgress(100);
      Animated.timing(opacity, { toValue: 0, duration: 420, useNativeDriver: true }).start(() => setVisible(false));
    }, 1550);
    return () => { clearInterval(timer); clearTimeout(done); };
  }, [opacity]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <LinearGradient colors={['#151027', '#080c12', '#070a10']} style={StyleSheet.absoluteFill} />
      <View style={styles.markWrap}>
        <LinearGradient colors={['#8b6cff', '#5637d7']} style={styles.mark}>
          <Music2 color="#fff" size={30} strokeWidth={2.3} />
        </LinearGradient>
      </View>
      <Text style={styles.kicker}>CREATOR ENGINE · V24 REACT</Text>
      <Text style={styles.title}>Suno<Text style={{ color: colors.violet }}>Down</Text></Text>
      <Text style={styles.copy}>Biến âm nhạc thành nội dung.</Text>
      <View style={styles.loaderRow}>
        <View style={styles.track}><LinearGradient colors={['#5d43d6', '#9e7cff', '#69a5ff']} style={[styles.fill, { width: `${progress}%` }]} /></View>
        <View style={styles.loaderMeta}><Text style={styles.loaderLabel}>ĐANG KHỞI TẠO STUDIO</Text><Text style={styles.loaderValue}>{String(progress).padStart(2, '0')}%</Text></View>
      </View>
      <Text style={styles.footer}>AI AUDIO   ·   LYRICS SYNC   ·   VIDEO ENGINE</Text>
    </Animated.View>
  );
}
const styles=StyleSheet.create({
  overlay:{...StyleSheet.absoluteFill,zIndex:999,alignItems:'center',justifyContent:'center',paddingHorizontal:28},
  markWrap:{marginBottom:26},mark:{width:66,height:66,borderRadius:20,alignItems:'center',justifyContent:'center'},
  kicker:{color:'#9a86ec',fontSize:10,fontWeight:'800',letterSpacing:3.2,marginBottom:14},
  title:{color:'#fff',fontSize:54,fontWeight:'800',letterSpacing:-2.5},
  copy:{color:'#838da0',fontSize:13,marginTop:14},
  loaderRow:{width:'100%',maxWidth:430,marginTop:62},
  track:{height:4,borderRadius:99,backgroundColor:'#1a202c',overflow:'hidden'},
  fill:{height:'100%',borderRadius:99},
  loaderMeta:{flexDirection:'row',justifyContent:'space-between',marginTop:10},
  loaderLabel:{color:'#697488',fontSize:9,fontWeight:'800',letterSpacing:1.5},
  loaderValue:{color:'#9a86ec',fontSize:10,fontWeight:'800'},
  footer:{position:'absolute',bottom:30,color:'#4f596b',fontSize:8,fontWeight:'800',letterSpacing:1.5}
});
