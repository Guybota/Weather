import { useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  Droplets,
  LocateFixed,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Star,
  Sun,
  Wind,
  X,
  WifiOff,
  Waves,
  Gauge,
  Info,
} from 'lucide-react';
import { loadData } from './api';
import { DailyForecast, ForecastChart, SkyIllustration, WeatherIcon } from './components';
import {
  dateInZone,
  distanceKm,
  formatDay,
  formatTime,
  nearestObservation,
  numeric,
  parseForecast,
  parseLocations,
  parseObservations,
  parseWarnings,
  parseWeatherTypes,
  relevantWarnings,
  value,
  type Location,
  type Observation,
  type Period,
  type Warning,
  type WeatherType,
} from './weather';

function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(`tempo:${key}`) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`tempo:${key}`, JSON.stringify(value));
  } catch {
    /* Optional storage. */
  }
}
type Bundle = {
  id: number;
  forecast: Period[];
  warnings: Warning[];
  observations: Observation[];
  fetchedAt: string;
  stale: boolean;
  warningsUnknown: boolean;
  warningsStale: boolean;
  observationsStale: boolean;
};
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [types, setTypes] = useState<WeatherType[]>([]);
  const [locationId, setLocationId] = useState<number>(
    () => Number(stored('location', 1110600)) || 1110600,
  );
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = stored<unknown>('favorites', [1110600, 1131200, 1080500]);
    return Array.isArray(saved) ? saved.filter((id): id is number => typeof id === 'number') : [];
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    stored('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') ===
    'dark'
      ? 'dark'
      : 'light',
  );
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [day, setDay] = useState('');
  const [metric, setMetric] = useState<'temperature' | 'rain' | 'wind'>('temperature');
  const [selectedHour, setSelectedHour] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [locating, setLocating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save('theme', theme);
  }, [theme]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    const online = () => {
      setOnline(true);
      setRefresh((r) => r + 1);
    };
    const offline = () => setOnline(false);
    const install = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setInstallPrompt(null);
      setInstallHelp(false);
      setNotice('A app foi instalada.');
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installed);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    loadData('locations', controller.signal)
      .then((result) => {
        const locations = parseLocations(result.data);
        setLocations(locations);
        setLocationId((id) =>
          locations.some((l) => l.id === id)
            ? id
            : (locations.find((l) => l.id === 1110600)?.id ?? locations[0].id),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Não foi possível obter as localidades.',
          );
          setLoading(false);
        }
      });
    loadData('weather-types', controller.signal)
      .then((result) => setTypes(parseWeatherTypes(result.data)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [refresh]);
  const location = locations.find((l) => l.id === locationId);
  const timezone = location?.timezone ?? 'Europe/Lisbon';
  const today = dateInZone(now, timezone);
  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    save('location', location.id);
    setDay('');
    setSelectedHour(0);
    Promise.allSettled(
      ['forecast/' + location.id, 'warnings', 'observations'].map((path) =>
        loadData(path, controller.signal),
      ),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        const forecast = results[0];
        if (forecast.status !== 'fulfilled') throw forecast.reason;
        const parsedForecast = parseForecast(forecast.value.data);
        const hourlyToday = parsedForecast.filter(
          (p) =>
            p.interval !== 24 &&
            dateInZone(p.at, location.timezone) === dateInZone(Date.now(), location.timezone),
        );
        const closest = hourlyToday.reduce(
          (best, p, i) =>
            Math.abs(Date.parse(p.at) - Date.now()) <
            Math.abs(Date.parse(hourlyToday[best].at) - Date.now())
              ? i
              : best,
          0,
        );
        setSelectedHour(closest);
        let warnings: Warning[] = [],
          observations: Observation[] = [],
          warningsUnknown = true,
          warningsStale = false,
          observationsStale = false;
        if (results[1].status === 'fulfilled') {
          try {
            warnings = parseWarnings(results[1].value.data);
            warningsUnknown = false;
            warningsStale = results[1].value.stale;
          } catch {
            /* Keep warnings unknown, not all-clear. */
          }
        }
        if (results[2].status === 'fulfilled') {
          try {
            observations = parseObservations(results[2].value.data);
            observationsStale = results[2].value.stale;
          } catch {
            /* Fall back to forecast, labelled explicitly. */
          }
        }
        setBundle({
          id: location.id,
          forecast: parsedForecast,
          warnings,
          observations,
          fetchedAt: forecast.value.fetchedAt,
          stale: forecast.value.stale,
          warningsUnknown,
          warningsStale,
          observationsStale,
        });
        setNow(Date.now());
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Não foi possível obter a previsão.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [location?.id, refresh]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') setRefresh((r) => r + 1);
    }, 10 * 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);
  useEffect(() => {
    if (installHelp) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [installHelp]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const current = bundle?.id === locationId ? bundle : null;
  const descriptions = useMemo(() => new Map(types.map((t) => [t.id, t.description])), [types]);
  const daily = current?.forecast.filter((p) => p.interval === 24 && p.date >= today) ?? [];
  const selectedDate = daily.some((p) => p.date === day)
    ? day
    : (daily.find((p) => p.date === today)?.date ?? daily[0]?.date ?? today);
  const selectedDay = daily.find((p) => p.date === selectedDate);
  const todayForecast = daily.find((p) => p.date === today);
  const hourly = current?.forecast.filter((p) => p.interval !== 24) ?? [];
  const hoursForDay = hourly.filter((p) => dateInZone(p.at, timezone) === selectedDate);
  const nearestForecast = [...hourly]
    .filter((p) => Math.abs(Date.parse(p.at) - now) <= 3 * 3600000)
    .sort((a, b) => Math.abs(Date.parse(a.at) - now) - Math.abs(Date.parse(b.at) - now))[0];
  const observation =
    current && location ? nearestObservation(current.observations, location, now) : null;
  const warnings =
    current && location ? relevantWarnings(current.warnings, location.area, now) : [];
  const isFavorite = favorites.includes(locationId);
  const shownLocations = locations.filter((l) =>
    l.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(
        search
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
      ),
  );
  const currentTemperature = observation?.temperature ?? nearestForecast?.temperature;
  const updated = current?.forecast
    .map((p) => p.updated)
    .filter(Boolean)
    .sort()
    .at(-1);
  const oldForecast = !!updated && now - Date.parse(updated) > 18 * 3600000;
  const noForecastToday = !!current && !todayForecast;
  const hasStale = !!current && (current.stale || oldForecast || noForecastToday);
  const installed =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;

  function choose(id: number) {
    setLocationId(id);
    setShowSearch(false);
    setSearch('');
    setNotice('');
  }
  function toggleFavorite() {
    const next = isFavorite
      ? favorites.filter((id) => id !== locationId)
      : [...favorites, locationId];
    setFavorites(next);
    save('favorites', next);
  }
  function locate() {
    if (!navigator.geolocation) {
      setNotice('Este browser não disponibiliza localização. Pesquisa uma localidade.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const closest = [...locations].sort(
          (a, b) => distanceKm(a, point) - distanceKm(b, point),
        )[0];
        if (closest && distanceKm(closest, point) <= 100) {
          choose(closest.id);
          setNotice(`Previsão para ${closest.name}, a localidade disponível mais próxima.`);
        } else setNotice('A app cobre Portugal. Pesquisa uma localidade portuguesa.');
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNotice('Não foi possível obter a localização. Podes pesquisar uma localidade.');
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else setInstallHelp(true);
  }
  const selectDate = (date: string) => {
    setDay(date);
    setSelectedHour(0);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#today" className="brand" aria-label="Tempo, início">
          <span className="brand-mark">
            <Sun size={24} />
            <Waves size={24} />
          </span>
          <span>
            tempo<span className="brand-country">Portugal</span>
          </span>
        </a>
        <div className="sidebar-intro">
          <h2>
            O teu tempo,
            <br />
            mais perto.
          </h2>
          <p>
            Do primeiro raio de sol
            <br />à próxima mudança de planos.
          </p>
        </div>
        <button
          className="search-trigger"
          onClick={() => setShowSearch((s) => !s)}
          aria-expanded={showSearch}
        >
          <Search size={18} />
          <span>Pesquisar localidade</span>
          <ChevronDown size={14} />
        </button>
        {showSearch && (
          <div className="search-panel">
            <label className="sr-only" htmlFor="place-search">
              Pesquisar localidade
            </label>
            <input
              id="place-search"
              ref={searchRef}
              type="search"
              placeholder="Lisboa, Porto, Funchal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowSearch(false);
              }}
            />
            <div className="search-results">
              {shownLocations.slice(0, 30).map((l) => (
                <button key={l.id} onClick={() => choose(l.id)}>
                  <span>{l.name}</span>
                  {l.id === locationId && <Check size={15} />}
                </button>
              ))}
              {!shownLocations.length && <p>Nenhuma localidade encontrada.</p>}
            </div>
          </div>
        )}
        <button className="locate-button" onClick={locate} disabled={!locations.length || locating}>
          <LocateFixed size={16} />
          {locating ? 'A localizar…' : 'Usar a minha localização'}
        </button>
        <div className="favorites-heading">
          <h3>Os teus locais</h3>
          <span>{favorites.length}</span>
        </div>
        <nav className="favorites" aria-label="Localidades favoritas">
          {favorites
            .map((id) => locations.find((l) => l.id === id))
            .filter((l): l is Location => !!l)
            .map((l) => (
              <button
                key={l.id}
                className={l.id === locationId ? 'active' : ''}
                onClick={() => choose(l.id)}
                aria-pressed={l.id === locationId}
              >
                <MapPin size={17} />
                <span>{l.name}</span>
                {l.id === locationId && <span className="location-dot" />}
              </button>
            ))}
          {!favorites.length && <p className="secondary">Usa a estrela para guardar um local.</p>}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-label">
            <span className="source-dot" />
            <span>Dados oficiais do IPMA</span>
          </div>
          <p>
            Uma perspetiva mais clara
            <br />
            sobre o tempo em Portugal.
          </p>
          <a href="https://www.ipma.pt" target="_blank" rel="noreferrer">
            Visitar o IPMA <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>

      <main className="main-content" id="today">
        <header className="topbar">
          <div>
            <span className="today-date">
              {new Intl.DateTimeFormat('pt-PT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: timezone,
              }).format(now)}
            </span>
            <span className="topbar-caption">Um olhar sobre o dia</span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            >
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button
              className="icon-button"
              onClick={() => setRefresh((r) => r + 1)}
              disabled={loading || !online}
              aria-label="Atualizar dados"
            >
              <RefreshCw size={18} className={loading ? 'spinning' : ''} />
            </button>
            {!installed && (
              <button className="install-button" onClick={install} aria-label="Instalar app">
                <Download size={16} />
                <span>Instalar app</span>
              </button>
            )}
          </div>
        </header>
        {needRefresh && (
          <div className="notice-banner">
            <Info size={18} />
            <span>Está disponível uma nova versão.</span>
            <button onClick={() => updateServiceWorker(true)}>Atualizar app</button>
          </div>
        )}
        {!online && (
          <div className="notice-banner">
            <WifiOff size={18} />
            <span>Sem ligação. Os dados guardados podem estar desatualizados.</span>
          </div>
        )}
        {notice && (
          <div className="notice-banner" role="status">
            <Info size={18} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Fechar mensagem"
              onClick={() => setNotice('')}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button onClick={() => setRefresh((r) => r + 1)}>Tentar novamente</button>
          </div>
        )}
        {hasStale && (
          <div className="notice-banner">
            <AlertTriangle size={18} />
            <span>
              Estás a consultar a última previsão disponível.{' '}
              {updated
                ? `Atualizada em ${new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: timezone }).format(new Date(updated))}.`
                : ''}
            </span>
          </div>
        )}
        <div className="location-heading">
          <div>
            <span className="location-region">
              <MapPin size={14} />
              {location?.region === 3
                ? 'Açores'
                : location?.region === 2
                  ? 'Madeira'
                  : 'Portugal continental'}
            </span>
            <h1>{location?.name ?? 'O tempo em Portugal'}</h1>
          </div>
          <button
            className={`favorite-button ${isFavorite ? 'saved' : ''}`}
            onClick={toggleFavorite}
            disabled={!location}
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
            aria-pressed={isFavorite}
          >
            <Star size={21} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        {loading && !current ? (
          <div className="loading-panel" role="status">
            <Sun size={42} className="spinning" />
            <h2>A abrir uma janela para o tempo…</h2>
            <p>A obter a previsão do IPMA.</p>
          </div>
        ) : current ? (
          <>
            <section className="weather-hero" aria-label="Resumo do tempo">
              <div className="hero-reading">
                <span className="reading-label">
                  {observation ? 'Temperatura observada' : 'Temperatura prevista'}
                </span>
                <div className="hero-temperature">
                  {value(currentTemperature)}
                  <span>°</span>
                </div>
                <h2>
                  {descriptions.get(todayForecast?.weather ?? nearestForecast?.weather ?? 0) ??
                    'Previsão do dia'}
                </h2>
                <div className="hero-range">
                  <span>
                    Máx. <strong>{value(todayForecast?.max, '°')}</strong>
                  </span>
                  <span>
                    Mín. <strong>{value(todayForecast?.min, '°')}</strong>
                  </span>
                </div>
                <p className="observation-source">
                  {observation
                    ? `${observation.name}, a ${value(observation.distance, ' km')} · ${formatTime(observation.at, timezone)}${current.observationsStale ? ' · dados guardados' : ''}`
                    : nearestForecast
                      ? `Previsão para as ${formatTime(nearestForecast.at, timezone)}. Sem observação recente próxima.`
                      : 'Sem temperatura recente disponível.'}
                </p>
              </div>
              <div className="hero-art">
                <SkyIllustration code={todayForecast?.weather ?? 0} />
                <p>
                  {todayForecast?.rain !== null && todayForecast?.rain !== undefined
                    ? `${value(todayForecast.rain, '%')} de probabilidade de chuva hoje`
                    : 'Previsão diária do IPMA'}
                </p>
              </div>
            </section>
            <section className="metrics" aria-label="Indicadores de hoje">
              <div>
                <span>
                  <Wind size={17} />
                  Vento previsto
                </span>
                <strong>
                  {value(nearestForecast?.wind)}
                  <small> km/h</small>
                </strong>
                <p>
                  {nearestForecast?.direction || 'Sem informação'}
                  {nearestForecast ? ` · ${formatTime(nearestForecast.at, timezone)}` : ''}
                </p>
              </div>
              <div>
                <span>
                  <Droplets size={17} />
                  Humidade{' '}
                  {observation?.humidity !== null && observation?.humidity !== undefined
                    ? 'observada'
                    : 'prevista'}
                </span>
                <strong>
                  {value(observation?.humidity ?? nearestForecast?.humidity)}
                  <small> %</small>
                </strong>
                <p>
                  {observation?.humidity !== null && observation?.humidity !== undefined
                    ? `Às ${formatTime(observation.at, timezone)}`
                    : 'Para a localidade'}
                </p>
              </div>
              <div>
                <span>
                  <Sun size={17} />
                  Índice UV previsto
                </span>
                <strong>{value(todayForecast?.uv, '', 1)}</strong>
                <p>
                  {todayForecast?.uv === null || todayForecast?.uv === undefined
                    ? 'Sem informação'
                    : todayForecast.uv >= 11
                      ? 'Extremo'
                      : todayForecast.uv >= 8
                        ? 'Muito elevado'
                        : todayForecast.uv >= 6
                          ? 'Elevado'
                          : todayForecast.uv >= 3
                            ? 'Moderado'
                            : 'Baixo'}
                </p>
              </div>
              <div>
                <span>
                  <Gauge size={17} />
                  Pressão observada
                </span>
                <strong>
                  {value(observation?.pressure)}
                  <small> hPa</small>
                </strong>
                <p>
                  {observation?.pressure !== null && observation?.pressure !== undefined
                    ? `Às ${formatTime(observation.at, timezone)}`
                    : 'Sem observação disponível'}
                </p>
              </div>
            </section>
            <section
              className={`warnings-section ${warnings.length ? 'has-warnings' : ''}`}
              aria-label="Avisos meteorológicos"
            >
              <div className="warnings-header">
                <span className="warning-status-icon">
                  {current.warningsUnknown || current.warningsStale || warnings.length ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                </span>
                <div>
                  <h2>
                    {current.warningsUnknown
                      ? 'Avisos indisponíveis'
                      : current.warningsStale
                        ? 'Avisos guardados — confirmar atualização'
                        : warnings.length
                          ? `${warnings.length} aviso${warnings.length === 1 ? '' : 's'} para a região`
                          : 'Sem avisos em vigor ou previstos'}
                  </h2>
                  <p>
                    {current.warningsUnknown || current.warningsStale
                      ? 'Não foi possível confirmar os avisos atuais. Consulta o IPMA.'
                      : 'Avisos oficiais para a região da localidade selecionada.'}
                  </p>
                </div>
                <a
                  href="https://www.ipma.pt/pt/otempo/prev-sam/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Consultar avisos no IPMA"
                >
                  <ArrowUpRight size={19} />
                </a>
              </div>
              {warnings.map((w) => (
                <article
                  className={`warning-item warning-${w.level}`}
                  key={`${w.type}-${w.start}-${w.end}`}
                >
                  <div>
                    <span className="warning-level">
                      {w.level === 'red'
                        ? 'Vermelho'
                        : w.level === 'orange'
                          ? 'Laranja'
                          : 'Amarelo'}
                    </span>
                    <strong>{w.type}</strong>
                    <span className="warning-when">
                      {Date.parse(w.start) > now ? 'Previsto' : 'Em vigor'} ·{' '}
                      {new Intl.DateTimeFormat('pt-PT', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: timezone,
                      }).format(new Date(w.start))}{' '}
                      até{' '}
                      {new Intl.DateTimeFormat('pt-PT', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: timezone,
                      }).format(new Date(w.end))}
                    </span>
                  </div>
                  <p>{w.text}</p>
                </article>
              ))}
            </section>
            <div className="forecast-layout">
              <section className="hourly-panel" id="forecast">
                <div className="section-heading">
                  <div>
                    <h2>O dia, hora a hora</h2>
                    <p>
                      {selectedDate === today
                        ? 'Hoje'
                        : formatDay(selectedDate, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                    </p>
                  </div>
                  <label className="day-select">
                    <span className="sr-only">Dia do gráfico</span>
                    <select value={selectedDate} onChange={(e) => selectDate(e.target.value)}>
                      {daily.map((p) => (
                        <option key={p.date} value={p.date}>
                          {p.date === today
                            ? 'Hoje'
                            : formatDay(p.date, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <ForecastChart
                  periods={hoursForDay}
                  timezone={timezone}
                  metric={metric}
                  onMetric={setMetric}
                  selected={selectedHour}
                  onSelect={setSelectedHour}
                />
                {selectedDay && (
                  <div className="selected-day-summary">
                    <span>
                      Mínima <strong>{value(selectedDay.min, '°')}</strong>
                    </span>
                    <span>
                      Máxima <strong>{value(selectedDay.max, '°')}</strong>
                    </span>
                    <span>
                      Chuva <strong>{value(selectedDay.rain, '%')}</strong>
                    </span>
                  </div>
                )}
              </section>
              <section className="daily-panel">
                <div className="section-heading">
                  <div>
                    <h2>Próximos {daily.length} dias</h2>
                    <p>Uma perspetiva para os teus planos</p>
                  </div>
                </div>
                <DailyForecast
                  periods={daily}
                  timezone={timezone}
                  today={today}
                  selectedDate={selectedDate}
                  onSelect={selectDate}
                  descriptions={descriptions}
                />
                <p className="daily-caption">
                  Temperaturas mínima e máxima (°C). Chuva: probabilidade diária (%).
                </p>
              </section>
            </div>
            <footer className="app-footer">
              <div>
                <span className="source-dot" />
                Fonte:{' '}
                <a
                  className="ipma-source"
                  href="https://www.ipma.pt"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src="/ipma.svg" alt="IPMA, I.P." width="95" height="22" />
                </a>
                {updated && <span>Previsão atualizada às {formatTime(updated, timezone)}</span>}
              </div>
              <span>
                Horas locais{' '}
                {timezone === 'Atlantic/Azores'
                  ? 'dos Açores'
                  : 'de Portugal continental e Madeira'}
                .
              </span>
              <p>
                Aplicação independente. Previsões sujeitas a alteração. Detalhe horário e
                disponibilidade dos parâmetros variam com o horizonte.
              </p>
            </footer>
          </>
        ) : !loading && !error ? (
          <p>Pesquisa uma localidade para consultar a previsão.</p>
        ) : null}
      </main>
      <dialog
        ref={dialogRef}
        onCancel={() => setInstallHelp(false)}
        onClose={() => setInstallHelp(false)}
        className="install-dialog"
      >
        <button
          className="icon-button dialog-close"
          onClick={() => setInstallHelp(false)}
          aria-label="Fechar instruções"
        >
          <X size={19} />
        </button>
        <Download size={32} />
        <h2>O tempo no teu ecrã principal</h2>
        <p>
          <strong>No iPhone:</strong> abre esta página no Safari, toca em Partilhar e escolhe
          “Adicionar ao ecrã principal”. Ativa “Abrir como app web”, se disponível.
        </p>
        <p>
          <strong>No Android:</strong> abre o menu do Chrome e escolhe “Instalar aplicação” ou
          “Adicionar ao ecrã principal”.
        </p>
        <p className="secondary">
          A instalação fica disponível quando visitas a app publicada, num browser compatível.
        </p>
        <button className="primary-button" onClick={() => setInstallHelp(false)}>
          Entendido
        </button>
      </dialog>
    </div>
  );
}
