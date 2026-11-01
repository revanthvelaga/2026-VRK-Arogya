import { useEffect, useRef, useState } from 'react';
import { IconCheckCircle } from './Icons';

// The closing note on Home: what Arogya is for, in plain words, with a
// drawing of our collection scooter heading out to a village. The scooter
// rides in once, the first time the section scrolls into view.
export function VillagePromise() {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return (
    <section ref={ref} className={`promise${seen ? ' is-seen' : ''}`} aria-labelledby="promise-title">
      <h2 id="promise-title" className="promise-title">
        Good health shouldn’t need a bus ride to the city.
      </h2>

      <ul className="promise-points">
        <li>
          <IconCheckCircle size={18} />
          We collect at your home or panchayat office, up to 20 km away
        </li>
        <li>
          <IconCheckCircle size={18} />
          Results in a day — even tests sent to our Visakhapatnam partner lab
        </li>
        <li>
          <IconCheckCircle size={18} />
          Prices shown up front, and a free recollection if a sample fails
        </li>
      </ul>

      <svg className="promise-art" viewBox="0 0 360 210" role="img" aria-label="An Arogya scooter with a sample box riding to a village">
        <defs>
          <linearGradient id="pr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e6f6f4" />
            <stop offset="1" stopColor="#fdf4ec" />
          </linearGradient>
          <clipPath id="pr-clip">
            <rect width="360" height="210" rx="22" />
          </clipPath>
        </defs>
        <g clipPath="url(#pr-clip)">
        <rect width="360" height="210" fill="url(#pr-sky)" />
        {/* sun and hills */}
        <circle cx="292" cy="52" r="20" fill="#fbd38d" />
        <path d="M0 140 C60 104 110 112 168 132 C220 150 280 108 360 124 V210 H0Z" fill="#cdeee8" />
        <path d="M0 158 C70 138 140 146 200 156 C260 166 310 148 360 152 V210 H0Z" fill="#b5e3da" />
        {/* village: two houses and a palm */}
        <g transform="translate(232 104)">
          <rect x="0" y="22" width="44" height="30" fill="#fff7ef" />
          <path d="M-5 24 L22 4 L49 24Z" fill="#e07a5f" />
          <rect x="17" y="34" width="10" height="18" fill="#c8775d" />
          <rect x="54" y="30" width="34" height="22" fill="#fff7ef" />
          <path d="M50 32 L71 16 L92 32Z" fill="#d4664b" />
          <rect x="64" y="38" width="9" height="8" fill="#9fd8cf" />
        </g>
        <g transform="translate(206 70)">
          <path d="M8 86 C10 60 6 34 12 14" stroke="#8a6a4f" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M12 14 C0 6 -14 10 -18 18 M12 14 C22 4 36 6 40 14 M12 14 C6 0 14 -10 22 -10 M12 14 C2 18 -4 30 -4 34 M12 14 C24 18 30 28 30 34" stroke="#3aa58f" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
        {/* road */}
        <path d="M0 186 C90 170 200 176 360 166" stroke="#f1e2d3" strokeWidth="22" fill="none" />
        <path d="M0 186 C90 170 200 176 360 166" stroke="#fff" strokeWidth="2" strokeDasharray="10 12" fill="none" />
        {/* scooter + rider + sample box */}
        <g className="promise-scooter" transform="translate(70 128)">
          <g className="promise-dust" fill="#e9d9c8">
            <circle cx="-6" cy="44" r="5" />
            <circle cx="-16" cy="40" r="3.5" />
          </g>
          <rect x="-2" y="10" width="26" height="22" rx="4" fill="#c8321f" />
          <path d="M11 15 v12 M5 21 h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M4 34 H52 C60 34 64 28 66 20 L70 8" stroke="#9e1c12" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M70 8 L76 6" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
          <path d="M28 34 C28 24 36 20 46 22 L54 34" fill="#9e1c12" />
          {/* rider */}
          <path d="M40 22 L36 6 L48 0 L56 12 L50 24" fill="#f97316" />
          <path d="M44 24 L56 30 L60 36" stroke="#334155" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M50 4 L66 10" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
          <circle cx="46" cy="-8" r="8" fill="#a16207" />
          <path d="M37 -9 A9 9 0 0 1 55 -10 L55 -6 L37 -5Z" fill="#ffffff" stroke="#c8321f" strokeWidth="2" />
          {/* wheels */}
          <g className="promise-wheel" style={{ transformOrigin: '12px 40px' }}>
            <circle cx="12" cy="40" r="9" fill="#334155" />
            <circle cx="12" cy="40" r="3.5" fill="#e2e8f0" />
            <path d="M12 31 V49" stroke="#94a3b8" strokeWidth="1.5" />
          </g>
          <g className="promise-wheel" style={{ transformOrigin: '62px 40px' }}>
            <circle cx="62" cy="40" r="9" fill="#334155" />
            <circle cx="62" cy="40" r="3.5" fill="#e2e8f0" />
            <path d="M62 31 V49" stroke="#94a3b8" strokeWidth="1.5" />
          </g>
        </g>
        </g>
      </svg>

      <p className="promise-signoff">Made for our villages, by people from here.</p>
    </section>
  );
}
