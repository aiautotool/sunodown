import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Bell, BriefcaseBusiness, FolderKanban, Library, Menu, Music2, PlusCircle, Settings, Sparkles } from 'lucide-react-native';
import { colors } from './src/theme';
import type { AppView, LocalLibraryItem, Project, RenderJob, Song } from './src/types';
import { EmptyCreate } from './src/EmptyCreate';
import { StudioScreen } from './src/StudioScreen';
import { MobileStudioScreen } from './src/MobileStudioScreen';
import { LibraryScreen } from './src/LibraryScreen';
import { JobsScreen, ProjectsScreen, SettingsScreen } from './src/SecondaryScreens';
import { MusicPlayer } from './src/MusicPlayer';
import { StartupScreen } from './src/StartupScreen';
import { storage } from './src/storage';

const nav=[
 {id:'create' as const,label:'Tạo mới',Icon:PlusCircle},
 {id:'projects' as const,label:'Dự án',Icon:FolderKanban},
 {id:'library' as const,label:'Thư viện',Icon:Library},
 {id:'jobs' as const,label:'Render',Icon:BriefcaseBusiness},
 {id:'settings' as const,label:'Cài đặt',Icon:Settings},
];

function UniversalApp(){
 const {width}=useWindowDimensions();
 const compact=width<780;
 const [view,setView]=useState<AppView>('create');
 const [song,setSong]=useState<Song|null>(null);
 const [sourceUrl,setSourceUrl]=useState('');
 const [playingSong,setPlayingSong]=useState<Song|null>(null);
 const [library,setLibrary]=useState<LocalLibraryItem[]>([]);
 const [projects,setProjects]=useState<Project[]>([]);
 const [jobs,setJobs]=useState<RenderJob[]>([]);
 const [hydrated,setHydrated]=useState(false);

 useEffect(()=>{void (async()=>{const [l,p,j]=await Promise.all([storage.getLibrary(),storage.getProjects(),storage.getJobs()]);setLibrary(l);setProjects(p);setJobs(j);setHydrated(true)})()},[]);

 const resolveDone=(next:Song,input:string)=>{
   setSong(next);setSourceUrl(input);setPlayingSong(next);
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
   setSong(next);setSourceUrl(item.url);setView('create');
 };
 const body=useMemo(()=>{
   if(view==='create') return song?(compact?<MobileStudioScreen song={song} onSave={saveProject}/>:<StudioScreen song={song} onSave={saveProject}/>):<EmptyCreate onResolved={resolveDone}/>;
   if(view==='library') return <LibraryScreen items={library} onPlay={setPlayingSong} onOpen={openLibraryItem}/>;
   if(view==='projects') return <ProjectsScreen projects={projects}/>;
   if(view==='jobs') return <JobsScreen jobs={jobs}/>;
   return <SettingsScreen/>;
 },[view,song,library,projects,jobs,sourceUrl,compact]);

 return <SafeAreaView style={styles.safe} edges={compact?['top']:['top','left','right']}>
   <StatusBar style="light"/>
   <View style={styles.app}>
     <Header compact={compact} song={song}/>
     {!compact&&<Sidebar active={view} onChange={setView}/>}
     <View style={[styles.content,!compact&&styles.contentDesktop,compact&&styles.contentMobile]}>{body}</View>
     {compact&&<BottomNav active={view} onChange={setView}/>}
     <MusicPlayer song={playingSong}/>
     {!hydrated&&null}
   </View>
   <StartupScreen/>
 </SafeAreaView>
}

function Header({compact,song}:{compact:boolean,song:Song|null}){
 return <View style={[styles.header,compact&&styles.headerCompact]}>
   <View style={styles.brand}><Music2 color={colors.violet} size={27}/><Text style={styles.brandText}>Suno<Text style={{color:colors.violet}}>Down</Text></Text></View>
   {!compact&&<View style={styles.loaded}><View style={styles.dot}/><Text style={styles.loadedText}>{song?'Đã tải bài hát':'Creator Studio'}</Text></View>}
   <View style={styles.headerActions}><Bell size={18} color="#9ca6b7"/><View style={styles.avatar}><Text style={styles.avatarText}>K</Text></View></View>
 </View>
}
function Sidebar({active,onChange}:{active:AppView,onChange:(v:AppView)=>void}){
 return <View style={styles.sidebar}><View style={styles.nav}>{nav.map(({id,label,Icon})=><Pressable key={id} onPress={()=>onChange(id)} style={[styles.navItem,active===id&&styles.navActive]}><Icon size={21} color={active===id?'#a98dff':'#8792a2'}/><Text style={[styles.navText,active===id&&styles.navTextActive]}>{label}</Text></Pressable>)}</View><View style={styles.version}><Sparkles size={13} color="#6f61a8"/><Text style={styles.versionText}>V24 REACT · EXPO 57</Text></View></View>
}
function BottomNav({active,onChange}:{active:AppView,onChange:(v:AppView)=>void}){
 return <View style={styles.bottomNav}>{nav.map(({id,label,Icon})=><Pressable key={id} onPress={()=>onChange(id)} style={styles.bottomItem}><Icon size={20} color={active===id?'#ad96ff':'#737e8e'}/><Text style={[styles.bottomText,active===id&&styles.bottomTextActive]}>{label}</Text></Pressable>)}</View>
}
export default function App(){return <SafeAreaProvider><UniversalApp/></SafeAreaProvider>}

const HEADER=66,SIDEBAR=190;
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.bg},app:{flex:1,backgroundColor:colors.bg},
 header:{height:HEADER,position:'absolute',left:0,right:0,top:0,zIndex:30,borderBottomWidth:1,borderColor:'#202630',backgroundColor:'#090d13',flexDirection:'row',alignItems:'center',paddingHorizontal:22},
 headerCompact:{height:58,paddingHorizontal:15},brand:{width:SIDEBAR-22,flexDirection:'row',alignItems:'center',gap:9},brandText:{color:'#f4f5f8',fontSize:20,fontWeight:'800',letterSpacing:-.5},
 loaded:{height:38,borderRadius:20,borderWidth:1,borderColor:'#272d37',backgroundColor:'#11161e',flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:8},dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.green},loadedText:{color:'#c7cdd7',fontSize:11,fontWeight:'600'},
 headerActions:{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:18},avatar:{width:32,height:32,borderRadius:16,borderWidth:2,borderColor:'#39414d',backgroundColor:'#7569a4',alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'800'},
 sidebar:{position:'absolute',left:0,top:HEADER,bottom:0,width:SIDEBAR,zIndex:20,borderRightWidth:1,borderColor:'#202630',backgroundColor:'#0a0e15',paddingTop:20,paddingHorizontal:9},nav:{gap:9},
 navItem:{minHeight:49,borderRadius:9,flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:14},navActive:{backgroundColor:'rgba(104,86,229,.18)'},navText:{color:'#8f9aaa',fontSize:12,fontWeight:'600'},navTextActive:{color:'#ad96ff'},
 version:{position:'absolute',left:16,bottom:92,flexDirection:'row',alignItems:'center',gap:7},versionText:{color:'#5f6979',fontSize:8,fontWeight:'800',letterSpacing:1},
 content:{flex:1,paddingTop:HEADER,backgroundColor:colors.bg},contentDesktop:{marginLeft:SIDEBAR},contentMobile:{paddingTop:58,paddingBottom:128},
 bottomNav:{position:'absolute',left:0,right:0,bottom:74,height:58,backgroundColor:'#0b1017',borderTopWidth:1,borderColor:colors.border,flexDirection:'row',zIndex:40},
 bottomItem:{flex:1,alignItems:'center',justifyContent:'center',gap:3},bottomText:{color:'#6e7989',fontSize:8,fontWeight:'700'},bottomTextActive:{color:'#b6a4ff'}
});
