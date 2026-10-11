import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayInsight, directionDegrees, validIndicators } from '../src/experience';
import { languageFor, t } from '../src/i18n';
import { parseForecast, parseWeatherTypes, type Period } from '../src/weather';

afterEach(() => vi.unstubAllGlobals());
const daily = parseForecast([
  { idPeriodo: 24, dataPrev: '2026-10-11T00:00:00', tMin: 12, tMax: 23 },
])[0];
const period = (at: string, rain: number | null, wind: number | null = null): Period => ({
  ...daily,
  interval: 1,
  at,
  temperature: 20,
  rain,
  wind,
});
describe('Planning summaries and system language', () => {
  it('uses Portuguese only for Portuguese system languages', () => {
    for (const input of ['pt', 'pt-PT', 'pt-BR', 'PT-ao']) expect(languageFor(input)).toBe('pt');
    for (const input of ['en-US', 'fr-FR', 'es', 'de', '', 'ptx'])
      expect(languageFor(input)).toBe('en');
  });
  it('translates dynamic summaries without changing location names', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(t('Maior probabilidade de chuva às 16:00: 80%.')).toBe(
      'Highest chance of rain at 16:00: 80%.',
    );
    expect(t('Próximos 10 dias')).toBe('Next 10 days');
    expect(t('Subir Ponta Delgada')).toBe('Move Ponta Delgada up');
    expect(t('Previsão para as 14:00. Sem observação recente próxima.')).toBe(
      'Forecast for 14:00. No recent nearby observation.',
    );
    expect(t('Lisboa')).toBe('Lisboa');
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(t('Pesquisar localidade')).toBe('Pesquisar localidade');
  });
  it('uses official bilingual IPMA descriptions', () => {
    expect(
      parseWeatherTypes([
        {
          idTipoTempo: 7,
          descTipoTempoPT: 'Aguaceiros/chuva fracos',
          descTipoTempoEN: 'Light showers/rain',
        },
      ])[0].englishDescription,
    ).toBe('Light showers/rain');
  });
  it('does not use expired rain peaks or treat missing rain as dry weather', () => {
    vi.stubGlobal('navigator', { language: 'pt-PT' });
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(
      dayInsight(
        [period('2026-10-11T08:00:00Z', 100), period('2026-10-11T14:00:00Z', null)],
        daily,
        'Europe/Lisbon',
        now,
      ),
    ).toBe('Hoje, temperaturas entre 12° e 23°.');
    expect(dayInsight([period('2026-10-11T14:00:00Z', 0)], daily, 'Europe/Lisbon', now)).toContain(
      'períodos restantes disponíveis',
    );
  });
  it('uses actual three-hour records and honours Azores time', () => {
    vi.stubGlobal('navigator', { language: 'pt-PT' });
    const sample = { ...period('2026-01-11T15:00:00Z', 80), interval: 3 as const };
    expect(
      dayInsight([sample], undefined, 'Atlantic/Azores', Date.parse('2026-01-11T13:00:00Z')),
    ).toContain('14:00: 80%');
    expect(
      dayInsight([sample], undefined, 'Atlantic/Azores', Date.parse('2026-01-11T18:00:00Z')),
    ).not.toContain('80%');
  });
  it('does not turn an unknown wind direction into north and validates saved indicators', () => {
    expect(directionDegrees('SW')).toBe(225);
    expect(directionDegrees('SO')).toBe(225);
    expect(directionDegrees('')).toBeNull();
    expect(validIndicators(['rain', 'unknown', 'rain', 'wind'])).toEqual(['rain', 'wind']);
    expect(validIndicators([]).length).toBeGreaterThan(0);
  });
});
