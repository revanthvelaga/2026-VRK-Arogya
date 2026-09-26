import { useEffect, useState } from 'react';

// Packages the customer ticked "Compare" on, across pages. Kept in this
// browser only (a convenience — losing it just empties the list).
const KEY = 'arogya_compare';
const EVENT = 'arogya:compare-changed';
export const MAX_COMPARE = 4;

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable — the list lives for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCompareList() {
  const [ids, setIds] = useState<string[]>(() => read());
  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = (id: string) => {
    const cur = read();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-MAX_COMPARE));
  };
  const clear = () => write([]);
  return { ids, toggle, clear, has: (id: string) => ids.includes(id) };
}
