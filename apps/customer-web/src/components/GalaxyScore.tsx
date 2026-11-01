import { useEffect, useRef, useState } from 'react';

// The health score at the heart of a little galaxy: stars swirl in from the
// edge of space and settle into glowing spiral arms that keep orbiting the
// number, the core breathes, a shooting star crosses now and then, and the
// score ring around the disk fills to the score. Canvas, ~60fps, paused when
// off screen; a still frame under reduced motion.

interface Star {
  r: number; // final orbit radius (0..1 of disk)
  a: number; // angle at t=0
  w: number; // angular speed (rad/s)
  size: number;
  color: string;
  tw: number; // twinkle phase
  r0: number; // start radius (outside), for the swirl-in
  a0: number;
  delay: number;
}

const FORM_S = 2.4; // seconds to form the galaxy
const COUNT_S = 1.9;

function easeOut(t: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

function makeStars(n: number, tone: string): Star[] {
  const palette = ['#ffffff', '#ffffff', '#e0f2fe', '#a5f3fc', '#c4b5fd', '#fde68a', tone, tone];
  const arms = 3;
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    const arm = i % arms;
    // More stars near the centre, thinning outwards.
    const r = 0.16 + Math.pow(Math.random(), 0.75) * 0.8;
    const spread = (Math.random() - 0.5) * (0.5 + r * 0.7);
    const a = (arm / arms) * Math.PI * 2 + r * 4.2 + spread;
    stars.push({
      r,
      a,
      w: 0.32 / Math.sqrt(r + 0.15),
      size: Math.random() < 0.08 ? 1.6 + Math.random() * 1.2 : 0.5 + Math.random() * 1.1,
      color: palette[(Math.random() * palette.length) | 0],
      tw: Math.random() * Math.PI * 2,
      r0: 1.3 + Math.random() * 0.9,
      a0: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.6,
    });
  }
  // A sprinkle of distant background stars that don't orbit much.
  for (let i = 0; i < 70; i++) {
    stars.push({
      r: 0.25 + Math.random() * 0.75,
      a: Math.random() * Math.PI * 2,
      w: 0.03,
      size: 0.4 + Math.random() * 0.6,
      color: '#ffffff',
      tw: Math.random() * Math.PI * 2,
      r0: 1.5,
      a0: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.8,
    });
  }
  return stars;
}

export function GalaxyScore({ score, tone, size = 220, empty = false }: { score: number; tone: string; size?: number; empty?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const stars = makeStars(Math.round(size * 1.7), tone);
    const c = size / 2;
    const R = size / 2 - 14; // galaxy disk radius (ring sits outside)
    const ringR = size / 2 - 6;
    let raf = 0;
    let start = 0;
    // Wait until the card is on screen so the swirl-in is actually seen.
    let visible = reduced || !('IntersectionObserver' in window);
    let lastNum = -1;
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = 2.8;

    const frame = (now: number) => {
      if (!start) start = now;
      const t = reduced ? 30 : (now - start) / 1000;

      ctx.clearRect(0, 0, size, size);

      // Deep-space disk.
      const space = ctx.createRadialGradient(c, c, 0, c, c, R);
      space.addColorStop(0, '#1e1b4b');
      space.addColorStop(0.55, '#0f172a');
      space.addColorStop(1, '#020617');
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fillStyle = space;
      ctx.fill();
      ctx.clip();

      // Nebula haze tinted by the score colour, slowly turning.
      const neb = ctx.createRadialGradient(c + Math.cos(t * 0.2) * R * 0.25, c + Math.sin(t * 0.2) * R * 0.25, 0, c, c, R);
      neb.addColorStop(0, tone + '55');
      neb.addColorStop(0.5, '#6366f122');
      neb.addColorStop(1, '#00000000');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, size, size);

      // Stars: swirl in, then orbit.
      ctx.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        const k = easeOut((t - s.delay) / FORM_S);
        if (k <= 0) continue;
        const rr = (s.r0 + (s.r - s.r0) * k) * R;
        const ang = s.a0 + (s.a - s.a0) * k + (1 - k) * 2.6 + s.w * t;
        const x = c + Math.cos(ang) * rr;
        const y = c + Math.sin(ang) * rr * 0.92;
        const twinkle = 0.55 + 0.45 * Math.sin(t * 2.4 + s.tw);
        ctx.globalAlpha = Math.min(1, k * 1.2) * twinkle;
        ctx.fillStyle = s.color;
        if (s.size > 1.5) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s.size * 3.2);
          g.addColorStop(0, s.color);
          g.addColorStop(1, '#00000000');
          ctx.fillStyle = g;
          ctx.fillRect(x - s.size * 3.2, y - s.size * 3.2, s.size * 6.4, s.size * 6.4);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Shooting star.
      if (!reduced && t > nextShoot && !shoot) {
        const a = Math.random() * Math.PI * 2;
        shoot = { x: c + Math.cos(a) * R * 0.9, y: c + Math.sin(a) * R * 0.9, vx: -Math.cos(a + 0.5) * R * 1.6, vy: -Math.sin(a + 0.5) * R * 1.6, life: 0 };
        nextShoot = t + 3.5 + Math.random() * 3;
      }
      if (shoot) {
        shoot.life += 1 / 60;
        const x2 = shoot.x + shoot.vx * shoot.life;
        const y2 = shoot.y + shoot.vy * shoot.life;
        const tail = ctx.createLinearGradient(x2 - shoot.vx * 0.12, y2 - shoot.vy * 0.12, x2, y2);
        tail.addColorStop(0, '#ffffff00');
        tail.addColorStop(1, '#ffffffcc');
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x2 - shoot.vx * 0.12, y2 - shoot.vy * 0.12);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (shoot.life > 0.7) shoot = null;
      }

      // Breathing core behind the number.
      const pulse = 1 + 0.08 * Math.sin(t * 2.2);
      const core = ctx.createRadialGradient(c, c, 0, c, c, R * 0.42 * pulse);
      core.addColorStop(0, '#ffffffcc');
      core.addColorStop(0.25, tone + 'aa');
      core.addColorStop(1, '#00000000');
      ctx.globalAlpha = easeOut(t / 1.2);
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // Score ring around the disk.
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.arc(c, c, ringR, 0, Math.PI * 2);
      ctx.stroke();
      if (!empty) {
        const p = easeOut((t - 0.3) / COUNT_S) * (score / 100);
        if (p > 0) {
          ctx.save();
          ctx.shadowColor = tone;
          ctx.shadowBlur = 14;
          ctx.strokeStyle = tone;
          ctx.beginPath();
          ctx.arc(c, c, ringR, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
          ctx.stroke();
          // A bright spark riding the tip of the ring.
          const tip = -Math.PI / 2 + p * Math.PI * 2;
          ctx.fillStyle = '#fff';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(c + Math.cos(tip) * ringR, c + Math.sin(tip) * ringR, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const num = Math.round(easeOut((t - 0.3) / COUNT_S) * score);
        if (num !== lastNum) {
          lastNum = num;
          setShown(num);
        }
      }

      if (!reduced && visible) raf = requestAnimationFrame(frame);
    };

    if (visible) raf = requestAnimationFrame(frame);

    // Pause while off screen to save battery.
    let io: IntersectionObserver | null = null;
    if (!reduced && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => {
        const was = visible;
        visible = e.isIntersecting;
        if (visible && !was) raf = requestAnimationFrame(frame);
      });
      io.observe(canvas);
    }
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [score, tone, size, empty, reduced]);

  return (
    <div className="galaxy-score" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden />
      <div className="galaxy-label">
        <div className="galaxy-number" style={{ textShadow: `0 0 18px ${tone}, 0 0 4px #fff` }}>
          {empty ? '–' : shown}
        </div>
        {!empty && <div className="galaxy-unit">out of 100</div>}
      </div>
    </div>
  );
}
