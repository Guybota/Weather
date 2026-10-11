// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { ForecastChart } from '../src/components';
import { parseForecast } from '../src/weather';
import { WeatherBackdrop } from '../src/WeatherBackdrop';

vi.mock('../src/api', () => ({
  loadData: vi.fn(async (path: string) => ({
    stale: false,
    fetchedAt: new Date().toISOString(),
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
          ]
        : path === 'weather-types'
          ? [
              {
                idTipoTempo: 4,
                descTipoTempoPT: 'Céu muito nublado ou encoberto',
                descTipoTempoEN: 'Cloudy',
              },
            ]
          : path === 'warnings'
            ? { data: [] }
            : path === 'observations'
              ? { features: [] }
              : [
                  {
                    idPeriodo: 24,
                    dataPrev: new Date().toISOString().slice(0, 10) + 'T00:00:00',
                    tMin: 12,
                    tMax: 23,
                    idTipoTempo: 4,
                    probabilidadePrecipita: 20,
                  },
                ],
  })),
}));
let dark = false;
let reducedMotion = false;
let listeners: Set<() => void>;
beforeEach(() => {
  localStorage.clear();
  listeners = new Set();
  dark = false;
  reducedMotion = false;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('navigator', { language: 'en-US', onLine: true });
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return (
        (query.includes('prefers-color-scheme') && dark) ||
        (query.includes('prefers-reduced-motion') && reducedMotion)
      );
    },
    addEventListener: (_name: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_name: string, fn: () => void) => listeners.delete(fn),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('keeps a static atmospheric layer when motion is reduced', async () => {
  reducedMotion = true;
  const { container } = render(<WeatherBackdrop code={4} night={false} dark={false} />);
  await waitFor(() => expect(container.querySelector('.aurora-weather')).toBeTruthy());
  expect(container.querySelector('.weather-backdrop')).toBeTruthy();
  expect(container.querySelector('.weather-backdrop')?.getAttribute('data-motion')).toBe('static');
  expect(container.querySelector('canvas')).toBeNull();
});
it('keeps weather and native panels usable when WebGL is unavailable', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Cloudy' });
  await waitFor(() => expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /Today: Cloudy/ }));
  expect(screen.getByRole('dialog', { name: 'Today' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Cloudy' })).toBeTruthy();
});
it('preserves the sky without reinitialising WebGL when system reduced motion changes', async () => {
  const { container } = render(<WeatherBackdrop code={4} night={false} dark={false} />);
  await waitFor(() => expect(container.querySelector('.aurora-weather')).toBeTruthy());
  const layer = container.querySelector('.aurora-weather');
  const attempts = vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length;
  act(() => {
    reducedMotion = true;
    listeners.forEach((fn) => fn());
  });
  expect(container.querySelector('.aurora-weather')).toBe(layer);
  expect(container.querySelector('.weather-backdrop')?.getAttribute('data-motion')).toBe('static');
  expect(vi.mocked(HTMLCanvasElement.prototype.getContext).mock.calls.length).toBe(attempts);
});
it('ignores an old manual theme and responds to system appearance changes', async () => {
  localStorage.setItem('tempo:theme', JSON.stringify('dark'));
  render(<App />);
  expect(document.documentElement.dataset.theme).toBe('light');
  act(() => {
    dark = true;
    listeners.forEach((fn) => fn());
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  act(() => {
    dark = false;
    listeners.forEach((fn) => fn());
  });
  expect(document.documentElement.dataset.theme).toBe('light');
  await screen.findByRole('heading', { name: 'Cloudy' });
});
it('renders English weather and switches to Portuguese on a system language event', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Cloudy' });
  expect(document.documentElement.lang).toBe('en');
  act(() => {
    vi.stubGlobal('navigator', { language: 'pt-BR', onLine: true });
    window.dispatchEvent(new Event('languagechange'));
  });
  expect(document.documentElement.lang).toBe('pt');
  expect(screen.getByRole('heading', { name: 'Céu muito nublado ou encoberto' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Personalizar' })).toBeTruthy();
});
it('opens and closes a day detail and persists selected indicators', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Cloudy' });
  fireEvent.click(screen.getByRole('button', { name: /Today: Cloudy/ }));
  expect(screen.getByRole('dialog', { name: 'Today' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Customise' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Pressure' }));
  expect(JSON.parse(localStorage.getItem('tempo:indicators')!)).toContain('pressure');
});
it('selects actual forecast records by keyboard and keeps missing rain unavailable', () => {
  const periods = parseForecast([
    { idPeriodo: 24, dataPrev: '2026-10-11T00:00:00' },
    ...['12:00', '15:00', '18:00'].map((time, i) => ({
      idPeriodo: 3,
      dataPrev: '2026-10-11T' + time + ':00',
      tMed: 20 + i,
      probabilidadePrecipita: i === 1 ? null : 30,
    })),
  ]).filter((p) => p.interval !== 24);
  const onSelect = vi.fn();
  const { rerender } = render(
    <ForecastChart
      periods={periods}
      timezone="Europe/Lisbon"
      metric="temperature"
      onMetric={() => {}}
      selected={0}
      onSelect={onSelect}
      now={Date.parse('2026-10-11T13:00:00Z')}
    />,
  );
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
  expect(onSelect).toHaveBeenLastCalledWith(1);
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
  expect(onSelect).toHaveBeenLastCalledWith(2);
  rerender(
    <ForecastChart
      periods={periods}
      timezone="Europe/Lisbon"
      metric="temperature"
      onMetric={() => {}}
      selected={1}
      onSelect={onSelect}
      now={Date.parse('2026-10-11T13:00:00Z')}
    />,
  );
  expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain('Chance of rain —');
});

it('connects known rain samples with dashed gaps while missing hours stay unavailable', () => {
  const periods = parseForecast([
    { idPeriodo: 24, dataPrev: '2026-10-11T00:00:00' },
    ...[0, null, null, 47, null, null, 55, null, null, 0].map((rain, i) => ({
      idPeriodo: 1,
      dataPrev: `2026-10-11T${String(10 + i).padStart(2, '0')}:00:00`,
      tMed: 20,
      probabilidadePrecipita: rain,
    })),
  ]).filter((p) => p.interval !== 24);
  const { container } = render(
    <ForecastChart
      periods={periods}
      timezone="Europe/Lisbon"
      metric="rain"
      onMetric={() => {}}
      selected={4}
      onSelect={() => {}}
      now={Date.parse('2026-10-11T14:00:00Z')}
    />,
  );
  expect(container.querySelectorAll('.rain-sample')).toHaveLength(4);
  expect(
    [...container.querySelectorAll('.rain-sample')].map((el) =>
      el.getAttribute('data-probability'),
    ),
  ).toEqual(['0', '47', '55', '0']);
  expect(container.querySelectorAll('.rain-link-gap')).toHaveLength(3);
  expect(container.querySelector('.chart-bar')).toBeNull();
  expect(container.querySelector('.chart-cursor')).toBeTruthy();
  expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain('Chance of rain —');
});

it('uses solid links for consecutive three-hour rain records and keeps gradient IDs unique', () => {
  const periods = parseForecast([
    { idPeriodo: 24, dataPrev: '2026-10-11T00:00:00' },
    ...['12:00', '15:00', '18:00'].map((time, i) => ({
      idPeriodo: 3,
      dataPrev: '2026-10-11T' + time + ':00',
      probabilidadePrecipita: [20, 60, 10][i],
    })),
  ]).filter((p) => p.interval !== 24);
  const chart = (
    <ForecastChart
      periods={periods}
      timezone="Europe/Lisbon"
      metric="rain"
      onMetric={() => {}}
      selected={1}
      onSelect={() => {}}
      now={0}
    />
  );
  const { container } = render(
    <>
      {chart}
      {chart}
    </>,
  );
  expect(container.querySelectorAll('.rain-link-gap')).toHaveLength(0);
  expect(container.querySelectorAll('.rain-link')).toHaveLength(4);
  const gradients = [...container.querySelectorAll('linearGradient')].map((el) => el.id);
  expect(new Set(gradients).size).toBe(2);
});

it('follows the current time between records until an hour is selected', () => {
  const periods = parseForecast([
    { idPeriodo: 24, dataPrev: '2026-10-11T00:00:00' },
    ...['12:00', '15:00'].map((time, i) => ({
      idPeriodo: 3,
      dataPrev: '2026-10-11T' + time + ':00',
      tMed: 20 + i,
      probabilidadePrecipita: i ? null : 30,
    })),
  ]).filter((p) => p.interval !== 24);
  const onSelect = vi.fn();
  const { container } = render(
    <ForecastChart
      periods={periods}
      timezone="Europe/Lisbon"
      metric="temperature"
      onMetric={() => {}}
      selected={-1}
      onSelect={onSelect}
      now={(Date.parse(periods[0].at) + Date.parse(periods[1].at)) / 2}
    />,
  );
  const text = screen.getByRole('slider').getAttribute('aria-valuetext')!;
  expect(text).toContain('Now. Temperature 21°');
  expect(text).toContain('Chance of rain —');
  expect(container.querySelector('.chart-summary')!.textContent).toContain('20.5');
  expect(container.querySelector('.hour-strip [aria-pressed="true"]')).toBeNull();
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
  expect(onSelect).toHaveBeenLastCalledWith(1);
});
