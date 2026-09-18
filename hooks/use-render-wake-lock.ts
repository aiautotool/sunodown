'use client';

import {useEffect, useState} from 'react';

export function useRenderWakeLock(active: boolean) {
  const [locked, setLocked] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (disposed || pending || lock || document.visibilityState !== 'visible') return;
      if (!('wakeLock' in navigator)) return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) { await next.release(); return; }
        lock = next;
        setLocked(next);
        next.addEventListener('release', () => {
          if (lock === next) {
            lock = null;
            if (!disposed) setLocked(null);
          }
        }, {once: true});
      } catch {
        if (!disposed) setLocked(null);
      } finally { pending = false; }
    };

    const onVisible = () => { void acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    void acquire();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) void lock.release().catch(() => {});
    };
  }, [active]);

  return active && locked !== null && !locked.released;
}
