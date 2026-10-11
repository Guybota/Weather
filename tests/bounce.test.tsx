// @vitest-environment jsdom
import { useRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePageBounce } from '../src/usePageBounce';

let reduced = false;
function Page({ refresh, blocked = false }: { refresh: () => void; blocked?: boolean }) {
  const main = useRef<HTMLElement>(null);
  const pull = useRef<HTMLDivElement>(null);
  usePageBounce(main, pull, blocked, refresh);
  return (
    <>
      <div ref={pull} data-testid="pull" />
      <main ref={main}>
        <p>Weather</p>
        <div className="interactive-chart">Chart</div>
        <div data-testid="nested" style={{ overflowY: 'auto' }}>
          Nested content
        </div>
      </main>
    </>
  );
}
beforeEach(() => {
  reduced = false;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperties(document.documentElement, {
    scrollHeight: { configurable: true, value: 1800 },
    clientHeight: { configurable: true, value: 800 },
  });
  document.documentElement.scrollTop = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function touch(target: Element, type: 'touchStart' | 'touchMove', x: number, y: number) {
  fireEvent[type](target, { touches: [{ clientX: x, clientY: y }] });
}
function offset(main: HTMLElement) {
  return Number.parseFloat(main.style.translate.split(' ')[1]);
}

it('bounces in opposite directions at both ends and settles without refreshing on wheel', () => {
  const refresh = vi.fn();
  const { container } = render(<Page refresh={refresh} />);
  const main = container.querySelector('main')!;
  fireEvent.wheel(main, { deltaY: -100 });
  expect(offset(main)).toBeGreaterThan(0);
  act(() => vi.advanceTimersByTime(2000));
  expect(main.style.translate).toBe('');
  document.documentElement.scrollTop = 1000;
  fireEvent.wheel(main, { deltaY: 100 });
  expect(offset(main)).toBeLessThan(0);
  act(() => vi.advanceTimersByTime(2000));
  expect(main.style.translate).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});

it('leaves normal scrolling, chart gestures, nested scrolling and zoom alone', () => {
  const { container, getByTestId } = render(<Page refresh={vi.fn()} />);
  const main = container.querySelector('main')!;
  document.documentElement.scrollTop = 400;
  expect(fireEvent.wheel(main, { deltaY: 100 })).toBe(true);
  touch(main, 'touchStart', 100, 200);
  touch(main, 'touchMove', 100, 80);
  expect(main.style.translate).toBe('');
  fireEvent.touchEnd(main, { touches: [] });
  document.documentElement.scrollTop = 0;
  fireEvent.wheel(main, { deltaY: -100, ctrlKey: true });
  fireEvent.wheel(container.querySelector('.interactive-chart')!, { deltaY: -100 });
  const nested = getByTestId('nested');
  Object.defineProperties(nested, { scrollHeight: { value: 300 }, clientHeight: { value: 100 } });
  fireEvent.wheel(nested, { deltaY: -100 });
  touch(main, 'touchStart', 100, 200);
  touch(main, 'touchMove', 230, 210);
  expect(main.style.translate).toBe('');
});

it('refreshes only after releasing a sufficient top pull, never a cancelled or bottom pull', () => {
  const refresh = vi.fn();
  const { container } = render(<Page refresh={refresh} />);
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 100, 100);
  touch(main, 'touchMove', 100, 150);
  expect(offset(main)).toBeGreaterThan(0);
  expect(offset(main)).toBeLessThan(50);
  fireEvent.touchEnd(main, { touches: [] });
  expect(refresh).not.toHaveBeenCalled();
  touch(main, 'touchStart', 100, 100);
  touch(main, 'touchMove', 100, 240);
  fireEvent.touchCancel(main, { touches: [] });
  expect(refresh).not.toHaveBeenCalled();
  touch(main, 'touchStart', 100, 100);
  touch(main, 'touchMove', 100, 240);
  fireEvent.touchEnd(main, { touches: [] });
  expect(refresh).toHaveBeenCalledTimes(1);
  document.documentElement.scrollTop = 1000;
  touch(main, 'touchStart', 100, 300);
  touch(main, 'touchMove', 100, 100);
  expect(offset(main)).toBeLessThan(0);
  fireEvent.touchEnd(main, { touches: [] });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('starts elasticity when a continuing gesture reaches the page boundary', () => {
  const { container } = render(<Page refresh={vi.fn()} />);
  const main = container.querySelector('main')!;
  document.documentElement.scrollTop = 900;
  touch(main, 'touchStart', 100, 400);
  touch(main, 'touchMove', 100, 300);
  expect(main.style.translate).toBe('');
  document.documentElement.scrollTop = 1000;
  touch(main, 'touchMove', 100, 260);
  expect(offset(main)).toBeLessThan(0);
  touch(main, 'touchMove', 100, 310);
  expect(main.style.translate).toBe('');
});

it('clears the bounce when a panel opens and cancels animation on unmount', () => {
  const refresh = vi.fn();
  const { container, rerender, unmount } = render(<Page refresh={refresh} />);
  const main = container.querySelector('main')!;
  fireEvent.wheel(main, { deltaY: -100 });
  rerender(<Page refresh={refresh} blocked />);
  expect(main.style.translate).toBe('');
  fireEvent.wheel(main, { deltaY: -100 });
  expect(main.style.translate).toBe('');
  rerender(<Page refresh={refresh} />);
  fireEvent.wheel(main, { deltaY: -100 });
  act(() => vi.advanceTimersByTime(100));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('respects reduced motion while preserving pull to refresh', () => {
  reduced = true;
  const refresh = vi.fn();
  const { container } = render(<Page refresh={refresh} />);
  const main = container.querySelector('main')!;
  fireEvent.wheel(main, { deltaY: -100 });
  touch(main, 'touchStart', 100, 100);
  touch(main, 'touchMove', 100, 240);
  expect(main.style.translate).toBe('');
  fireEvent.touchEnd(main, { touches: [] });
  expect(refresh).toHaveBeenCalledOnce();
});
