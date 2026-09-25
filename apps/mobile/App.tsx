import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import {
  absoluteResultUrl,
  capabilities,
  getRender,
  resolveSong,
  startRender,
  type RenderStatus,
  type Song,
} from './src/api';
import { MOBILE_PRESETS, type MobilePreset } from './src/presets';

const DEFAULT_LINK = 'https://suno.com/s/tszo0jGdVUua4rT4';

export default function App() {
  const [input, setInput] = useState(DEFAULT_LINK);
  const [song, setSong] = useState<Song | null>(null);
  const [preset, setPreset] = useState<MobilePreset>(MOBILE_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [render, setRender] = useState<RenderStatus | null>(null);
  const [message, setMessage] = useState('Dán link Suno để bắt đầu.');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const finished = render?.status === 'completed' && !!render.resultUrl;
  const failed = render?.status === 'failed';

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function analyze() {
    setBusy(true);
    setRender(null);
    setMessage('Đang phân tích bài hát…');
    try {
      const result = await resolveSong(input.trim());
      setSong(result);
      setMessage('Đã phân tích. Chọn preset rồi tạo video.');
    } catch (error) {
      Alert.alert('Không phân tích được', error instanceof Error ? error.message : 'Unknown error');
      setMessage('Phân tích thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function createVideo() {
    if (!song) return;
    setBusy(true);
    try {
      const caps = await capabilities();
      if (!caps.aiMusicVideo) throw new Error('AI Music Video renderer hiện chưa khả dụng.');
      const job = await startRender(song, preset);
      setRender(job);
      setMessage('Đã gửi render. Có thể tiếp tục giữ app mở để theo dõi tiến độ.');
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(async () => {
        try {
          const next = await getRender(job.id);
          setRender(next);
          if (next.status === 'completed' || next.status === 'failed') {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
          }
        } catch {}
      }, 4000);
    } catch (error) {
      Alert.alert('Không tạo được video', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function downloadResult(share: boolean) {
    if (!render?.resultUrl) return;
    try {
      setBusy(true);
      const uri = FileSystem.cacheDirectory + `sunodown-${render.id}.mp4`;
      const result = await FileSystem.downloadAsync(absoluteResultUrl(render.resultUrl), uri);
      if (share) {
        const available = await Sharing.isAvailableAsync();
        if (!available) throw new Error('Thiết bị không hỗ trợ share sheet.');
        await Sharing.shareAsync(result.uri, { mimeType: 'video/mp4', dialogTitle: song?.title || 'SunoDown video' });
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) throw new Error('Chưa được cấp quyền lưu video.');
        await MediaLibrary.saveToLibraryAsync(result.uri);
        Alert.alert('Đã lưu', 'Video đã được lưu vào thư viện.');
      }
    } catch (error) {
      Alert.alert('Không thể xuất video', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  const progressText = useMemo(() => {
    if (!render) return '';
    if (failed) return render.error || 'Render thất bại.';
    if (finished) return 'Render hoàn tất.';
    return `${render.status} · ${Math.round(render.progress || 0)}%`;
  }, [render, failed, finished]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>SunoDown</Text>
        <Text style={styles.heading}>Create from a Suno link</Text>
        <Text style={styles.sub}>Mobile MVP · iOS / Android · shared core</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Suno link</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            placeholder="https://suno.com/s/…"
            placeholderTextColor="#64748b"
          />
          <Pressable style={styles.primary} onPress={analyze} disabled={busy}>
            <Text style={styles.primaryText}>{busy && !song ? 'Đang phân tích…' : 'Phân tích'}</Text>
          </Pressable>
        </View>

        {song && (
          <>
            <View style={styles.preview}>
              {song.picture ? <Image source={{ uri: song.picture }} style={styles.cover} /> : <View style={styles.coverFallback} />}
              <View style={[styles.previewOverlay, { borderColor: preset.accent }]}>
                <Text style={styles.previewEyebrow}>{preset.name}</Text>
                <Text style={styles.previewTitle}>{song.title}</Text>
                <Text style={styles.previewCreator}>{song.creator || 'Suno'}</Text>
                <View style={styles.wave}>
                  {[8,18,12,28,22,38,18,30,15,25,10,20].map((h, i) => <View key={i} style={[styles.bar,{height:h, backgroundColor:preset.accent}]} />)}
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Quick presets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
              {MOBILE_PRESETS.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => setPreset(item)}
                  style={[styles.preset, preset.id === item.id && { borderColor: item.accent, borderWidth: 2 }]}
                >
                  <View style={[styles.dot,{backgroundColor:item.accent}]} />
                  <Text style={styles.presetName}>{item.name}</Text>
                  <Text style={styles.presetDescription}>{item.description}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable style={styles.primary} onPress={createVideo} disabled={busy || !!(render && !finished && !failed)}>
              <Text style={styles.primaryText}>Tạo video · {preset.aspect}</Text>
            </Pressable>
          </>
        )}

        {render && (
          <View style={styles.card}>
            <View style={styles.progressHead}>
              <Text style={styles.sectionTitle}>Render</Text>
              <Text style={styles.progressText}>{progressText}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill,{width:`${Math.max(3,Math.min(100,render.progress || (finished ? 100 : 3)))}%`}]} />
            </View>
            {!finished && !failed && <ActivityIndicator style={{marginTop:16}} />}
            {finished && (
              <View style={styles.actions}>
                <Pressable style={styles.secondary} onPress={() => downloadResult(false)}><Text style={styles.secondaryText}>Lưu video</Text></Pressable>
                <Pressable style={styles.primarySmall} onPress={() => downloadResult(true)}><Text style={styles.primaryText}>Chia sẻ</Text></Pressable>
              </View>
            )}
          </View>
        )}

        <Text style={styles.status}>{message}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#070b14'},
  page:{padding:20,paddingBottom:48,gap:16},
  brand:{color:'#a78bfa',fontWeight:'800',fontSize:16,letterSpacing:1},
  heading:{color:'white',fontWeight:'800',fontSize:28},
  sub:{color:'#94a3b8',marginTop:-10},
  card:{backgroundColor:'#0f172a',borderRadius:22,padding:16,borderWidth:1,borderColor:'#1e293b'},
  label:{color:'#cbd5e1',fontSize:12,fontWeight:'700',marginBottom:8},
  input:{backgroundColor:'#020617',borderWidth:1,borderColor:'#334155',borderRadius:14,padding:14,color:'white',marginBottom:12},
  primary:{backgroundColor:'#7c3aed',borderRadius:14,padding:15,alignItems:'center'},
  primarySmall:{flex:1,backgroundColor:'#7c3aed',borderRadius:14,padding:14,alignItems:'center'},
  primaryText:{color:'white',fontWeight:'800'},
  secondary:{flex:1,backgroundColor:'#1e293b',borderRadius:14,padding:14,alignItems:'center'},
  secondaryText:{color:'#e2e8f0',fontWeight:'800'},
  preview:{aspectRatio:9/16,borderRadius:26,overflow:'hidden',backgroundColor:'#111827',maxHeight:520,alignSelf:'center',width:'82%'},
  cover:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  coverFallback:{...StyleSheet.absoluteFillObject,backgroundColor:'#111827'},
  previewOverlay:{...StyleSheet.absoluteFillObject,borderWidth:2,borderRadius:26,backgroundColor:'rgba(2,6,23,.44)',padding:22,justifyContent:'flex-end'},
  previewEyebrow:{color:'#ddd6fe',fontSize:12,fontWeight:'800',textTransform:'uppercase'},
  previewTitle:{color:'white',fontSize:26,fontWeight:'900',marginTop:6},
  previewCreator:{color:'#cbd5e1',marginTop:4},
  wave:{height:44,flexDirection:'row',alignItems:'center',gap:4,marginTop:18},
  bar:{width:5,borderRadius:4},
  sectionTitle:{color:'white',fontSize:16,fontWeight:'800'},
  presets:{gap:10,paddingRight:20},
  preset:{width:170,backgroundColor:'#0f172a',padding:14,borderRadius:18,borderWidth:1,borderColor:'#1e293b'},
  dot:{width:10,height:10,borderRadius:5,marginBottom:12},
  presetName:{color:'white',fontWeight:'800'},
  presetDescription:{color:'#94a3b8',fontSize:12,lineHeight:17,marginTop:6},
  progressHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  progressText:{color:'#a78bfa',fontSize:12,fontWeight:'700',maxWidth:'58%',textAlign:'right'},
  track:{height:8,borderRadius:5,backgroundColor:'#1e293b',overflow:'hidden',marginTop:14},
  fill:{height:'100%',backgroundColor:'#7c3aed'},
  actions:{flexDirection:'row',gap:10,marginTop:18},
  status:{color:'#64748b',textAlign:'center',fontSize:12},
});
