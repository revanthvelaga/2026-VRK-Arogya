import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  kind: 'test' | 'package';
  id: string;
  name: string;
  price: number;
  meta?: string;
}

interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  add: (item: CartItem) => void;
  remove: (kind: CartItem['kind'], id: string) => void;
  has: (kind: CartItem['kind'], id: string) => boolean;
  clear: () => void;
  total: number;
}

const STORAGE_KEY = 'arogya_cart';
const CartContext = createContext<CartContextValue | null>(null);

// Same shape and behavior as customer-web's CartContext — AsyncStorage
// instead of localStorage is the only real difference.
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setItems(JSON.parse(raw) as CartItem[]);
      })
      .catch(() => {
        // Storage unavailable — cart just starts empty.
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {
      // Storage can fail on some devices — the cart just won't survive a reload.
    });
  }, [items, ready]);

  const add = (item: CartItem) => {
    setItems((prev) => (prev.some((i) => i.kind === item.kind && i.id === item.id) ? prev : [...prev, item]));
  };

  const remove = (kind: CartItem['kind'], id: string) => {
    setItems((prev) => prev.filter((i) => !(i.kind === kind && i.id === id)));
  };

  const has = (kind: CartItem['kind'], id: string) => items.some((i) => i.kind === kind && i.id === id);

  const clear = () => setItems([]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);

  const value = useMemo(() => ({ items, ready, add, remove, has, clear, total }), [items, ready, total]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
