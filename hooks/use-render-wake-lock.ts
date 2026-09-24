'use client';

import {useEffect, useRef, useState} from 'react';

export function useRenderWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const retryRef = useRef<number | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active) {
      setLocked(false);
      return;
    }

    let disposed = false;
    let pending = false;

    const clearRetry = () => {
      if (retryRef.current !== null) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const scheduleRetry = () => {
      if (disposed) return;
      clearRetry();
      retryRef.current = window.setTimeout(() => {
        retryRef.current = null;
        void acquire();
      }, 300);
    };

    const acquire = async () => {
      if (
        disposed ||
        pending ||
        sentinelRef.current ||
        document.visibilityState !== 'visible' ||
        !('wakeLock' in navigator)
      ) {
        return;
      }

      pending = true;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (disposed) {
          await sentinel.release();
          return;
        }

        sentinelRef.current = sentinel;
        setLocked(true);

        sentinel.addEventListener(
          'release',
          () => {
            if (sentinelRef.current === sentinel) {
              sentinelRef.current = null;
            }
            if (!disposed) {
              setLocked(false);
              scheduleRetry();
            }
          },
          {once: true},
        );
      } catch {
        if (!disposed) {
          setLocked(false);
          scheduleRetry();
        }
      } finally {
        pending = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    void acquire();

    return () => {
      disposed = true;
      clearRetry();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      setLocked(false);
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [active]);

  return active && locked;
}
