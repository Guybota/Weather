import { Sun, Sunrise, Sunset, Wind, Droplets } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { dateInZone, formatDay, formatTime, value, type Period } from './weather';
import { localHour } from './experience';
import { t, language } from './i18n';
import type { SolarEvent } from './solar';

export function WeatherIcon({
  code,
  size = 28,
  className = '',
  night = false,
}: {
  code: number;
  size?: number;
  className?: string;
  night?: boolean;
}) {
  // Filled, multicolour glyphs so conditions read at a glance; colours live in styles.css.
  const clear = code === 1,
    partly = [2, 3, 5, 25].includes(code),
    fog = [16, 17, 26].includes(code),
    snow = [18, 21, 22, 28, 29, 30].includes(code),
    thunder = [19, 20, 23].includes(code),
    rain = code >= 6 && code <= 15;
  const cloudY = fog || snow || thunder || rain ? 0.5 : partly ? 5.5 : 3.3;
  return (
    <svg
      className={`weather-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {(clear || partly) && (
        <g
          className={night ? 'icon-moon' : 'icon-sun'}
          transform={partly ? 'translate(9.5 0.5) scale(0.6)' : undefined}
        >
          {night ? (
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4.6" />
              <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
            </>
          )}
        </g>
      )}
      {!clear && (
        <path
          className="icon-cloud"
          transform={`translate(-1.6 ${cloudY}) scale(0.085)`}
          d="M101 152c-27 0-47-18-47-41 0-23 19-40 42-40 7 0 13 1 19 4a55 55 0 0 1 106 23c25-2 44 9 44 29 0 15-12 25-31 25Z"
        />
      )}
      {rain && <path className="icon-rain" d="M8 16.5l-1.2 3M12.5 16.5l-1.2 3M17 16.5l-1.2 3" />}
      {snow && (
        <g className="icon-snow">
          <circle cx="7.5" cy="18" r="1.1" />
          <circle cx="12" cy="19.5" r="1.1" />
          <circle cx="16.5" cy="18" r="1.1" />
        </g>
      )}
      {thunder && <path className="icon-bolt" d="M12.5 14l-3 4.5h2.6l-1.2 4 4.2-5.5h-2.7l1.3-3Z" />}
      {fog && <path className="icon-fog" d="M5 17h14M7 20h12" />}
    </svg>
  );
}

export function SkyIllustration({ code, night = false }: { code: number; night?: boolean }) {
  const rain = (code >= 6 && code <= 15) || [19, 20, 23].includes(code);
  const celestial = [1, 2, 3, 5, 25].includes(code);
  return (
    <svg viewBox="0 0 340 230" className="sky-illustration" aria-hidden="true">
      <path d="M28 164h280M66 189h212M104 214h136" className="sky-horizon" />
      {celestial &&
        (night ? (
          <path d="M239 36a39 39 0 1 0 20 66 37 37 0 0 1-20-66Z" className="sky-moon" />
        ) : (
          <circle cx="222" cy="73" r="39" className="sky-sun" />
        ))}
      {celestial && !night && !rain && (
        <g className="sky-rays">
          <path d="M222 14v-9M222 133v9M163 73h-9M281 73h9M180 31l-7-7M264 115l7 7M264 31l7-7M180 115l-7 7" />
        </g>
      )}
      {code !== 1 && (
        <path
          d="M101 152c-27 0-47-18-47-41 0-23 19-40 42-40 7 0 13 1 19 4a55 55 0 0 1 106 23c25-2 44 9 44 29 0 15-12 25-31 25Z"
          className="sky-cloud"
        />
      )}
      {rain && (
        <g className="sky-rain">
          <path d="m113 169-8 14m48-14-8 14m48-14-8 14m48-14-8 14" />
        </g>
      )}
      {[18, 21, 22, 28, 29, 30].includes(code) && (
        <g className="sky-snow">
          <circle cx="112" cy="179" r="4" />
          <circle cx="151" cy="193" r="4" />
          <circle cx="191" cy="174" r="4" />
          <circle cx="229" cy="191" r="4" />
        </g>
      )}
      {[19, 20, 23].includes(code) && (
        <path d="m177 150-15 28h19l-11 29 34-42h-21l9-15Z" className="sky-lightning" />
      )}
      {[16, 17, 26].includes(code) && (
        <g className="sky-fog">
          <path d="M72 163h181M95 179h178" />
        </g>
      )}
    </svg>
  );
}

export function ForecastChart({
  periods,
  timezone,
  metric,
  onMetric,
  selected,
  onSelect,
  now,
  source = 'IPMA',
  solar = [],
}: {
  periods: Period[];
  timezone: string;
  source?: string;
  solar?: SolarEvent[];
  metric: 'temperature' | 'rain' | 'wind';
  onMetric: (metric: 'temperature' | 'rain' | 'wind') => void;
  selected: number;
  onSelect: (index: number) => void;
  now: number;
}) {
  const metricInfo = {
    temperature: { label: 'Temperatura', unit: '°C', icon: Sun },
    rain: { label: 'Chuva', unit: '%', icon: Droplets },
    wind: { label: 'Vento', unit: 'km/h', icon: Wind },
  };
  const info = metricInfo[metric];
  const rainGradientId = useId();
  const description =
    language() === 'en'
      ? `${t(info.label)} forecast`
      : `${info.label} ${metric === 'wind' ? 'previsto' : 'prevista'}`;
  const values = periods.map((p) => p[metric]);
  const valid = values.filter((n): n is number => n !== null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, entries[0].contentRect.width)),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const start = periods.length ? Date.parse(periods[0].at) : 0;
  const end = periods.length ? Date.parse(periods[periods.length - 1].at) : start + 1;
  const hasNow = periods.length > 1 && now >= start && now <= end;
  // A negative selection follows the current time, between two forecast records.
  const live = selected < 0 && hasNow;
  const index =
    selected < 0
      ? periods.reduce(
          (best, p, i) =>
            Math.abs(Date.parse(p.at) - now) < Math.abs(Date.parse(periods[best].at) - now)
              ? i
              : best,
          0,
        )
      : Math.min(selected, Math.max(0, periods.length - 1));
  const before = periods.filter((p) => Date.parse(p.at) <= now).length - 1;
  const entries = [
    ...periods.map((period, index) => ({
      kind: 'forecast' as const,
      at: period.at,
      period,
      index,
    })),
    ...solar,
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  useEffect(() => {
    const strip = stripRef.current,
      button = strip?.querySelector<HTMLElement>(`[data-forecast-index="${index}"]`);
    if (strip && button)
      strip.scrollLeft =
        button.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + button.clientWidth / 2;
  }, [index, periods, solar]);
  const height = 190,
    left = 34,
    right = 20,
    top = 18,
    bottom = 32;
  const low =
    metric === 'rain'
      ? 0
      : Math.floor(Math.min(...valid, 0 === valid.length ? 0 : Infinity) / 5) * 5;
  const high =
    metric === 'rain' ? 100 : Math.max(low + 5, Math.ceil(Math.max(...valid, 5) / 5) * 5);
  const x = (i: number) =>
    left +
    ((Date.parse(periods[i].at) - start) / Math.max(1, end - start)) * (width - left - right);
  const y = (n: number) => top + ((high - n) / (high - low)) * (height - top - bottom);
  const rainPoints = values.flatMap((n, i) => (n === null ? [] : [{ i, n, x: x(i), y: y(n) }]));
  const rainLinks = rainPoints.slice(1).map((point, i) => {
    const previous = rainPoints[i];
    const gap =
      point.i !== previous.i + 1 ||
      Date.parse(periods[point.i].at) - Date.parse(periods[previous.i].at) >
        Math.max(periods[point.i].interval, periods[previous.i].interval) * 3_600_000 + 1000;
    return { previous, point, gap };
  });
  let path = '',
    connected = false;
  values.forEach((n, i) => {
    if (n === null) {
      connected = false;
      return;
    }
    path += `${connected ? 'L' : 'M'}${x(i)},${y(n)} `;
    connected = true;
  });
  const chosen = periods[index];
  const nowX = left + ((now - start) / Math.max(1, end - start)) * (width - left - right);
  const cursorX = live ? nowX : periods.length ? x(index) : 0;
  // Live readings are linear between the two surrounding records; a missing side stays missing.
  const reading = (key: 'temperature' | 'rain' | 'wind') => {
    if (!live) return chosen?.[key] ?? null;
    const a = periods[before],
      b = periods[before + 1];
    if (!b) return a[key];
    if (a[key] === null || b[key] === null) return null;
    const from = Date.parse(a.at);
    return a[key] + ((b[key] - a[key]) * (now - from)) / (Date.parse(b.at) - from);
  };
  const pointAt = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const position = ((clientX - rect.left) / rect.width) * width;
    const target =
      start + Math.max(0, Math.min(1, (position - left) / (width - left - right))) * (end - start);
    const closest = periods.reduce(
      (best, p, i) =>
        Math.abs(Date.parse(p.at) - target) < Math.abs(Date.parse(periods[best].at) - target)
          ? i
          : best,
      0,
    );
    const pick =
      hasNow && Math.abs(now - target) < Math.abs(Date.parse(periods[closest].at) - target)
        ? -1
        : closest;
    if (pick !== selected) navigator.vibrate?.(5);
    onSelect(pick);
  };
  return (
    <div ref={containerRef}>
      <div className="chart-toolbar">
        <div className="segmented" aria-label={t('Métrica do gráfico')}>
          {(Object.keys(metricInfo) as Array<keyof typeof metricInfo>).map((key) => {
            const Icon = metricInfo[key].icon;
            return (
              <button key={key} aria-pressed={metric === key} onClick={() => onMetric(key)}>
                <Icon size={15} />
                <span>{t(metricInfo[key].label)}</span>
              </button>
            );
          })}
        </div>
        <span className="chart-unit">{info.unit}</span>
      </div>
      {periods.length && valid.length ? (
        <>
          <div className="chart-summary" aria-live="polite">
            <strong>{live ? t('Agora') : chosen ? formatTime(chosen.at, timezone) : '—'}</strong>
            <span>{value(reading(metric), ` ${info.unit}`, 1)}</span>
            <span className="secondary">
              {t(
                live
                  ? 'Estimativa entre previsões'
                  : chosen?.interval === 3
                    ? 'Intervalo de 3 horas'
                    : 'Previsão horária',
              )}
            </span>
          </div>
          <div
            className="interactive-chart"
            role="slider"
            tabIndex={0}
            aria-label={t('Hora da previsão')}
            aria-valuemin={0}
            aria-valuemax={periods.length - 1}
            aria-valuenow={index}
            aria-valuetext={`${live ? t('Agora') : formatTime(chosen.at, timezone)}. ${t('Temperatura')} ${value(reading('temperature'), '°')}, ${t('Probabilidade de chuva')} ${value(reading('rain'), '%')}, ${t('Vento')} ${value(reading('wind'), ' km/h')}.`}
            onKeyDown={(e) => {
              const next =
                e.key === 'ArrowRight' || e.key === 'ArrowUp'
                  ? Math.min(periods.length - 1, live ? before + 1 : index + 1)
                  : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
                    ? Math.max(0, live ? before : index - 1)
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? periods.length - 1
                        : null;
              if (next !== null) {
                e.preventDefault();
                onSelect(next);
              }
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              pointAt(e.clientX, e.currentTarget);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                pointAt(e.clientX, e.currentTarget);
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          >
            <svg
              className="forecast-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${metric === 'rain' ? t('Probabilidade de chuva') : description} (${info.unit}). ${t('Ao longo do dia')}.`}
            >
              {metric === 'rain' && (
                <defs>
                  <linearGradient id={rainGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.36" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.025" />
                  </linearGradient>
                </defs>
              )}
              {hasNow && (
                <rect
                  x={left}
                  y={top}
                  width={Math.max(0, nowX - left)}
                  height={height - top - bottom}
                  className="chart-past"
                />
              )}
              {[0, 1, 2].map((i) => {
                const n = low + ((high - low) * i) / 2;
                return (
                  <g key={i}>
                    <path d={`M${left} ${y(n)}H${width - right}`} className="chart-grid" />
                    <text x={left - 12} y={y(n) + 4} textAnchor="end">
                      {value(n)}
                    </text>
                  </g>
                );
              })}
              {metric === 'rain' ? (
                <g className="rain-series">
                  {rainLinks.map(({ previous: a, point: b, gap }) => (
                    <path
                      key={`area-${b.i}`}
                      d={`M${a.x},${a.y}L${b.x},${b.y}L${b.x},${y(0)}L${a.x},${y(0)}Z`}
                      fill={`url(#${rainGradientId})`}
                      opacity={gap ? 0.45 : 1}
                    />
                  ))}
                  {rainLinks.map(({ previous: a, point: b, gap }) => (
                    <path
                      key={`line-${b.i}`}
                      d={`M${a.x},${a.y}L${b.x},${b.y}`}
                      className={`chart-line rain-link ${gap ? 'rain-link-gap' : ''}`}
                    />
                  ))}
                  {rainPoints.map((point) => (
                    <circle
                      key={point.i}
                      cx={point.x}
                      cy={point.y}
                      r="3.3"
                      className="rain-sample"
                      data-time={periods[point.i].at}
                      data-probability={point.n}
                    />
                  ))}
                </g>
              ) : (
                <path key={metric} d={path} pathLength={1} className="chart-line" />
              )}
              {hasNow && (
                <g>
                  <path d={`M${nowX} ${top}V${height - bottom}`} className="chart-now" />
                  <text
                    x={Math.min(width - right - 20, Math.max(left + 20, nowX))}
                    y={12}
                    textAnchor="middle"
                    className="chart-now-label"
                  >
                    {t('Agora')}
                  </text>
                </g>
              )}
              {chosen && (
                <>
                  <path d={`M${cursorX} ${top}V${height - bottom}`} className="chart-cursor" />
                  {reading(metric) !== null && (
                    <circle cx={cursorX} cy={y(reading(metric)!)} r="5" className="chart-dot" />
                  )}
                </>
              )}
              {periods.map((p, i) => {
                const last = periods.length - 1,
                  step = Math.max(
                    1,
                    Math.ceil(periods.length / Math.max(2, Math.floor(width / 80))),
                  );
                return (
                  (i === last || (i % step === 0 && last - i >= step / 2)) && (
                    <text key={p.at} x={x(i)} y={height - 8} textAnchor="middle">
                      {formatTime(p.at, timezone)}
                    </text>
                  )
                );
              })}
            </svg>
          </div>
          {metric === 'rain' && (
            <div className="rain-chart-legend">
              <span>
                <i className="rain-legend-point" />
                {t('Probabilidade de chuva')}
              </span>
              {rainLinks.some((link) => link.gap) && (
                <span>
                  <i className="rain-legend-gap" />
                  {t('Sem dados entre pontos')}
                </span>
              )}
            </div>
          )}
          <div className="hour-details" aria-live="polite">
            <span>
              {t('Temperatura')}
              <strong>{value(reading('temperature'), '°', 1)}</strong>
            </span>
            <span>
              {t('Chuva')}
              <strong>{value(reading('rain'), '%')}</strong>
            </span>
            <span>
              {t('Vento')}
              <strong>{value(reading('wind'), ' km/h')}</strong>
            </span>
          </div>
        </>
      ) : (
        <div className="section-empty">
          {t(
            periods.length
              ? 'Este parâmetro não está disponível para o dia selecionado.'
              : 'O IPMA disponibiliza apenas previsão diária para este dia. Consulta o resumo diário.',
          ).replaceAll('IPMA', source)}
        </div>
      )}
      {entries.length > 0 && (
        <div ref={stripRef} className="hour-strip" aria-label={t('Selecionar hora')}>
          {entries.map((entry) => {
            if (entry.kind !== 'forecast') {
              const label = t(entry.kind === 'sunrise' ? 'Nascer do sol' : 'Pôr do sol');
              const Icon = entry.kind === 'sunrise' ? Sunrise : Sunset;
              return (
                <div
                  key={entry.kind + entry.at}
                  className="hour-solar"
                  role="group"
                  aria-label={`${label}, ${formatTime(entry.at, timezone)}`}
                >
                  <time dateTime={entry.at}>{formatTime(entry.at, timezone)}</time>
                  <Icon size={23} aria-hidden="true" />
                  <strong>{label}</strong>
                </div>
              );
            }
            const { period: p, index: i } = entry;
            return (
              <button
                key={p.at}
                data-forecast-index={i}
                aria-pressed={!live && index === i}
                onClick={() => onSelect(i)}
              >
                <span>{formatTime(p.at, timezone)}</span>
                <WeatherIcon
                  code={p.weather}
                  size={23}
                  night={localHour(p.at, timezone) < 7 || localHour(p.at, timezone) >= 20}
                />
                <strong>{value(p.temperature, '°')}</strong>
                <span className="hour-rain">
                  <Droplets size={11} />
                  {value(p.rain, '%')}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {periods.length > 0 && valid.length > 0 && (
        <p className="chart-caption">
          {t(
            metric === 'rain'
              ? 'Pontos: valores do IPMA. Tracejado: horas sem valor. Toca ou arrasta para consultar; “—” significa sem dados.'
              : 'Toca ou arrasta no gráfico. As setas do teclado também mudam a hora. “—” indica um valor não fornecido pelo IPMA.',
          ).replaceAll('IPMA', source)}
        </p>
      )}
    </div>
  );
}

export function DailyForecast({
  periods,
  today,
  selectedDate,
  onSelect,
  descriptions,
}: {
  periods: Period[];
  today: string;
  selectedDate: string;
  onSelect: (date: string) => void;
  descriptions: Map<number, string>;
}) {
  const minima = periods.flatMap((p) => (p.min === null ? [] : [p.min]));
  const maxima = periods.flatMap((p) => (p.max === null ? [] : [p.max]));
  const low = Math.min(...minima, 0 === minima.length ? 0 : Infinity);
  const high = Math.max(...maxima, low + 1);
  return (
    <div className="daily-list">
      {periods.map((p) => (
        <button
          key={p.date}
          className="daily-row"
          aria-pressed={selectedDate === p.date}
          aria-haspopup="dialog"
          onClick={() => onSelect(p.date)}
          aria-label={`${p.date === today ? t('Hoje') : formatDay(p.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${descriptions.get(p.weather) ?? t('Previsão do dia')}, ${t('Mínima')} ${value(p.min, '°')}, ${t('Máxima')} ${value(p.max, '°')}, ${t('Chuva')} ${value(p.rain, '%')}`}
        >
          <span className="daily-day">
            <strong>{p.date === today ? t('Hoje') : formatDay(p.date)}</strong>
            <span>{formatDay(p.date, { day: 'numeric', month: 'short' })}</span>
          </span>
          <WeatherIcon code={p.weather} size={24} />
          <span className="daily-rain">
            <Droplets size={12} />
            {value(p.rain, '%')}
          </span>
          <span className="daily-min">{value(p.min, '°')}</span>
          <span className="temperature-track">
            {p.min !== null && p.max !== null && (
              <span
                style={{
                  left: `${((p.min - low) / (high - low)) * 100}%`,
                  width: `${Math.max(3, ((p.max - p.min) / (high - low)) * 100)}%`,
                }}
              />
            )}
          </span>
          <strong className="daily-max">{value(p.max, '°')}</strong>
        </button>
      ))}
    </div>
  );
}
