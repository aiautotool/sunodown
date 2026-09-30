import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BookOpen, ChevronLeft, ChevronRight, FileText, Folder, Image as ImageIcon, Link2, ListMusic, Menu, Music2, Play, Plus, Sparkles, Upload } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, v24 } from './theme';
import type { AppView, Project, Song } from './types';
import { resolveSuno } from './api';

const DEFAULT='https://suno.com/s/tszo0jGdVUua4rT4';
const previewUri=Platform.OS==='web'?'/home-cinematic-v23.svg':'https://sunoapp.aiautotool.com/home-cinematic-v23.svg';
const featured=[
  ['Cinematic','cinematic',['#281c44','#875dff']],
  ['Minimal','minimal',['#121821','#384454']],
  ['Neon','neon',['#151337','#b844ff']],
  ['Vintage','vintage',['#30231b','#a27148']],
  ['Aesthetic','aesthetic',['#2a1f36','#d67bc2']],
  ['Visualizer','visualizer',['#10132b','#6e62ff']],
] as const;

export function EmptyCreate({
  onResolved,
  onNavigate,
  projects,
}:{
  onResolved:(song:Song,input:string)=>void;
  onNavigate:(view:AppView)=>void;
  projects:Project[];
}) {
  const {width}=useWindowDimensions();
  const mobile=width<=v24.mobileBreakpoint;
  const stacked=width<=v24.tabletBreakpoint;
  const mid=width<=v24.laptopBreakpoint;
  const [input,setInput]=useState(DEFAULT);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [collapsed,setCollapsed]=useState(false);

  const analyze=async()=>{
    if(!input.trim())return;
    setLoading(true);setError('');
    try{const song=await resolveSuno(input.trim());onResolved(song,input.trim())}
    catch(e){setError(e instanceof Error?e.message:'Không phân tích được link')}
    finally{setLoading(false)}
  };
  const paste=async()=>{const value=(await Clipboard.getStringAsync()).trim();if(value)setInput(value)};

  const railWidth=stacked?0:(collapsed?(mid?72:76):(mid?210:250));

  return <View style={[styles.root,stacked&&styles.rootStacked]}>
    {!stacked&&<View style={[styles.side,{width:railWidth,paddingHorizontal:collapsed?10:15}]}>
      <Pressable style={[styles.sideItem,styles.collapse,collapsed&&styles.sideCollapsed]} onPress={()=>setCollapsed(v=>!v)}>
        {collapsed?<ChevronRight size={17} color="#7f8ba0"/>:<ChevronLeft size={17} color="#7f8ba0"/>}
        {!collapsed&&<Text style={styles.collapseText}>Thu gọn</Text>}
      </Pressable>

      <Pressable style={[styles.sideItem,styles.primary,collapsed&&styles.sideCollapsed]} disabled={loading} onPress={analyze}>
        <Plus size={19} color="#fff"/>
        {!collapsed&&<Text style={styles.primaryText}>{loading?'Đang phân tích…':'Tạo mới'}</Text>}
        {!collapsed&&<Text style={styles.arrow}>›</Text>}
      </Pressable>

      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]} onPress={()=>onNavigate('create')}>
        <Link2 size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Từ link Suno</Text>}
      </Pressable>
      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]}>
        <Upload size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Tải audio lên</Text>}
      </Pressable>
      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]} onPress={()=>onNavigate('library')}>
        <Music2 size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Music Player</Text>}
      </Pressable>
      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]} onPress={()=>onNavigate('library')}>
        <BookOpen size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Thư viện bài hát</Text>}
      </Pressable>
      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]}>
        <Sparkles size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Preset & Style</Text>}
      </Pressable>
      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]} onPress={()=>onNavigate('projects')}>
        <Folder size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Dự án</Text>}
      </Pressable>
      <Pressable style={[styles.sideItem,collapsed&&styles.sideCollapsed]} onPress={()=>onNavigate('jobs')}>
        <ListMusic size={19} color="#96a3b7"/>{!collapsed&&<Text style={styles.sideText}>Lịch sử render</Text>}
      </Pressable>

      <Pressable style={[styles.pro,collapsed&&styles.proCollapsed]} onPress={()=>onNavigate('settings')}>
        <View style={styles.proCrown}><Text style={styles.proCrownText}>♛</Text></View>
        {!collapsed&&<View style={{flex:1}}><Text style={styles.proTitle}>Nâng cấp Pro</Text><Text style={styles.proSub}>Không giới hạn, chất lượng cao hơn</Text></View>}
        {!collapsed&&<Text style={styles.proArrow}>›</Text>}
      </Pressable>
    </View>}

    <ScrollView style={styles.scroll} contentContainerStyle={[styles.shell,{paddingTop:mobile?8:26}]}>
      {mobile&&<View style={styles.mobileBrand}>
        <View style={styles.mobileBrandLeft}><Music2 size={27} color={colors.violet}/><Text style={styles.mobileBrandText}>SunoDown</Text></View>
        <Menu size={20} color="#c9d0dc"/>
      </View>}

      <View style={[styles.hero,stacked&&styles.heroStack]}>
        <View style={styles.copy}>
          <View style={styles.kicker}><Sparkles size={13} color="#a27dff"/><Text style={styles.kickerText}>CREATOR STUDIO</Text></View>
          <Text style={[styles.headline,mobile&&styles.headlineMobile]}>Turn your Suno song{String.fromCharCode(10)}<Text style={styles.headlineAccent}>into stunning content</Text></Text>
          <Text style={styles.description}>Biến nhạc Suno thành video lyric, karaoke và social video chuyên nghiệp chỉ trong vài phút.</Text>

          <View style={[styles.analyzeRow,stacked&&styles.analyzeRowStack]}>
            <View style={styles.linkbox}>
              <Link2 size={18} color="#c7d0dd"/>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={()=>void analyze()}
                placeholder="https://suno.com/s/..."
                placeholderTextColor="#667286"
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable onPress={paste} style={styles.paste}><Text style={styles.pasteText}>Dán</Text></Pressable>
            </View>
            <Pressable disabled={loading} onPress={analyze} style={{flex:stacked?undefined:0,width:stacked?'100%':174}}>
              <LinearGradient colors={['#9560ff','#745cf2']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.analyze}>
                {loading?<ActivityIndicator color="#fff"/>:<><Sparkles size={16} color="#fff"/><Text style={styles.analyzeText}>Phân tích</Text><Text style={styles.analyzeArrow}>›</Text></>}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.orRow}><View style={styles.orLine}/><Text style={styles.orText}>HOẶC</Text><View style={styles.orLine}/></View>

          <View style={[styles.sourceGrid,mobile&&styles.sourceGridMobile]}>
            <Pressable style={styles.sourceCard}>
              <View style={styles.sourceIcon}><Upload size={20} color="#a97eff"/></View>
              <View style={styles.sourceCopy}><Text style={styles.sourceTitle}>Tải file audio lên</Text><Text style={styles.sourceSub}>MP3, WAV, M4A, AAC, OGG, FLAC</Text></View>
              <Text style={styles.sourceArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.sourceCard} onPress={()=>onNavigate('library')}>
              <View style={styles.sourceIcon}><Music2 size={20} color="#a97eff"/></View>
              <View style={styles.sourceCopy}><Text style={styles.sourceTitle}>Thư viện bài hát</Text><Text style={styles.sourceSub}>Quản lý bài đã lưu và quét theo tài khoản Suno</Text></View>
              <Text style={styles.sourceArrow}>›</Text>
            </Pressable>
          </View>

          {!!error&&<Text style={styles.error}>{error}</Text>}
          {projects[0]&&<Pressable style={styles.continueCard}>
            <Folder size={17} color="#8d72ff"/>
            <View style={{flex:1}}><Text style={styles.continueKicker}>TIẾP TỤC DỰ ÁN</Text><Text numberOfLines={1} style={styles.continueTitle}>{projects[0].title}</Text></View>
            <Text style={styles.sourceArrow}>›</Text>
          </Pressable>}
        </View>

        <View style={[styles.showcase,stacked&&styles.showcaseStack]}>
          <View style={styles.showcaseGlow}/>
          <View style={styles.toolStack}>
            <MiniTool icon={<FileText size={20} color="#d4c8ff"/>} label="Lyrics"/>
            <MiniTool icon={<Music2 size={20} color="#d4c8ff"/>} label="Waveform"/>
            <MiniTool icon={<ImageIcon size={20} color="#d4c8ff"/>} label="Background"/>
            <MiniTool icon={<Sparkles size={20} color="#d4c8ff"/>} label="Preset"/>
          </View>

          <View style={[styles.phone,mobile&&styles.phoneMobile]}>
            <View style={styles.phoneNotch}/>
            <View style={styles.phoneScreen}>
              <Image source={{uri:previewUri}} style={StyleSheet.absoluteFill} resizeMode="cover"/>
              <LinearGradient colors={['rgba(4,7,12,.02)','rgba(4,7,12,.10)','rgba(4,7,12,.92)']} style={StyleSheet.absoluteFill}/>
              <View style={styles.ratioBadge}><Text style={styles.ratioText}>9:16</Text></View>
              <Text style={styles.phoneLyrics}>Có những ngày{String.fromCharCode(10)}chỉ muốn đi thật xa...</Text>
              <View style={styles.phoneWave}>{Array.from({length:34}).map((_,i)=><View key={i} style={[styles.phoneBar,{height:5+((i*11)%18)}]}/>)}</View>
              <View style={styles.phoneTime}><Text style={styles.phoneTimeText}>00:42</Text><Text style={styles.phoneTimeText}>03:18</Text></View>
              <View style={styles.phoneControls}><Text style={styles.chev}>‹</Text><View style={styles.phonePlay}><Play size={19} color="#fff" fill="#fff"/></View><Text style={styles.chev}>›</Text></View>
            </View>
          </View>

          <View style={[styles.controlCard,mobile&&styles.controlCardMobile]}>
            <Image source={{uri:previewUri}} style={styles.controlThumb} resizeMode="cover"/>
            <Text style={styles.controlTitle}>Cinematic</Text>
            <SliderFake label="Blur" value={32} text="30%"/>
            <SliderFake label="Zoom" value={68} text="100%"/>
            <SliderFake label="Glow" value={50} text="50%"/>
          </View>
        </View>
      </View>

      <View style={[styles.benefits,mobile&&styles.benefitsMobile]}>
        <Benefit icon="⚡" title="Nhanh chóng" sub="Tạo video trong vài phút"/>
        <Benefit icon="HD" title="Chất lượng cao" sub="Preset và export sắc nét"/>
        <Benefit icon="✦" title="Nhiều phong cách" sub="Lyrics, cinematic, visualizer"/>
        <Benefit icon="9:16" title="Tối ưu social" sub="TikTok, Reels, Shorts"/>
        <Benefit icon="☁" title="Không cần cài đặt" sub="Dùng ngay trên trình duyệt"/>
      </View>

      <View style={styles.featured}>
        <View style={styles.featuredHead}><View style={styles.featuredTitleRow}><Text>🔥</Text><Text style={styles.featuredTitle}>Mẫu video nổi bật</Text></View><Text style={styles.featuredLink}>Xem tất cả  ›</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {featured.map(([name,id,gradient],index)=><Pressable key={id} style={[styles.template,index===0&&styles.templateActive]}>
            <LinearGradient colors={gradient as any} style={styles.templateThumb}>
              <Image source={{uri:previewUri}} style={StyleSheet.absoluteFill} resizeMode="cover"/>
              <LinearGradient colors={['transparent','rgba(5,8,13,.68)']} style={StyleSheet.absoluteFill}/>
              <View style={styles.templateBadge}><Text style={styles.templateBadgeText}>{index===0?'HOT':'STYLE'}</Text></View>
            </LinearGradient>
            <Text numberOfLines={1} style={styles.templateName}>{name}</Text>
            <View style={styles.templatePlay}><Play size={9} color="#fff" fill="#fff"/></View>
          </Pressable>)}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLinks}><Text style={styles.footerLink}>Tải Suno MP3</Text><Text style={styles.footerLink}>Tải Suno WAV</Text><Text style={styles.footerLink}>Tải & tạo video Suno</Text></View>
        <Text style={styles.footerBuild}>MUSIC LIVES FURTHER · V24REACT</Text>
      </View>
    </ScrollView>
  </View>
}

function MiniTool({icon,label}:{icon:React.ReactNode;label:string}){return <View style={styles.miniTool}>{icon}<Text style={styles.miniToolText}>{label}</Text></View>}
function SliderFake({label,value,text}:{label:string;value:number;text:string}){return <View style={styles.sliderRow}><Text style={styles.sliderLabel}>{label}</Text><View style={styles.sliderTrack}><LinearGradient colors={['#9c6aff','#7768ff']} style={[styles.sliderFill,{width:`${value}%`}]}/></View><Text style={styles.sliderValue}>{text}</Text></View>}
function Benefit({icon,title,sub}:{icon:string;title:string;sub:string}){return <View style={styles.benefit}><View style={styles.benefitIcon}><Text style={styles.benefitIconText}>{icon}</Text></View><View style={{flex:1}}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitSub}>{sub}</Text></View></View>}

const styles=StyleSheet.create({
  root:{flex:1,flexDirection:'row',backgroundColor:'#07101b',paddingTop:v24.headerHeight},rootStacked:{paddingTop:0},
  side:{minHeight:'100%',backgroundColor:'rgba(9,15,25,.93)',borderRightWidth:1,borderRightColor:'rgba(132,148,173,.08)',paddingTop:25,paddingBottom:18,gap:7},
  sideItem:{minHeight:48,borderRadius:12,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14},
  sideCollapsed:{justifyContent:'center',paddingHorizontal:0},
  collapse:{minHeight:38,marginTop:-8,marginBottom:4,borderWidth:1,borderColor:'rgba(140,156,184,.08)',backgroundColor:'rgba(255,255,255,.018)'},
  collapseText:{color:'#7f8ba0',fontSize:11},
  primary:{minHeight:54,marginBottom:9,borderWidth:1,borderColor:'rgba(167,125,255,.37)',backgroundColor:'#815af3'},
  primaryText:{flex:1,color:'#fff',fontSize:12,fontWeight:'700'},arrow:{color:'#fff',fontSize:25},
  sideText:{color:'#96a3b7',fontSize:12},
  pro:{marginTop:'auto',minHeight:82,borderWidth:1,borderColor:'rgba(149,163,184,.16)',borderRadius:12,backgroundColor:'#0d1420',flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12},
  proCollapsed:{minHeight:54,justifyContent:'center',paddingHorizontal:0},
  proCrown:{width:30,height:30,borderRadius:10,backgroundColor:'rgba(245,174,67,.1)',alignItems:'center',justifyContent:'center'},proCrownText:{color:'#ffc45f',fontSize:15},
  proTitle:{color:'#f3f5f8',fontSize:12,fontWeight:'700'},proSub:{color:'#717e92',fontSize:8,marginTop:4},proArrow:{color:'#8e9bb0',fontSize:22},

  scroll:{flex:1},shell:{paddingHorizontal:28,paddingBottom:22},
  mobileBrand:{height:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:4,marginBottom:8},
  mobileBrandLeft:{flexDirection:'row',alignItems:'center',gap:10},mobileBrandText:{color:'#f5f7fb',fontSize:21,fontWeight:'700'},
  hero:{minHeight:520,flexDirection:'row',gap:18,alignItems:'center'},heroStack:{flexDirection:'column',alignItems:'stretch',paddingTop:18},
  copy:{flex:1,maxWidth:720},kicker:{alignSelf:'flex-start',height:34,borderWidth:1,borderColor:'rgba(145,164,194,.13)',borderRadius:999,backgroundColor:'rgba(23,32,49,.72)',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:8},
  kickerText:{color:'#b9c3d4',fontSize:9,fontWeight:'800',letterSpacing:1.8},
  headline:{color:'#f5f7fb',fontSize:58,lineHeight:57,fontWeight:'900',letterSpacing:-3,marginTop:17,marginBottom:14},headlineMobile:{fontSize:39,lineHeight:40,letterSpacing:-1.7},
  headlineAccent:{color:'#8d66ff'},description:{maxWidth:650,color:'#aeb9cb',fontSize:14,lineHeight:23,marginBottom:24},
  analyzeRow:{flexDirection:'row',gap:9},analyzeRowStack:{flexDirection:'column'},
  linkbox:{flex:1,minHeight:62,borderWidth:1,borderColor:'rgba(143,106,255,.72)',borderRadius:14,backgroundColor:'#0e1622',paddingLeft:15,paddingRight:11,flexDirection:'row',alignItems:'center',gap:10},
  input:{flex:1,color:'#f8faff',fontSize:13,paddingVertical:0},paste:{borderRadius:8,backgroundColor:'rgba(255,255,255,.05)',paddingHorizontal:9,paddingVertical:7},pasteText:{color:'#9aa6b9',fontSize:9},
  analyze:{minHeight:62,borderRadius:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9,paddingHorizontal:14},analyzeText:{color:'#fff',fontSize:13,fontWeight:'800'},analyzeArrow:{color:'#fff',fontSize:22},
  orRow:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:15},orLine:{height:1,flex:1,backgroundColor:'rgba(137,153,179,.13)'},orText:{color:'#5f6b7e',fontSize:8,fontWeight:'800',letterSpacing:1.6},
  sourceGrid:{flexDirection:'row',gap:10},sourceGridMobile:{flexDirection:'column'},sourceCard:{flex:1,minHeight:78,borderWidth:1,borderColor:'rgba(132,148,174,.15)',borderRadius:14,backgroundColor:'#0f1722',paddingHorizontal:13,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:12},
  sourceIcon:{width:44,height:44,borderRadius:13,backgroundColor:'rgba(133,82,255,.20)',alignItems:'center',justifyContent:'center'},sourceCopy:{flex:1},sourceTitle:{color:'#e9edf4',fontSize:11,fontWeight:'700'},sourceSub:{color:'#778397',fontSize:8,marginTop:4},sourceArrow:{color:'#8996aa',fontSize:20},
  error:{color:'#ff9da5',fontSize:12,marginTop:10},continueCard:{marginTop:10,minHeight:54,borderWidth:1,borderColor:'rgba(105,122,149,.12)',borderRadius:11,backgroundColor:'rgba(10,16,25,.65)',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10},continueKicker:{color:'#7666c9',fontSize:7,letterSpacing:1},continueTitle:{color:'#dbe1ea',fontSize:9,fontWeight:'700',marginTop:2},

  showcase:{flex:0.95,minHeight:520,alignItems:'center',justifyContent:'center',position:'relative'},showcaseStack:{width:'100%',minHeight:520},
  showcaseGlow:{position:'absolute',width:500,height:500,borderRadius:250,backgroundColor:'rgba(139,75,255,.13)'},
  toolStack:{position:'absolute',left:'4%',top:'23%',zIndex:5,width:100,borderWidth:1,borderColor:'rgba(182,166,231,.2)',borderRadius:21,overflow:'hidden',backgroundColor:'rgba(20,21,38,.90)',transform:[{rotate:'8deg'}]},
  miniTool:{height:76,alignItems:'center',justifyContent:'center',borderBottomWidth:1,borderColor:'rgba(255,255,255,.045)'},miniToolText:{color:'#bec7d7',fontSize:7,marginTop:8},
  phone:{zIndex:4,width:280,aspectRatio:9/16,borderWidth:1,borderColor:'rgba(210,218,239,.22)',borderRadius:38,backgroundColor:'#111a26',padding:10,transform:[{rotate:'7deg'}]},phoneMobile:{width:250,transform:[{rotate:'4deg'}]},
  phoneNotch:{position:'absolute',zIndex:10,top:15,left:'35%',right:'35%',height:18,borderBottomLeftRadius:12,borderBottomRightRadius:12,backgroundColor:'#05070b'},
  phoneScreen:{flex:1,borderRadius:29,overflow:'hidden',backgroundColor:'#090e17'},ratioBadge:{position:'absolute',right:11,top:13,zIndex:5,borderWidth:1,borderColor:'rgba(255,255,255,.12)',borderRadius:9,backgroundColor:'rgba(8,12,19,.55)',paddingHorizontal:7,paddingVertical:5},ratioText:{color:'#fff',fontSize:9,fontWeight:'800'},
  phoneLyrics:{position:'absolute',zIndex:5,left:15,right:15,bottom:120,color:'#fff',fontSize:18,fontWeight:'700',fontStyle:'italic',lineHeight:24,textAlign:'center',textShadowColor:'#000',textShadowRadius:16},
  phoneWave:{position:'absolute',zIndex:5,left:19,right:19,bottom:84,height:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},phoneBar:{width:2,borderRadius:2,backgroundColor:'#cf78ff'},
  phoneTime:{position:'absolute',zIndex:5,left:20,right:20,bottom:65,flexDirection:'row',justifyContent:'space-between'},phoneTimeText:{color:'#aeb8ca',fontSize:6},
  phoneControls:{position:'absolute',zIndex:5,left:0,right:0,bottom:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:22},chev:{color:'#dce3ec',fontSize:24},phonePlay:{width:48,height:48,borderWidth:1,borderColor:'rgba(255,255,255,.7)',borderRadius:24,backgroundColor:'rgba(255,255,255,.08)',alignItems:'center',justifyContent:'center'},
  controlCard:{position:'absolute',zIndex:6,right:0,top:'31%',width:165,borderWidth:1,borderColor:'rgba(192,180,225,.24)',borderRadius:18,backgroundColor:'rgba(18,22,34,.95)',padding:10,transform:[{rotate:'6deg'}]},controlCardMobile:{width:128,right:0,top:'34%'},controlThumb:{width:'100%',height:76,borderRadius:11},controlTitle:{color:'#f1f4f8',fontSize:9,fontWeight:'700',marginVertical:9},
  sliderRow:{flexDirection:'row',alignItems:'center',gap:6,marginVertical:4},sliderLabel:{width:38,color:'#8f9bad',fontSize:6},sliderTrack:{height:3,flex:1,borderRadius:99,backgroundColor:'#222b39',overflow:'hidden'},sliderFill:{height:3,borderRadius:99},sliderValue:{width:27,color:'#8f9bad',fontSize:6,textAlign:'right'},

  benefits:{flexDirection:'row',marginTop:4,marginBottom:20,borderWidth:1,borderColor:'rgba(130,146,171,.08)',borderRadius:14,backgroundColor:'rgba(12,19,29,.86)',overflow:'hidden'},benefitsMobile:{flexWrap:'wrap'},
  benefit:{flex:1,minWidth:145,minHeight:75,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,borderRightWidth:1,borderColor:'rgba(255,255,255,.04)'},benefitIcon:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(122,78,255,.08)',alignItems:'center',justifyContent:'center'},benefitIconText:{color:'#9e75ff',fontSize:9,fontWeight:'900'},benefitTitle:{color:'#eef2f7',fontSize:9,fontWeight:'700'},benefitSub:{color:'#6e7a8d',fontSize:7,marginTop:3},
  featured:{marginTop:4},featuredHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11},featuredTitleRow:{flexDirection:'row',alignItems:'center',gap:7},featuredTitle:{color:'#f5f7fb',fontSize:12,fontWeight:'700'},featuredLink:{color:'#9b82f5',fontSize:8},featuredRow:{gap:9,paddingBottom:5},
  template:{width:170,overflow:'hidden',borderWidth:1,borderColor:'rgba(126,143,169,.16)',borderRadius:12,backgroundColor:'#0d131d',position:'relative'},templateActive:{borderColor:'#8d5cff'},templateThumb:{height:92,position:'relative'},templateBadge:{position:'absolute',left:7,top:7,borderRadius:999,backgroundColor:'rgba(11,16,25,.75)',paddingHorizontal:6,paddingVertical:3},templateBadgeText:{color:'#fff',fontSize:7,fontWeight:'800'},templateName:{color:'#fff',fontSize:8,fontWeight:'700',paddingTop:9,paddingBottom:10,paddingLeft:10,paddingRight:30},templatePlay:{position:'absolute',right:7,bottom:7,width:22,height:22,borderWidth:1,borderColor:'rgba(255,255,255,.17)',borderRadius:11,backgroundColor:'rgba(11,16,25,.72)',alignItems:'center',justifyContent:'center'},
  footer:{marginTop:24,marginBottom:4,alignItems:'center'},footerLinks:{flexDirection:'row',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:10},footerLink:{color:'#78859a',fontSize:9,fontWeight:'700'},footerBuild:{color:'#495468',fontSize:7,fontWeight:'700',letterSpacing:2.4},
});
