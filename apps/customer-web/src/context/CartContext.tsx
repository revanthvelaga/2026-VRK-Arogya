import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { Package } from '../api/types';

export interface CartItem {
  kind: 'test' | 'package';
  id: string;
  name: string;
  price: number;
  meta?: string;
}

interface CartContextValue {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (kind: CartItem['kind'], id: string) => void;
  has: (kind: CartItem['kind'], id: string) => boolean;
  // Name of a package in the cart that already includes this test.
  includedIn: (testId: string) => string | undefined;
  clear: () => void;
  total: number;
  // A short message about something the cart did on its own.
  notice: string | null;
  clearNotice: () => void;
}

const STORAGE_KEY = 'arogya_cart';
const CartContext = createContext<CartContextValue | null>(null);

function readStored(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

type PackageContents = Map<string, { name: string; testIds: Set<string> }>;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStored());
  const [contents, setContents] = useState<PackageContents>(new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

  const say = useCallback((text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage can be unavailable — the cart just won't survive a reload.
    }
  }, [items]);

  // Which tests each package contains, so a test is never in the cart
  // alongside a package that already covers it (it'd be paid twice).
  useEffect(() => {
    api
      .get<Package[]>('/catalog/packages')
      .then((pkgs) =>
        setContents(new Map(pkgs.map((p) => [p.id, { name: p.name, testIds: new Set((p.tests ?? []).map((t) => t.id)) }]))),
      )
      .catch(() => undefined);
  }, []);

  const coveringPackage = useCallback(
    (testId: string, list: CartItem[]) =>
      list.find((i) => i.kind === 'package' && contents.get(i.id)?.testIds.has(testId)),
    [contents],
  );

  // Adding a package (or an older cart that already has both) drops the
  // standalone tests it includes.
  useEffect(() => {
    if (!contents.size) return;
    const dropped = items.filter((i) => i.kind === 'test' && coveringPackage(i.id, items));
    if (!dropped.length) return;
    setItems((prev) => prev.filter((i) => !dropped.some((d) => d.id === i.id && d.kind === i.kind)));
    const pkg = coveringPackage(dropped[0].id, items);
    say(
      `${dropped.map((d) => d.name).join(', ')} removed — already included in ${pkg?.name ?? 'your package'}, so you won't pay twice.`,
    );
  }, [items, contents, coveringPackage, say]);

  const add = (item: CartItem) => {
    if (item.kind === 'test') {
      const pkg = coveringPackage(item.id, items);
      if (pkg) {
        say(`${item.name} is already included in ${pkg.name} in your cart.`);
        return;
      }
    }
    setItems((prev) => (prev.some((i) => i.kind === item.kind && i.id === item.id) ? prev : [...prev, item]));
  };

  const remove = (kind: CartItem['kind'], id: string) => {
    setItems((prev) => prev.filter((i) => !(i.kind === kind && i.id === id)));
  };

  const has = (kind: CartItem['kind'], id: string) => items.some((i) => i.kind === kind && i.id === id);

  const includedIn = (testId: string) => coveringPackage(testId, items)?.name;

  const clear = () => setItems([]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);

  const value = useMemo(
    () => ({ items, add, remove, has, includedIn, clear, total, notice, clearNotice: () => setNotice(null) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, total, notice, contents],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
