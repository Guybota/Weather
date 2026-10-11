import { describe, expect, it } from 'vitest';
import {
  dateInZone,
  distanceKm,
  formatDay,
  nearestObservation,
  numeric,
  parseForecast,
  parseLocations,
  parseWarnings,
  relevantWarnings,
  utc,
} from '../src/weather';

describe('IPMA data adapter', () => {
  it('does not turn missing measurements into zero', () => {
    for (const n of [-99, '-99.0', '', null, undefined, 'invalid', false])
      expect(numeric(n)).toBeNull();
    expect(numeric('0.0')).toBe(0);
    expect(numeric('18.4')).toBe(18.4);
  });
  it('interprets IPMA timestamps as UTC and preserves daily calendar labels', () => {
    expect(utc('2026-10-11T00:00:00')).toBe('2026-10-11T00:00:00.000Z');
    expect(dateInZone('2026-01-11T00:00:00Z', 'Atlantic/Azores')).toBe('2026-01-10');
    const [daily] = parseForecast([
      { idPeriodo: 24, dataPrev: '2026-10-11T00:00:00', tMin: '12', tMax: '22' },
    ]);
    expect(daily.date).toBe('2026-10-11');
    expect(formatDay(daily.date, { day: 'numeric' })).toBe('11');
  });
  it('retains the actual 3-hour intervals and unavailable rain probability', () => {
    const periods = parseForecast([
      {
        idPeriodo: 3,
        dataPrev: '2026-10-14T03:00:00',
        probabilidadePrecipita: '-99.0',
        tMed: '17',
      },
      { idPeriodo: 24, dataPrev: '2026-10-14T00:00:00', tMin: '12', tMax: '22' },
    ]);
    expect(periods).toHaveLength(2);
    expect(periods[1].interval).toBe(3);
    expect(periods[1].rain).toBeNull();
  });
  it('selects the correct island timezones from IPMA region identifiers', () => {
    const locations = parseLocations([
      { globalIdLocal: 2310300, local: 'Funchal', idRegiao: 2, latitude: 32.65, longitude: -16.9 },
      {
        globalIdLocal: 3420300,
        local: 'Ponta Delgada',
        idRegiao: 3,
        latitude: 37.74,
        longitude: -25.67,
      },
    ]);
    expect(locations.find((l) => l.name === 'Funchal')?.timezone).toBe('Europe/Lisbon');
    expect(locations.find((l) => l.name === 'Ponta Delgada')?.timezone).toBe('Atlantic/Azores');
  });
  it('fails explicitly when the required IPMA shape changes', () => {
    expect(() => parseForecast({ data: [] })).toThrow();
    expect(() => parseForecast([])).toThrow();
    expect(() => parseLocations([])).toThrow();
    expect(() => parseWarnings({})).toThrow();
  });
  it('omits expired and all-clear warning records, includes upcoming warnings only in the selected area', () => {
    const base = {
      idAreaAviso: 'LSB',
      awarenessTypeName: 'Chuva',
      text: 'Teste',
      startTime: '2026-10-11T15:00:00',
      endTime: '2026-10-11T20:00:00',
    };
    const warnings = parseWarnings({
      data: [
        { ...base, awarenessLevelID: 'yellow' },
        { ...base, idAreaAviso: 'AOC', awarenessLevelID: 'red' },
        { ...base, awarenessLevelID: 'green' },
        { ...base, endTime: '2026-10-10T20:00:00', awarenessLevelID: 'orange' },
      ],
    });
    expect(relevantWarnings(warnings, 'LSB', Date.parse('2026-10-11T12:00:00Z'))).toHaveLength(1);
  });
  it('never labels a remote or old station as current local conditions', () => {
    const location = parseLocations([
      {
        globalIdLocal: 1110600,
        local: 'Lisboa',
        idAreaAviso: 'LSB',
        idRegiao: 1,
        latitude: '38.766',
        longitude: '-9.1286',
      },
    ])[0];
    const station = {
      name: 'Teste',
      at: '2026-10-11T09:00:00Z',
      temperature: 20,
      wind: null,
      pressure: null,
      humidity: null,
      latitude: 38.766,
      longitude: -9.1286,
    };
    expect(nearestObservation([station], location, Date.parse('2026-10-11T13:00:00Z'))).toBeNull();
    expect(
      nearestObservation(
        [{ ...station, at: '2026-10-11T12:00:00Z', latitude: 41 }],
        location,
        Date.parse('2026-10-11T13:00:00Z'),
      ),
    ).toBeNull();
    expect(distanceKm(station, location)).toBe(0);
  });
});
