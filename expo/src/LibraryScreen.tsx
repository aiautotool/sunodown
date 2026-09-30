import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { BookOpen, LogIn, Music2, Play, Plus, Search } from 'lucide-react-native';
import type { LocalLibraryItem, Song } from './types';
import { v24 } from './theme';

const fmt=(n=0)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
const shortDate=(n:number)=>new Date(n).toLocaleDateString('vi-VN');

export function LibraryScreen({
  items,onPlay,onOpen,onCreate,
}:{
  items:LocalLibraryItem[];
  onPlay:(song:Song)=>void;
  onOpen:(item:LocalLibraryItem)=>void;
  onCreate:()=>void;
}){
  const {width}=useWindowDimensions();
  const compact=width<=900;
  const narrow=width<=520;
  const [query,setQuery]=useState('');
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return q?items.filter(item=>(item.title+' '+(item.creator||'')+' '+item.url).toLowerCase().includes(q)):items;
  },[items,query]);
  const latest=items[0];

  return <ScrollView style={styles.root} contentContainerStyle={[styles.content,compact&&styles.contentCompact]}>
    <View style={[styles.head,compact&&styles.headCompact]}>
      <View style={{flex:1}}>
        <Text style={styles.kicker}>SUNODOWN</Text>
        <Text style={[styles.title,compact&&styles.titleCompact]}>Thư viện</Text>
        <Text style={styles.headSub}>Tập hợp bài Suno đã mở, tải hoặc render trên thiết bị này.</Text>
      </View>
      <Pressable style={[styles.create,compact&&styles.createFull]} onPress={onCreate}><Plus size={16} color="#fff"/><Text style={styles.createText}>Tạo mới</Text></Pressable>
    </View>

    <View style={[styles.hero,compact&&styles.heroCompact]}>
      <HeroCard kicker="LOCAL LIBRARY" title={items.length?String(items.length)+' bài':'0 bài'} sub="Những bài từng mở, tải audio hoặc render video trên máy này."/>
      <HeroCard kicker="GẦN NHẤT" title={latest?.title||'Chưa có'} sub={latest?(latest.creator||'Suno')+' · '+shortDate(latest.updatedAt):'Mở một bài Suno để tự động lưu vào thư viện.'}/>
      <HeroCard kicker="FAVORITE" title={String(items.filter(x=>x.favorite).length)} sub="Bài đã đánh dấu yêu thích trong lịch sử local."/>
    </View>

    <View style={[styles.toolbar,compact&&styles.toolbarCompact]}>
      <View style={styles.searchWrap}><Text style={styles.searchLabel}>TÌM BÀI HÁT</Text><View style={styles.searchBox}><Search size={16} color="#718096"/><TextInput value={query} onChangeText={setQuery} placeholder="Tên bài, nghệ sĩ hoặc link Suno..." placeholderTextColor="#596679" style={styles.searchInput}/></View></View>
      {items.length>0&&<Pressable style={styles.clear}><Text style={styles.clearText}>Xóa lịch sử local</Text></Pressable>}
    </View>

    <View style={styles.grid}>
      {visible.length?visible.map(item=><View key={item.id||item.url} style={[styles.songCard,narrow&&styles.songCardNarrow]}>
        {item.picture?<Image source={{uri:item.picture}} style={[styles.songCover,narrow&&styles.songCoverNarrow]}/>:<View style={[styles.songCover,styles.songCoverEmpty,narrow&&styles.songCoverNarrow]}><Music2 size={24} color="#a98aff"/></View>}
        <Pressable style={styles.songCopy} onPress={()=>onOpen(item)}>
          <Text numberOfLines={1} style={styles.songTitle}>{item.title||'Suno song'}</Text>
          <Text numberOfLines={1} style={styles.songMeta}>{item.creator||'Suno'} · {fmt(item.duration)}</Text>
          <Text numberOfLines={1} style={styles.songEvent}>Đã mở · {shortDate(item.updatedAt)}</Text>
        </Pressable>
        <Pressable style={[styles.sunoPill,narrow&&styles.sunoPillNarrow]} onPress={()=>onPlay({id:item.id,title:item.title,creator:item.creator,picture:item.picture,duration:item.duration,audio:item.url})}>
          <Play size={10} color="#bdaeff" fill="#bdaeff"/><Text style={styles.sunoPillText}>Suno</Text>
        </Pressable>
      </View>):<View style={styles.empty}>
        <BookOpen size={34} color="#9176ff"/>
        <Text style={styles.emptyTitle}>Thư viện local còn trống</Text>
        <Text style={styles.emptySub}>Dán link Suno ở trang chủ, tải audio hoặc render video để lưu lịch sử.</Text>
        <Pressable style={styles.emptyBtn} onPress={onCreate}><Text style={styles.emptyBtnText}>Mở bài mới</Text></Pressable>
      </View>}
    </View>

    <View style={styles.accountWrap}>
      <View style={styles.accountPanel}>
        <LogIn size={30} color="#8f7bff"/>
        <Text style={styles.accountTitle}>Đăng nhập để dùng thư viện Music</Text>
        <Text style={styles.accountSub}>Thư viện, playlist, lượt nghe và Top 20 được lưu theo tài khoản của bạn.</Text>
        <Pressable style={styles.accountBtn}><Text style={styles.accountBtnText}>Đăng nhập với Google</Text></Pressable>
      </View>
    </View>
  </ScrollView>
}

function HeroCard({kicker,title,sub}:{kicker:string;title:string;sub:string}){return <View style={styles.heroCard}><Text style={styles.heroKicker}>{kicker}</Text><Text numberOfLines={1} style={styles.heroTitle}>{title}</Text><Text numberOfLines={2} style={styles.heroSub}>{sub}</Text></View>}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#090d14'},
  content:{minHeight:'100%',marginLeft:0,paddingTop:v24.headerHeight+42,paddingHorizontal:42,paddingBottom:120},
  contentCompact:{marginLeft:0,paddingTop:0,paddingHorizontal:18,paddingBottom:100},
  head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:20,borderBottomWidth:1,borderColor:'#242b35',paddingBottom:24},
  headCompact:{flexDirection:'column',alignItems:'stretch',paddingTop:0},
  kicker:{color:'#8d72ff',fontSize:9,fontWeight:'800',letterSpacing:3},
  title:{color:'#f5f7fb',fontSize:32,fontWeight:'400',marginTop:7},titleCompact:{fontSize:27},
  headSub:{color:'#7f8ba0',fontSize:13,lineHeight:20,marginTop:18},
  create:{minHeight:42,borderRadius:10,backgroundColor:'#7559f4',paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},createFull:{width:'100%'},createText:{color:'#fff',fontSize:12,fontWeight:'700'},
  hero:{flexDirection:'row',gap:12,marginTop:24},heroCompact:{flexDirection:'column'},
  heroCard:{flex:1,minWidth:0,borderWidth:1,borderColor:'rgba(137,153,179,.12)',borderRadius:16,backgroundColor:'#0f1722',padding:18},
  heroKicker:{color:'#8f7bff',fontSize:9,fontWeight:'900',letterSpacing:1.6},
  heroTitle:{color:'#f4f7fb',fontSize:24,lineHeight:28,fontWeight:'400',marginTop:10},
  heroSub:{minHeight:38,color:'#7d889a',fontSize:11,lineHeight:17,marginTop:8},
  toolbar:{flexDirection:'row',alignItems:'flex-end',gap:12,marginTop:16},toolbarCompact:{flexDirection:'column',alignItems:'stretch'},
  searchWrap:{flex:1,gap:7},searchLabel:{color:'#8490a3',fontSize:10,fontWeight:'800',letterSpacing:.8},
  searchBox:{height:46,borderWidth:1,borderColor:'rgba(137,153,179,.16)',borderRadius:13,backgroundColor:'rgba(7,12,20,.76)',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:8},
  searchInput:{flex:1,color:'#f4f7fb',fontSize:13,paddingVertical:0},
  clear:{minHeight:46,borderWidth:1,borderColor:'rgba(137,153,179,.14)',borderRadius:13,backgroundColor:'rgba(255,255,255,.045)',paddingHorizontal:14,alignItems:'center',justifyContent:'center'},clearText:{color:'#d8deea',fontSize:12,fontWeight:'800'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:16},
  songCard:{flexGrow:1,flexBasis:270,minWidth:260,minHeight:84,borderWidth:1,borderColor:'rgba(137,153,179,.12)',borderRadius:16,backgroundColor:'#0f1722',padding:12,flexDirection:'row',alignItems:'center',gap:12},
  songCardNarrow:{flexBasis:'100%',minWidth:0},songCover:{width:58,height:58,borderRadius:14,backgroundColor:'rgba(137,92,246,.14)'},songCoverNarrow:{width:50,height:50},songCoverEmpty:{alignItems:'center',justifyContent:'center'},
  songCopy:{flex:1,minWidth:0},songTitle:{color:'#eef2f8',fontSize:13,fontWeight:'700'},songMeta:{color:'#9aa5b7',fontSize:11,marginTop:3},songEvent:{color:'#68768b',fontSize:10,marginTop:3},
  sunoPill:{borderWidth:1,borderColor:'rgba(137,153,179,.14)',borderRadius:999,backgroundColor:'rgba(255,255,255,.045)',paddingHorizontal:9,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:4},sunoPillNarrow:{alignSelf:'flex-end'},sunoPillText:{color:'#bdaeff',fontSize:10,fontWeight:'900'},
  empty:{width:'100%',minHeight:260,borderWidth:1,borderStyle:'dashed',borderColor:'rgba(137,153,179,.18)',borderRadius:18,backgroundColor:'rgba(9,15,24,.58)',padding:34,alignItems:'center',justifyContent:'center'},
  emptyTitle:{color:'#f4f7fb',fontSize:14,fontWeight:'800',marginTop:12},emptySub:{maxWidth:390,color:'#8190a6',fontSize:12,lineHeight:18,textAlign:'center',marginTop:6},emptyBtn:{marginTop:16,borderWidth:1,borderColor:'rgba(159,128,255,.24)',borderRadius:12,backgroundColor:'rgba(125,92,246,.16)',paddingHorizontal:14,paddingVertical:11},emptyBtnText:{color:'#d9d1ff',fontSize:11,fontWeight:'800'},
  accountWrap:{marginTop:18},accountPanel:{borderWidth:1,borderStyle:'dashed',borderColor:'rgba(148,163,184,.24)',borderRadius:18,padding:28,alignItems:'center'},accountTitle:{color:'#f4f7fb',fontSize:14,fontWeight:'800',marginTop:10},accountSub:{color:'#8190a6',fontSize:11,textAlign:'center',marginTop:6,marginBottom:14},accountBtn:{borderWidth:1,borderColor:'rgba(159,128,255,.24)',borderRadius:11,backgroundColor:'rgba(125,92,246,.16)',paddingHorizontal:14,paddingVertical:10},accountBtnText:{color:'#d9d1ff',fontSize:11,fontWeight:'700'},
});
