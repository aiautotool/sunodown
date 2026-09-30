import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Download, Link2, Music2, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from './theme';
import type { Song } from './types';
import { resolveSuno } from './api';

const DEFAULT='https://suno.com/s/tszo0jGdVUua4rT4';

export function EmptyCreate({onResolved}:{onResolved:(song:Song,input:string)=>void}) {
 const [input,setInput]=useState(DEFAULT); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
 const analyze=async()=>{ if(!input.trim())return; setLoading(true);setError('');try{const song=await resolveSuno(input.trim());onResolved(song,input.trim())}catch(e){setError(e instanceof Error?e.message:'Không phân tích được link')}finally{setLoading(false)}};
 const paste=async()=>{const value=(await Clipboard.getStringAsync()).trim();if(value)setInput(value)};
 return <View style={styles.page}>
   <Text style={styles.kicker}>SUNO CREATOR STUDIO</Text>
   <Text style={styles.hero}>Âm nhạc của bạn.{`\n`}<Text style={{color:colors.violet}}>Nội dung của bạn.</Text></Text>
   <Text style={styles.sub}>Dán link Suno để tải nhạc, đồng bộ lyric, dựng visualizer và xuất video đa nền tảng.</Text>
   <View style={styles.inputBox}><Link2 size={20} color="#bec5d1"/><TextInput value={input} onChangeText={setInput} placeholder="Dán link https://suno.com/..." placeholderTextColor="#697488" autoCapitalize="none" style={styles.input}/><Pressable onPress={paste}><Text style={styles.paste}>DÁN</Text></Pressable></View>
   <Pressable disabled={loading} onPress={analyze}><LinearGradient colors={['#7258f5','#905cff']} style={styles.analyze}>{loading?<ActivityIndicator color="#fff"/>:<><Sparkles size={20} color="#fff"/><Text style={styles.analyzeText}>Phân tích bài hát</Text></>}</LinearGradient></Pressable>
   {!!error&&<Text style={styles.error}>{error}</Text>}
   <Text style={styles.choose}>BẠN MUỐN LÀM GÌ?</Text>
   <View style={styles.cards}>
    <Intent icon={<Download size={27} color="#a98dff"/>} title="Tải nhạc" desc="MP3 · WAV · M4A"/>
    <Intent icon={<Music2 size={27} color="#a98dff"/>} title="Lyric video" desc="Karaoke · subtitle"/>
    <Intent icon={<Sparkles size={27} color="#a98dff"/>} title="Visualizer" desc="Waveform · spectrum"/>
   </View>
 </View>
}
function Intent({icon,title,desc}:{icon:React.ReactNode,title:string,desc:string}){return <View style={styles.card}>{icon}<Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDesc}>{desc}</Text></View>}
const styles=StyleSheet.create({
 page:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:20,paddingBottom:110,maxWidth:720,width:'100%',alignSelf:'center'},
 kicker:{color:'#8d8aa6',fontSize:10,letterSpacing:5,fontWeight:'700',marginBottom:25},hero:{color:colors.text,fontSize:42,lineHeight:48,fontWeight:'800',textAlign:'center',letterSpacing:-1.4},
 sub:{color:colors.muted,fontSize:13,lineHeight:20,textAlign:'center',maxWidth:540,marginTop:18},
 inputBox:{width:'100%',height:62,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#343c49',borderRadius:17,backgroundColor:colors.panel2,paddingHorizontal:16,marginTop:34},
 input:{flex:1,color:'#fff',fontSize:15,paddingHorizontal:12},paste:{color:'#bcaaff',fontWeight:'800',fontSize:11,letterSpacing:1},
 analyze:{width:'100%',height:56,borderRadius:16,marginTop:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9},analyzeText:{color:'#fff',fontWeight:'800',fontSize:16},
 error:{color:colors.red,fontSize:12,marginTop:10},choose:{color:'#8f99aa',fontSize:11,fontWeight:'700',marginTop:34,marginBottom:14,letterSpacing:1.8},
 cards:{width:'100%',flexDirection:'row',gap:10},card:{flex:1,minHeight:112,borderWidth:1,borderColor:'#303846',borderRadius:15,backgroundColor:'#111720',alignItems:'center',justifyContent:'center',padding:10},
 cardTitle:{color:'#e7e9ee',fontWeight:'700',fontSize:13,marginTop:10},cardDesc:{color:'#788293',fontSize:10,marginTop:4,textAlign:'center'}
});
