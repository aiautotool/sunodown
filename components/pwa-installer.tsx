'use client';

import { Download, Share2, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'sunodown-pwa-install-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
}

export function PwaInstaller() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return { ios: false, mobile: false };
    const ua = navigator.userAgent || '';
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mobile = ios || /Android|Mobile/i.test(ua);
    return { ios, mobile };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const register = () => {
        void navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .catch(() => {});
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    const standalone = isStandaloneMode();
    setInstalled(standalone);
    if (standalone || !platform.mobile) return;

    let dismissed = false;
    try {
      const value = Number(localStorage.getItem(DISMISS_KEY) || 0);
      dismissed = Number.isFinite(value) && Date.now() - value < DISMISS_MS;
    } catch {}

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      if (!dismissed) setVisible(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setShowIOSHelp(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (platform.ios && !dismissed) {
      const timer = window.setTimeout(() => setVisible(true), 1800);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener(
          'beforeinstallprompt',
          onBeforeInstallPrompt,
        );
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [platform.ios, platform.mobile]);

  const dismiss = () => {
    setVisible(false);
    setShowIOSHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (platform.ios) {
      setShowIOSHelp(true);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice.catch(() => null);
    if (result?.outcome === 'accepted') {
      setVisible(false);
      setInstallPrompt(null);
    }
  };

  if (installed || !visible) return null;

  return (
    <aside className="sd-pwa-install" aria-label="Cài SunoDown">
      <button className="sd-pwa-close" onClick={dismiss} aria-label="Đóng">
        <X />
      </button>

      <div className="sd-pwa-icon">
        <Smartphone />
      </div>

      <div className="sd-pwa-copy">
        <b>Cài SunoDown</b>
        <span>Mở nhanh như app · toàn màn hình · giữ Music riêng biệt</span>
      </div>

      <button className="sd-pwa-action" onClick={() => void install()}>
        <Download />
        Cài app
      </button>

      {showIOSHelp && (
        <div className="sd-pwa-ios-help">
          <div>
            <Share2 />
            <span>
              Trên iPhone/iPad: bấm <b>Chia sẻ</b> trong Safari → chọn{' '}
              <b>Thêm vào Màn hình chính</b> → <b>Thêm</b>.
            </span>
          </div>
          <button onClick={() => setShowIOSHelp(false)}>Đã hiểu</button>
        </div>
      )}
    </aside>
  );
}
