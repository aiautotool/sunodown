import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Clock3, Heart, Music2, Play, Search } from 'lucide-react-native';
import type { LocalLibraryItem, Song } from './types';
import { colors } from './theme';

export function LibraryScreen({items,onPlay,onOpen}:{items:LocalLibraryItem[],onPlay:(song:Song)=>void,onOpen:(item:LocalLibraryItem)=>void}){
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
   <View style={styles.header}><View><Text style={styles.kicker}>YOUR MUSIC</Text><Text style={styles.title}>Thư viện bài hát</Text><Text style={styles.sub}>Những bài đã mở, tải hoặc dựng gần đây trên mọi nền tảng.</Text></View><View style={styles.search}><Search size={17} color={colors.muted}/><Text style={styles.searchText}>Tìm trong thư viện</Text></View></View>
   {!items.length?<View style={styles.empty}><Music2 size={40} color="#51466f"/><Text style={styles.emptyTitle}>Chưa có bài hát</Text><Text style={styles.emptySub}>Dán link Suno ở mục Tạo mới. Bài hát sẽ tự xuất hiện ở đây.</Text></View>:
   <View style={styles.grid}>{items.map(item=><Pressable key={item.id} onPress={()=>onOpen(item)} style={styles.card}>
     {item.picture?<Image source={{uri:item.picture}} style={styles.cover}/>:<View style={[styles.cover,styles.coverEmpty]}><Music2 color={colors.violet}/></View>}
     <Pressable style={styles.play} onPress={(e)=>{e.stopPropagation();onPlay({id:item.id,title:item.title,creator:item.creator,duration:item.duration,picture:item.picture,audio:item.url})}}><Play size={16} color="#fff" fill="#fff"/></Pressable>
     <Text numberOfLines={1} style={styles.name}>{item.title}</Text><Text numberOfLines={1} style={styles.creator}>{item.creator||'Suno'}</Text>
     <View style={styles.meta}><Clock3 size={11} color="#737e8f"/><Text style={styles.metaText}>{new Date(item.updatedAt).toLocaleDateString('vi-VN')}</Text><Heart size={12} color="#737e8f"/></View>
   </Pressable>)}</View>}
 </ScrollView>
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.bg},content:{padding:28,paddingBottom:120},header:{flexDirection:'row',justifyContent:'space-between',gap:20,alignItems:'flex-end',marginBottom:26,flexWrap:'wrap'},
 kicker:{color:'#947df1',fontSize:9,fontWeight:'800',letterSpacing:2.5},title:{color:colors.text,fontSize:29,fontWeight:'800',marginTop:8},sub:{color:colors.muted,fontSize:12,marginTop:8},
 search:{height:42,minWidth:210,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel2,flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},searchText:{color:'#657081',fontSize:11},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:14},card:{width:170,position:'relative'},cover:{width:170,height:170,borderRadius:12,backgroundColor:'#131a24'},coverEmpty:{alignItems:'center',justifyContent:'center'},play:{position:'absolute',right:10,top:126,width:34,height:34,borderRadius:17,backgroundColor:colors.violet,alignItems:'center',justifyContent:'center'},
 name:{color:'#e8eaf0',fontSize:13,fontWeight:'700',marginTop:9},creator:{color:'#7e8898',fontSize:10,marginTop:4},meta:{flexDirection:'row',gap:5,alignItems:'center',marginTop:7},metaText:{color:'#737e8f',fontSize:9,flex:1},
 empty:{minHeight:350,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:'#0c1118'},emptyTitle:{color:'#e1e4ea',fontWeight:'800',fontSize:18,marginTop:14},emptySub:{color:'#758092',fontSize:11,marginTop:7,textAlign:'center',maxWidth:330}
});
