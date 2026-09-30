import '@expo/metro-runtime';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronDown, Music2 } from 'lucide-react-native';
import { colors, v24 } from './src/theme';
import type { AppView, LocalLibraryItem, Project, RenderJob, Song } from './src/types';
import { EmptyCreate } from './src/EmptyCreate';
import { StudioScreen } from './src/StudioScreen';
import { MobileStudioScreen } from './src/MobileStudioScreen';
import { LibraryScreen } from './src/LibraryScreen';
import { JobsScreen, ProjectsScreen, SettingsScreen } from './src/SecondaryScreens';
import { MusicPlayer } from './src/MusicPlayer';
import { StartupScreen } from './src/StartupScreen';
import { storage } from './src/storage';

function UniversalApp(){
  const {width}=useWindowDimensions();
  const compact=width<=v24.mobileBreakpoint;
  const [view,setView]=useState<AppView>('create');
  const [song,setSong]=useState<Song|null>(null);
  const [sourceUrl,setSourceUrl]=useState('');
  const [playingSong,setPlayingSong]=useState<Song|null>(null);
  const [library,setLibrary]=useState<LocalLibraryItem[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [jobs,setJobs]=useState<RenderJob[]>([]);

  useEffect(()=>{void (async()=>{
    const [l,p,j]=await Promise.all([storage.getLibrary(),storage.getProjects(),storage.getJobs()]);
    setLibrary(l); setProjects(p); setJobs(j);
  })()},[]);

  const resolveDone=(next:Song,input:string)=>{
    setSong(next); setSourceUrl(input);
    const id=next.id||input;
    const item:LocalLibraryItem={id,url:input,title:next.title,creator:next.creator,picture:next.picture,duration:next.duration,updatedAt:Date.now()};
    setLibrary(prev=>{const updated=[item,...prev.filter(x=>x.id!==id)].slice(0,200);void storage.setLibrary(updated);return updated});
  };

  const saveProject=()=>{
    if(!song)return;
    const p:Project={id:`${song.id||'local'}-${Date.now()}`,title:song.title,sourceUrl,updatedAt:Date.now(),song};
    setProjects(prev=>{const updated=[p,...prev].slice(0,100);void storage.setProjects(updated);return updated});
  };

  const openLibraryItem=(item:LocalLibraryItem)=>{
    const next:Song={id:item.id,title:item.title,creator:item.creator,picture:item.picture,duration:item.duration,audio:item.url};
    setSong(next); setSourceUrl(item.url); setView('create');
  };

  const openProject=(project:Project)=>{
    if(project.song) setSong(project.song);
    setSourceUrl(project.sourceUrl);
    setView('create');
  };

  const goCreate=()=>setView('create');

  const body=useMemo(()=>{
    if(view==='create'){
      if(!song) return <EmptyCreate onResolved={resolveDone} onNavigate={setView} projects={projects}/>;
      return compact
        ? <MobileStudioScreen song={song} onSave={saveProject} onBack={()=>setSong(null)}/>
        : <StudioScreen song={song} onSave={saveProject}/>;
    }
    if(view==='library') return <LibraryScreen items={library} onPlay={setPlayingSong} onOpen={openLibraryItem} onCreate={goCreate}/>;
    if(view==='projects') return <ProjectsScreen projects={projects} onOpen={openProject} onCreate={goCreate}/>;
    if(view==='jobs') return <JobsScreen jobs={jobs} onCreate={goCreate}/>;
    return <SettingsScreen onCreate={goCreate}/>;
  },[view,song,library,projects,jobs,sourceUrl,compact]);

  const showHeader=!compact;
  const showGlobalPlayer=Boolean(playingSong) && view==='library';

  return <SafeAreaView style={styles.safe} edges={compact?['top']:[]}>
    <StatusBar style="light"/>
    <View style={styles.app}>
      {showHeader&&<Header song={song} view={view} onNavigate={setView}/>}
      <View style={styles.content}>{body}</View>
      {showGlobalPlayer&&<MusicPlayer song={playingSong}/>}
    </View>
    <StartupScreen/>
  </SafeAreaView>
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
  content:{flex:1,backgroundColor:colors.bg},
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
