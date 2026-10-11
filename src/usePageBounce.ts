import { useEffect, useRef, type RefObject } from 'react';

// Keep vertical elasticity separate from the horizontal place-swipe transform.
export function usePageBounce(
  mainRef: RefObject<HTMLElement | null>,
  pullRef: RefObject<HTMLDivElement | null>,
  blocked: boolean,
  onRefresh: () => void,
) {
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    const main = mainRef.current;
    const indicator = pullRef.current;
    if (!main || !indicator || blocked) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let offset = 0;
    let velocity = 0;
    let frame = 0;
    let wheelTimer = 0;
    let dragging = false;
    let axis: 'pending' | 'vertical' | 'horizontal' = 'pending';
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let distance = 0;
    let pull = 0;

    const paint = (value: number) => {
      offset = motion.matches ? 0 : value;
      main.style.translate = offset ? `0 ${offset}px` : '';
      main.style.willChange = offset ? 'translate' : '';
    };
    const setPull = (value: number) => {
      pull = value;
      indicator.style.transition = value ? 'none' : '';
      indicator.style.setProperty('--pull', String(value));
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(wheelTimer);
      frame = 0;
      velocity = 0;
    };
    const reset = () => {
      stop();
      dragging = false;
      distance = 0;
      paint(0);
      setPull(0);
    };
    const release = () => {
      stop();
      setPull(0);
      if (!offset || motion.matches) return paint(0);
      let previous = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - previous) / 1000, 0.032);
        previous = now;
        // A damped spring gives a small rebound without a long oscillation.
        velocity += (-offset * 220 - velocity * 24) * dt;
        paint(offset + velocity * dt);
        if (Math.abs(offset) < 0.1 && Math.abs(velocity) < 1) {
          frame = 0;
          paint(0);
        } else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const eligible = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !main.contains(target)) return false;
      if (document.querySelector('dialog[open]')) return false;
      if (target.closest('.interactive-chart, input, select, textarea, [contenteditable="true"]'))
        return false;
      // Nested scrollers (including the horizontal hours) keep their own gestures.
      for (
        let element: Element | null = target;
        element && element !== main;
        element = element.parentElement
      ) {
        const style = getComputedStyle(element);
        if (
          (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) ||
          (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth)
        )
          return false;
      }
      return true;
    };
    const atEdge = (delta: number) => {
      const root = document.scrollingElement ?? document.documentElement;
      const max = Math.max(0, root.scrollHeight - root.clientHeight);
      return (delta > 0 && root.scrollTop <= 1) || (delta < 0 && root.scrollTop >= max - 1);
    };
    const resist = (value: number) =>
      Math.sign(value) * 110 * (1 - Math.exp((-Math.abs(value) * 0.55) / 110));

    const down = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !eligible(event.target)) return reset();
      reset();
      dragging = true;
      axis = 'pending';
      startX = event.touches[0].clientX;
      startY = lastY = event.touches[0].clientY;
    };
    const move = (event: TouchEvent) => {
      if (!dragging) return;
      if (event.touches.length !== 1 || document.querySelector('dialog[open]')) return reset();
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (axis === 'pending') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        axis = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
      }
      const delta = touch.clientY - lastY;
      lastY = touch.clientY;
      if (axis !== 'vertical') return;
      if (!distance && !atEdge(delta)) return;
      if (event.cancelable) event.preventDefault();
      // Reversing the drag first consumes the stretched distance, then scrolls normally.
      const next = distance + delta;
      distance = distance && Math.sign(next) !== Math.sign(distance) ? 0 : next;
      paint(resist(distance));
      setPull(Math.min(90, Math.max(0, distance * 0.5)));
    };
    const up = (event: TouchEvent) => {
      const shouldRefresh = dragging && event.type === 'touchend' && pull >= 60 && navigator.onLine;
      dragging = false;
      distance = 0;
      release();
      if (shouldRefresh) {
        navigator.vibrate?.(10);
        refresh.current();
      }
    };
    const wheel = (event: WheelEvent) => {
      if (
        motion.matches ||
        dragging ||
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
        !eligible(event.target)
      )
        return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      const delta = -event.deltaY * unit;
      if (!atEdge(delta)) {
        if (offset) release();
        return;
      }
      if (event.cancelable) event.preventDefault();
      stop();
      // Wheel momentum gets a bounded nudge; it never triggers pull to refresh.
      const base = Math.sign(offset) === Math.sign(delta) ? offset : 0;
      paint(Math.sign(delta) * Math.min(85, Math.abs(base) + Math.min(18, Math.abs(delta) * 0.2)));
      wheelTimer = window.setTimeout(release, 80);
    };

    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', reset);
    motion.addEventListener('change', reset);
    return () => {
      reset();
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', reset);
      motion.removeEventListener('change', reset);
    };
  }, [mainRef, pullRef, blocked]);
}
