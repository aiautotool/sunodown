'use client';

import { useEffect } from 'react';

export function PasteLinkEnhancer() {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder^="Dán link https://suno.com"]');
    if (!input) return;

    const label = input.closest('label');
    if (!label || label.querySelector('[data-paste-link-button]')) return;

    const status = label.querySelector('span.pointer-events-none');
    input.classList.remove('pr-36');
    input.classList.add('pr-28', 'sm:pr-44');

    if (status instanceof HTMLElement) {
      status.classList.remove('right-4');
      status.classList.add('right-[4.75rem]', 'hidden', 'sm:inline-flex');
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-paste-link-button', 'true');
    button.setAttribute('aria-label', 'Dán liên kết từ clipboard');
    button.className = 'absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/15 px-3 text-xs font-bold text-violet-100 transition active:scale-95 hover:bg-violet-400/20 focus:outline-none focus:ring-4 focus:ring-violet-400/20 sm:right-3 sm:px-4';
    button.textContent = 'Dán';

    const pasteFromClipboard = async () => {
      const original = button.textContent;
      try {
        if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable');
        const text = (await navigator.clipboard.readText()).trim();
        if (!text) {
          button.textContent = 'Trống';
          window.setTimeout(() => { button.textContent = original; }, 1200);
          return;
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        button.textContent = 'Đã dán';
        window.setTimeout(() => { button.textContent = original; }, 1200);
      } catch {
        button.textContent = 'Giữ để dán';
        input.focus();
        window.setTimeout(() => { button.textContent = original; }, 1800);
      }
    };

    button.addEventListener('click', pasteFromClipboard);
    label.appendChild(button);

    return () => {
      button.removeEventListener('click', pasteFromClipboard);
      button.remove();
    };
  }, []);

  return null;
}
