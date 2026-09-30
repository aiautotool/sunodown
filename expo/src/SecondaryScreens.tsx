import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Cloud, Cpu, FolderKanban, HardDrive, Loader2, Settings2, Smartphone } from 'lucide-react-native';
import type { Project, RenderJob } from './types';
import { colors } from './theme';

export function ProjectsScreen({projects}:{projects:Project[]}){return <Shell kicker="WORKSPACE" title="Dự án">
 {projects.length?projects.map(p=><View key={p.id} style={styles.row}><FolderKanban size={20} color="#ad98ff"/><View style={{flex:1}}><Text style={styles.rowTitle}>{p.title}</Text><Text style={styles.rowSub}>Cập nhật {new Date(p.updatedAt).toLocaleString('vi-VN')}</Text></View><Text style={styles.tag}>PROJECT</Text></View>):<Empty text="Chưa có project. Trong Creator Studio bấm Lưu project để tạo."/>}
 </Shell>}
export function JobsScreen({jobs}:{jobs:RenderJob[]}){return <Shell kicker="RENDER ENGINE" title="Hàng đợi xuất file">
 {jobs.length?jobs.map(j=><View key={j.id} style={styles.row}>{j.status==='done'?<CheckCircle2 size={20} color={colors.green}/>:<Loader2 size={20} color="#ad98ff"/>}<View style={{flex:1}}><Text style={styles.rowTitle}>{j.title}</Text><Text style={styles.rowSub}>{j.status} · {j.progress}%</Text><View style={styles.progress}><View style={[styles.fill,{width:`${j.progress}%`}]} /></View></View></View>):<Empty text="Chưa có render job. Export video/audio sẽ xuất hiện ở đây."/>}
 </Shell>}
export function SettingsScreen(){return <Shell kicker="APP SETTINGS" title="Cài đặt">
 <View style={styles.card}><Setting icon={<Cloud color="#ad98ff"/>} title="Backend API" value="https://sunoapp.aiautotool.com"/><Setting icon={<Smartphone color="#ad98ff"/>} title="Client" value="React Native + Expo SDK 57"/><Setting icon={<Cpu color="#ad98ff"/>} title="Cloud architecture" value="Isolated Worker · D1 · R2 · Queue"/><Setting icon={<HardDrive color="#ad98ff"/>} title="Local data" value="AsyncStorage"/></View>
 <Text style={styles.note}>Android, iOS và Web dùng chung codebase React Native/Expo nhưng toàn bộ API, dữ liệu cloud, subtitle và hàng đợi của v24react chạy trên hạ tầng riêng của SunoApp. Không sử dụng backend picai.online.</Text>
 </Shell>}
function Shell({kicker,title,children}:{kicker:string,title:string,children:React.ReactNode}){return <ScrollView style={styles.root} contentContainerStyle={styles.content}><Text style={styles.kicker}>{kicker}</Text><Text style={styles.title}>{title}</Text><View style={{marginTop:24}}>{children}</View></ScrollView>}
function Empty({text}:{text:string}){return <View style={styles.empty}><Settings2 size={34} color="#4f4668"/><Text style={styles.emptyText}>{text}</Text></View>}
function Setting({icon,title,value}:{icon:React.ReactNode,title:string,value:string}){return <View style={styles.setting}>{icon}<View style={{flex:1}}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSub}>{value}</Text></View></View>}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.bg},content:{padding:28,paddingBottom:120},kicker:{color:'#947df1',fontSize:9,fontWeight:'800',letterSpacing:2.5},title:{color:colors.text,fontSize:30,fontWeight:'800',marginTop:8},
 row:{minHeight:72,borderBottomWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:12},rowTitle:{color:'#e5e8ee',fontSize:13,fontWeight:'700'},rowSub:{color:'#788394',fontSize:10,marginTop:5},tag:{color:'#8d78da',fontSize:8,fontWeight:'800',letterSpacing:1},
 progress:{height:3,backgroundColor:'#242c37',borderRadius:99,marginTop:9},fill:{height:3,backgroundColor:colors.violet,borderRadius:99},
 empty:{height:260,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:'#0c1118',alignItems:'center',justifyContent:'center',padding:30},emptyText:{color:'#7c8798',fontSize:11,textAlign:'center',marginTop:12,maxWidth:340},
 card:{borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:'#0c1118',paddingHorizontal:18},setting:{minHeight:74,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:1,borderColor:'#1c2330'},note:{color:'#758091',fontSize:11,lineHeight:18,marginTop:18}
});
