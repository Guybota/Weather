import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, ChevronRight, X } from 'lucide-react';
import { WeatherIcon } from './components';
import { dateInZone, value, type Location, type Period } from './weather';
import { directionDegrees } from './experience';
import { t, language } from './i18n';

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    let alive = true;
    let revert: (() => void) | undefined;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const animate = () => {
      revert?.();
      revert = undefined;
      if (motion.matches) return;
      // GSAP executes on first use, without blocking the dialog or its focus.
      void import('gsap')
        .then(({ gsap }) => {
          if (!alive || motion.matches) return;
          revert?.();
          const context = gsap.context(() => {
            const mobile = matchMedia('(max-width: 620px)').matches;
            gsap
              .timeline({ defaults: { ease: 'power3.out' } })
              .fromTo(
                dialog,
                { y: mobile ? 28 : 10, opacity: 0.7 },
                { y: 0, opacity: 1, duration: 0.24, clearProps: 'transform,opacity' },
              )
              .fromTo(
                '.sheet-header, .sheet-content',
                { y: 6, opacity: 0.8 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.18,
                  stagger: 0.025,
                  clearProps: 'transform,opacity',
                },
                0.04,
              );
          }, dialog);
          revert = () => context.revert();
        })
        .catch(() => {
          /* Panels remain usable if animation cannot load. */
        });
    };
    animate();
    motion.addEventListener('change', animate);
    return () => {
      alive = false;
      motion.removeEventListener('change', animate);
      revert?.();
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`detail-sheet ${wide ? 'wide-sheet' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        )
          onClose();
      }}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t('Fechar painel')}>
          <X size={20} />
        </button>
      </header>
      <div className="sheet-content">{children}</div>
    </dialog>
  );
}

export type Preview = { forecast: Period[]; stale: boolean };
export function FavoritePlaces({
  favorites,
  locations,
  previews,
  selected,
  now,
  onChoose,
  onMove,
}: {
  favorites: number[];
  locations: Location[];
  previews: Record<number, Preview>;
  selected: number;
  now: number;
  onChoose: (id: number) => void;
  onMove: (id: number, offset: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const places = favorites
    .map((id) => locations.find((l) => l.id === id))
    .filter((l): l is Location => !!l);
  return (
    <>
      <div className="favorites-heading">
        <h3>{t('Os teus locais')}</h3>
        {places.length > 1 && (
          <button onClick={() => setEditing(!editing)} aria-pressed={editing}>
            {t(editing ? 'Concluir' : 'Reordenar')}
          </button>
        )}
      </div>
      <nav className="favorites" aria-label={t('Localidades favoritas')}>
        {places.map((l, i) => {
          const data = previews[l.id];
          const daily = data?.forecast.find(
            (p) => p.interval === 24 && p.date === dateInZone(now, l.timezone),
          );
          return (
            <div className="favorite-row" key={l.id}>
              <button
                className={`favorite-place ${l.id === selected ? 'active' : ''}`}
                onClick={() => onChoose(l.id)}
                aria-pressed={l.id === selected}
              >
                <span className="favorite-name">
                  <strong>{l.name}</strong>
                  <small>
                    {daily
                      ? `${t('Hoje')} · ${value(daily.min, '°')} / ${value(daily.max, '°')}${data.stale ? ' · ' + t('guardado') : ''}`
                      : t('Previsão diária indisponível')}
                  </small>
                </span>
                {daily ? (
                  <WeatherIcon code={daily.weather} size={25} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
              {editing && (
                <span className="reorder-controls">
                  <button
                    disabled={i === 0}
                    onClick={() => onMove(l.id, -1)}
                    aria-label={t(`Subir ${l.name}`)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    disabled={i === places.length - 1}
                    onClick={() => onMove(l.id, 1)}
                    aria-label={t(`Descer ${l.name}`)}
                  >
                    <ArrowDown size={16} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {!places.length && (
          <p className="secondary empty-favorites">
            {t('Usa a estrela junto ao nome da localidade para guardar o primeiro local.')}
          </p>
        )}
      </nav>
    </>
  );
}

export function Compass({ direction }: { direction: string }) {
  const degrees = directionDegrees(direction);
  return (
    <div
      className="compass"
      role="img"
      aria-label={t(
        degrees === null ? 'Direção do vento indisponível' : `O vento vem de ${direction}`,
      )}
    >
      <span className="compass-n">N</span>
      <span className="compass-e">E</span>
      <span className="compass-s">S</span>
      <span className="compass-w">{language() === 'en' ? 'W' : 'O'}</span>
      {degrees !== null ? (
        <ArrowUp
          className="compass-arrow"
          size={60}
          style={{ transform: `rotate(${degrees}deg)` }}
        />
      ) : (
        <span>—</span>
      )}
    </div>
  );
}
