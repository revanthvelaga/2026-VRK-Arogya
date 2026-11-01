import { useId } from 'react';

// The Arogya brand scene: a bold teal-blue plus with a white heart and a
// heartbeat line, and two doctors leaning on it. When `animated`, the plus
// pops in with a glow, the doctors walk in from either side and settle into
// their poses, the heartbeat line draws across, and the heart keeps beating.
// `glow` adds the soft light rings and sparkles behind it (login + welcome).

// Heart fitted into the box (x, y, w, h), drawn from a unit heart.
function heartPath(x: number, y: number, w: number, h: number) {
  const p = (u: number, v: number) => `${(x + u * w).toFixed(1)} ${(y + v * h).toFixed(1)}`;
  return [
    `M${p(0.5, 0.22)}`,
    `C${p(0.5, 0.07)} ${p(0.36, 0)} ${p(0.24, 0)}`,
    `C${p(0.1, 0)} ${p(0, 0.12)} ${p(0, 0.29)}`,
    `C${p(0, 0.56)} ${p(0.3, 0.76)} ${p(0.5, 1)}`,
    `C${p(0.7, 0.76)} ${p(1, 0.56)} ${p(1, 0.29)}`,
    `C${p(1, 0.12)} ${p(0.9, 0)} ${p(0.76, 0)}`,
    `C${p(0.64, 0)} ${p(0.5, 0.07)} ${p(0.5, 0.22)}`,
    'Z',
  ].join(' ');
}

const HEART = heartPath(768, 845, 520, 445);
const ECG =
  'M640 1058 H880 L902 1012 L926 1094 L966 922 L1008 1186 L1044 998 L1068 1080 L1090 1058 H1250';

const SPARKS = Array.from({ length: 28 }, (_, i) => ({
  left: `${8 + ((i * 41) % 84)}%`,
  top: `${10 + ((i * 29) % 78)}%`,
  size: 3 + ((i * 5) % 5),
  delay: `${((i * 7) % 20) / 10}s`,
  dur: `${2.4 + ((i * 3) % 7) / 4}s`,
}));

// One doctor: the upper body and the legs are the same picture clipped at the
// hip, so the legs can swing from the hip while the body bobs with each step.
function Doctor({ cls, href, x, y, w, h, hipX, hipY, top, leg }: {
  cls: string; href: string; x: number; y: number; w: number; h: number; hipX: number; hipY: number; top: string; leg: string;
}) {
  return (
    <g className={`as-doc ${cls}`}>
      <g className="as-walk">
        <g transform={`translate(${hipX} ${hipY})`}>
          <g className="as-legs">
            <image href={href} x={x - hipX} y={y - hipY} width={w} height={h} clipPath={`url(#${leg})`} />
          </g>
        </g>
        <g className="as-body">
          <image href={href} x={x} y={y} width={w} height={h} clipPath={`url(#${top})`} />
        </g>
      </g>
    </g>
  );
}

export function ArogyaScene({
  size = 240,
  animated = true,
  glow = false,
  warm = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  glow?: boolean;
  /** Red-orange glowing palette (login and welcome); default is teal-blue. */
  warm?: boolean;
  className?: string;
}) {
  const plusStops = warm
    ? [['0', '#C81E2C'], ['0.5', '#EE4A2C'], ['1', '#FB7A26']]
    : [['0', '#1BD1BC'], ['0.55', '#14A9C9'], ['1', '#2459E8']];
  const ecgStops = warm ? ['#FF7A1A', '#E0262F'] : ['#FF7A1A', '#E0262F'];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = (n: string) => `${n}${uid}`;

  const svg = (
    <svg
      className={`as-svg${animated ? ' as-anim' : ''}`}
      viewBox="440 420 1160 1160"
      width={size}
      height={size}
      role="img"
      aria-label="Arogya"
    >
      <defs>
        <linearGradient id={g('pl')} x1="0" y1="0" x2="1" y2={warm ? '0.35' : '1'}>
          {plusStops.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id={g('core')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFC27A" stopOpacity={warm ? 0.85 : 0} />
          <stop offset="1" stopColor="#FFC27A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('sh')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('ecg')} x1="0" x2="1">
          <stop offset="0" stopColor={ecgStops[0]} />
          <stop offset="1" stopColor={ecgStops[1]} />
        </linearGradient>
        <clipPath id={g('hc')}>
          <path d={HEART} />
        </clipPath>
        <mask id={g('out')}>
          <rect x="440" y="420" width="1160" height="1160" fill="#fff" />
          <path d={HEART} fill="#000" />
        </mask>
      </defs>

      <g className="as-plus">
        <rect x="862" y="466" width="341" height="1050" rx="170" fill={`url(#${g('pl')})`} />
        <rect x="498" y="811" width="1039" height="392" rx="196" fill={`url(#${g('pl')})`} />
        <rect x="862" y="466" width="341" height="1050" rx="170" fill={`url(#${g('sh')})`} />
        <rect x="498" y="811" width="1039" height="392" rx="196" fill={`url(#${g('sh')})`} />
        {warm && <ellipse className="as-core" cx="1030" cy="1010" rx="430" ry="380" fill={`url(#${g('core')})`} />}
      </g>

      <g className="as-heart">
        <path d={HEART} fill="#fff" />
        <path
          className="as-ecg"
          d={ECG}
          pathLength={1}
          fill="none"
          stroke={`url(#${g('ecg')})`}
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${g('hc')})`}
        />
        <path
          className="as-ecg"
          d={ECG}
          pathLength={1}
          fill="none"
          stroke="#fff"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          mask={`url(#${g('out')})`}
        />
      </g>

      <defs>
        <clipPath id={g('wTop')}><rect x="540" y="960" width="360" height="303" /></clipPath>
        <clipPath id={g('wLeg')}><rect x="-200" y="-4" width="400" height="300" /></clipPath>
        <clipPath id={g('mTop')}><rect x="1170" y="930" width="360" height="313" /></clipPath>
        <clipPath id={g('mLeg')}><rect x="-200" y="-4" width="400" height="330" /></clipPath>
      </defs>
      <Doctor cls="as-woman" href="/brand/doctor-woman.webp" x={560} y={990} w={320} h={555} hipX={720} hipY={1260} top={g('wTop')} leg={g('wLeg')} />
      <Doctor cls="as-man" href="/brand/doctor-man.webp" x={1190} y={950} w={310} h={595} hipX={1345} hipY={1240} top={g('mTop')} leg={g('mLeg')} />
    </svg>
  );

  if (!glow) return <span className={className}>{svg}</span>;

  return (
    <div className={`as-glow${warm ? ' warm' : ''}${animated ? ' as-anim' : ''}${className ? ` ${className}` : ''}`} style={{ width: size * 1.35, height: size * 1.2 }}>
      <span className="as-halo" aria-hidden />
      <span className="as-ring r1" aria-hidden />
      <span className="as-ring r2" aria-hidden />
      <span className="as-ring r3" aria-hidden />
      {warm && <span className="as-ground" aria-hidden />}
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="as-spark"
          aria-hidden
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
      {svg}
    </div>
  );
}
