import '@expo/metro-runtime';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Bell, BookOpen, ChevronDown, Folder, Home, Library as LibraryIcon, ListMusic, Menu, Music2, PlusCircle, Settings, UserRound, X } from 'lucide-react-native';
import { colors, v24 } from './src/theme';
import type { AppView, LocalLibraryItem, Project, RenderJob, Song, StudioSnapshot } from './src/types';
import { EmptyCreate } from './src/EmptyCreate';
import { StudioScreen } from './src/StudioScreen';
import { LibraryScreen } from './src/LibraryScreen';
import { JobsScreen, ProjectsScreen, SettingsScreen } from './src/SecondaryScreens';
import { MusicPlayer } from './src/MusicPlayer';
import { StartupScreen } from './src/StartupScreen';
import { SongInitScreen, type SongInitState } from './src/SongInitScreen';
import { storage } from './src/storage';

const BUILD_SHA=process.env.EXPO_PUBLIC_BUILD_SHA||'dev';

function UniversalApp(){
  const {width}=useWindowDimensions();
  const compact=width<=v24.mobileBreakpoint;
  const [view,setView]=useState<AppView>('create');
  const [song,setSong]=useState<Song|null>(null);
  const [sourceUrl,setSourceUrl]=useState('');
  const [initialStudio,setInitialStudio]=useState<StudioSnapshot|undefined>(undefined);
  const [playingSong,setPlayingSong]=useState<Song|null>(null);
  const [library,setLibrary]=useState<LocalLibraryItem[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [jobs,setJobs]=useState<RenderJob[]>([]);
  const [songInit,setSongInit]=useState<SongInitState>({visible:false,progress:0,title:'Đang khởi tạo bài hát',detail:'Chuẩn bị dữ liệu mới…'});
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);

  useEffect(()=>{void (async()=>{
    const [l,p,j]=await Promise.all([storage.getLibrary(),storage.getProjects(),storage.getJobs()]);
    setLibrary(l); setProjects(p); setJobs(j);
  })()},[]);

  useEffect(()=>{
    if(Platform.OS!=='web')return;
    const doc=(globalThis as any).document;
    if(!doc||doc.getElementById('v24-font-parity'))return;
    const style=doc.createElement('style');
    style.id='v24-font-parity';
    style.textContent="@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');#root *{font-family:'Be Vietnam Pro',Arial,Helvetica,sans-serif}html,body,#root{margin:0;min-height:100%;background:#080c12}";
    doc.head.appendChild(style);
    return()=>style.remove();
  },[]);

  const resolveDone=(next:Song,input:string)=>{
    setInitialStudio(undefined);
    setSong(next); setSourceUrl(input);
    const id=next.id||input;
    const item:LocalLibraryItem={id,url:input,title:next.title,creator:next.creator,picture:next.picture,duration:next.duration,updatedAt:Date.now()};
    setLibrary(prev=>{const updated=[item,...prev.filter(x=>x.id!==id)].slice(0,200);void storage.setLibrary(updated);return updated});
  };

  const saveProject=(studio:StudioSnapshot)=>{
    if(!song)return;
    const p:Project={id:`${song.id||'local'}-${Date.now()}`,title:song.title,sourceUrl,updatedAt:Date.now(),song,studio};
    setProjects(prev=>{const updated=[p,...prev].slice(0,100);void storage.setProjects(updated);return updated});
  };

  const openLibraryItem=(item:LocalLibraryItem)=>{
    const next:Song={id:item.id,title:item.title,creator:item.creator,picture:item.picture,duration:item.duration,audio:item.url};
    setInitialStudio(undefined);
    setSong(next); setSourceUrl(item.url); setView('create');
  };

  const openProject=(project:Project)=>{
    setInitialStudio(project.studio);
    if(project.song) setSong(project.song);
    setSourceUrl(project.sourceUrl);
    setView('create');
  };

  const goCreate=()=>setView('create');
  const upsertJob=(job:RenderJob)=>{
    setJobs(prev=>{
      const updated=[job,...prev.filter(item=>item.id!==job.id)].slice(0,100);
      void storage.setJobs(updated);
      return updated;
    });
  };

  const body=useMemo(()=>{
    if(view==='create'){
      if(!song) return <EmptyCreate onResolved={resolveDone} onNavigate={setView} projects={projects} onOpenProject={openProject} onInitChange={setSongInit}/>;
      return <StudioScreen
        song={song}
        compact={compact}
        initialStudio={initialStudio}
        onSave={saveProject}
        onBack={()=>{setSong(null);setInitialStudio(undefined)}}
        onRenderJob={upsertJob}
      />;
    }
    if(view==='library') return <LibraryScreen items={library} onPlay={setPlayingSong} onOpen={openLibraryItem} onCreate={goCreate}/>;
    if(view==='projects') return <ProjectsScreen projects={projects} onOpen={openProject} onCreate={goCreate}/>;
    if(view==='jobs') return <JobsScreen jobs={jobs} onCreate={goCreate}/>;
    return <SettingsScreen onCreate={goCreate}/>;
  },[view,song,library,projects,jobs,sourceUrl,compact,initialStudio]);

  const showHeader=!compact;
  const showGlobalPlayer=Boolean(playingSong) && view==='library';

  return <SafeAreaView style={styles.safe} edges={compact?['top']:[]}>
    <StatusBar style="light"/>
    <View style={styles.app}>
      <View nativeID="v24react-build" accessibilityLabel={BUILD_SHA} style={styles.buildMarker}/>
      {showHeader&&<Header song={song} view={view} onNavigate={setView}/>}
      <View style={styles.content}>{songInit.visible?<SongInitScreen state={songInit}/>:body}</View>
      {compact&&!song&&<MobileAppNav active={view} onNavigate={setView}/>}
      {showGlobalPlayer&&<MusicPlayer song={playingSong}/>}
    </View>
    <StartupScreen/>
  </SafeAreaView>
}

function MobileSectionBrand(){
  return <View style={styles.mobileSectionBrand}>
    <View style={styles.mobileSectionBrandLeft}><Music2 size={27} color={colors.violet}/><Text style={styles.mobileSectionBrandText}>SunoDown</Text></View>
    <View style={styles.mobileSectionMenu}><Text style={styles.mobileSectionMenuText}>☰</Text></View>
  </View>
}

function MobileSectionHeader({open,onToggle,onNavigate}:{open:boolean;onToggle:()=>void;onNavigate:(view:AppView)=>void}){
  const items=[
    {id:'create' as const,label:'Create',Icon:PlusCircle},
    {id:'library' as const,label:'Library',Icon:BookOpen},
    {id:'projects' as const,label:'Projects',Icon:Folder},
    {id:'jobs' as const,label:'Jobs',Icon:ListMusic},
    {id:'settings' as const,label:'Settings',Icon:Settings},
  ];
  return <View pointerEvents="box-none" style={styles.mobileSectionHeaderWrap}>
    <View style={styles.mobileSectionHeader}>
      <Pressable style={styles.mobileSectionBrand} onPress={()=>onNavigate('create')}>
        <View style={styles.mobileSectionBrandMark}><Music2 size={27} color={colors.violet}/></View>
        <Text style={styles.mobileSectionBrandText}>SunoDown</Text>
      </Pressable>
      <Pressable style={styles.mobileSectionMenuButton} onPress={onToggle}>{open?<X size={22} color="#d8dee9"/>:<Menu size={22} color="#d8dee9"/>}</Pressable>
    </View>
    {open&&<View style={styles.mobileSectionMenu}>
      <View style={styles.mobileSectionMenuHead}><View style={styles.mobileMenuAvatar}><Text style={styles.mobileMenuAvatarText}>S</Text></View><View><Text style={styles.mobileMenuName}>SunoDown</Text><Text style={styles.mobileMenuSub}>Creator Studio</Text></View></View>
      {items.map(({id,label,Icon})=><Pressable key={id} style={styles.mobileMenuLink} onPress={()=>onNavigate(id)}><Icon size={17} color="#a9b4c4"/><Text style={styles.mobileMenuLinkText}>{label}</Text></Pressable>)}
    </View>}
  </View>;
}

function MobileAppNav({active,onNavigate}:{active:AppView;onNavigate:(view:AppView)=>void}){
  const items=[
    {id:'create' as const,label:'Home',Icon:Home,primary:false,active:active==='create'},
    {id:'library' as const,label:'Music',Icon:Music2,primary:false,active:false},
    {id:'create' as const,label:'Create',Icon:PlusCircle,primary:true,active:false},
    {id:'library' as const,label:'Library',Icon:LibraryIcon,primary:false,active:active==='library'},
    {id:'settings' as const,label:'Me',Icon:UserRound,primary:false,active:active==='settings'},
  ];
  return <View style={styles.mobileNav}>
    {items.map(({id,label,Icon,primary,active:isActive},index)=><Pressable key={label+index} onPress={()=>onNavigate(id)} style={[styles.mobileNavItem,isActive&&styles.mobileNavActive]}>
      <View style={[styles.mobileNavIcon,primary&&styles.mobileNavPrimary]}><Icon size={primary?20:18} color={primary?'#fff':isActive?'#c6baff':'#778397'}/></View>
      <Text style={[styles.mobileNavLabel,isActive&&styles.mobileNavLabelActive,primary&&styles.mobileNavPrimaryLabel]}>{label}</Text>
    </Pressable>)}
  </View>
}

function Header({song,view,onNavigate}:{song:Song|null;view:AppView;onNavigate:(v:AppView)=>void}){
  return <View style={styles.header}>
    <Pressable style={styles.brand} onPress={()=>onNavigate('create')}>
      <View style={styles.brandMark}><Music2 color={colors.violet} size={27}/></View>
      <Text style={styles.brandText}>SunoDown</Text>
    </Pressable>

    <View style={styles.headerCenter}>
      {song
        ? <View style={styles.loaded}><Text style={styles.loadedCheck}>✓</Text><Text style={styles.loadedText}>Suno song loaded</Text></View>
        : <View style={styles.homeNav}>
            <Pressable style={[styles.homeNavButton,view==='create'&&styles.homeNavButtonActive]} onPress={()=>onNavigate('create')}><Text style={[styles.homeNavText,view==='create'&&styles.homeNavActive]}>Trang chủ</Text></Pressable>
            <Pressable style={styles.homeNavButton} onPress={()=>onNavigate('library')}><Text style={styles.homeNavText}>Music</Text></Pressable>
            <Pressable style={[styles.homeNavButton,view==='projects'&&styles.homeNavButtonActive]} onPress={()=>onNavigate('projects')}><Text style={[styles.homeNavText,view==='projects'&&styles.homeNavActive]}>Dự án</Text></Pressable>
            <Pressable style={[styles.homeNavButton,view==='library'&&styles.homeNavButtonActive]} onPress={()=>onNavigate('library')}><Text style={[styles.homeNavText,view==='library'&&styles.homeNavActive]}>Thư viện</Text></Pressable>
            <Pressable style={[styles.homeNavButton,view==='jobs'&&styles.homeNavButtonActive]} onPress={()=>onNavigate('jobs')}><Text style={[styles.homeNavText,view==='jobs'&&styles.homeNavActive]}>Jobs</Text></Pressable>
          </View>}
    </View>

    <View style={styles.headerActions}>
      <Bell size={19} color="#9ca6b7"/>
      <Pressable style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>S</Text></View>
        <ChevronDown size={15} color="#788394"/>
      </Pressable>
    </View>
  </View>
}

export default function App(){return <SafeAreaProvider><UniversalApp/></SafeAreaProvider>}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  app:{flex:1,backgroundColor:colors.bg},
  buildMarker:{position:'absolute',left:-2,top:-2,width:1,height:1,opacity:0},
  content:{flex:1,backgroundColor:colors.bg},
  mobileSectionHeaderWrap:{position:'absolute',zIndex:95,left:0,right:0,top:0,pointerEvents:'box-none'},
  mobileSectionHeader:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:16,paddingRight:4},
  mobileSectionBrand:{height:52,flexDirection:'row',alignItems:'center',gap:10},
  mobileSectionBrandMark:{width:16,height:32,alignItems:'center',justifyContent:'center'},
  mobileSectionBrandText:{color:'#f5f7fb',fontSize:21,fontWeight:'700'},
  mobileSectionMenuButton:{width:38,height:38,borderWidth:1,borderColor:'#303744',borderRadius:10,backgroundColor:'#101620',alignItems:'center',justifyContent:'center'},
  mobileSectionMenu:{position:'absolute',right:8,top:56,width:230,borderWidth:1,borderColor:'#2b3442',borderRadius:14,backgroundColor:'#0d131d',padding:9,shadowColor:'#000',shadowOpacity:.42,shadowRadius:30},
  mobileSectionMenuHead:{minHeight:54,borderBottomWidth:1,borderColor:'#202834',paddingHorizontal:8,paddingBottom:9,flexDirection:'row',alignItems:'center',gap:9},
  mobileMenuAvatar:{width:34,height:34,borderRadius:17,backgroundColor:'#7569a4',alignItems:'center',justifyContent:'center'},
  mobileMenuAvatarText:{color:'#fff',fontWeight:'800'},mobileMenuName:{color:'#eef2f7',fontSize:11,fontWeight:'800'},mobileMenuSub:{color:'#728094',fontSize:8,marginTop:2},
  mobileMenuLink:{height:39,borderRadius:9,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:9},
  mobileMenuLinkText:{color:'#c2cad5',fontSize:10,fontWeight:'700'},
  contentBody:{flex:1},
  mobileSectionBrand:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,backgroundColor:'#090d14'},
  mobileSectionBrandLeft:{flexDirection:'row',alignItems:'center',gap:10},
  mobileSectionBrandText:{color:'#f5f7fb',fontSize:21,fontWeight:'700'},
  mobileSectionMenu:{width:38,height:38,borderWidth:1,borderColor:'#343d4b',borderRadius:11,backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},
  mobileSectionMenuText:{color:'#c9d0dc',fontSize:19,lineHeight:22},
  mobileNav:{position:'absolute',zIndex:70,left:0,right:0,bottom:0,height:64,paddingHorizontal:6,paddingTop:4,paddingBottom:4,borderTopWidth:1,borderColor:'rgba(148,163,184,.14)',backgroundColor:'rgba(8,11,18,.97)',flexDirection:'row'},
  mobileNavItem:{flex:1,minHeight:52,borderRadius:12,alignItems:'center',justifyContent:'center',gap:3},
  mobileNavActive:{backgroundColor:'rgba(116,88,225,.08)'},
  mobileNavIcon:{width:28,height:25,alignItems:'center',justifyContent:'center'},
  mobileNavPrimary:{width:38,height:38,marginTop:-19,borderWidth:1,borderColor:'rgba(255,255,255,.25)',borderRadius:19,backgroundColor:'#765cf0'},
  mobileNavLabel:{color:'#778397',fontSize:8,fontWeight:'700'},
  mobileNavLabelActive:{color:'#c6baff'},
  mobileNavPrimaryLabel:{marginTop:-1,color:'#b7abc9'},
  header:{
    position:'absolute',left:0,right:0,top:0,zIndex:30,height:v24.headerHeight,
    flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#202630',
    backgroundColor:'#090d13',
  },
  brand:{width:v24.railWidth,height:'100%',flexDirection:'row',alignItems:'center',gap:12,paddingLeft:26},
  brandMark:{width:25,height:32,alignItems:'center',justifyContent:'center'},
  brandText:{color:'#f5f7fb',fontSize:21,fontWeight:'700'},
  headerCenter:{flex:1,height:'100%',alignItems:'center',justifyContent:'center'},
  loaded:{alignSelf:'flex-start',marginLeft:18,minHeight:40,borderWidth:1,borderColor:'#272d37',borderRadius:22,backgroundColor:'#11161e',paddingHorizontal:17,flexDirection:'row',alignItems:'center',gap:8},
  loadedCheck:{width:19,height:19,borderRadius:10,backgroundColor:'#35cb7c',color:'#07130d',fontWeight:'900',fontSize:12,textAlign:'center',lineHeight:19},
  loadedText:{color:'#c8ced8',fontSize:14},
  homeNav:{flexDirection:'row',alignItems:'center',gap:7,height:'100%'},
  homeNavButton:{height:42,borderWidth:1,borderColor:'transparent',borderRadius:12,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
  homeNavButtonActive:{borderColor:'rgba(144,117,255,.20)',backgroundColor:'rgba(104,86,229,.22)'},
  homeNavText:{color:'#aeb8c8',fontSize:12,fontWeight:'700'},
  homeNavActive:{color:'#fff'},
  headerActions:{height:'100%',flexDirection:'row',alignItems:'center',gap:24,paddingRight:28},
  profile:{flexDirection:'row',alignItems:'center',gap:5},
  avatar:{width:34,height:34,borderWidth:2,borderColor:'#39414d',borderRadius:17,backgroundColor:'#7569a4',alignItems:'center',justifyContent:'center'},
  avatarText:{color:'#fff',fontWeight:'800'},
});
