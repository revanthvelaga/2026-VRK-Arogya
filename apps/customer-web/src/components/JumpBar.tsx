import { useEffect, useState } from 'react';

export interface JumpTarget {
  id: string;
  label: string;
}

function headerHeight(): number {
  return (document.querySelector('.site-header') as HTMLElement | null)?.offsetHeight ?? 60;
}

// A sticky row of section links under the site header, for long pages on
// a phone. The current section is highlighted as you scroll.
export function JumpBar({ targets }: { targets: JumpTarget[] }) {
  const [active, setActive] = useState(targets[0]?.id);
  const [top, setTop] = useState(60);

  useEffect(() => {
    setTop(headerHeight());
    const onScroll = () => {
      const offset = headerHeight() + 70;
      let current = targets[0]?.id;
      for (const t of targets) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top - offset <= 0) current = t.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [targets]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - headerHeight() - 56;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <nav className="jump-bar" style={{ top }} aria-label="Page sections">
      {targets.map((t) => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? 'active' : ''}
          onClick={() => go(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
