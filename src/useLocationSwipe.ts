import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';

export type LocationPages = { ids: number[]; id: number };

export function useLocationSwipe(
  mainRef: RefObject<HTMLElement | null>,
  pages: RefObject<LocationPages>,
  blocked: boolean,
  onChoose: (id: number) => void,
) {
  const choose = useRef(onChoose);
  choose.current = onChoose;
  const transition = useRef<(id: number, direction: number) => void>(() => {});

  useEffect(() => {
    const main = mainRef.current;
    if (!main || blocked) return;
    const mobile = matchMedia('(max-width: 760px)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = false;
    let horizontal = false;
    let busy = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let drawn = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let frame = 0;
    let suppressClickUntil = 0;
    let snapshot: HTMLElement | null = null;
    let animations: Animation[] = [];
    let generation = 0;

    const width = () => main.getBoundingClientRect().width || innerWidth;
    const neighbour = () => {
      const { ids, id } = pages.current;
      return ids[ids.indexOf(id) + (dx < 0 ? 1 : -1)];
    };
    const paint = (x: number) => {
      drawn = x;
      main.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
    };
    const drawDrag = () => {
      const resisted = Math.sign(dx) * 64 * (1 - Math.exp(-Math.abs(dx) / 180));
      paint(
        motion.matches
          ? 0
          : neighbour() === undefined
            ? resisted
            : Math.max(-width(), Math.min(width(), dx)),
      );
      main.style.willChange = motion.matches ? '' : 'transform';
    };
    const clean = () => {
      generation++;
      cancelAnimationFrame(frame);
      frame = 0;
      animations.forEach((animation) => animation.cancel());
      animations = [];
      snapshot?.remove();
      snapshot = null;
      active = horizontal = busy = false;
      dx = velocity = 0;
      paint(0);
      main.style.willChange = '';
    };
    const finish = (running: Animation[]) => {
      const current = generation;
      animations = running;
      void Promise.all(running.map((animation) => animation.finished))
        .then(() => {
          if (current === generation) clean();
        })
        .catch(() => {
          // Cancellation belongs to the newer gesture or effect cleanup.
        });
    };
    const snapBack = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      active = horizontal = false;
      if (!drawn || motion.matches || !main.animate) return clean();
      busy = true;
      finish([
        main.animate(
          { transform: [`translate3d(${drawn}px, 0, 0)`, 'translate3d(0, 0, 0)'] },
          { duration: 320, easing: 'cubic-bezier(0.22, 1.15, 0.36, 1)', fill: 'forwards' },
        ),
      ]);
    };
    const slide = (id: number, direction: number) => {
      if (busy || id === pages.current.id || !pages.current.ids.includes(id)) return;
      cancelAnimationFrame(frame);
      frame = 0;
      active = horizontal = false;
      if (motion.matches || !main.animate || !mobile.matches) {
        clean();
        choose.current(id);
        return;
      }
      busy = true;
      const rect = main.getBoundingClientRect();
      const pageWidth = width();
      const from = drawn;
      // The old page is a short-lived inert visual, never a second interactive app.
      snapshot = main.cloneNode(true) as HTMLElement;
      snapshot.removeAttribute('id');
      snapshot.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      snapshot.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
      snapshot.classList.add('location-swipe-snapshot');
      snapshot.inert = true;
      snapshot.setAttribute('aria-hidden', 'true');
      Object.assign(snapshot.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left - from}px`,
        width: `${pageWidth}px`,
        height: `${rect.height}px`,
        margin: '0',
        translate: 'none',
        transform: `translate3d(${from}px, 0, 0)`,
        pointerEvents: 'none',
      });
      main.parentElement!.append(snapshot);
      // The prefetched forecast is rendered before the incoming page starts moving.
      flushSync(() => choose.current(id));
      const incoming = from + direction * pageWidth;
      paint(incoming);
      main.style.willChange = 'transform';
      const options: KeyframeAnimationOptions = {
        duration: 340,
        easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)',
        fill: 'forwards',
      };
      finish([
        snapshot.animate(
          {
            transform: [
              `translate3d(${from}px, 0, 0)`,
              `translate3d(${-direction * pageWidth}px, 0, 0)`,
            ],
          },
          options,
        ),
        main.animate(
          { transform: [`translate3d(${incoming}px, 0, 0)`, 'translate3d(0, 0, 0)'] },
          options,
        ),
      ]);
      navigator.vibrate?.(8);
    };
    transition.current = slide;

    const down = (event: TouchEvent) => {
      if (busy) return;
      clean();
      suppressClickUntil = 0;
      if (event.touches.length !== 1 || !mobile.matches || document.querySelector('dialog[open]'))
        return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest(
          '.interactive-chart, .hour-strip, .page-dots, select, input, textarea, [contenteditable="true"]',
        )
      )
        return;
      const touch = event.touches[0];
      // Leave the iPhone's screen-edge back gesture to the system.
      if (touch.clientX <= 24 || touch.clientX >= innerWidth - 24) return;
      active = true;
      startX = lastX = touch.clientX;
      startY = touch.clientY;
      lastTime = performance.now();
    };
    const move = (event: TouchEvent) => {
      if (!active) return;
      if (event.touches.length !== 1) return snapBack();
      const touch = event.touches[0];
      const x = touch.clientX - startX;
      const y = touch.clientY - startY;
      if (!horizontal) {
        if (Math.max(Math.abs(x), Math.abs(y)) < 10) return;
        if (Math.abs(x) <= Math.abs(y) * 1.2) {
          active = false;
          return;
        }
        horizontal = true;
      }
      // Vertical gestures remain untouched, preserving native iOS scroll and bounce.
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      const elapsed = now - lastTime;
      if (elapsed > 0) velocity = 0.75 * ((touch.clientX - lastX) / elapsed) + 0.25 * velocity;
      lastX = touch.clientX;
      lastTime = now;
      dx = x;
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          drawDrag();
        });
    };
    const up = (event: TouchEvent) => {
      if (!active || !horizontal) {
        active = false;
        return;
      }
      suppressClickUntil = performance.now() + 450;
      // Release can arrive before the scheduled frame of a very quick flick.
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        drawDrag();
      }
      const next = neighbour();
      const speed = performance.now() - lastTime < 100 ? velocity : 0;
      const projected = dx + speed * 160;
      const threshold = Math.min(110, Math.max(64, width() * 0.22));
      const commit =
        event.type === 'touchend' &&
        next !== undefined &&
        Math.sign(projected) === Math.sign(dx) &&
        (Math.abs(dx) >= threshold || (Math.abs(dx) >= 26 && Math.abs(speed) >= 0.5));
      if (commit) slide(next, dx < 0 ? 1 : -1);
      else snapBack();
    };
    const click = (event: MouseEvent) => {
      if (event.detail && (busy || performance.now() < suppressClickUntil)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    main.addEventListener('touchstart', down, { passive: true });
    main.addEventListener('touchmove', move, { passive: false });
    main.addEventListener('touchend', up);
    main.addEventListener('touchcancel', up);
    main.addEventListener('click', click, true);
    window.addEventListener('blur', clean);
    mobile.addEventListener('change', clean);
    motion.addEventListener('change', clean);
    return () => {
      clean();
      transition.current = () => {};
      main.removeEventListener('touchstart', down);
      main.removeEventListener('touchmove', move);
      main.removeEventListener('touchend', up);
      main.removeEventListener('touchcancel', up);
      main.removeEventListener('click', click, true);
      window.removeEventListener('blur', clean);
      mobile.removeEventListener('change', clean);
      motion.removeEventListener('change', clean);
    };
  }, [mainRef, pages, blocked]);

  return useCallback((id: number, direction: number) => transition.current(id, direction), []);
}
