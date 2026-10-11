// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import { ForecastChart } from '../src/components';
import { parseForecast } from '../src/weather';

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
let listeners: Set<() => void>;
beforeEach(() => {
  localStorage.clear();
  listeners = new Set();
  dark = false;
  vi.stubGlobal('navigator', { language: 'en-US', onLine: true });
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('prefers-color-scheme') && dark;
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
  vi.unstubAllGlobals();
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
