'use client';

import { Music2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function StartupScreen() {
  const [progress, setProgress] = useState(8);
  const [state, setState] = useState<'loading' | 'ready' | 'hidden'>('loading');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sd-booting');

    const startedAt = performance.now();
    const progressTimer = window.setInterval(() => {
      setProgress((value) => Math.min(88, value + Math.max(1, Math.round((92 - value) * 0.08))));
    }, 120);

    const pageReady = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', () => resolve(), { once: true });
    });
    const fontsReady = document.fonts?.ready?.then(() => undefined) ?? Promise.resolve();
    const minimumDisplay = new Promise<void>((resolve) => window.setTimeout(resolve, 1450));
    const maximumWait = new Promise<void>((resolve) => window.setTimeout(resolve, 4500));

    void Promise.race([
      Promise.all([pageReady, fontsReady, minimumDisplay]).then(() => undefined),
      maximumWait,
    ]).then(() => {
      window.clearInterval(progressTimer);
      setProgress(100);
      const remaining = Math.max(0, 1650 - (performance.now() - startedAt));
      window.setTimeout(() => {
        setState('ready');
        root.classList.remove('sd-booting');
        window.setTimeout(() => setState('hidden'), 560);
      }, remaining + 180);
    });

    return () => {
      window.clearInterval(progressTimer);
      root.classList.remove('sd-booting');
    };
  }, []);

  if (state === 'hidden') return null;

  return (
    <div
      className={`sd-startup ${state === 'ready' ? 'is-ready' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Đang khởi động SunoDown, ${progress}%`}
    >
      <div className="sd-startup-glow" aria-hidden="true" />
      <div className="sd-startup-grid" aria-hidden="true" />
      <main className="sd-startup-content">
        <div className="sd-startup-mark" aria-hidden="true">
          <span><Music2 /></span>
          <i /><i /><i /><i /><i />
        </div>
        <p className="sd-startup-kicker">CREATOR ENGINE · V18</p>
        <h1>Suno<span>Down</span></h1>
        <p className="sd-startup-copy">Biến âm nhạc thành nội dung.</p>
        <div className="sd-startup-loader" aria-hidden="true">
          <div><i style={{ width: `${progress}%` }} /></div>
          <span>ĐANG KHỞI TẠO STUDIO</span>
          <b>{String(progress).padStart(2, '0')}%</b>
        </div>
      </main>
      <footer>
        <span>AI AUDIO</span><i />
        <span>LYRICS SYNC</span><i />
        <span>VIDEO ENGINE</span>
      </footer>
    </div>
  );
}
