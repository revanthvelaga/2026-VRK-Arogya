// A one-shot confetti burst from the centre of its parent (which should be
// position: relative). Pieces fly out, tumble and fall away. Pure CSS.
const COLORS = ['#10B5A6', '#2563EB', '#F5B83D', '#FF6B6B', '#8B5CF6', '#34D399'];

const PIECES = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const d = 60 + ((i * 37) % 70);
  return {
    x: Math.round(Math.cos(a) * d),
    y: Math.round(Math.sin(a) * d * 0.8 - 30),
    r: ((i * 97) % 720) - 360,
    c: COLORS[i % COLORS.length],
    w: i % 3 === 0 ? 6 : 8,
    h: i % 3 === 0 ? 6 : 4,
    round: i % 4 === 0,
    delay: (i % 6) * 0.025,
  };
});

export function Confetti({ delay = 0.55 }: { delay?: number }) {
  return (
    <span className="confetti" aria-hidden>
      {PIECES.map((p, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--r': `${p.r}deg`,
              background: p.c,
              width: p.w,
              height: p.h,
              borderRadius: p.round ? '50%' : 2,
              animationDelay: `${delay + p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
