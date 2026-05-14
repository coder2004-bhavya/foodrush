'use client';
// src/store/cart.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  restaurantId: string;
  restaurantName: string;
  notes?: string;
  customizations?: any;
}

interface CartStore {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  couponCode: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  setCoupon: (code: string | null) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      restaurantName: null,
      couponCode: null,

      addItem: (item) => {
        const { items, restaurantId } = get();
        if (restaurantId && restaurantId !== item.restaurantId) {
          // Clear cart if different restaurant
          set({ items: [{ ...item, quantity: 1 }], restaurantId: item.restaurantId, restaurantName: item.restaurantName, couponCode: null });
          return;
        }
        const existing = items.find(i => i.menuItemId === item.menuItemId);
        if (existing) {
          set({ items: items.map(i => i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i) });
        } else {
          set({ items: [...items, { ...item, quantity: 1 }], restaurantId: item.restaurantId, restaurantName: item.restaurantName });
        }
      },

      removeItem: (menuItemId) => {
        const { items } = get();
        const item = items.find(i => i.menuItemId === menuItemId);
        if (!item) return;
        if (item.quantity === 1) {
          const newItems = items.filter(i => i.menuItemId !== menuItemId);
          set({ items: newItems, restaurantId: newItems.length === 0 ? null : get().restaurantId });
        } else {
          set({ items: items.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i) });
        }
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity === 0) return get().removeItem(menuItemId);
        set({ items: get().items.map(i => i.menuItemId === menuItemId ? { ...i, quantity } : i) });
      },

      clearCart: () => set({ items: [], restaurantId: null, restaurantName: null, couponCode: null }),
      setCoupon: (code) => set({ couponCode: code }),
    }),
    { name: 'foodrush-cart' }
  )
);
