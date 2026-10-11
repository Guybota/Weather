import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
  Droplets,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dateInZone, formatDay, formatTime, value, type Period } from './weather';

export function WeatherIcon({
  code,
  size = 28,
  className = '',
}: {
  code: number;
  size?: number;
  className?: string;
}) {
  const Icon =
    code === 1
      ? Sun
      : [2, 3, 5, 25].includes(code)
        ? CloudSun
        : [16, 17, 26].includes(code)
          ? CloudFog
          : [18, 21, 22, 28, 29, 30].includes(code)
            ? CloudSnow
            : [19, 20, 23].includes(code)
              ? CloudLightning
              : code >= 6 && code <= 15
                ? CloudRain
                : Cloud;
  return (
    <Icon
      className={`weather-icon ${className}`}
      size={size}
      strokeWidth={1.6}
      aria-hidden="true"
    />
  );
}

export function SkyIllustration({ code }: { code: number }) {
  const rain = (code >= 6 && code <= 15) || [19, 20, 23].includes(code);
  return (
    <svg viewBox="0 0 340 230" className="sky-illustration" aria-hidden="true">
      <path d="M28 164h280M66 189h212M104 214h136" className="sky-horizon" />
      <circle cx="222" cy="73" r="39" className="sky-sun" />
      <g className="sky-rays">
        <path d="M222 14v-9M222 133v9M163 73h-9M281 73h9M180 31l-7-7M264 115l7 7M264 31l7-7M180 115l-7 7" />
      </g>
      <path
        d="M101 152c-27 0-47-18-47-41 0-23 19-40 42-40 7 0 13 1 19 4a55 55 0 0 1 106 23c25-2 44 9 44 29 0 15-12 25-31 25Z"
        className="sky-cloud"
      />
      {rain && (
        <g className="sky-rain">
          <path d="m113 169-8 14m48-14-8 14m48-14-8 14m48-14-8 14" />
        </g>
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
}: {
  periods: Period[];
  timezone: string;
  metric: 'temperature' | 'rain' | 'wind';
  onMetric: (metric: 'temperature' | 'rain' | 'wind') => void;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const metricInfo = {
    temperature: { label: 'Temperatura', unit: '°C', icon: Sun },
    rain: { label: 'Chuva', unit: '%', icon: Droplets },
    wind: { label: 'Vento', unit: 'km/h', icon: Wind },
  };
  const info = metricInfo[metric];
  const description = `${info.label} ${metric === 'wind' ? 'previsto' : 'prevista'}`;
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
  useEffect(() => {
    const strip = stripRef.current,
      button = strip?.children[selected] as HTMLElement | undefined;
    if (strip && button)
      strip.scrollLeft =
        button.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + button.clientWidth / 2;
  }, [selected, periods]);
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
  const start = periods.length ? Date.parse(periods[0].at) : 0;
  const end = periods.length ? Date.parse(periods[periods.length - 1].at) : start + 1;
  const x = (i: number) =>
    left +
    ((Date.parse(periods[i].at) - start) / Math.max(1, end - start)) * (width - left - right);
  const y = (n: number) => top + ((high - n) / (high - low)) * (height - top - bottom);
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
  const chosen = periods[Math.min(selected, Math.max(0, periods.length - 1))];
  return (
    <div ref={containerRef}>
      <div className="chart-toolbar">
        <div className="segmented" aria-label="Métrica do gráfico">
          {(Object.keys(metricInfo) as Array<keyof typeof metricInfo>).map((key) => {
            const Icon = metricInfo[key].icon;
            return (
              <button key={key} aria-pressed={metric === key} onClick={() => onMetric(key)}>
                <Icon size={15} />
                <span>{metricInfo[key].label}</span>
              </button>
            );
          })}
        </div>
        <span className="chart-unit">{info.unit}</span>
      </div>
      {periods.length && valid.length ? (
        <>
          <div className="chart-summary" aria-live="polite">
            <strong>{chosen ? formatTime(chosen.at, timezone) : '—'}</strong>
            <span>{chosen ? value(chosen[metric], ` ${info.unit}`, 1) : '—'}</span>
            <span className="secondary">
              {chosen?.interval === 3 ? 'Intervalo de 3 horas' : 'Previsão horária'}
            </span>
          </div>
          <div>
            <svg
              className="forecast-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${description} em ${info.unit}, ao longo do dia. Seleciona uma hora na lista abaixo para consultar os valores.`}
            >
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
                values.map(
                  (n, i) =>
                    n !== null && (
                      <rect
                        key={i}
                        x={x(i) - 5}
                        y={y(n)}
                        width="10"
                        height={Math.max(1, y(0) - y(n))}
                        rx="3"
                        className="chart-bar"
                      />
                    ),
                )
              ) : (
                <path d={path} className="chart-line" />
              )}
              {chosen && chosen[metric] !== null && (
                <>
                  <path
                    d={`M${x(Math.min(selected, periods.length - 1))} ${top}V${height - bottom}`}
                    className="chart-cursor"
                  />
                  <circle
                    cx={x(Math.min(selected, periods.length - 1))}
                    cy={y(chosen[metric]!)}
                    r="5"
                    className="chart-dot"
                  />
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
          <div ref={stripRef} className="hour-strip" aria-label="Selecionar hora">
            {periods.map((p, i) => (
              <button key={p.at} aria-pressed={selected === i} onClick={() => onSelect(i)}>
                <span>{formatTime(p.at, timezone)}</span>
                <WeatherIcon code={p.weather} size={23} />
                <strong>{value(p.temperature, '°')}</strong>
                <span className="hour-rain">
                  <Droplets size={11} />
                  {value(p.rain, '%')}
                </span>
              </button>
            ))}
          </div>
          <p className="chart-caption">
            {description} ({info.unit}) por hora local. IPMA. Pontos em falta são apresentados como
            “—”.
          </p>
        </>
      ) : (
        <div className="section-empty">
          {periods.length
            ? 'Este parâmetro não está disponível para o dia selecionado.'
            : 'O IPMA disponibiliza apenas previsão diária para este dia. Consulta os valores abaixo.'}
        </div>
      )}
    </div>
  );
}

export function DailyForecast({
  periods,
  timezone,
  today,
  selectedDate,
  onSelect,
  descriptions,
}: {
  periods: Period[];
  timezone: string;
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
          onClick={() => onSelect(p.date)}
          aria-label={`${p.date === today ? 'Hoje' : formatDay(p.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${descriptions.get(p.weather) ?? 'Previsão'}, mínima ${value(p.min)} graus, máxima ${value(p.max)} graus, chuva ${value(p.rain, '%')}`}
        >
          <span className="daily-day">
            <strong>{p.date === today ? 'Hoje' : formatDay(p.date)}</strong>
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
