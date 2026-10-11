import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  House,
  Download,
  Droplets,
  LocateFixed,
  MapPin,
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
  Settings2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  CalendarDays,
} from 'lucide-react';
import { loadData } from './api';
import { DailyForecast, ForecastChart, SkyIllustration, WeatherIcon } from './components';
import { Sheet, FavoritePlaces, Compass, type Preview } from './ExperienceUI';
import { WeatherBackdrop } from './WeatherBackdrop';
import { usePageBounce } from './usePageBounce';
import { useLocationSwipe } from './useLocationSwipe';
import {
  dayInsight,
  localHour,
  uvLabel,
  validIndicators,
  indicatorNames,
  defaultIndicators,
  type Indicator,
} from './experience';
import { t, language, locale } from './i18n';
import {
  dateInZone,
  distanceKm,
  formatDay,
  formatTime,
  nearestObservation,
  parseForecast,
  parseOpenMeteo,
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
// Animates list reorders where the View Transitions API exists; a plain update elsewhere.
function reorder(update: () => void) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    document.startViewTransition(() => flushSync(update));
  else update();
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
type ForecastPreview = Preview & { fetchedAt: string };

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
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [systemLanguage, setSystemLanguage] = useState(language);
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
  // -1 follows the current time; other values index the selected day's periods.
  const [selectedHour, setSelectedHour] = useState(-1);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [sheet, setSheet] = useState<'day' | 'places' | 'settings' | Indicator | null>(null);
  const [previews, setPreviews] = useState<Record<number, ForecastPreview>>({});
  const [indicators, setIndicators] = useState<Indicator[]>(() =>
    validIndicators(stored('indicators', defaultIndicators)),
  );
  const [online, setOnline] = useState(navigator.onLine);
  const [locating, setLocating] = useState(false);
  const [provider, setProvider] = useState<'ipma' | 'open-meteo'>(() =>
    stored<string>('provider', 'ipma') === 'open-meteo' ? 'open-meteo' : 'ipma',
  );
  // Only the forecast changes with the provider; warnings, observations and places stay with IPMA.
  const source = provider === 'ipma' ? 'IPMA' : 'Open-Meteo';
  const forecastPath = (l: Location) =>
    provider === 'ipma'
      ? 'forecast/' + l.id
      : `open-meteo/${l.latitude.toFixed(2)},${l.longitude.toFixed(2)}`;
  const readForecast = (data: unknown, l: Location) =>
    provider === 'ipma' ? parseForecast(data) : parseOpenMeteo(data, l.timezone);
  function changeProvider(next: typeof provider) {
    save('provider', next);
    setBundle(null);
    setPreviews({});
    setProvider(next);
  }
  const searchRef = useRef<HTMLInputElement>(null);
  const pullRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const swipePreviewRef = useRef<HTMLElement>(null);
  const [swipePreviewId, setSwipePreviewId] = useState<number | null>(null);
  usePageBounce(mainRef, pullRef, showSearch || sheet !== null || installHelp, () =>
    setRefresh((r) => r + 1),
  );
  const pages = useRef({ ids: [] as number[], id: 0 });
  const slideTo = useLocationSwipe(
    mainRef,
    pages,
    showSearch || sheet !== null || installHelp,
    choose,
    (id) => {
      if (id === null) setSwipePreviewId(null);
      else flushSync(() => setSwipePreviewId(id));
      return id === null ? null : swipePreviewRef.current;
    },
  );
  const loadedLocation = useRef<number | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const preference = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setTheme(preference.matches ? 'dark' : 'light');
    const changeLanguage = () => setSystemLanguage(language());
    preference.addEventListener('change', change);
    window.addEventListener('languagechange', changeLanguage);
    return () => {
      preference.removeEventListener('change', change);
      window.removeEventListener('languagechange', changeLanguage);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = systemLanguage;
    document.title =
      systemLanguage === 'pt' ? 'Tempo — Meteorologia em Portugal' : 'Tempo — Weather in Portugal';
  }, [systemLanguage]);
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
    const changingLocation = loadedLocation.current !== location.id;
    if (changingLocation) {
      setDay('');
      setSelectedHour(-1);
    }
    Promise.allSettled(
      [forecastPath(location), 'warnings', 'observations'].map((path) =>
        loadData(path, controller.signal),
      ),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        const forecast = results[0];
        if (forecast.status !== 'fulfilled') throw forecast.reason;
        const parsedForecast = readForecast(forecast.value.data, location);
        setPreviews((current) => ({
          ...current,
          [location.id]: {
            forecast: parsedForecast,
            stale: forecast.value.stale,
            fetchedAt: forecast.value.fetchedAt,
          },
        }));
        loadedLocation.current = location.id;
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
  }, [location?.id, refresh, provider]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') setRefresh((r) => r + 1);
    }, 10 * 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);
  const favoriteKey = [...favorites].sort().join(',');
  useEffect(() => {
    if (!locations.length) return;
    const controller = new AbortController();
    const pending = locations.filter((l) => favorites.includes(l.id) && l.id !== locationId);
    // Two concurrent requests keep a long list of saved places gentle on the IPMA proxy.
    const work = async () => {
      while (pending.length && !controller.signal.aborted) {
        const place = pending.shift()!;
        try {
          const result = await loadData(forecastPath(place), controller.signal);
          const preview = {
            forecast: readForecast(result.data, place),
            stale: result.stale,
            fetchedAt: result.fetchedAt,
          };
          if (!controller.signal.aborted)
            setPreviews((current) => ({ ...current, [place.id]: preview }));
        } catch {
          /* Each place can remain unavailable independently. */
        }
      }
    };
    void Promise.all([work(), work()]);
    return () => controller.abort();
  }, [favoriteKey, locations.length, refresh, provider]);
  useEffect(() => {
    save('indicators', indicators);
  }, [indicators]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const current = bundle?.id === locationId ? bundle : null;
  const descriptions = useMemo(
    () =>
      new Map(
        types.map((type) => [
          type.id,
          systemLanguage === 'pt'
            ? type.description
            : (type.englishDescription ?? 'Weather forecast'),
        ]),
      ),
    [types, systemLanguage],
  );
  const isFavorite = favorites.includes(locationId);
  const saved = favorites.filter((id) => locations.some((l) => l.id === id));
  pages.current = { ids: isFavorite ? saved : [locationId, ...saved], id: locationId };
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
  const installed =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  function viewFor(id: number, current: Bundle | null, selected = day) {
    const location = locations.find((place) => place.id === id);
    const timezone = location?.timezone ?? 'Europe/Lisbon';
    const today = dateInZone(now, timezone);
    const daily = current?.forecast.filter((p) => p.interval === 24 && p.date >= today) ?? [];
    const selectedDate = daily.some((p) => p.date === selected)
      ? selected
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
    const currentTemperature = observation?.temperature ?? nearestForecast?.temperature;
    const updated = current?.forecast
      .map((p) => p.updated)
      .filter(Boolean)
      .sort()
      .at(-1);
    const oldForecast = !!updated && now - Date.parse(updated) > 18 * 3600000;
    const noForecastToday = !!current && !todayForecast;
    const hasStale = !!current && (current.stale || oldForecast || noForecastToday);
    const night = localHour(now, timezone) < 7 || localHour(now, timezone) >= 20;
    const skyCode = nearestForecast?.weather ?? todayForecast?.weather ?? 0;
    const sky = night
      ? 'night'
      : skyCode >= 6 && skyCode <= 23
        ? 'rain'
        : skyCode === 1
          ? 'sun'
          : 'cloud';
    const insight = dayInsight(hourly, todayForecast, timezone, now);
    const humidityObserved = observation?.humidity != null;
    const indicatorData = {
      wind: {
        icon: Wind,
        label: 'Vento previsto',
        reading: value(nearestForecast?.wind, ' km/h'),
        note: nearestForecast?.direction
          ? 'Vem de ' + nearestForecast.direction
          : 'Direção indisponível',
        text: 'Velocidade e direção previstas para a localidade. A direção indica de onde vem o vento. Não representa rajadas.',
        source: nearestForecast
          ? 'Previsão para as ' + formatTime(nearestForecast.at, timezone)
          : 'Sem previsão recente disponível.',
      },
      rain: {
        icon: Droplets,
        label: 'Probabilidade de chuva',
        reading: value(todayForecast?.rain, '%'),
        note: 'Para hoje',
        text: 'A percentagem indica a probabilidade de precipitação durante o período previsto. Não é a quantidade de chuva nem a percentagem do dia em que vai chover. Os valores de cada período e do dia completo podem diferir.',
        source:
          'Previsão diária do IPMA. No gráfico, cada valor corresponde ao período disponibilizado.',
      },
      uv: {
        icon: Sun,
        label: 'Índice UV previsto',
        reading: value(todayForecast?.uv, '', 1),
        note: uvLabel(todayForecast?.uv),
        text: 'O índice UV descreve a intensidade da radiação ultravioleta prevista. A escala vai de baixo (0–2) a extremo (11 ou mais). Este é o valor diário disponibilizado pelo IPMA; não é uma medição em tempo real.',
        source: 'Previsão diária para hoje.',
      },
      humidity: {
        icon: Droplets,
        label: 'Humidade ' + (humidityObserved ? 'observada' : 'prevista'),
        reading: value(observation?.humidity ?? nearestForecast?.humidity, '%'),
        note: humidityObserved
          ? 'Às ' + formatTime(observation!.at, timezone)
          : 'Para a localidade',
        text: 'A humidade relativa compara o vapor de água presente no ar com o máximo possível à mesma temperatura. Um valor de 100% não implica, por si só, que esteja a chover.',
        source: humidityObserved
          ? observation!.name +
            ', às ' +
            formatTime(observation!.at, timezone) +
            (current?.observationsStale ? ' · dados guardados' : '')
          : nearestForecast
            ? 'Previsão para as ' + formatTime(nearestForecast.at, timezone)
            : 'Sem informação recente disponível.',
      },
      pressure: {
        icon: Gauge,
        label: 'Pressão observada',
        reading: value(observation?.pressure, ' hPa'),
        note:
          observation?.pressure != null
            ? 'Às ' + formatTime(observation.at, timezone)
            : 'Sem observação recente',
        text: 'Pressão atmosférica registada pela estação meteorológica próxima. O valor é apresentado em hectopascais (hPa), sem inferir uma tendência a partir de uma única observação.',
        source:
          observation?.pressure != null
            ? observation.name + (current?.observationsStale ? ' · dados guardados' : '')
            : 'Não há uma observação adequada disponível.',
      },
    };
    return {
      location,
      timezone,
      today,
      current,
      daily,
      selectedDate,
      selectedDay,
      todayForecast,
      hoursForDay,
      nearestForecast,
      observation,
      warnings,
      currentTemperature,
      updated,
      hasStale,
      night,
      skyCode,
      sky,
      insight,
      indicatorData,
    };
  }
  const activeView = viewFor(locationId, current);
  const {
    daily,
    selectedDate,
    selectedDay,
    hoursForDay,
    nearestForecast,
    hasStale,
    indicatorData,
  } = activeView;
  const previewValues = current
    ? { ...previews, [locationId]: { forecast: current.forecast, stale: hasStale } }
    : previews;
  const indicatorDetail =
    sheet && Object.hasOwn(indicatorNames, sheet) ? indicatorData[sheet as Indicator] : null;

  function previewBundle(id: number): Bundle | null {
    const preview = previews[id];
    if (preview && Date.now() - Date.parse(preview.fetchedAt) < 20 * 60000) {
      return {
        id,
        forecast: preview.forecast,
        fetchedAt: preview.fetchedAt,
        stale: preview.stale,
        warnings: bundle?.warnings ?? [],
        observations: bundle?.observations ?? [],
        warningsUnknown: bundle?.warningsUnknown ?? true,
        warningsStale: bundle?.warningsStale ?? false,
        observationsStale: bundle?.observationsStale ?? false,
      };
    }
    return null;
  }

  function choose(id: number) {
    const cached = previewBundle(id);
    // Show the already-loaded forecast immediately, then revalidate in the background.
    if (cached) setBundle(cached);
    if (id !== locationId) setLoading(true);
    setDay('');
    setSelectedHour(-1);
    setError('');
    setLocationId(id);
    setShowSearch(false);
    setSearch('');
    setNotice('');
    setSheet(null);
  }
  function toggleFavorite() {
    const next = isFavorite
      ? favorites.filter((id) => id !== locationId)
      : [...favorites, locationId];
    setFavorites(next);
    save('favorites', next);
    navigator.vibrate?.(10);
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
    setSelectedHour(date === today ? -1 : 0);
  };
  function moveFavorite(id: number, offset: number) {
    const next = [...favorites],
      index = next.indexOf(id),
      target = index + offset;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFavorites(next);
    save('favorites', next);
  }
  function moveIndicator(index: number, offset: number) {
    const next = [...indicators],
      target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder(() => setIndicators(next));
  }

  function renderWarnings(current: Bundle | null, warnings: Warning[], timezone: string) {
    return (
      current && (
        <section
          className={
            'warnings-section ' +
            (warnings.length || current.warningsUnknown || current.warningsStale
              ? 'has-warnings'
              : 'all-clear')
          }
          aria-label={t('Avisos meteorológicos')}
        >
          <div className="warnings-header">
            {current.warningsUnknown || current.warningsStale || warnings.length ? (
              <AlertTriangle size={19} />
            ) : (
              <Check size={16} />
            )}
            <div>
              <h2>
                {t(
                  current.warningsUnknown
                    ? 'Avisos indisponíveis'
                    : current.warningsStale
                      ? 'Avisos guardados — confirmar atualização'
                      : warnings.length
                        ? warnings.length +
                          ' aviso' +
                          (warnings.length > 1 ? 's' : '') +
                          ' para a região'
                        : 'Sem avisos em vigor ou previstos',
                )}
              </h2>
              {(warnings.length > 0 || current.warningsUnknown || current.warningsStale) && (
                <p>
                  {t(
                    current.warningsUnknown || current.warningsStale
                      ? 'Não foi possível confirmar os avisos atuais. Consulta o IPMA.'
                      : 'Avisos oficiais para a região da localidade selecionada.',
                  )}
                </p>
              )}
            </div>
            <a
              href="https://www.ipma.pt/pt/otempo/prev-sam/"
              target="_blank"
              rel="noreferrer"
              aria-label={t('Consultar avisos no IPMA')}
            >
              <ArrowUpRight size={19} />
            </a>
          </div>
          {warnings.map((w) => (
            <article className={'warning-item warning-' + w.level} key={w.type + w.start + w.end}>
              <div>
                <span className="warning-level">
                  {t(w.level === 'red' ? 'Vermelho' : w.level === 'orange' ? 'Laranja' : 'Amarelo')}
                </span>
                <strong>{t(w.type)}</strong>
              </div>
              <p className="warning-when">
                {t(Date.parse(w.start) > now ? 'Previsto' : 'Em vigor')} ·{' '}
                {new Intl.DateTimeFormat(locale(), {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: timezone,
                }).format(new Date(w.start))}{' '}
                {t('até')}{' '}
                {new Intl.DateTimeFormat(locale(), {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: timezone,
                }).format(new Date(w.end))}
              </p>
              <p lang="pt">{w.text}</p>
              {systemLanguage === 'en' && <small>{t('Texto oficial do IPMA em português.')}</small>}
            </article>
          ))}
        </section>
      )
    );
  }
  const favoriteList = (
    <FavoritePlaces
      favorites={favorites}
      locations={locations}
      previews={previewValues}
      selected={locationId}
      now={now}
      onChoose={choose}
      onMove={moveFavorite}
    />
  );
  const searchPanel = (
    <div className="search-panel">
      <label className="search-field">
        <Search size={18} />
        <span className="sr-only">{t('Pesquisar localidade')}</span>
        <input
          ref={searchRef}
          type="search"
          placeholder={t('Lisboa, Porto, Funchal…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowSearch(false);
          }}
        />
      </label>
      <div className="search-results">
        {shownLocations.slice(0, 30).map((l) => (
          <button key={l.id} onClick={() => choose(l.id)}>
            <span>{l.name}</span>
            {l.id === locationId ? <Check size={17} /> : <ChevronRight size={16} />}
          </button>
        ))}
        {!shownLocations.length && <p>{t('Nenhuma localidade encontrada.')}</p>}
      </div>
    </div>
  );
  function renderPage(pageId: number, preview = false) {
    const {
      location,
      timezone,
      today,
      current,
      daily,
      selectedDate,
      selectedDay,
      todayForecast,
      hoursForDay,
      nearestForecast,
      observation,
      warnings,
      currentTemperature,
      updated,
      hasStale,
      night,
      skyCode,
      sky,
      insight,
      indicatorData,
    } = preview ? viewFor(pageId, previewBundle(pageId), '') : activeView;
    const isFavorite = favorites.includes(pageId);
    const pageLoading = preview ? !current : loading;
    const warningBlock = renderWarnings(current, warnings, timezone);
    return (
      <main
        className={'main-content' + (preview ? ' location-swipe-preview' : '')}
        id={preview ? undefined : 'today'}
        ref={preview ? swipePreviewRef : mainRef}
        data-sky={sky}
        inert={preview ? true : undefined}
        aria-hidden={preview ? true : undefined}
      >
        <header className="topbar">
          <span className="today-date">
            {new Intl.DateTimeFormat(locale(), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: timezone,
            }).format(now)}
          </span>
          <div className="topbar-actions glass-control">
            <button
              className="icon-button"
              onClick={() => setRefresh((r) => r + 1)}
              disabled={pageLoading || !online}
              aria-label={t('Atualizar dados')}
            >
              <RefreshCw size={19} className={pageLoading ? 'spinning' : ''} />
            </button>
            <button
              className="icon-button"
              onClick={() => setSheet('settings')}
              aria-label={t('Personalizar')}
            >
              <Settings2 size={20} />
            </button>
            {!installed && (
              <button className="install-button" onClick={install} aria-label={t('Instalar app')}>
                <Download size={18} />
                <span>{t('Instalar app')}</span>
              </button>
            )}
          </div>
        </header>
        {needRefresh && (
          <div className="notice-banner">
            <Info size={18} />
            <span>{t('Está disponível uma nova versão.')}</span>
            <button onClick={() => updateServiceWorker(true)}>{t('Atualizar app')}</button>
          </div>
        )}
        {!online && (
          <div className="notice-banner">
            <WifiOff size={18} />
            <span>{t('Sem ligação. Os dados guardados podem estar desatualizados.')}</span>
          </div>
        )}
        {notice && (
          <div className="notice-banner" role="status">
            <Info size={18} />
            <span>{t(notice)}</span>
            <button
              className="icon-button"
              aria-label={t('Fechar mensagem')}
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={18} />
            <span>{t(error)}</span>
            <button onClick={() => setRefresh((r) => r + 1)}>{t('Tentar novamente')}</button>
          </div>
        )}
        {hasStale && (
          <div className="notice-banner">
            <AlertTriangle size={18} />
            <span>
              {systemLanguage === 'pt'
                ? 'Última previsão disponível. '
                : 'Last available forecast. '}
              {updated &&
                new Intl.DateTimeFormat(locale(), {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: timezone,
                }).format(new Date(updated))}
            </span>
          </div>
        )}
        <div className="location-heading">
          <div>
            <span className="location-region">
              {t(
                location?.region === 3
                  ? 'Açores'
                  : location?.region === 2
                    ? 'Madeira'
                    : 'Portugal continental',
              )}
            </span>
            <h1>{location?.name ?? t('O tempo em Portugal')}</h1>
          </div>
          <button
            className={'favorite-button ' + (isFavorite ? 'saved' : '')}
            onClick={toggleFavorite}
            disabled={!location}
            aria-label={t(isFavorite ? 'Remover dos favoritos' : 'Guardar nos favoritos')}
            aria-pressed={isFavorite}
          >
            <Star size={21} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        {pages.current.ids.length > 1 && (
          <div className="page-dots" role="group" aria-label={t('Localidades favoritas')}>
            {pages.current.ids.map((id, index) => (
              <button
                key={id}
                className={id === pageId ? 'active' : ''}
                aria-label={`${systemLanguage === 'pt' ? 'Ver previsão para' : 'View forecast for'} ${locations.find((place) => place.id === id)?.name}`}
                aria-current={id === pageId ? 'location' : undefined}
                onClick={() => slideTo(id, index > pages.current.ids.indexOf(pageId) ? 1 : -1)}
              >
                {index === 0 ? (
                  <House size={12} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <span />
                )}
              </button>
            ))}
          </div>
        )}
        {pageLoading && !current ? (
          <div className="skeleton" role="status">
            <span className="sr-only">{t('A carregar a previsão…')}</span>
            <div className="skeleton-hero" />
            <div className="forecast-layout">
              <div />
              <div />
            </div>
          </div>
        ) : current ? (
          <>
            {(warnings.length > 0 || current.warningsStale || current.warningsUnknown) &&
              warningBlock}
            <div className="dashboard">
              <section className="weather-hero" aria-label={t('Resumo do tempo')}>
                <WeatherBackdrop code={skyCode} night={night} dark={theme === 'dark'} />
                <div className="hero-reading">
                  <span className="reading-label">
                    {t(observation ? 'Temperatura observada' : 'Temperatura prevista')}
                  </span>
                  <div className="hero-temperature">
                    {value(currentTemperature)}
                    <span>°</span>
                  </div>
                  <h2>{descriptions.get(skyCode) ?? t('Previsão do dia')}</h2>
                  <p className="condition-source">
                    {t('Condição prevista')}
                    {nearestForecast
                      ? ' · ' + formatTime(nearestForecast.at, timezone)
                      : ' · ' + t('Previsão diária')}
                  </p>
                  <div className="hero-range">
                    <span>
                      {t('Máx.')} <strong>{value(todayForecast?.max, '°')}</strong>
                    </span>
                    <span>
                      {t('Mín.')} <strong>{value(todayForecast?.min, '°')}</strong>
                    </span>
                    <button
                      onClick={() => setSheet('rain')}
                      aria-label={t('Probabilidade de chuva')}
                    >
                      <Droplets size={14} />
                      {value(todayForecast?.rain, '%')}
                    </button>
                  </div>
                </div>
                <div className="hero-art">
                  <SkyIllustration code={skyCode} night={night} />
                </div>
                <p className="observation-source">
                  {t(
                    observation
                      ? observation.name +
                          ', a ' +
                          value(observation.distance, ' km') +
                          ' · ' +
                          formatTime(observation.at, timezone) +
                          (current.observationsStale ? ' · dados guardados' : '')
                      : nearestForecast
                        ? 'Previsão para as ' +
                          formatTime(nearestForecast.at, timezone) +
                          '. Sem observação recente próxima.'
                        : 'Sem temperatura recente disponível.',
                  )}
                </p>
              </section>
              <div className="day-insight">
                <Info size={17} />
                <p>{t(insight)}</p>
              </div>
              <div className="forecast-layout">
                <section className="hourly-panel" id={preview ? undefined : 'forecast'}>
                  <div className="section-heading">
                    <div>
                      <h2>{t('Ao longo do dia')}</h2>
                      <p>
                        {selectedDate === today
                          ? t('Hoje')
                          : formatDay(selectedDate, {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'short',
                            })}
                      </p>
                    </div>
                    <label className="day-select">
                      <span className="sr-only">{t('Dia do gráfico')}</span>
                      <select value={selectedDate} onChange={(e) => selectDate(e.target.value)}>
                        {daily.map((p) => (
                          <option key={p.date} value={p.date}>
                            {p.date === today
                              ? t('Hoje')
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
                    selected={preview ? -1 : selectedHour}
                    onSelect={setSelectedHour}
                    source={source}
                    now={now}
                  />
                  {selectedDay && !hoursForDay.length && (
                    <div className="selected-day-summary">
                      <span>
                        {t('Mínima')}
                        <strong>{value(selectedDay.min, '°')}</strong>
                      </span>
                      <span>
                        {t('Máxima')}
                        <strong>{value(selectedDay.max, '°')}</strong>
                      </span>
                      <span>
                        {t('Chuva')}
                        <strong>{value(selectedDay.rain, '%')}</strong>
                      </span>
                    </div>
                  )}
                </section>
                <section className="daily-panel" id={preview ? undefined : 'days'}>
                  <div className="section-heading">
                    <div>
                      <h2>
                        <CalendarDays size={17} />
                        {t('Próximos ' + daily.length + ' dias')}
                      </h2>
                      <p>{t('Consulta o detalhe ao tocar num dia.')}</p>
                    </div>
                  </div>
                  <DailyForecast
                    periods={daily}
                    today={today}
                    selectedDate={selectedDate}
                    onSelect={(date) => {
                      selectDate(date);
                      setSheet('day');
                    }}
                    descriptions={descriptions}
                  />
                  <p className="daily-caption">
                    {t('Temperaturas mínima e máxima (°C). Chuva: probabilidade diária (%).')}
                  </p>
                </section>
              </div>
              <section className="metrics" aria-label={t('Indicadores de hoje')}>
                {indicators.map((key) => {
                  const data = indicatorData[key],
                    Icon = data.icon;
                  return (
                    <button
                      key={key}
                      className="metric-card"
                      onClick={() => setSheet(key)}
                      aria-haspopup="dialog"
                    >
                      <span className="metric-label">
                        <Icon size={17} />
                        {t(data.label)}
                        <ChevronRight size={14} />
                      </span>
                      <strong>{data.reading}</strong>
                      <span className="metric-note">{t(data.note)}</span>
                    </button>
                  );
                })}
              </section>
            </div>
            {!warnings.length && !current.warningsStale && !current.warningsUnknown && warningBlock}
            <footer className="app-footer">
              <div>
                <a
                  className="ipma-source"
                  href="https://www.ipma.pt"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('Visitar o IPMA')}
                >
                  <img src="/ipma.svg" alt="IPMA, I.P." width="95" height="22" />
                </a>
                {updated && (
                  <span>{t('Previsão atualizada às ' + formatTime(updated, timezone))}</span>
                )}
                {provider !== 'ipma' && (
                  <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                    {t('Previsão por Open-Meteo.com')}
                  </a>
                )}
              </div>
              <p>
                {t(
                  timezone === 'Atlantic/Azores'
                    ? 'Horas locais dos Açores.'
                    : 'Horas locais de Portugal continental e Madeira.',
                )}
              </p>
              <p>
                {t('Aplicação independente. Previsões sujeitas a alteração.')}{' '}
                {t('Detalhe horário e disponibilidade dos parâmetros variam com o horizonte.')}
              </p>
            </footer>
          </>
        ) : null}
      </main>
    );
  }
  return (
    <div className="app-shell" data-sky={activeView.sky}>
      <div ref={pullRef} className="pull-indicator glass-control" aria-hidden="true">
        <RefreshCw size={18} />
      </div>
      <a className="skip-link" href="#today">
        {systemLanguage === 'pt' ? 'Ir para a previsão' : 'Skip to forecast'}
      </a>
      <aside className="sidebar">
        <a href="#today" className="brand" aria-label={t('Tempo, início')}>
          <span className="brand-mark">
            <Sun size={25} />
            <Waves size={22} />
          </span>
          <span>
            tempo<small>Portugal</small>
          </span>
        </a>
        <button
          className="search-trigger glass-control"
          aria-label={t('Pesquisar localidade')}
          onClick={() => setShowSearch(!showSearch)}
          aria-expanded={showSearch}
        >
          <Search size={18} />
          <span>{t('Pesquisar localidade')}</span>
        </button>
        <button className="locate-button" onClick={locate} disabled={!locations.length || locating}>
          <LocateFixed size={17} />
          {t(locating ? 'A localizar…' : 'Usar a minha localização')}
        </button>
        <div className="desktop-favorites">{favoriteList}</div>
        <div className="sidebar-bottom">
          <span className="source-dot" />
          {t(provider === 'ipma' ? 'Dados oficiais do IPMA' : 'Previsão por Open-Meteo.com')}
          <a href="https://www.ipma.pt" target="_blank" rel="noreferrer">
            {t('Visitar o IPMA')}
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      {renderPage(locationId)}
      {swipePreviewId !== null && renderPage(swipePreviewId, true)}
      <nav
        className="mobile-navigation glass-control"
        aria-label={systemLanguage === 'pt' ? 'Navegação principal' : 'Main navigation'}
      >
        <a href="#today">
          <Sun size={20} />
          {t('Hoje')}
        </a>
        <a href="#days">
          <CalendarDays size={20} />
          {t('10 dias')}
        </a>
        <button onClick={() => setSheet('places')}>
          <MapPin size={20} />
          {t('Locais')}
        </button>
      </nav>
      {showSearch && (
        <Sheet title={t('Pesquisar localidade')} onClose={() => setShowSearch(false)}>
          {searchPanel}
        </Sheet>
      )}
      {sheet === 'places' && (
        <Sheet title={t('Locais')} onClose={() => setSheet(null)}>
          <button
            className="primary-button"
            onClick={() => {
              setSheet(null);
              setShowSearch(true);
            }}
          >
            <Search size={18} />
            {t('Pesquisar localidade')}
          </button>
          <button
            className="locate-button"
            onClick={locate}
            disabled={!locations.length || locating}
          >
            <LocateFixed size={17} />
            {t(locating ? 'A localizar…' : 'Usar a minha localização')}
          </button>
          {favoriteList}
        </Sheet>
      )}
      {sheet === 'day' && selectedDay && (
        <Sheet
          title={
            selectedDate === today
              ? t('Hoje')
              : formatDay(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })
          }
          subtitle={location?.name}
          onClose={() => setSheet(null)}
          wide
        >
          <div className="day-switcher">
            <button
              className="icon-button"
              aria-label={t('Anterior')}
              disabled={daily.findIndex((p) => p.date === selectedDate) <= 0}
              onClick={() =>
                selectDate(daily[daily.findIndex((p) => p.date === selectedDate) - 1].date)
              }
            >
              <ChevronLeft size={20} />
            </button>
            <span>{t('Detalhe do dia')}</span>
            <button
              className="icon-button"
              aria-label={t('Seguinte')}
              disabled={daily.findIndex((p) => p.date === selectedDate) >= daily.length - 1}
              onClick={() =>
                selectDate(daily[daily.findIndex((p) => p.date === selectedDate) + 1].date)
              }
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="day-overview">
            <WeatherIcon code={selectedDay.weather} size={45} />
            <div>
              <h3>{descriptions.get(selectedDay.weather) ?? t('Previsão do dia')}</h3>
              <p>
                {t('Mínima')} {value(selectedDay.min, '°')} · {t('Máxima')}{' '}
                {value(selectedDay.max, '°')}
              </p>
            </div>
          </div>
          <div className="day-values">
            <span>
              {t('Probabilidade de chuva')}
              <strong>{value(selectedDay.rain, '%')}</strong>
            </span>
            <span>
              {t('Índice UV')}
              <strong>{value(selectedDay.uv, '', 1)}</strong>
            </span>
          </div>
          <ForecastChart
            periods={hoursForDay}
            timezone={timezone}
            metric={metric}
            onMetric={setMetric}
            selected={selectedHour}
            onSelect={setSelectedHour}
            source={source}
            now={now}
          />
        </Sheet>
      )}
      {indicatorDetail && (
        <Sheet
          title={t(indicatorDetail.label)}
          subtitle={location?.name}
          onClose={() => setSheet(null)}
        >
          <div className="indicator-reading">
            {indicatorDetail.reading}
            <span>{t(indicatorDetail.note)}</span>
          </div>
          {sheet === 'wind' && <Compass direction={nearestForecast?.direction ?? ''} />}
          <p className="detail-copy">{t(indicatorDetail.text).replaceAll('IPMA', source)}</p>
          <p className="detail-source">{t(indicatorDetail.source).replaceAll('IPMA', source)}</p>
          {sheet === 'rain' && (
            <button
              className="primary-button"
              onClick={() => {
                setMetric('rain');
                setSheet('day');
                selectDate(today);
              }}
            >
              {t('Ao longo do dia')}
              <ChevronRight size={18} />
            </button>
          )}
        </Sheet>
      )}
      {sheet === 'settings' && (
        <Sheet
          title={t('Personaliza o teu resumo')}
          subtitle={t('Escolhe os indicadores e a ordem em que aparecem.')}
          onClose={() => setSheet(null)}
        >
          <div className="system-settings">
            <p>
              <span>{t('Idioma')}</span>
              <strong>{t(systemLanguage === 'pt' ? 'Português' : 'Inglês')}</strong>
            </p>
            <p>
              <span>{t('Aparência')}</span>
              <strong>{t(theme === 'dark' ? 'Escuro' : 'Claro')}</strong>
            </p>
            <small>{t('A língua e o tema seguem o sistema.')}</small>
          </div>
          <h3 className="settings-heading">{t('Fonte da previsão')}</h3>
          <div className="indicator-options">
            {(['ipma', 'open-meteo'] as const).map((key) => (
              <label key={key}>
                <input
                  type="radio"
                  name="provider"
                  checked={provider === key}
                  onChange={() => changeProvider(key)}
                />
                {key === 'ipma' ? 'IPMA' : 'Open-Meteo'}
              </label>
            ))}
          </div>
          <small className="settings-note">
            {t('Avisos e temperatura observada vêm sempre do IPMA.')}
          </small>
          <h3 className="settings-heading">{t('Indicadores visíveis')}</h3>
          <div className="indicator-options">
            {(Object.keys(indicatorNames) as Indicator[]).map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={indicators.includes(key)}
                  disabled={indicators.length === 1 && indicators.includes(key)}
                  onChange={() =>
                    setIndicators((previous) =>
                      previous.includes(key)
                        ? previous.filter((k) => k !== key)
                        : [...previous, key],
                    )
                  }
                />
                {t(indicatorNames[key])}
              </label>
            ))}
          </div>
          <div className="indicator-order">
            {indicators.map((key, index) => (
              <div key={key} style={{ viewTransitionName: 'indicator-' + key }}>
                <span>{t(indicatorNames[key])}</span>
                <span className="reorder-controls">
                  <button
                    disabled={index === 0}
                    onClick={() => moveIndicator(index, -1)}
                    aria-label={t('Subir ' + t(indicatorNames[key]))}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    disabled={index === indicators.length - 1}
                    onClick={() => moveIndicator(index, 1)}
                    aria-label={t('Descer ' + t(indicatorNames[key]))}
                  >
                    <ArrowDown size={17} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          <button className="text-button" onClick={() => setIndicators(defaultIndicators)}>
            {t('Repor indicadores')}
          </button>
        </Sheet>
      )}
      {installHelp && (
        <Sheet title={t('O tempo no teu ecrã principal')} onClose={() => setInstallHelp(false)}>
          <div className="detail-copy">
            <p>
              <strong>{t('No iPhone:')}</strong>{' '}
              {t(
                'abre esta página no Safari, toca em Partilhar e escolhe “Adicionar ao ecrã principal”.',
              )}{' '}
              {t('Ativa “Abrir como app web”, se disponível.')}
            </p>
            <p>
              <strong>{t('No Android:')}</strong>{' '}
              {t(
                'abre o menu do Chrome e escolhe “Instalar aplicação” ou “Adicionar ao ecrã principal”.',
              )}
            </p>
          </div>
          <button className="primary-button" onClick={() => setInstallHelp(false)}>
            {t('Entendido')}
          </button>
        </Sheet>
      )}
    </div>
  );
}
