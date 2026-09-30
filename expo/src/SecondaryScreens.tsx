import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Folder, ListMusic, Plus, Save, Settings2 } from 'lucide-react-native';
import type { Project, RenderJob } from './types';
import { v24 } from './theme';

type ShellProps={title:string;description:string;onCreate:()=>void;children:React.ReactNode};

export function ProjectsScreen({
  projects,onOpen,onCreate,
}:{
  projects:Project[];
  onOpen:(project:Project)=>void;
  onCreate:()=>void;
}){
  const {width}=useWindowDimensions();
  const compact=width<=900;
  const [query,setQuery]=useState('');
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return q?projects.filter(p=>(p.title+' '+p.sourceUrl).toLowerCase().includes(q)):projects;
  },[projects,query]);
  const latest=projects[0];

  return <SectionShell title="Dự án" description="Lưu, mở lại và tiếp tục dựng video từ những phiên gần đây." onCreate={onCreate}>
    <View style={[styles.hero,compact&&styles.heroCompact]}>
      <HeroCard kicker="PROJECT HUB" title={projects.length?String(projects.length)+' project':'0 project'} sub="Project lưu toàn bộ preset, subtitle, timeline, media và cấu hình export."/>
      <HeroCard kicker="GẦN NHẤT" title={latest?.title||'Chưa có'} sub={latest?.sourceUrl||'Lưu project đầu tiên từ Studio để tiếp tục sau.'}/>
      <HeroCard kicker="TRẠNG THÁI" title="Sẵn sàng" sub="Chọn project hoặc tạo mới từ link Suno/audio."/>
    </View>

    <View style={[styles.toolbar,compact&&styles.toolbarCompact]}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchLabel}>TÌM PROJECT</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Tên dự án hoặc link Suno..." placeholderTextColor="#596679" style={styles.search}/>
      </View>
      <Pressable style={[styles.toolbarBtn,styles.toolbarPrimary]} onPress={onCreate}><Save size={16} color="#dcffe8"/><Text style={styles.toolbarPrimaryText}>Tạo project mới</Text></Pressable>
    </View>

    <View style={styles.projectList}>
      {visible.length?visible.map((project,index)=><View key={project.id} style={[styles.projectRow,compact&&styles.projectRowCompact]}>
        <Pressable style={styles.projectOpen} onPress={()=>onOpen(project)}>
          <View style={styles.projectIcon}><Folder size={21} color="#a98aff"/></View>
          <View style={styles.projectCopy}><Text numberOfLines={1} style={styles.projectTitle}>{project.title}</Text><Text numberOfLines={1} style={styles.projectUrl}>{project.sourceUrl}</Text></View>
          <View style={styles.projectBadge}><Text style={styles.projectBadgeText}>{index===0?'Gần nhất':'Project'}</Text></View>
        </Pressable>
        <View style={styles.projectActions}><Pressable style={styles.projectAction} onPress={()=>onOpen(project)}><Text style={styles.projectActionText}>Mở</Text></Pressable><Pressable style={styles.projectAction}><Text style={styles.projectRemove}>Ẩn khỏi danh sách</Text></Pressable></View>
      </View>):<Empty icon={<Folder size={34} color="#9176ff"/>} title="Chưa có project phù hợp" description="Lưu project trong Studio hoặc đổi từ khoá tìm kiếm." action="Tạo project mới" onAction={onCreate}/>}
    </View>
  </SectionShell>
}

export function JobsScreen({jobs,onCreate}:{jobs:RenderJob[];onCreate:()=>void}){
  return <SectionShell title="Jobs" description="Quản lý trạng thái SunoDown." onCreate={onCreate}>
    <View style={styles.jobStack}>
      {jobs.length?jobs.map(job=><View key={job.id} style={styles.jobCard}>
        <ListMusic size={23} color="#9275ff"/>
        <View style={{flex:1}}><Text style={styles.jobTitle}>{job.status==='done'?'Completed video':job.status==='error'?'Render failed':'Rendering video'}</Text><Text style={styles.jobSub}>{job.title} · {Math.round(job.progress)}% complete</Text></View>
        <View style={[styles.jobProgress,{width:((Math.max(0,Math.min(100,job.progress)))+'%') as any}]}/>
      </View>):<View style={styles.jobCard}>
        <ListMusic size={23} color="#9275ff"/>
        <View><Text style={styles.jobTitle}>No active render job</Text><Text style={styles.jobSub}>Completed videos download automatically.</Text></View>
      </View>}
    </View>
  </SectionShell>
}

export function SettingsScreen({onCreate}:{onCreate:()=>void}){
  const [autoPreview,setAutoPreview]=useState(true);
  return <SectionShell title="Settings" description="Quản lý trạng thái SunoDown." onCreate={onCreate}>
    <View style={styles.settings}>
      <View style={styles.settingRow}>
        <View style={{flex:1}}><Text style={styles.settingTitle}>Auto-play preview</Text><Text style={styles.settingSub}>Play the full song when media is ready.</Text></View>
        <Switch value={autoPreview} onValueChange={setAutoPreview} trackColor={{false:'#29313d',true:'#6f55db'}} thumbColor="#f3efff"/>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Plan foundation</Text>
        <Text style={styles.planSub}>FREE · Advanced mastering locked · Pro entitlements ready</Text>
      </View>

      <Pressable style={styles.clearProjects}><Text style={styles.clearProjectsText}>Clear saved projects</Text></Pressable>
    </View>
  </SectionShell>
}

function SectionShell({title,description,onCreate,children}:ShellProps){
  const {width}=useWindowDimensions();
  const compact=width<=900;
  return <ScrollView style={styles.root} contentContainerStyle={[styles.content,compact&&styles.contentCompact]}>
    <View style={[styles.head,compact&&styles.headCompact]}>
      <View style={{flex:1}}>
        <Text style={styles.kicker}>SUNODOWN</Text>
        <Text style={[styles.title,compact&&styles.titleCompact]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Pressable style={[styles.create,compact&&styles.createFull]} onPress={onCreate}><Plus size={16} color="#fff"/><Text style={styles.createText}>Tạo mới</Text></Pressable>
    </View>
    {children}
  </ScrollView>
}

function HeroCard({kicker,title,sub}:{kicker:string;title:string;sub:string}){return <View style={styles.heroCard}><Text style={styles.heroKicker}>{kicker}</Text><Text numberOfLines={1} style={styles.heroTitle}>{title}</Text><Text numberOfLines={2} style={styles.heroSub}>{sub}</Text></View>}

function Empty({icon,title,description,action,onAction}:{icon:React.ReactNode;title:string;description:string;action:string;onAction:()=>void}){return <View style={styles.empty}>{icon}<Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptySub}>{description}</Text><Pressable style={styles.emptyBtn} onPress={onAction}><Text style={styles.emptyBtnText}>{action}</Text></Pressable></View>}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#090d14'},
  content:{minHeight:'100%',marginLeft:v24.railWidth,paddingTop:v24.headerHeight+42,paddingHorizontal:42,paddingBottom:120},
  contentCompact:{marginLeft:0,paddingTop:0,paddingHorizontal:18,paddingBottom:100},
  head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:20,borderBottomWidth:1,borderColor:'#242b35',paddingBottom:24},
  headCompact:{flexDirection:'column',alignItems:'stretch',paddingTop:20},
  kicker:{color:'#8d72ff',fontSize:9,fontWeight:'800',letterSpacing:3},
  title:{color:'#f5f7fb',fontSize:32,fontWeight:'400',marginTop:7},titleCompact:{fontSize:27},
  description:{color:'#7f8a9b',fontSize:12,marginTop:7},
  create:{minHeight:42,borderRadius:10,backgroundColor:'#7559f4',paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},createFull:{width:'100%'},createText:{color:'#fff',fontSize:12,fontWeight:'700'},
  hero:{flexDirection:'row',gap:12,marginTop:24},heroCompact:{flexDirection:'column'},
  heroCard:{flex:1,minWidth:0,borderWidth:1,borderColor:'rgba(137,153,179,.12)',borderRadius:16,backgroundColor:'#0f1722',padding:18},
  heroKicker:{color:'#8f7bff',fontSize:9,fontWeight:'900',letterSpacing:1.6},heroTitle:{color:'#f4f7fb',fontSize:24,lineHeight:28,fontWeight:'400',marginTop:10},heroSub:{minHeight:38,color:'#7d889a',fontSize:11,lineHeight:17,marginTop:8},
  toolbar:{flexDirection:'row',alignItems:'flex-end',gap:12,marginTop:16},toolbarCompact:{flexDirection:'column',alignItems:'stretch'},searchWrap:{flex:1,gap:7},searchLabel:{color:'#8490a3',fontSize:10,fontWeight:'800',letterSpacing:.8},search:{height:46,borderWidth:1,borderColor:'rgba(137,153,179,.16)',borderRadius:13,backgroundColor:'rgba(7,12,20,.76)',paddingHorizontal:14,color:'#f4f7fb',fontSize:13},
  toolbarBtn:{minHeight:46,borderWidth:1,borderColor:'rgba(137,153,179,.14)',borderRadius:13,backgroundColor:'rgba(255,255,255,.045)',paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},toolbarPrimary:{borderColor:'rgba(74,222,128,.24)',backgroundColor:'rgba(27,83,63,.62)'},toolbarPrimaryText:{color:'#dcffe8',fontSize:12,fontWeight:'800'},
  projectList:{gap:10,marginTop:16},projectRow:{minHeight:76,borderWidth:1,borderColor:'rgba(137,153,179,.12)',borderRadius:16,backgroundColor:'#0f1722',padding:10,flexDirection:'row',alignItems:'center',gap:12},projectRowCompact:{flexDirection:'column',alignItems:'stretch'},
  projectOpen:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:12},projectIcon:{width:48,height:48,borderRadius:14,backgroundColor:'rgba(137,92,246,.14)',alignItems:'center',justifyContent:'center'},projectCopy:{flex:1,minWidth:0},projectTitle:{color:'#eef2f8',fontSize:14,fontWeight:'700'},projectUrl:{color:'#7c8799',fontSize:11,marginTop:4},projectBadge:{borderWidth:1,borderColor:'rgba(159,128,255,.18)',borderRadius:999,backgroundColor:'rgba(125,92,246,.1)',paddingHorizontal:8,paddingVertical:5},projectBadgeText:{color:'#a995ff',fontSize:9,fontWeight:'900'},projectActions:{flexDirection:'row',gap:7},projectAction:{borderWidth:1,borderColor:'rgba(137,153,179,.14)',borderRadius:10,backgroundColor:'rgba(255,255,255,.045)',paddingHorizontal:11,paddingVertical:9},projectActionText:{color:'#cdd5e2',fontSize:11,fontWeight:'800'},projectRemove:{color:'#ffb8c0',fontSize:11,fontWeight:'800'},
  empty:{width:'100%',minHeight:260,borderWidth:1,borderStyle:'dashed',borderColor:'rgba(137,153,179,.18)',borderRadius:18,backgroundColor:'rgba(9,15,24,.58)',padding:34,alignItems:'center',justifyContent:'center'},emptyTitle:{color:'#f4f7fb',fontSize:14,fontWeight:'800',marginTop:12},emptySub:{maxWidth:390,color:'#8190a6',fontSize:12,lineHeight:18,textAlign:'center',marginTop:6},emptyBtn:{marginTop:16,borderWidth:1,borderColor:'rgba(159,128,255,.24)',borderRadius:12,backgroundColor:'rgba(125,92,246,.16)',paddingHorizontal:14,paddingVertical:11},emptyBtnText:{color:'#d9d1ff',fontSize:11,fontWeight:'800'},
  jobStack:{maxWidth:650},jobCard:{position:'relative',minHeight:82,maxWidth:650,marginTop:24,overflow:'hidden',borderWidth:1,borderColor:'#29313e',borderRadius:14,backgroundColor:'#111720',padding:22,flexDirection:'row',alignItems:'center',gap:17},jobTitle:{color:'#f4f7fb',fontSize:13,fontWeight:'700'},jobSub:{color:'#8e98a8',fontSize:12,marginTop:5},jobProgress:{position:'absolute',left:0,bottom:0,height:3,backgroundColor:'#8060ff'},
  settings:{maxWidth:650,gap:14,marginTop:24},settingRow:{minHeight:82,borderWidth:1,borderColor:'#29313e',borderRadius:14,backgroundColor:'#111720',padding:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:15},settingTitle:{color:'#f4f7fb',fontSize:13,fontWeight:'700'},settingSub:{color:'#8e98a8',fontSize:11,marginTop:5},planCard:{borderWidth:1,borderColor:'#29313e',borderRadius:14,backgroundColor:'#111720',padding:20},planTitle:{color:'#f4f7fb',fontSize:13,fontWeight:'700'},planSub:{color:'#8e98a8',fontSize:11,marginTop:6},clearProjects:{alignSelf:'flex-start',borderWidth:1,borderColor:'#54333a',borderRadius:9,backgroundColor:'#201318',paddingHorizontal:14,paddingVertical:11},clearProjectsText:{color:'#ffadb4',fontSize:11,fontWeight:'700'},
});
