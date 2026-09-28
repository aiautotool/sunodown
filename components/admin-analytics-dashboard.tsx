'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Gauge,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

type RangeKey = '24h' | '7d' | '30d';

type Report = {
  range: RangeKey;
  generatedAt: string;
  summary: {
    sessions: number;
    rendersOk: number;
    rendersFailed: number;
    renderSuccessRate: number;
    saves: number;
    resumes: number;
    avgRenderMs: number;
    avgFirstPreviewMs: number;
    avgFirstExportMs: number;
    retries: number;
  };
  funnel: Array<{
    event: string;
    sessions: number;
    stepConversion: number;
    totalConversion: number;
  }>;
  topPresets: Array<{ preset: string; exports: number }>;
  topScenes: Array<{ scene: string; exports: number }>;
  performance: Array<{
    device: string;
    avgFps: number;
    avgDropped: number;
    samples: number;
  }>;
  devices: Array<{ device: string; sessions: number }>;
  failures: Array<{ reason: string; count: number }>;
  failureStages: Array<{ stage: string; count: number }>;
};

const LABELS: Record<string, string> = {
  session_started: 'Session',
  song_resolve_succeeded: 'Resolve',
  preset_applied: 'Preset',
  preview_played: 'Preview',
  render_started: 'Render',
  render_succeeded: 'Render OK',
  video_saved: 'Save',
};

function formatMs(value: number) {
  if (!value) return '—';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} s`;
}

export function AdminAnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>('24h');
  const [report, setReport] = useState<Report | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async (nextRange: RangeKey = range) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/analytics?range=${nextRange}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (response.status === 401) {
        setReport(null);
        setAuthRequired(true);
        setLoginError('');
        return;
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
        throw new Error(detail?.detail || detail?.error || 'Không tải được báo cáo analytics.');
      }
      setReport((await response.json()) as Report);
      setAuthRequired(false);
    } catch (error) {
      setAuthRequired(true);
      setLoginError(error instanceof Error ? error.message : 'Không tải được dashboard.');
    } finally {
      setBusy(false);
    }
  }, [range]);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setLoginError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setLoginError('Mật khẩu quản trị không đúng.');
        return;
      }
      setPassword('');
      await load(range);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Không kết nối được máy chủ quản trị.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    setReport(null);
    setAuthRequired(true);
  }

  const maxPreset = useMemo(
    () => Math.max(1, ...(report?.topPresets.map((item) => Number(item.exports)) || [1])),
    [report],
  );
  const maxScene = useMemo(
    () => Math.max(1, ...(report?.topScenes.map((item) => Number(item.exports)) || [1])),
    [report],
  );

  if (authRequired || (!report && !busy)) {
    return (
      <main className="sd-admin-login">
        <section>
          <div className="sd-admin-lock"><LockKeyhole /></div>
          <small>SUNODOWN · INTERNAL</small>
          <h1>Growth Dashboard</h1>
          <p>Trang nội bộ. Chỉ tài khoản quản trị có mật khẩu mới xem được dữ liệu.</p>
          <form onSubmit={login}>
            <label>
              Mật khẩu quản trị
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </label>
            {loginError && <div className="sd-admin-error">{loginError}</div>}
            <button disabled={busy || !password}>
              <ShieldCheck />
              {busy ? 'Đang xác thực…' : 'Mở dashboard'}
            </button>
          </form>
          <span className="sd-admin-security">
            <ShieldCheck /> Session ký phía server · HttpOnly · 8 giờ · không lưu password ở trình duyệt
          </span>
        </section>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="sd-admin-loading">
        <RefreshCw />
        <span>Đang tải báo cáo nội bộ…</span>
      </main>
    );
  }

  return (
    <main className="sd-admin">
      <header className="sd-admin-head">
        <div>
          <small>SUNODOWN · INTERNAL ANALYTICS</small>
          <h1>Growth Dashboard</h1>
          <p>Funnel, rendering, retention và mobile performance — dữ liệu aggregate, không hiển thị nội dung bài hát.</p>
        </div>
        <div className="sd-admin-actions">
          <div className="sd-admin-range">
            {(['24h', '7d', '30d'] as RangeKey[]).map((item) => (
              <button
                key={item}
                className={range === item ? 'active' : ''}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button className="icon" title="Làm mới" onClick={() => void load(range)} disabled={busy}>
            <RefreshCw className={busy ? 'spin' : ''} />
          </button>
          <button className="icon" title="Đăng xuất" onClick={() => void logout()}>
            <LogOut />
          </button>
        </div>
      </header>

      <section className="sd-admin-kpis">
        <article><span><Activity /> Sessions</span><b>{report.summary.sessions}</b><small>unique sessions</small></article>
        <article><span><BarChart3 /> Render success</span><b>{report.summary.renderSuccessRate}%</b><small>{report.summary.rendersOk} ok · {report.summary.rendersFailed} fail</small></article>
        <article><span><Gauge /> Avg render</span><b>{formatMs(report.summary.avgRenderMs)}</b><small>successful renders</small></article>
        <article><span><Sparkles /> Saves</span><b>{report.summary.saves}</b><small>{report.summary.resumes} project resumes</small></article>
        <article><span><Gauge /> First preview</span><b>{formatMs(report.summary.avgFirstPreviewMs)}</b><small>resolve → first play</small></article>
        <article><span><Gauge /> First export</span><b>{formatMs(report.summary.avgFirstExportMs)}</b><small>{report.summary.retries} render retries</small></article>
      </section>

      <section className="sd-admin-grid">
        <article className="wide">
          <div className="sd-admin-card-title">
            <div><b>Activation funnel</b><span>Unique session theo từng bước</span></div>
            <small>{range}</small>
          </div>
          <div className="sd-funnel">
            {report.funnel.map((step, index) => (
              <div key={step.event}>
                <span className="step">{index + 1}</span>
                <div className="copy">
                  <b>{LABELS[step.event] || step.event}</b>
                  <small>{step.stepConversion}% từ bước trước · {step.totalConversion}% tổng</small>
                </div>
                <div className="bar"><i style={{ width: `${Math.max(2, step.totalConversion)}%` }} /></div>
                <strong>{step.sessions}</strong>
              </div>
            ))}
          </div>
        </article>

        <article>
          <div className="sd-admin-card-title"><div><b>Preview performance</b><span>FPS thực tế trên client</span></div></div>
          <div className="sd-admin-table">
            {report.performance.length ? report.performance.map((item) => (
              <div key={item.device}>
                <span>{item.device}</span>
                <b>{item.avgFps} FPS</b>
                <small>{item.avgDropped} dropped · {item.samples} samples</small>
              </div>
            )) : <p>Chưa có mẫu performance trong khoảng này.</p>}
          </div>
        </article>

        <article>
          <div className="sd-admin-card-title"><div><b>Device split</b><span>Session theo thiết bị</span></div></div>
          <div className="sd-admin-table">
            {report.devices.length ? report.devices.map((item) => (
              <div key={item.device}>
                <span>{item.device}</span>
                <b>{item.sessions}</b>
              </div>
            )) : <p>Chưa có session trong khoảng này.</p>}
          </div>
        </article>

        <article>
          <div className="sd-admin-card-title"><div><b>Preset tạo export</b><span>Xếp theo render thành công</span></div></div>
          <div className="sd-rank-list">
            {report.topPresets.length ? report.topPresets.map((item, index) => (
              <div key={item.preset}>
                <span>{index + 1}</span>
                <div><b>{item.preset}</b><i style={{ width: `${(Number(item.exports) / maxPreset) * 100}%` }} /></div>
                <strong>{item.exports}</strong>
              </div>
            )) : <p>Chưa có export trong khoảng này.</p>}
          </div>
        </article>

        <article>
          <div className="sd-admin-card-title"><div><b>Scene tạo export</b><span>Visual template thực tế</span></div></div>
          <div className="sd-rank-list">
            {report.topScenes.length ? report.topScenes.map((item, index) => (
              <div key={item.scene}>
                <span>{index + 1}</span>
                <div><b>{item.scene}</b><i style={{ width: `${(Number(item.exports) / maxScene) * 100}%` }} /></div>
                <strong>{item.exports}</strong>
              </div>
            )) : <p>Chưa có export trong khoảng này.</p>}
          </div>
        </article>

        <article className="wide">
          <div className="sd-admin-card-title">
            <div><b>Render failures</b><span>Aggregate reason + failure stage, không lưu URL/media/lyrics</span></div>
          </div>
          <div className="sd-failures">
            {report.failureStages.length > 0 && (
              <div>
                <TriangleAlert />
                <span>
                  Stage: {report.failureStages
                    .map((item) => `${item.stage} (${item.count})`)
                    .join(' · ')}
                </span>
                <b>{report.summary.rendersFailed}</b>
              </div>
            )}
            {report.failures.length ? report.failures.map((item) => (
              <div key={item.reason}>
                <TriangleAlert />
                <span>{item.reason}</span>
                <b>{item.count}</b>
              </div>
            )) : <div className="ok"><ShieldCheck /> Không có render failure trong khoảng này.</div>}
          </div>
        </article>
      </section>

      <footer className="sd-admin-foot">
        <ShieldCheck />
        <span>Admin-only · noindex · dữ liệu aggregate · cập nhật {new Date(report.generatedAt).toLocaleString('vi-VN')}</span>
      </footer>
    </main>
  );
}
