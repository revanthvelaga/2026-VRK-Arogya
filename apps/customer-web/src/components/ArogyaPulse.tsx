import { useEffect, useRef, useState } from 'react';

// The welcome moment after sign-in, built from the "Allopathic Healthcare"
// design (without the doctors): a glossy 3D red cross with a translucent
// white heart and a glowing heartbeat line, golden light rings swirling
// around it and embers drifting on a warm cream stage.
// Only the heart beats — three lub-dubs locked to the heartbeat sound. On each
// beat a laser pulse runs along the heartbeat line and hits the spike on the
// "lub", the aura swells, a soft shock ring and a burst of sparks fly out
// AROUND the cross. The cross itself never moves after it settles in.
// About 3 seconds; a still frame under reduced motion.

const SOUND = '/brand/arogya-heartbeat.m4a';
export const PULSE_MS = 3100;

// Where the "lub" lands in the sound file (measured). The "dub" is 0.2 s later.
const BEATS = [0.762, 1.562, 2.362];
const TOTAL = 3.2; // seconds of beat timeline

let soundUrl: Promise<string> | null = null;
export function preloadPulse(): Promise<string> {
  if (!soundUrl) {
    soundUrl = fetch(SOUND)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('sound'))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        soundUrl = null;
        return SOUND;
      });
  }
  return soundUrl;
}

// Cross outline in the 800×800 design space (centre 400, 365).
const CROSS_OUTER =
  'M 332 213 A 68 68 0 0 1 468 213 L 468 297 L 552 297 A 68 68 0 0 1 552 433 L 468 433 L 468 517 A 68 68 0 0 1 332 517 L 332 433 L 248 433 A 68 68 0 0 1 248 297 L 332 297 Z';
const CROSS_INNER =
  'M 346 215 A 54 54 0 0 1 454 215 L 454 311 L 550 311 A 54 54 0 0 1 550 419 L 454 419 L 454 515 A 54 54 0 0 1 346 515 L 346 419 L 250 419 A 54 54 0 0 1 250 311 L 346 311 Z';
const CROSS_RIM =
  'M 348 215 A 52 52 0 0 1 452 215 L 452 313 L 550 313 A 52 52 0 0 1 550 417 L 452 417 L 452 515 A 52 52 0 0 1 348 515 L 348 417 L 250 417 A 52 52 0 0 1 250 313 L 348 313 Z';
const HEART =
  'M 400 476 C 400 476, 286 404, 286 332 C 286 286, 324 260, 360 260 C 382 260, 395 273, 400 288 C 405 273, 418 260, 440 260 C 476 260, 514 286, 514 332 C 514 404, 400 476, 400 476 Z';
const HEART_CORE =
  'M 400 470 C 400 470, 292 400, 292 332 C 292 290, 326 266, 360 266 C 380 266, 394 278, 400 292 C 406 278, 420 266, 440 266 C 474 266, 508 290, 508 332 C 508 400, 400 470, 400 470 Z';
const ECG = 'M 198 370 L 335 370 L 348 340 L 361 384 L 377 312 L 398 424 L 418 326 L 434 385 L 447 360 L 458 370 L 602 370';
const ECG_PEAK = 0.385; // fraction of the line's length at the tall spike

type Frame = Record<string, string | number>;
// Keyframes that rest at `rest` and play `shape` (seconds from each lub) at every beat.
function onBeats(rest: Frame, shape: [number, Frame][]): Keyframe[] {
  const out: Keyframe[] = [{ offset: 0, ...rest }];
  for (const b of BEATS) {
    out.push({ offset: (b + shape[0][0] - 0.001) / TOTAL, ...rest });
    for (const [dt, f] of shape) out.push({ offset: (b + dt) / TOTAL, ...f });
    out.push({ offset: (b + shape[shape.length - 1][0] + 0.001) / TOTAL, ...rest });
  }
  out.push({ offset: 1, ...rest });
  let last = 0;
  return out.map((k) => {
    last = Math.min(1, Math.max(last, k.offset as number));
    return { ...k, offset: last };
  });
}

// ---- Embers on a canvas behind the cross (so none ever sit on it) ----
type Ember = { a: number; r: number; w: number; size: number; tw: number; ts: number; star: boolean };
type Dust = { x: number; y: number; vx: number; vy: number; size: number; life: number; max: number; hue: number };
type Spark = { a: number; r: number; v: number; size: number; life: number; max: number; gold: boolean };

function runEmbers(canvas: HTMLCanvasElement, clock: () => number, alive: () => boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  const fit = () => {
    W = canvas.clientWidth;
    canvas.width = W * dpr;
    canvas.height = W * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  const embers: Ember[] = Array.from({ length: 34 }, (_, i) => ({
    a: Math.random() * Math.PI * 2,
    r: 0.37 + Math.random() * 0.11,
    w: (0.12 + Math.random() * 0.2) * (Math.random() > 0.3 ? 1 : -1),
    size: 1.1 + Math.random() * 2.2,
    tw: Math.random() * Math.PI * 2,
    ts: 2 + Math.random() * 3,
    star: i % 6 === 0,
  }));
  const newDust = (): Dust => ({
    x: 0.5 + (Math.random() - 0.5) * 0.62,
    y: 0.9 + Math.random() * 0.04,
    vx: (Math.random() - 0.5) * 0.02,
    vy: -(0.05 + Math.random() * 0.09),
    size: 0.8 + Math.random() * 1.8,
    life: 0,
    max: 1.6 + Math.random() * 1.6,
    hue: 25 + Math.random() * 25,
  });
  const dust: Dust[] = Array.from({ length: 30 }, () => {
    const d = newDust();
    d.life = Math.random() * d.max;
    return d;
  });
  const sparks: Spark[] = [];
  let fired = 0;
  let prev = clock();

  const star = (x: number, y: number, R: number, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const rot = (Math.PI / 2) * i;
      ctx.lineTo(Math.cos(rot) * R, Math.sin(rot) * R);
      ctx.lineTo(Math.cos(rot + Math.PI / 4) * R * 0.28, Math.sin(rot + Math.PI / 4) * R * 0.28);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 245, 210, ${alpha})`;
    ctx.shadowColor = 'rgba(255, 150, 40, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  };
  const dot = (x: number, y: number, r: number, fill: string, glow: string, blur: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
    ctx.fill();
  };

  const frame = () => {
    if (!alive()) return;
    if (canvas.clientWidth !== W) fit();
    const t = clock();
    const dt = Math.min(0.05, Math.max(0, t - prev));
    prev = t;
    // A burst of sparks on each "lub", flying out from the cross's edge.
    while (fired < BEATS.length && t >= BEATS[fired]) {
      for (let i = 0; i < 22; i++)
        sparks.push({
          a: (i / 22) * Math.PI * 2 + Math.random() * 0.2,
          r: 0.33 + Math.random() * 0.03,
          v: 0.12 + Math.random() * 0.14,
          size: 1 + Math.random() * 1.8,
          life: 0,
          max: 0.6 + Math.random() * 0.4,
          gold: Math.random() > 0.4,
        });
      fired++;
    }
    const cx = W * 0.5;
    const cy = W * 0.5;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    for (const d of dust) {
      d.life += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const p = d.life / d.max;
      const fade = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      const al = Math.max(0, 0.85 * fade);
      dot(d.x * W, d.y * W, d.size, `hsla(${d.hue}, 100%, 72%, ${al})`, `hsla(${d.hue}, 100%, 55%, ${al})`, 6);
      if (d.life >= d.max) Object.assign(d, newDust());
    }
    for (const e of embers) {
      e.a += e.w * dt;
      e.tw += e.ts * dt;
      const x = cx + Math.cos(e.a) * e.r * W;
      const y = cy + Math.sin(e.a) * e.r * W;
      const al = 0.25 + 0.75 * Math.abs(Math.sin(e.tw));
      if (e.star) star(x, y, e.size * 2.6, al);
      else dot(x, y, e.size, `rgba(255, 214, 140, ${al})`, 'rgba(255, 130, 30, 0.85)', 10);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      const p = s.life / s.max;
      if (p >= 1) {
        sparks.splice(i, 1);
        continue;
      }
      const r = (s.r + s.v * (1 - Math.pow(1 - p, 3))) * W;
      const al = 1 - p;
      dot(cx + Math.cos(s.a) * r, cy + Math.sin(s.a) * r, s.size * (1 - p * 0.4), s.gold ? `rgba(255, 236, 190, ${al})` : `rgba(255, 150, 70, ${al})`, 'rgba(255, 120, 30, 0.9)', 9);
    }
    ctx.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function ArogyaPulse({ sound = true, onEnd, className }: { sound?: boolean; onEnd?: () => void; className?: string }) {
  const [go, setGo] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const end = useRef(onEnd);
  end.current = onEnd;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => end.current?.(), 600);
      return () => clearTimeout(t);
    }
    let alive = true;
    let timer = 0;
    let fallback = 0;
    const anims: Animation[] = [];
    let origin = 0; // document-timeline ms at which the beat timeline is 0
    let started = false;
    let audio: HTMLAudioElement | null = null;
    // (__agNow lets a recording tool step the embers frame by frame)
    const now = () => ((window as unknown as { __agNow?: number }).__agNow ?? (document.timeline.currentTime as number) ?? performance.now());
    const clock = () => (now() - origin) / 1000;

    const build = () => {
      const el = root.current;
      if (!el || typeof el.animate !== 'function') return;
      const opts: KeyframeAnimationOptions = { duration: TOTAL * 1000, fill: 'both', easing: 'linear' };
      const add = (s: string, k: Keyframe[]) => el.querySelectorAll<Element>(s).forEach((n) => anims.push(n.animate(k, opts)));

      // Only the heart beats: lub (big), dub (smaller).
      add('.ag-heart', onBeats({ transform: 'scale(1)' }, [
        [0, { transform: 'scale(1)', easing: 'cubic-bezier(.3,0,.2,1)' }],
        [0.07, { transform: 'scale(1.09)', easing: 'cubic-bezier(.4,0,.6,1)' }],
        [0.15, { transform: 'scale(0.985)', easing: 'cubic-bezier(.3,0,.2,1)' }],
        [0.24, { transform: 'scale(1.045)', easing: 'cubic-bezier(.3,0,.4,1)' }],
        [0.48, { transform: 'scale(1)' }],
      ]));
      add('.ag-heart-glow', onBeats({ opacity: 0.35 }, [
        [0, { opacity: 0.35 }],
        [0.07, { opacity: 1 }],
        [0.15, { opacity: 0.6 }],
        [0.24, { opacity: 0.9 }],
        [0.6, { opacity: 0.35 }],
      ]));
      // Laser pulse along the heartbeat line, hitting the spike on the "lub".
      const D = 0.75;
      const lead = (ECG_PEAK / 1.25) * D;
      add('.ag-laser', onBeats({ strokeDashoffset: 0.25, opacity: 0 }, [
        [-lead, { strokeDashoffset: 0.25, opacity: 1 }],
        [D - lead - 0.1, { opacity: 1 }],
        [D - lead, { strokeDashoffset: -1, opacity: 0 }],
      ]));
      add('.ag-ecg-glow', onBeats({ opacity: 0.55 }, [
        [0, { opacity: 0.55 }],
        [0.08, { opacity: 1 }],
        [0.5, { opacity: 0.55 }],
      ]));
      add('.ag-tip', onBeats({ transform: 'scale(.85)', opacity: 0.7 }, [
        [0, { transform: 'scale(.85)', opacity: 0.7 }],
        [0.08, { transform: 'scale(1.45)', opacity: 1 }],
        [0.5, { transform: 'scale(.85)', opacity: 0.7 }],
      ]));
      // Around the cross: aura swells, a shock ring rolls out, the rings flare.
      add('.ag-aura', onBeats({ transform: 'scale(1)', opacity: 0.8 }, [
        [0, { transform: 'scale(1)', opacity: 0.8 }],
        [0.09, { transform: 'scale(1.08)', opacity: 1 }],
        [0.26, { transform: 'scale(1.04)', opacity: 0.95 }],
        [0.7, { transform: 'scale(1)', opacity: 0.8 }],
      ]));
      add('.ag-shock', onBeats({ transform: 'scale(.8)', opacity: 0 }, [
        [0.01, { transform: 'scale(.8)', opacity: 0.85, easing: 'cubic-bezier(.1,.6,.3,1)' }],
        [0.8, { transform: 'scale(1.5)', opacity: 0 }],
      ]));
      add('.ag-rings', onBeats({ opacity: 0.85 }, [
        [0, { opacity: 0.85 }],
        [0.08, { opacity: 1 }],
        [0.5, { opacity: 0.85 }],
      ]));
    };
    const sync = () => anims.forEach((a) => (a.startTime = origin));

    const start = () => {
      if (!alive || started) return;
      started = true;
      origin = now();
      setGo(true);
      build();
      sync();
      if (canvas.current) runEmbers(canvas.current, clock, () => alive);
      timer = window.setTimeout(() => end.current?.(), PULSE_MS);
    };

    if (!sound) start();
    else {
      // Wait briefly for the sound so the first thump and the first beat land together.
      fallback = window.setTimeout(start, 700);
      preloadPulse().then((u) => {
        if (!alive) return;
        const a = new Audio(u);
        a.preload = 'auto';
        audio = a;
        a.addEventListener(
          'playing',
          () => {
            if (!alive) return;
            start();
            // Lock everything to where the sound actually is.
            if (clock() < 0.6) {
              origin = now() - a.currentTime * 1000;
              sync();
            } else a.pause(); // too late to match — stay silent rather than out of step
          },
          { once: true },
        );
        const play = () => {
          window.clearTimeout(fallback);
          a.play().catch(() => start());
        };
        if (a.readyState >= 3) play();
        else a.addEventListener('canplaythrough', play, { once: true });
      });
    }
    return () => {
      alive = false;
      window.clearTimeout(fallback);
      window.clearTimeout(timer);
      audio?.pause();
      anims.forEach((x) => x.cancel());
    };
  }, [sound, reduced]);

  return (
    <div ref={root} className={`hp-stage ag${go ? ' go' : ''}${reduced ? ' still' : ''}${className ? ` ${className}` : ''}`} aria-hidden>
      <span className="ag-aura" />
      <span className="ag-shock" />
      <canvas ref={canvas} className="ag-embers" />
      <svg className="ag-svg" viewBox="100 65 600 600" fill="none">
        <defs>
          <filter id="agGold" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="b1" />
            <feGaussianBlur stdDeviation="18" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="agLaser" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="t" />
            <feGaussianBlur stdDeviation="10" result="m" />
            <feGaussianBlur stdDeviation="20" result="w" />
            <feMerge>
              <feMergeNode in="w" />
              <feMergeNode in="m" />
              <feMergeNode in="t" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="agCrossShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="18" stdDeviation="20" floodColor="#7c1808" floodOpacity="0.32" />
            <feDropShadow dx="0" dy="0" stdDeviation="28" floodColor="#ff8c24" floodOpacity="0.45" />
          </filter>
          <filter id="agGlowWide" filterUnits="userSpaceOnUse" x="0" y="0" width="800" height="800">
            <feGaussianBlur stdDeviation="7" result="b1" />
            <feGaussianBlur stdDeviation="14" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="agHeartGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <linearGradient id="agRim" x1="220" y1="145" x2="580" y2="585" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffb85c" />
            <stop offset="25%" stopColor="#ea4c1f" />
            <stop offset="65%" stopColor="#b51c12" />
            <stop offset="100%" stopColor="#7a0e08" />
          </linearGradient>
          <radialGradient id="agRecess" cx="50%" cy="38%" r="58%" fx="50%" fy="32%">
            <stop offset="0%" stopColor="#ff6a24" />
            <stop offset="42%" stopColor="#d62312" />
            <stop offset="82%" stopColor="#8f0d07" />
            <stop offset="100%" stopColor="#610604" />
          </radialGradient>
          <linearGradient id="agBevel" x1="400" y1="145" x2="400" y2="585" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffdca8" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ff8438" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffa652" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="agHeart" cx="46%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="55%" stopColor="#fff3eb" stopOpacity="0.92" />
            <stop offset="82%" stopColor="#ffd5bd" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffb38a" stopOpacity="0.9" />
          </radialGradient>
          <radialGradient id="agHeartWarm" cx="50%" cy="52%" r="48%">
            <stop offset="0%" stopColor="#ffae42" stopOpacity="0.65" />
            <stop offset="55%" stopColor="#ff661a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="agHalo1" x1="150" y1="150" x2="650" y2="600" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff6d6" stopOpacity="0" />
            <stop offset="30%" stopColor="#ffcf70" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="80%" stopColor="#ff9330" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff6a00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="agHalo2" x1="650" y1="180" x2="160" y2="550" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffae38" stopOpacity="0" />
            <stop offset="45%" stopColor="#ffe5a3" stopOpacity="0.8" />
            <stop offset="75%" stopColor="#ff771c" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="agFloor" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8c2d19" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#b85d38" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f5f0eb" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="agFountain" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff8de" stopOpacity="1" />
            <stop offset="35%" stopColor="#ffae38" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#ea4315" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f5f0eb" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. golden light rings swirling around the cross (behind it) */}
        <g className="ag-rings">
          <g className="ag-swirl cw">
            <circle cx="400" cy="365" r="248" stroke="url(#agHalo1)" strokeWidth="3.5" strokeDasharray="360 180 220 140" strokeLinecap="round" filter="url(#agGold)" />
            <circle cx="400" cy="365" r="222" stroke="url(#agHalo2)" strokeWidth="2" strokeDasharray="280 240" strokeLinecap="round" opacity="0.85" />
            <path d="M 605 215 L 610 227 L 622 232 L 610 237 L 605 249 L 600 237 L 588 232 L 600 227 Z" fill="#fff7d6" filter="url(#agGlowWide)" />
            <path d="M 272 175 L 275 183 L 283 186 L 275 189 L 272 197 L 269 189 L 261 186 L 269 183 Z" fill="#ffd27d" />
          </g>
          <g className="ag-swirl ccw">
            <ellipse cx="400" cy="365" rx="268" ry="254" stroke="url(#agHalo2)" strokeWidth="4" strokeDasharray="420 300" strokeLinecap="round" filter="url(#agGold)" opacity="0.9" />
            <circle cx="400" cy="365" r="200" stroke="url(#agHalo1)" strokeWidth="2.5" strokeDasharray="190 220 140 180" strokeLinecap="round" />
            <path transform="translate(612 268)" d="M 0 -18 L 4 -4 L 18 0 L 4 4 L 0 18 L -4 4 L -18 0 L -4 -4 Z" fill="#ffffff" filter="url(#agGlowWide)" />
          </g>
          <g className="ag-swirl fast">
            <circle cx="400" cy="365" r="236" stroke="#fff9e6" strokeWidth="1.5" strokeDasharray="80 450" strokeLinecap="round" filter="url(#agGold)" />
          </g>
        </g>

        {/* 2. floor shadow and the golden light at the cross's base */}
        <g className="ag-floor">
          <ellipse cx="400" cy="590" rx="220" ry="18" fill="url(#agFloor)" />
          <ellipse cx="400" cy="588" rx="68" ry="14" fill="url(#agFountain)" filter="url(#agGold)" />
        </g>

        {/* 3. glossy 3D cross — settles in once, then stays still */}
        <g className="ag-cross" filter="url(#agCrossShadow)">
          <path d={CROSS_OUTER} fill="url(#agRim)" stroke="url(#agBevel)" strokeWidth="3" />
          <path d={CROSS_INNER} fill="url(#agRecess)" />
          <path d={CROSS_RIM} stroke="#ffae66" strokeWidth="2" strokeOpacity="0.55" />
          <path d="M 356 205 A 44 42 0 0 1 444 205" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
        </g>

        {/* 4. translucent heart — the only thing that beats */}
        <g className="ag-heart-in">
          <g className="ag-heart">
            <path className="ag-heart-glow" d={HEART} fill="#ffd9a0" filter="url(#agHeartGlow)" />
            <path d={HEART} fill="url(#agHeart)" stroke="#ffffff" strokeWidth="2.5" />
            <path d={HEART_CORE} fill="url(#agHeartWarm)" />
            <ellipse cx="338" cy="296" rx="26" ry="13" transform="rotate(-24 338 296)" fill="#ffffff" opacity="0.85" />
            <ellipse cx="464" cy="296" rx="24" ry="12" transform="rotate(24 464 296)" fill="#ffffff" opacity="0.75" />
          </g>
        </g>

        {/* 5. glowing heartbeat line with a laser pulse on every beat */}
        <g className="ag-ecg">
          <path className="ag-ecg-glow" d={ECG} stroke="#ff6a00" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
          <path d={ECG} stroke="#ffc46b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path
            className="ag-laser"
            d={ECG}
            pathLength={1}
            stroke="#ffffff"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.25 1.75"
            strokeDashoffset="0.25"
            filter="url(#agLaser)"
            opacity="0"
          />
          <g className="ag-tip" style={{ transformOrigin: '222px 370px' }}>
            <circle cx="222" cy="370" r="8" fill="#ff9d2e" filter="url(#agGlowWide)" />
            <circle cx="222" cy="370" r="4" fill="#ffffff" />
          </g>
          <g className="ag-tip" style={{ transformOrigin: '578px 370px' }}>
            <circle cx="578" cy="370" r="9" fill="#ff9d2e" filter="url(#agGlowWide)" />
            <circle cx="578" cy="370" r="4.5" fill="#ffffff" />
          </g>
        </g>
      </svg>
    </div>
  );
}
