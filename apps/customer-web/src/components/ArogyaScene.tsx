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

const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  left: `${8 + ((i * 41) % 84)}%`,
  top: `${10 + ((i * 29) % 78)}%`,
  size: 3 + ((i * 5) % 5),
  delay: `${((i * 7) % 20) / 10}s`,
  dur: `${2.4 + ((i * 3) % 7) / 4}s`,
}));

export function ArogyaScene({
  size = 240,
  animated = true,
  glow = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  glow?: boolean;
  className?: string;
}) {
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
        <linearGradient id={g('pl')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1BD1BC" />
          <stop offset="0.55" stopColor="#14A9C9" />
          <stop offset="1" stopColor="#2459E8" />
        </linearGradient>
        <linearGradient id={g('sh')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('ecg')} x1="0" x2="1">
          <stop offset="0" stopColor="#10B5A6" />
          <stop offset="1" stopColor="#2563EB" />
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

      <g className="as-doc as-woman">
        <g className="as-walk">
          <image href="/brand/doctor-woman.webp" x="560" y="990" width="320" height="555" />
        </g>
      </g>
      <g className="as-doc as-man">
        <g className="as-walk">
          <image href="/brand/doctor-man.webp" x="1190" y="950" width="310" height="595" />
        </g>
      </g>
    </svg>
  );

  if (!glow) return <span className={className}>{svg}</span>;

  return (
    <div className={`as-glow${animated ? ' as-anim' : ''}${className ? ` ${className}` : ''}`} style={{ width: size * 1.35, height: size * 1.2 }}>
      <span className="as-halo" aria-hidden />
      <span className="as-ring r1" aria-hidden />
      <span className="as-ring r2" aria-hidden />
      <span className="as-ring r3" aria-hidden />
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
