import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
  clear: () => void;
  total: number;
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStored());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage can be unavailable — the cart just won't survive a reload.
    }
  }, [items]);

  const add = (item: CartItem) => {
    setItems((prev) =>
      prev.some((i) => i.kind === item.kind && i.id === item.id) ? prev : [...prev, item],
    );
  };

  const remove = (kind: CartItem['kind'], id: string) => {
    setItems((prev) => prev.filter((i) => !(i.kind === kind && i.id === id)));
  };

  const has = (kind: CartItem['kind'], id: string) =>
    items.some((i) => i.kind === kind && i.id === id);

  const clear = () => setItems([]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);

  const value = useMemo(() => ({ items, add, remove, has, clear, total }), [items, total]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
