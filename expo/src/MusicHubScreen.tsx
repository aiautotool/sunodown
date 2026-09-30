import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Clock3, Heart, ListMusic, Music2, Plus, Search, Shuffle, Sparkles } from 'lucide-react-native';
import type { LocalLibraryItem, Song } from './types';

type Tab='listen'|'new'|'top'|'playlists';

const fmt=(n=0)=>{
  const safe=Number.isFinite(n)?Math.max(0,n):0;
  return Math.floor(safe/60)+':'+String(Math.floor(safe%60)).padStart(2,'0');
};

export function MusicHubScreen({
  items,
  onPlay,
  onOpenLibrary,
  onCreate,
}:{
  items:LocalLibraryItem[];
  onPlay:(song:Song)=>void;
  onOpenLibrary:()=>void;
  onCreate:()=>void;
}){
  const {width}=useWindowDimensions();
  const compact=width<=900;
  const [tab,setTab]=useState<Tab>('listen');
  const [query,setQuery]=useState('');
  const songs=useMemo(()=>items.map(item=>({
    id:item.id,
    title:item.title,
    creator:item.creator,
    picture:item.picture,
    duration:item.duration,
    audio:item.url,
    updatedAt:item.updatedAt,
    favorite:item.favorite,
  })),[items]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return songs;
    return songs.filter(song=>(song.title+' '+(song.creator||'')).toLowerCase().includes(q));
  },[songs,query]);

  const newest=useMemo(()=>[...songs].sort((a,b)=>b.updatedAt-a.updatedAt),[songs]);
  const favorites=useMemo(()=>songs.filter(song=>song.favorite),[songs]);
  const top=useMemo(()=>[...songs].sort((a,b)=>(Number(b.favorite)-Number(a.favorite))||(b.updatedAt-a.updatedAt)).slice(0,20),[songs]);
  const visible=query?filtered:tab==='new'?newest:tab==='top'?top:tab==='playlists'?favorites:songs;
  const heroSong=songs[0];

  const play=(item:(typeof songs)[number])=>onPlay({
    id:item.id,
    title:item.title,
    creator:item.creator,
    picture:item.picture,
    duration:item.duration,
    audio:item.audio,
  });

  return <View style={styles.root}>
    {!compact&&<View style={styles.sidebar}>
      <Pressable style={styles.brand} onPress={onCreate}>
        <View style={styles.brandMark}><Music2 size={22} color="#9e87ff"/></View>
        <Text style={styles.brandText}>SunoDown</Text>
      </Pressable>
      <Text style={styles.sideLabel}>MUSIC</Text>
      <SideButton active={tab==='listen'} icon={<Sparkles size={17}/>} label="Listen Now" onPress={()=>setTab('listen')}/>
      <SideButton active={tab==='new'} icon={<Clock3 size={17}/>} label="New Songs" onPress={()=>setTab('new')}/>
      <SideButton active={tab==='top'} icon={<ListMusic size={17}/>} label="Top 20" onPress={()=>setTab('top')}/>
      <SideButton active={tab==='playlists'} icon={<Music2 size={17}/>} label="Playlists" onPress={()=>setTab('playlists')}/>
      <View style={styles.sideDivider}/>
      <SideButton active={false} icon={<Heart size={17}/>} label="Liked Songs" onPress={()=>setTab('playlists')}/>
      <Pressable style={styles.newPlaylist}><Plus size={16} color="#aeb7c6"/><Text style={styles.newPlaylistText}>New Playlist</Text></Pressable>
    </View>}

    <View style={styles.main}>
      <View style={[styles.topbar,compact&&styles.topbarCompact]}>
        <View style={styles.search}>
          <Search size={17} color="#7d899c"/>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm tên bài, tác giả, style..."
            placeholderTextColor="#596679"
            style={styles.searchInput}
          />
        </View>
        {!compact&&<View style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>S</Text></View><Text style={styles.profileText}>SunoDown</Text></View>}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content,compact&&styles.contentCompact]}>
        {!query&&tab==='listen'&&<>
          <View style={[styles.hero,compact&&styles.heroCompact]}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>LISTEN NOW</Text>
              <Text style={[styles.heroTitle,compact&&styles.heroTitleCompact]}>Nhạc của bạn,{String.fromCharCode(10)}sẵn sàng để nghe.</Text>
              <Text style={styles.heroText}>{songs.length?(String(songs.length)+' bài trong thư viện local'):'Quét tài khoản Suno hoặc mở bài để đưa nhạc vào đây.'}</Text>
              <View style={[styles.heroActions,compact&&styles.heroActionsCompact]}>
                <Pressable
                  disabled={!songs.length}
                  onPress={()=>songs.length&&play(songs[Math.floor(Math.random()*songs.length)]!)}
                  style={[styles.primary,songs.length===0&&styles.disabled]}
                >
                  <Shuffle size={16} color="#fff"/><Text style={styles.primaryText}>Shuffle My Library</Text>
                </Pressable>
                <Pressable onPress={onOpenLibrary} style={styles.secondary}><Plus size={16} color="#d4ccff"/><Text style={styles.secondaryText}>Thêm nhạc</Text></Pressable>
              </View>
            </View>

            <Pressable
              disabled={!heroSong}
              onPress={()=>heroSong&&play(heroSong)}
              style={[styles.continueCard,!heroSong&&styles.continueEmpty]}
            >
              {heroSong?.picture?<Image source={{uri:heroSong.picture}} style={styles.continueCover}/>:<View style={[styles.continueCover,styles.coverEmpty]}><Music2 size={28} color="#9b85ff"/></View>}
              <View style={styles.continueCopy}>
                <Text style={styles.continueKicker}>{heroSong?'CONTINUE LISTENING':'START LISTENING'}</Text>
                <Text numberOfLines={1} style={styles.continueTitle}>{heroSong?.title||'Chưa có lịch sử nghe'}</Text>
                <Text numberOfLines={1} style={styles.continueMeta}>{heroSong?.creator||'Phát một bài để bắt đầu Music của bạn.'}</Text>
                {!!heroSong&&<Text style={styles.continueTime}>0:00 / {fmt(heroSong.duration)}</Text>}
              </View>
              {!!heroSong&&<View style={styles.continuePlay}><Text style={styles.continuePlayText}>▶</Text></View>}
            </Pressable>
          </View>

          {!songs.length&&<View style={styles.emptyLibrary}>
            <Music2 size={28} color="#8f7bff"/>
            <View style={{flex:1}}><Text style={styles.emptyTitle}>Chưa có thư viện nhạc</Text><Text style={styles.emptyText}>Mở Library, quét tài khoản Suno hoặc mở một bài. Music và player sẽ dùng cùng dữ liệu trên app Expo.</Text></View>
            <Pressable style={styles.emptyButton} onPress={onOpenLibrary}><Text style={styles.emptyButtonText}>Mở Library</Text></Pressable>
          </View>}
        </>}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.eyebrow}>{query?'SEARCH':tab==='new'?'NEW MUSIC':tab==='top'?'YOUR LISTENING':tab==='playlists'?'PLAYLISTS':'YOUR HISTORY'}</Text>
              <Text style={styles.sectionTitle}>{query?('Kết quả cho “'+query+'”'):tab==='new'?'Bài mới':tab==='top'?'Top 20':tab==='playlists'?'Liked Songs':'Recently Played'}</Text>
            </View>
            <Text style={styles.count}>{visible.length} bài</Text>
          </View>

          <View style={styles.list}>
            {visible.length?visible.map((song,index)=><Pressable key={song.id||song.audio} onPress={()=>play(song)} style={styles.row}>
              <Text style={styles.rank}>{String(index+1).padStart(2,'0')}</Text>
              {song.picture?<Image source={{uri:song.picture}} style={styles.cover}/>:<View style={[styles.cover,styles.coverEmpty]}><Music2 size={20} color="#9c86ff"/></View>}
              <View style={styles.songCopy}><Text numberOfLines={1} style={styles.songTitle}>{song.title}</Text><Text numberOfLines={1} style={styles.songMeta}>{song.creator||'Suno'} · {fmt(song.duration)}</Text></View>
              {song.favorite&&<Heart size={15} color="#b39fff" fill="#b39fff"/>}
              <View style={styles.playPill}><Text style={styles.playText}>Play</Text></View>
            </Pressable>):<View style={styles.emptyRows}><Music2 size={28} color="#8a75ed"/><Text style={styles.emptyRowsTitle}>Chưa có bài phù hợp</Text><Pressable onPress={onOpenLibrary}><Text style={styles.emptyRowsLink}>Mở thư viện</Text></Pressable></View>}
          </View>
        </View>
      </ScrollView>
    </View>
  </View>;
}

function SideButton({active,icon,label,onPress}:{active:boolean;icon:React.ReactNode;label:string;onPress:()=>void}){
  return <Pressable style={[styles.sideBtn,active&&styles.sideBtnActive]} onPress={onPress}>{icon}<Text style={[styles.sideBtnText,active&&styles.sideBtnTextActive]}>{label}</Text></Pressable>;
}

const styles=StyleSheet.create({
  root:{flex:1,flexDirection:'row',backgroundColor:'#080c12'},
  sidebar:{width:226,borderRightWidth:1,borderRightColor:'#202630',backgroundColor:'#0a0f16',paddingHorizontal:16,paddingTop:22,paddingBottom:98},
  brand:{height:48,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:6},
  brandMark:{width:34,height:34,borderRadius:11,backgroundColor:'rgba(126,96,238,.13)',alignItems:'center',justifyContent:'center'},
  brandText:{color:'#f4f7fb',fontSize:20,fontWeight:'800'},
  sideLabel:{color:'#596578',fontSize:8,fontWeight:'900',letterSpacing:2.1,marginTop:24,marginBottom:8,paddingHorizontal:9},
  sideBtn:{height:44,borderRadius:11,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:10},
  sideBtnActive:{backgroundColor:'rgba(116,88,225,.16)'},
  sideBtnText:{color:'#8d99aa',fontSize:11,fontWeight:'700'},
  sideBtnTextActive:{color:'#ece8ff'},
  sideDivider:{height:1,backgroundColor:'#202630',marginVertical:14},
  newPlaylist:{height:42,marginTop:'auto',borderWidth:1,borderColor:'#2c3440',borderRadius:11,backgroundColor:'#101720',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8},
  newPlaylistText:{color:'#aeb7c6',fontSize:10,fontWeight:'700'},

  main:{flex:1,minWidth:0},
  topbar:{height:68,borderBottomWidth:1,borderColor:'#202630',paddingHorizontal:26,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#090d13'},
  topbarCompact:{height:58,paddingHorizontal:12},
  search:{flex:1,maxWidth:560,height:42,borderWidth:1,borderColor:'#252d39',borderRadius:12,backgroundColor:'#0f151e',paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:8},
  searchInput:{flex:1,color:'#eef2f8',fontSize:12,paddingVertical:0},
  profile:{flexDirection:'row',alignItems:'center',gap:8,marginLeft:16},
  avatar:{width:34,height:34,borderRadius:17,backgroundColor:'#7569a4',alignItems:'center',justifyContent:'center'},
  avatarText:{color:'#fff',fontWeight:'800'},profileText:{color:'#adb6c4',fontSize:11,fontWeight:'700'},

  scroll:{flex:1},
  content:{paddingHorizontal:34,paddingTop:28,paddingBottom:130},
  contentCompact:{paddingHorizontal:14,paddingTop:16,paddingBottom:140},
  hero:{minHeight:300,borderWidth:1,borderColor:'rgba(139,108,255,.16)',borderRadius:20,backgroundColor:'#0d131d',padding:28,flexDirection:'row',gap:28,alignItems:'center'},
  heroCompact:{flexDirection:'column',alignItems:'stretch',padding:18,minHeight:0},
  heroCopy:{flex:1},
  eyebrow:{color:'#8f79ff',fontSize:9,fontWeight:'900',letterSpacing:1.8},
  heroTitle:{color:'#f5f7fb',fontSize:46,lineHeight:49,fontWeight:'800',letterSpacing:-1.8,marginTop:10},
  heroTitleCompact:{fontSize:32,lineHeight:35},
  heroText:{color:'#7f8ba0',fontSize:12,lineHeight:19,marginTop:14},
  heroActions:{flexDirection:'row',gap:9,marginTop:20},
  heroActionsCompact:{flexDirection:'column'},
  primary:{minHeight:43,borderRadius:11,backgroundColor:'#765cf0',paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  primaryText:{color:'#fff',fontSize:11,fontWeight:'800'},
  secondary:{minHeight:43,borderWidth:1,borderColor:'#313a48',borderRadius:11,backgroundColor:'#121925',paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  secondaryText:{color:'#d4ccff',fontSize:11,fontWeight:'800'},disabled:{opacity:.35},

  continueCard:{width:340,minHeight:155,borderWidth:1,borderColor:'#29313d',borderRadius:16,backgroundColor:'#111821',padding:12,flexDirection:'row',alignItems:'center',gap:12},
  continueEmpty:{opacity:.8},continueCover:{width:110,height:130,borderRadius:12,backgroundColor:'#171e29'},coverEmpty:{alignItems:'center',justifyContent:'center'},
  continueCopy:{flex:1,minWidth:0},continueKicker:{color:'#8070d8',fontSize:8,fontWeight:'900',letterSpacing:1.1},continueTitle:{color:'#f5f7fb',fontSize:13,fontWeight:'800',marginTop:7},continueMeta:{color:'#8591a3',fontSize:10,marginTop:4},continueTime:{color:'#626f82',fontSize:8,marginTop:20},
  continuePlay:{width:34,height:34,borderRadius:17,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},continuePlayText:{color:'#0b0f16',fontSize:12},

  emptyLibrary:{marginTop:16,borderWidth:1,borderStyle:'dashed',borderColor:'rgba(148,163,184,.22)',borderRadius:16,backgroundColor:'#0c121b',padding:18,flexDirection:'row',alignItems:'center',gap:14},
  emptyTitle:{color:'#eef2f8',fontSize:12,fontWeight:'800'},emptyText:{color:'#7e899a',fontSize:10,lineHeight:16,marginTop:4},
  emptyButton:{borderWidth:1,borderColor:'#3b315f',borderRadius:10,backgroundColor:'#1a1530',paddingHorizontal:12,paddingVertical:9},emptyButtonText:{color:'#cbbfff',fontSize:10,fontWeight:'800'},

  section:{marginTop:24},
  sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:14,marginBottom:10},
  sectionTitle:{color:'#f3f6fb',fontSize:20,fontWeight:'800',marginTop:5},
  count:{color:'#687588',fontSize:9},
  list:{gap:7},
  row:{minHeight:66,borderWidth:1,borderColor:'#202936',borderRadius:13,backgroundColor:'#0e151e',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:10},
  rank:{width:26,color:'#5f6b7c',fontSize:9,fontWeight:'800',textAlign:'center'},
  cover:{width:46,height:46,borderRadius:10,backgroundColor:'#171e29'},
  songCopy:{flex:1,minWidth:0},songTitle:{color:'#eef2f8',fontSize:11,fontWeight:'800'},songMeta:{color:'#788598',fontSize:9,marginTop:4},
  playPill:{borderWidth:1,borderColor:'#332d4e',borderRadius:999,backgroundColor:'#171328',paddingHorizontal:10,paddingVertical:6},playText:{color:'#c7baff',fontSize:8,fontWeight:'900'},
  emptyRows:{minHeight:190,borderWidth:1,borderStyle:'dashed',borderColor:'#27303d',borderRadius:15,alignItems:'center',justifyContent:'center'},
  emptyRowsTitle:{color:'#d9dfe8',fontSize:11,fontWeight:'800',marginTop:9},emptyRowsLink:{color:'#a995ff',fontSize:10,fontWeight:'800',marginTop:7},
});
