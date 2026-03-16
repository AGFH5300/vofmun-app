'use client';

import { RefObject, useEffect } from 'react';

let lockDepth = 0;
let previousOverflow = '';
let previousPaddingRight = '';

const getScrollbarWidth = () => {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
};

export const useModalLayerLock = (open: boolean) => {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    if (lockDepth === 0) {
      previousOverflow = document.body.style.overflow;
      previousPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = getScrollbarWidth();
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    lockDepth += 1;

    return () => {
      lockDepth = Math.max(0, lockDepth - 1);
      if (lockDepth === 0) {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
      }
    };
  }, [open]);
};

export const useModalFocusTrap = (
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
) => {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter((node) => {
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

    const activeElement = document.activeElement as HTMLElement | null;
    const focusables = getFocusables();
    (focusables[0] || container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const nodes = getFocusables();
      if (nodes.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (activeElement && document.contains(activeElement)) {
        activeElement.focus({ preventScroll: true });
      }
    };
  }, [containerRef, onEscape, open]);
};
