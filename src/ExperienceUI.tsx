import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ArrowUp, ChevronRight, GripVertical, X } from 'lucide-react';
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
  const dragStart = useRef(0);
  const dismiss = () => {
    const dialog = ref.current!;
    if (!dialog.animate || matchMedia('(prefers-reduced-motion: reduce)').matches)
      return closeRef.current();
    // `translate` composes with the transform left by a drag.
    void dialog
      .animate(
        { translate: '0 40px', opacity: 0 },
        { duration: 180, easing: 'ease-in', fill: 'forwards' },
      )
      .finished.then(() => closeRef.current());
  };
  const release = (e: PointerEvent) => {
    const dialog = ref.current!;
    if (e.type === 'pointerup' && e.clientY - dragStart.current > 90) return dismiss();
    dialog.animate?.(
      { transform: [dialog.style.transform || 'none', 'none'] },
      { duration: 300, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
    dialog.style.transform = '';
  };
  useEffect(() => {
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    // iOS draws the keyboard over the page without resizing it; lift the sheet above it.
    const viewport = window.visualViewport;
    const keyboard = () =>
      dialog.style.setProperty(
        '--keyboard',
        Math.max(0, innerHeight - viewport!.height - viewport!.offsetTop) + 'px',
      );
    viewport?.addEventListener('resize', keyboard);
    viewport?.addEventListener('scroll', keyboard);
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
      viewport?.removeEventListener('resize', keyboard);
      viewport?.removeEventListener('scroll', keyboard);
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
        dismiss();
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        )
          dismiss();
      }}
    >
      <div
        className="sheet-handle"
        aria-hidden="true"
        onPointerDown={(e) => {
          dragStart.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            ref.current!.style.transform = `translateY(${Math.max(0, e.clientY - dragStart.current)}px)`;
        }}
        onPointerUp={release}
        onPointerCancel={release}
      />
      <header className="sheet-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={dismiss} aria-label={t('Fechar painel')}>
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
  const listRef = useRef<HTMLElement>(null);
  // Read through a ref: a drag outlives the render it started in.
  const latest = useRef({ places, onMove });
  latest.current = { places, onMove };
  const tops = useRef(new Map<Element, number>());
  useLayoutEffect(() => {
    // Rows displaced by a reorder glide from their previous position.
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const row of listRef.current!.querySelectorAll<HTMLElement>('.favorite-row')) {
      const before = tops.current.get(row);
      if (before !== undefined && before !== row.offsetTop && !still && !row.dataset.dragging)
        row.animate?.(
          { transform: [`translateY(${before - row.offsetTop}px)`, 'none'] },
          { duration: 250, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
        );
      tops.current.set(row, row.offsetTop);
    }
  });
  const drag = (e: PointerEvent, id: number) => {
    const row = e.currentTarget.closest<HTMLElement>('.favorite-row')!;
    const step = row.offsetHeight + 7;
    let start = e.clientY;
    row.dataset.dragging = 'true';
    // Window listeners: React moves the row in the DOM, which drops pointer capture.
    const move = (event: globalThis.PointerEvent) => {
      let dy = event.clientY - start;
      const direction = Math.sign(dy);
      const { places, onMove } = latest.current;
      const target = places.findIndex((l) => l.id === id) + direction;
      if (Math.abs(dy) > step / 2 && target >= 0 && target < places.length) {
        onMove(id, direction);
        navigator.vibrate?.(5);
        start += direction * step;
        dy -= direction * step;
      }
      row.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      delete row.dataset.dragging;
      row.style.transform = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
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
      <nav ref={listRef} className="favorites" aria-label={t('Localidades favoritas')}>
        {places.map((l) => {
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
                <button
                  className="drag-handle"
                  aria-label={t(`Reordenar ${l.name}`)}
                  onPointerDown={(e) => drag(e, l.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    onMove(l.id, e.key === 'ArrowUp' ? -1 : 1);
                    // Moving the row in the DOM can drop focus; hand it back.
                    const handle = e.currentTarget;
                    setTimeout(() => handle.focus());
                  }}
                >
                  <GripVertical size={18} />
                </button>
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
