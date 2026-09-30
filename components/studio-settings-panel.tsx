'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserRound, SlidersHorizontal, Captions, AudioLines, Gauge, HardDrive, Wrench, ChevronRight } from 'lucide-react';
import { DEFAULT_SETTINGS, saveSettings, useStudioSettings, type StudioSettings } from '@/app/lib/studio-settings';
import { FilenameTemplatePanel } from './v9/filename-template';

type Props = { account: string | null; onLogout: () => Promise<void>; onClearProjects: () => Promise<void> };
const groups = [
  { id: 'account', title: 'Account', icon: UserRound, detail: 'Tài khoản, Library & đồng bộ' },
  { id: 'project', title: 'Project Defaults', icon: SlidersHorizontal, detail: 'Project mới, Timeline & Editor' },
  { id: 'subtitle', title: 'Subtitle', icon: Captions, detail: 'Ngôn ngữ, timing & khôi phục' },
  { id: 'audio', title: 'Audio & Export', icon: AudioLines, detail: 'Mastering, chất lượng & render' },
  { id: 'performance', title: 'Performance', icon: Gauge, detail: 'Preview & chi tiết waveform' },
  { id: 'storage', title: 'Storage', icon: HardDrive, detail: 'Dung lượng & dọn dữ liệu trên máy' },
  { id: 'advanced', title: 'Advanced', icon: Wrench, detail: 'Chẩn đoán & hỗ trợ' },
] as const;
type Group = typeof groups[number]['id'];
export function StudioSettingsPanel(props: Props) {
  const settings = useStudioSettings();
  const [group,setGroup] = useState<Group | null>(null);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [usage,setUsage] = useState<number | null>(null);
  const [quota,setQuota] = useState<number | null>(null);
  const [busy,setBusy] = useState(false);
  const [advanced,setAdvanced] = useState(false);
  useEffect(() => {
    if (group !== 'storage') return;
    navigator.storage?.estimate().then(v => { setUsage(v.usage ?? null); setQuota(v.quota ?? null); }).catch(() => setUsage(null));
  },[group,notice]);
  const change = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => {
    try { saveSettings({ ...settings,[key]:value }); setNotice('Đã lưu trên thiết bị này.'); setError(''); }
    catch { setError('Không lưu được. Kiểm tra dung lượng hoặc quyền lưu dữ liệu của trình duyệt.'); }
  };
  const toggle = (key: keyof StudioSettings, label: string, hint?: string) => <label className="sd-setting-row"><span><b>{label}</b>{hint && <small>{hint}</small>}</span><input aria-label={label} type="checkbox" checked={Boolean(settings[key])} onChange={e=>change(key,e.target.checked as never)} /></label>;
  const select = (key: keyof StudioSettings, label: string, options: readonly (readonly [string|number,string])[], hint?: string) => <label className="sd-setting-row"><span><b>{label}</b>{hint && <small>{hint}</small>}</span><select aria-label={label} value={String(settings[key])} onChange={e=>change(key,(typeof settings[key]==='number'?Number(e.target.value):e.target.value) as never)}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
  const number = (key: 'subtitleOffset'|'snapInterval'|'zoom', label: string, min: number, max: number, step: number, hint?: string) => <label className="sd-setting-row"><span><b>{label}</b>{hint&&<small>{hint}</small>}</span><input aria-label={label} type="number" min={min} max={max} step={step} value={settings[key]} onChange={e=>{if(e.target.value!=='' && Number.isFinite(e.target.valueAsNumber))change(key,e.target.valueAsNumber)}} /></label>;
  const action = async (run:()=>Promise<void>|void, success:string) => {
    setBusy(true); setError('');
    try { await run(); setNotice(success); } catch { setError('Thao tác chưa hoàn tất. Hãy thử lại.'); } finally { setBusy(false); }
  };
  const download = (value: unknown, filename: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=filename; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const title = groups.find(x=>x.id===group)?.title;
  return <div className="sd-settings-hub">
    <div className="sd-settings-heading">{group&&<button aria-label="Quay lại Settings" onClick={()=>{setGroup(null);setNotice('');setError('')}}><ArrowLeft size={18}/></button>}<div>{group && <h2>{title}</h2>}<p>{group==='project'?'Mặc định áp dụng khi mở bài mới. Project đã lưu giữ cấu hình riêng.':'Tùy chọn được lưu trên thiết bị này.'}</p></div></div>
    {!group ? <div className="sd-settings-groups">{groups.map(({id,title,icon:Icon,detail})=><button key={id} onClick={()=>{setGroup(id);setNotice('');setError('')}}><Icon size={23}/><span><b>{title}</b><small>{detail}</small></span><ChevronRight size={18}/></button>)}</div> : <div className="sd-settings-detail">
      {group==='account'&&<><h3>Tài khoản</h3><p>{props.account || 'Chưa đăng nhập.'}</p>{props.account?<button disabled={busy} onClick={()=>void action(props.onLogout,'Đã đăng xuất.')}>Đăng xuất</button>:<form action="/api/auth/google" method="get"><button type="submit">Đăng nhập với Google</button></form>}<Link href="/library">Mở Library & tài khoản Suno</Link><p className="sd-settings-note">Google là tài khoản ứng dụng. Library hiện nhập từ tài khoản Suno công khai; chưa có liên kết phiên Suno riêng. Đồng bộ Web / Android / iOS, backup cloud và quản lý thiết bị chưa khả dụng.</p><button onClick={()=>download({schemaVersion:1,settings},'sunodown-settings.json')}>Backup tùy chọn (JSON)</button><p className="sd-settings-note">Backup này chỉ chứa tùy chọn; chưa bao gồm project và media.</p></>}
      {group==='project'&&<><h3>Project mới</h3>
        {select('aspect','Format', [['9:16','9:16 · Vertical'],['16:9','16:9 · Landscape'],['1:1','1:1'],['4:5','4:5'],['4:3','4:3']])}
        {select('resolution','Resolution',[['720','720p'],['1080','1080p'],['2160','4K']], 'Cạnh ngắn của video. 4K cần nhiều bộ nhớ và encoder hỗ trợ.')}
        {select('fps','FPS',[[24,'24'],[30,'30'],[60,'60']])}
        {select('background','Background',[['suno','Ảnh bìa Suno'],['purple-gradient','Purple Gradient'],['dark-film','Dark Film'],['dreamy-blue','Dreamy Blue']])}
        {select('wave','Waveform / visualizer',[['mirror-glow','Mirror Glow'],['rounded-spectrum','Rounded Spectrum'],['circular-pulse','Circular Pulse'],['bars','Bars']])}
        <h3>Timeline / Editor</h3>{toggle('snap','Snap timeline')}{number('snapInterval','Snap interval (giây)',0.01,5,0.01)}{toggle('autoScroll','Auto-scroll theo playhead')}{number('zoom','Zoom mặc định',0.5,5,0.25,'Giới hạn zoom: 0.5× – 5×.')}{toggle('showWaveform','Show waveform')}{toggle('confirmDelete','Xác nhận trước khi xóa clip / subtitle')}
        <p className="sd-settings-note">Click timeline chỉ seek và dừng playback. Project đã lưu không bị ghi đè bởi mặc định mới.</p></>}
      {group==='subtitle'&&<><h3>Subtitle / Karaoke</h3><p className="sd-settings-note">Bài Suno: cloud Groq, có timing tạm khi server chưa sẵn sàng. Audio local: pipeline tự chọn engine theo thiết bị. Lời hợp âm được loại tự động bằng bộ làm sạch lyrics hiện có.</p>
        {select('subtitleLanguage','Ngôn ngữ mặc định',[['vi','Tiếng Việt'],['en','English']])}{toggle('subtitleRetry','Tự thử lại subtitle local khi lỗi','Tối đa 2 lần; không tạo vòng retry vô hạn.')}{number('subtitleOffset','Offset toàn bộ subtitle (ms)',-5000,5000,50,'Áp dụng một lần khi tạo / lấy lại subtitle; không dịch lại timeline đã chỉnh.')}
        <Link href="/create">Mở editor để Force Regenerate Subtitle</Link><p className="sd-settings-note">Nút “Lấy lại subtitle” trong editor bỏ cache cloud cho bài đang mở. Chỉ thực hiện khi bạn bấm, vì thao tác gọi provider. Lead-in/out, ngưỡng vocal và chọn engine thủ công chưa khả dụng.</p></>}
      {group==='audio'&&<><h3>Audio mặc định</h3>{select('audio','Mastering',[['original','Original'],['clean','Clean'],['tiktok-loud','TikTok Loud'],['punchy','Punchy'],['max-loud','Max Loud']])}{toggle('spatial','Bật 5D mặc định','Chế độ Immersive; có thể chỉnh theo project trong editor.')}<h3>Render & Export</h3>{select('exportQuality','Video bitrate preset',[['auto','Auto · theo thiết bị'],['data-saver','Data Saver'],['balanced','Balanced'],['high','High']])}{toggle('keepAwake','Giữ màn hình sáng khi render','Hoạt động khi trình duyệt hỗ trợ Screen Wake Lock.')}<p className="sd-settings-note">Render hiện chạy local với H.264. Chất lượng audio, EQ và loudness theo mastering của project. Retry render hiện là thao tác thủ công trong editor; server fallback và H.265 chưa có trong luồng này.</p><FilenameTemplatePanel/></>}
      {group==='performance'&&<><h3>Preview</h3>{select('previewQuality','Preview quality',[['low','Low · 360 px'],['balanced','Balanced · 640 px'],['high','High · 960 px']],'Giới hạn cạnh dài canvas, không giảm chất lượng video xuất.')}{select('previewFps','Preview FPS',[[15,'15'],[24,'24'],[30,'30'],[60,'60']])}{toggle('autoPreview','Auto-play khi mở bài','Mặc định tắt. Click timeline luôn chỉ seek.')}<h3>Timeline</h3>{select('waveformDetail','Waveform detail',[['low','Low · 160 samples'],['balanced','Balanced · 320 samples'],['high','High · 640 samples']])}<p className="sd-settings-note">Trình duyệt chưa cung cấp giới hạn RAM/GPU trực tiếp. Background rendering và thumbnail quality chưa có tùy chọn riêng.</p></>}
      {group==='storage'&&<><h3>Dữ liệu trên thiết bị</h3><p>{usage===null?'Không đọc được dung lượng trình duyệt.':`${(usage/1048576).toFixed(1)} MB đang dùng${quota===null?'':` / ${(quota/1073741824).toFixed(1)} GB hạn mức`}`}</p><p className="sd-settings-note">Ước lượng cho origin hiện tại, gồm IndexedDB và cache; chưa tách riêng audio/video. Không bao gồm dung lượng server.</p><button disabled={busy} onClick={()=>void action(()=>{const keys=Object.keys(localStorage).filter(key=>key.startsWith('sunodown-music-subtitle:'));keys.forEach(key=>localStorage.removeItem(key));},'Đã xóa cache subtitle trên máy. Cache cloud giữ nguyên.')}>Clear subtitle cache</button><button disabled={busy} onClick={()=>{if(window.confirm('Xóa tất cả project và media đã lưu trên thiết bị này? Thao tác này không thể hoàn tác.'))void action(props.onClearProjects,'Đã xóa project trên thiết bị.')}}>Xóa project & media đã lưu</button><button disabled={busy} onClick={()=>{if(window.confirm('Đặt lại toàn bộ tùy chọn về mặc định?'))void action(()=>saveSettings({...DEFAULT_SETTINGS}),'Đã reset tùy chọn.')}}>Reset tùy chọn</button></>}
      {group==='advanced'&&<><h3>About & Support</h3><p>SunoDown · {process.env.NEXT_PUBLIC_BUILD_VERSION} · {process.env.NEXT_PUBLIC_BUILD_IDENTITY}</p><a href="https://github.com/aiautotool/sunodown/issues" target="_blank" rel="noreferrer">Report bug</a><a href="https://github.com/aiautotool/sunodown/tree/v24" target="_blank" rel="noreferrer">Documentation & source</a><p className="sd-settings-note">Chưa có kiểm tra update tự động. Khi mở bài Suno, metadata và yêu cầu subtitle gửi tới backend; render video trong luồng hiện tại chạy trên máy.</p><button aria-expanded={advanced} onClick={()=>setAdvanced(v=>!v)}>{advanced?'Ẩn':'Hiện'} công cụ chẩn đoán</button>{advanced&&<><p className="sd-settings-note">Công cụ dành cho xử lý sự cố. Báo cáo bên dưới không chứa token, project, URL bài hát hay nội dung subtitle.</p><button onClick={()=>download({version:process.env.NEXT_PUBLIC_BUILD_VERSION,build:process.env.NEXT_PUBLIC_BUILD_IDENTITY,platform:navigator.platform,webCodecs:typeof VideoEncoder!=='undefined',wakeLock:'wakeLock'in navigator,settings},'sunodown-diagnostics.json')}>Export diagnostic info</button><Link href="/create?debug=subtitle">Mở editor với debug subtitle</Link><p>Backend: cùng origin · Subtitle: cloud Groq / local pipeline · Render: local H.264</p></>}</>}
    </div>}
    {notice&&<output className="sd-settings-saved">{notice}</output>}{error&&<p role="alert" className="sd-settings-error">{error}</p>}
  </div>;
}
