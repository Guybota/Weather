// Adapted from React Bits Aurora by David Haz.
// Source: 90b2750ec57ab24969681dff24fbf22ccf9ccb59, see third-party/react-bits-LICENSE.md.
import { useEffect, useRef } from 'react';
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';
import { auroraNoise } from './auroraNoise';
import type { BackdropProps } from './WeatherBackdrop';

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
const fragment = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[3];
uniform float uCloud;
uniform float uRain;
uniform float uSnow;
out vec4 fragColor;
${auroraNoise}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 sky = vec2(uv.x * 2.8, uv.y * 1.8);
  float drift = uTime * 0.025;
  float field = snoise(sky + vec2(drift, 0.0)) * 0.65
    + snoise(sky * 2.1 + vec2(drift * 0.6, 4.0)) * 0.25;
  float cloud = smoothstep(-0.35, 0.7, field) * uCloud;
  vec3 color = mix(uColors[0], uColors[1], clamp(uv.x * 0.65 + uv.y * 0.35, 0.0, 1.0));
  color = mix(color, uColors[2], cloud);
  // Sparse precipitation, decorative only: no simulated quantity or timing.
  vec2 rainGrid = vec2(uv.x * 60.0 + uv.y * 6.0, uv.y * 8.0 + uTime * 0.7);
  float streak = smoothstep(0.96, 1.0, fract(rainGrid.x))
    * smoothstep(0.8, 1.0, fract(rainGrid.y))
    * step(0.66, fract(sin(floor(rainGrid.x) * 127.1) * 43758.5453));
  color += streak * uRain * 0.14;
  vec2 snowGrid = vec2(uv.x * 32.0 + sin(uTime * 0.15) * 0.3, uv.y * 10.0 + uTime * 0.1);
  float seed = fract(sin(dot(floor(snowGrid), vec2(127.1, 311.7))) * 43758.5453);
  vec2 offset = vec2(seed, fract(seed * 7.31)) * 0.5 + 0.25;
  float flake = (1.0 - smoothstep(0.02, 0.08, length(fract(snowGrid) - offset))) * step(0.65, seed);
  color += flake * uSnow * 0.2;
  fragColor = vec4(color, 1.0);
}`;

function settings({ code, night, dark }: BackdropProps) {
  const rain = (code >= 6 && code <= 15) || [19, 20, 23].includes(code);
  const snow = [18, 21, 22, 28, 29, 30].includes(code);
  const fog = [16, 17, 26].includes(code);
  const colors = night
    ? ['#172c49', '#345775', '#6d839e']
    : dark
      ? rain
        ? ['#26394d', '#456077', '#748998']
        : ['#1d3958', '#376786', '#849fae']
      : rain
        ? ['#4a5d75', '#6a7f97', '#b4c2d1']
        : ['#2a78d6', '#4f9be8', code === 1 ? '#ffe9a8' : '#d4e7fa'];
  return {
    colors: colors.map((hex) => [...new Color(hex)]),
    cloud: code === 1 ? 0.2 : fog ? 0.95 : 0.75,
    rain: rain ? 1 : 0,
    snow: snow ? 1 : 0,
  };
}

export default function AuroraWeather(props: BackdropProps) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const refresh = useRef<() => void>(() => {});
  latest.current = props;
  useEffect(() => {
    const host = ref.current!;
    const canvas = document.createElement('canvas');
    // A missing GPU/context leaves the static CSS background intact.
    let gl: WebGL2RenderingContext | null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    } catch {
      return;
    }
    if (!gl) return;
    let renderer: Renderer;
    let program: Program;
    let geometry: Triangle;
    try {
      renderer = new Renderer({ canvas, alpha: false, antialias: false, dpr: 1 });
      geometry = new Triangle(renderer.gl);
      program = new Program(renderer.gl, {
        vertex,
        fragment,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [1, 1] },
          uColors: { value: settings(latest.current).colors },
          uCloud: { value: 0.75 },
          uRain: { value: 0 },
          uSnow: { value: 0 },
        },
      });
      if (!gl.getProgramParameter(program.program, gl.LINK_STATUS))
        throw new Error('Atmosphere shader unavailable');
    } catch {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return;
    }
    const mesh = new Mesh(renderer.gl, { geometry, program });
    host.append(canvas);
    let frame = 0;
    let visible = false;
    let lost = false;
    let elapsed = 0;
    let last = 0;
    const render = () => {
      const next = settings(latest.current);
      program.uniforms.uTime.value = elapsed / 1000;
      program.uniforms.uColors.value = next.colors;
      program.uniforms.uCloud.value = next.cloud;
      program.uniforms.uRain.value = next.rain;
      program.uniforms.uSnow.value = next.snow;
      try {
        renderer.render({ scene: mesh });
      } catch {
        // Driver errors must never interrupt weather data or navigation.
        lost = true;
        cancelAnimationFrame(frame);
        frame = 0;
        canvas.style.visibility = 'hidden';
      }
    };
    const tick = (time: number) => {
      if (!visible || document.hidden || lost || latest.current.animate === false) {
        frame = 0;
        return;
      }
      // 24 fps maximum, no catch-up jumps after returning to the app.
      if (time - last >= 1000 / 24) {
        elapsed += last ? Math.min(time - last, 100) : 0;
        last = time;
        render();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (visible && !document.hidden && !lost && latest.current.animate !== false) {
        if (!frame) {
          last = 0;
          frame = requestAnimationFrame(tick);
        }
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height || lost) return;
      renderer.dpr = Math.min(1, 960 / width);
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [canvas.width, canvas.height];
      render();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(host);
    const size = new ResizeObserver(resize);
    size.observe(host);
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      sync();
      canvas.style.visibility = 'hidden';
    };
    canvas.addEventListener('webglcontextlost', onLost);
    document.addEventListener('visibilitychange', sync);
    refresh.current = () => {
      render();
      sync();
    };
    resize();
    return () => {
      refresh.current = () => {};
      cancelAnimationFrame(frame);
      observer.disconnect();
      size.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('webglcontextlost', onLost);
      geometry.remove();
      program.remove();
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);
  useEffect(() => {
    refresh.current();
  }, [props.code, props.night, props.dark, props.animate]);
  return <div ref={ref} className="aurora-weather" />;
}
