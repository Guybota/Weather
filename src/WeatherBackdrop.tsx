import { useEffect, useState, type ComponentType } from 'react';

export type BackdropProps = { code: number; night: boolean; dark: boolean };

// Load WebGL separately; the CSS sky remains available on every device.
export function WeatherBackdrop(props: BackdropProps) {
  const [Effect, setEffect] = useState<ComponentType<BackdropProps> | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const contrast = matchMedia('(forced-colors: active)');
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & { saveData?: boolean };
      }
    ).connection;
    let alive = true;
    const update = () => {
      const animate = !motion.matches && !contrast.matches && !connection?.saveData;
      setEnabled(animate);
      if (animate)
        void import('./AuroraWeather')
          .then((module) => {
            if (alive) setEffect(() => module.default);
          })
          .catch(() => {
            /* Keep the CSS sky if loading fails offline. */
          });
    };
    update();
    motion.addEventListener('change', update);
    contrast.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => {
      alive = false;
      motion.removeEventListener('change', update);
      contrast.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
    };
  }, []);
  return (
    <div className="weather-backdrop" aria-hidden="true">
      {enabled && Effect && <Effect {...props} />}
    </div>
  );
}
