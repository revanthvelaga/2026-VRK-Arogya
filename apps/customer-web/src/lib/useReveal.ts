import { useEffect, type RefObject } from 'react';

// Fades and lifts each direct child of `ref` into view as it scrolls on
// screen (once). The container can be `display: contents` so layout is
// untouched. Does nothing under reduced motion.
export function useReveal(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(root.children).filter((el) => !el.classList.contains('rv-in')) as HTMLElement[];
    if (!('IntersectionObserver' in window)) return;
    items.forEach((el) => el.classList.add('rv'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('rv-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    // A fast fling can jump past an item without it ever intersecting;
    // reveal anything that is already above the bottom of the screen.
    let raf = 0;
    const sweep = () => {
      raf = 0;
      for (const el of items) {
        if (!el.classList.contains('rv-in') && el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('rv-in');
          io.unobserve(el);
        }
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sweep);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
