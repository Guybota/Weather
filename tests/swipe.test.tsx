// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLocationSwipe } from '../src/useLocationSwipe';
import App from '../src/App';
import { loadData } from '../src/api';

vi.mock('../src/api', () => ({
  loadData: vi.fn(async (path: string) => ({
    fetchedAt: new Date().toISOString(),
    stale: false,
    data:
      path === 'locations'
        ? [
            {
              globalIdLocal: 1110600,
              local: 'Lisboa',
              latitude: 38.7,
              longitude: -9.1,
              idRegiao: 1,
              idAreaAviso: 'LSB',
            },
            {
              globalIdLocal: 1131200,
              local: 'Porto',
              latitude: 41.1,
              longitude: -8.6,
              idRegiao: 1,
              idAreaAviso: 'PTO',
            },
          ]
        : path === 'weather-types'
          ? [{ idTipoTempo: 1, descTipoTempoPT: 'Céu limpo', descTipoTempoEN: 'Clear sky' }]
          : path === 'warnings'
            ? { data: [] }
            : path === 'observations'
              ? { features: [] }
              : [
                  {
                    idPeriodo: 24,
                    dataPrev: new Date().toISOString().slice(0, 10) + 'T00:00:00',
                    tMin: 12,
                    tMax: path.endsWith('1131200') ? 26 : 23,
                    idTipoTempo: 1,
                  },
                ],
  })),
}));

let reduced = false;
let running: {
  element: HTMLElement;
  frames: PropertyIndexedKeyframes;
  resolve: () => void;
  cancel: ReturnType<typeof vi.fn>;
}[];
const animateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');

function Page({
  onChoose,
  blocked = false,
}: {
  onChoose: (id: number) => void;
  blocked?: boolean;
}) {
  const [id, setId] = useState(2);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const preview = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const pages = useRef({ ids: [1, 2, 3], id });
  pages.current.id = id;
  const slideTo = useLocationSwipe(
    main,
    pages,
    blocked,
    (next) => {
      onChoose(next);
      setId(next);
    },
    (next) => {
      if (next === null) setPreviewId(null);
      else flushSync(() => setPreviewId(next));
      return next === null ? null : preview.current;
    },
  );
  return (
    <div>
      <main ref={main} id="page">
        <h1 id="location-name">Place {id}</h1>
        <button onClick={() => onChoose(99)}>Open details</button>
        <div className="hour-strip">Hours</div>
        <canvas />
        <div className="page-dots">
          <button onClick={() => slideTo(3, 1)}>Next place</button>
        </div>
      </main>
      {previewId !== null && (
        <main ref={preview} className="location-swipe-preview" inert aria-hidden="true">
          <h1>Place {previewId}</h1>
        </main>
      )}
    </div>
  );
}

beforeEach(() => {
  reduced = false;
  running = [];
  localStorage.clear();
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('navigator', { language: 'en-US', userAgent: 'iPhone', onLine: true });
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('max-width') || (query.includes('reduced-motion') && reduced);
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, frames: PropertyIndexedKeyframes) {
      let resolve!: () => void;
      let reject!: (reason: Error) => void;
      const finished = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      const cancel = vi.fn(() => reject(new DOMException('Cancelled', 'AbortError')));
      running.push({ element: this, frames, resolve, cancel });
      return { finished, cancel };
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (animateDescriptor) Object.defineProperty(HTMLElement.prototype, 'animate', animateDescriptor);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});
function timers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
}
function touch(target: Element, type: 'touchStart' | 'touchMove', x: number, y = 200) {
  return fireEvent[type](target, { touches: [{ clientX: x, clientY: y }] });
}
function move(target: Element, x: number, elapsed: number, y = 200) {
  act(() => vi.advanceTimersByTime(elapsed));
  touch(target, 'touchMove', x, y);
  act(() => vi.advanceTimersByTime(16));
}
async function finish() {
  await act(async () => {
    running.forEach((animation) => animation.resolve());
    await Promise.resolve();
  });
}

it('continues the drag into simultaneous outgoing and incoming pages, then removes the snapshot', async () => {
  timers();
  const onChoose = vi.fn();
  const { container } = render(<Page onChoose={onChoose} />);
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 230);
  move(main, 110, 250);
  expect(main.style.transform).toBe('translate3d(-120px, 0, 0)');
  const preview = container.querySelector<HTMLElement>('.location-swipe-preview')!;
  expect(preview.textContent).toContain('Place 3');
  expect(preview.style.transform).toBe('translate3d(270px, 0, 0)');
  expect(onChoose).not.toHaveBeenCalled();
  fireEvent.touchEnd(main, { touches: [] });
  expect(onChoose).toHaveBeenCalledWith(3);
  const snapshot = container.querySelector<HTMLElement>('.location-swipe-snapshot')!;
  expect(snapshot.inert).toBe(true);
  expect(snapshot.getAttribute('aria-hidden')).toBe('true');
  expect(snapshot.querySelector('[id], canvas')).toBeNull();
  expect(snapshot.textContent).toContain('Place 2');
  expect(within(main).getByRole('heading').textContent).toBe('Place 3');
  expect(running[0].frames.transform).toEqual([
    'translate3d(-120px, 0, 0)',
    'translate3d(-390px, 0, 0)',
  ]);
  expect(running[1].frames.transform).toEqual(['translate3d(270px, 0, 0)', 'translate3d(0, 0, 0)']);
  await finish();
  expect(container.querySelector('.location-swipe-snapshot')).toBeNull();
  expect(container.querySelector('.location-swipe-preview')).toBeNull();
  expect(main.style.transform).toBe('');
});

it('reveals either neighbour during the drag and returns both pages on cancellation', async () => {
  timers();
  const onChoose = vi.fn();
  const { container } = render(<Page onChoose={onChoose} />);
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 200);
  move(main, 110, 200);
  expect(container.querySelector('.location-swipe-preview')!.textContent).toContain('Place 3');
  move(main, 275, 200);
  const preview = container.querySelector<HTMLElement>('.location-swipe-preview')!;
  expect(preview.textContent).toContain('Place 1');
  expect(preview.style.transform).toBe('translate3d(-315px, 0, 0)');
  expect(within(main).getByRole('heading').textContent).toBe('Place 2');
  fireEvent.touchCancel(main, { touches: [] });
  expect(running).toHaveLength(2);
  expect(running[1].frames.transform).toEqual([
    'translate3d(-315px, 0, 0)',
    'translate3d(-390px, 0, 0)',
  ]);
  await finish();
  expect(container.querySelector('.location-swipe-preview')).toBeNull();
  expect(main.style.transform).toBe('');
  expect(onChoose).not.toHaveBeenCalled();
});

it('accepts a quick short flick and cancels a short drag held still before release', async () => {
  timers();
  const onChoose = vi.fn();
  const { container, unmount } = render(<Page onChoose={onChoose} />);
  let main = container.querySelector('main')!;
  touch(main, 'touchStart', 200);
  move(main, 162, 30);
  fireEvent.touchEnd(main, { touches: [] });
  expect(onChoose).toHaveBeenCalledWith(3);
  await finish();
  unmount();
  onChoose.mockClear();
  const next = render(<Page onChoose={onChoose} />);
  main = next.container.querySelector('main')!;
  touch(main, 'touchStart', 200);
  move(main, 162, 30);
  act(() => vi.advanceTimersByTime(200));
  fireEvent.touchEnd(main, { touches: [] });
  expect(onChoose).not.toHaveBeenCalled();
  await finish();
  expect(main.style.transform).toBe('');
});

it('never changes places on touchcancel or a swipe reversed before release', async () => {
  timers();
  const onChoose = vi.fn();
  const { container } = render(<Page onChoose={onChoose} />);
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 230);
  move(main, 60, 250);
  fireEvent.touchCancel(main, { touches: [] });
  await finish();
  expect(onChoose).not.toHaveBeenCalled();
  touch(main, 'touchStart', 200);
  move(main, 50, 250);
  move(main, 180, 30);
  fireEvent.touchEnd(main, { touches: [] });
  await finish();
  expect(onChoose).not.toHaveBeenCalled();
});

it('keeps native vertical scrolling, the screen edges and the hours strip free', () => {
  timers();
  const onChoose = vi.fn();
  const { container } = render(<Page onChoose={onChoose} />);
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 200);
  expect(touch(main, 'touchMove', 180, 320)).toBe(true);
  move(main, 60, 200, 320);
  fireEvent.touchEnd(main, { touches: [] });
  touch(main, 'touchStart', 12);
  move(main, 160, 30);
  fireEvent.touchEnd(main, { touches: [] });
  const hours = container.querySelector('.hour-strip')!;
  touch(hours, 'touchStart', 230);
  move(hours, 60, 30);
  fireEvent.touchEnd(hours, { touches: [] });
  expect(onChoose).not.toHaveBeenCalled();
  expect(main.style.transform).toBe('');
  expect(running).toHaveLength(0);
});

it('resists the last-page edge and prevents an accidental detail tap after swiping', async () => {
  timers();
  const onChoose = vi.fn();
  const { container } = render(<Page onChoose={onChoose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next place' }));
  await finish();
  onChoose.mockClear();
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 230);
  move(main, 60, 250);
  const x = Number.parseFloat(main.style.transform.slice('translate3d('.length));
  expect(x).toBeLessThan(0);
  expect(x).toBeGreaterThan(-64);
  fireEvent.touchEnd(main, { touches: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Open details' }), { detail: 1 });
  await finish();
  expect(onChoose).not.toHaveBeenCalled();
});

it('cleans up both pages when a panel opens during the transition', () => {
  timers();
  const onChoose = vi.fn();
  const { container, rerender } = render(<Page onChoose={onChoose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next place' }));
  rerender(<Page onChoose={onChoose} blocked />);
  expect(container.querySelector('.location-swipe-snapshot')).toBeNull();
  expect(container.querySelector('main')!.style.transform).toBe('');
  expect(running.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
});

it('switches without page animations when reduced motion is enabled', () => {
  timers();
  reduced = true;
  const onChoose = vi.fn();
  const { container } = render(<Page onChoose={onChoose} />);
  const main = container.querySelector('main')!;
  touch(main, 'touchStart', 230);
  move(main, 60, 250);
  expect(main.style.transform).toBe('');
  fireEvent.touchEnd(main, { touches: [] });
  expect(onChoose).toHaveBeenCalledWith(3);
  expect(running).toHaveLength(0);
});

it('shows a prefetched locality immediately while its next network request is still pending', async () => {
  const { container } = render(<App />);
  await screen.findByRole('heading', { name: 'Clear sky' });
  await waitFor(() => expect(screen.getByRole('button', { name: /Porto.*Today/ })).toBeTruthy());
  const hero = container.querySelector('main .weather-hero');
  const header = container.querySelector('.page-header');
  vi.mocked(loadData).mockImplementationOnce(() => new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'View forecast for Porto' }));
  const main = container.querySelector('main')!;
  expect(within(main).getByRole('heading', { name: 'Porto' })).toBeTruthy();
  expect(main.querySelector('.skeleton')).toBeNull();
  expect(main.querySelector('.hero-range')!.textContent).toContain('26°');
  expect(main.querySelector('.weather-hero')).toBe(hero);
  expect(container.querySelector('.page-header')).toBe(header);
  expect(
    container.querySelector(
      '.location-swipe-snapshot .page-header, .location-swipe-snapshot .page-dots',
    ),
  ).toBeNull();
  const markerAnimations = running.filter((animation) =>
    animation.element.matches('[data-location-id]'),
  );
  expect(markerAnimations).toHaveLength(2);
  expect(markerAnimations[0].frames.opacity).toEqual([1, 0.35]);
  expect(markerAnimations[1].frames.opacity).toEqual([0.35, 1]);
  await finish();
  expect(main.querySelector('.weather-hero')).toBe(hero);
  expect(header!.querySelector('[aria-current="location"]')!.getAttribute('data-location-id')).toBe(
    '1131200',
  );
  expect(header!.querySelector('[data-location-motion]')).toBeNull();
});

it('previews the actual next forecast before release and uses a house for the first location', async () => {
  const { container } = render(<App />);
  await screen.findByRole('heading', { name: 'Clear sky' });
  await waitFor(() => expect(screen.getByRole('button', { name: /Porto.*Today/ })).toBeTruthy());
  const main = container.querySelector('main')!;
  const header = container.querySelector('.page-header')!;
  const dots = header.querySelector('.page-dots')!;
  expect(main.querySelector('.topbar, .page-dots')).toBeNull();
  expect(
    dots.compareDocumentPosition(header.querySelector('.topbar')!) &
      Node.DOCUMENT_POSITION_PRECEDING,
  ).toBeTruthy();
  expect(dots.querySelector('button:first-child .lucide-house')).toBeTruthy();
  expect(dots.querySelector('button:nth-child(2) span')).toBeTruthy();
  const requests = vi.mocked(loadData).mock.calls.length;
  timers();
  touch(main, 'touchStart', 230);
  move(main, 110, 200);
  const preview = container.querySelector<HTMLElement>('.location-swipe-preview')!;
  expect(preview.querySelector('h1')!.textContent).toBe('Porto');
  expect(preview.querySelector('.hero-range')!.textContent).toContain('26°');
  expect(preview.hasAttribute('inert')).toBe(true);
  expect(preview.getAttribute('aria-hidden')).toBe('true');
  expect(preview.querySelector('#today, #forecast, #days')).toBeNull();
  expect(preview.querySelector('.topbar, .page-dots')).toBeNull();
  expect(container.querySelector('.page-header')).toBe(header);
  const home = dots.querySelector<HTMLElement>('button:first-child')!;
  const next = dots.querySelector<HTMLElement>('button:nth-child(2)')!;
  expect(Number(home.style.getPropertyValue('--location-weight'))).toBeCloseTo(1 - 120 / 390);
  expect(Number(next.style.getPropertyValue('--location-weight'))).toBeCloseTo(120 / 390);
  expect(within(main).getByRole('heading', { name: 'Lisboa' })).toBeTruthy();
  expect(vi.mocked(loadData).mock.calls).toHaveLength(requests);
  fireEvent.touchCancel(main, { touches: [] });
  const markerAnimations = running.filter((animation) =>
    animation.element.matches('[data-location-id]'),
  );
  expect(markerAnimations).toHaveLength(2);
  expect(markerAnimations[0].frames.opacity).toEqual([0.35 + (1 - 120 / 390) * 0.65, 1]);
  expect(markerAnimations[1].frames.opacity).toEqual([0.35 + (120 / 390) * 0.65, 0.35]);
  await finish();
  expect(container.querySelector('.location-swipe-preview')).toBeNull();
  expect(within(main).getByRole('heading', { name: 'Lisboa' })).toBeTruthy();
  expect(home.style.getPropertyValue('--location-weight')).toBe('');
  expect(next.style.getPropertyValue('--location-weight')).toBe('');
  expect(home.getAttribute('aria-current')).toBe('location');
  expect(dots.hasAttribute('data-location-motion')).toBe(false);
});
