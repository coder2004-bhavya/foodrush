'use client';
// src/components/cart/CartSidebar.tsx
import Link from 'next/link';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/cart';

export function CartSidebar({ restaurantId }: { restaurantId?: string }) {
  const { items, restaurantId: cartRestaurantId, removeItem, updateQuantity } = useCartStore();

  const myItems = restaurantId && cartRestaurantId === restaurantId ? items : [];
  const subtotal = myItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal + 30; // delivery fee estimate

  if (myItems.length === 0) {
    return (
      <div className="card p-6 text-center">
        <ShoppingBag size={40} className="mx-auto text-surface-200 mb-3" />
        <p className="font-semibold text-gray-700 mb-1">Your cart is empty</p>
        <p className="text-sm text-gray-400">Add items from the menu to get started</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-brand-500 px-4 py-3">
        <h3 className="font-display font-bold text-white">Your Order</h3>
        <p className="text-brand-100 text-xs">{myItems[0]?.restaurantName}</p>
      </div>

      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {myItems.map(item => (
          <div key={item.menuItemId} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-brand-600 font-semibold">₹{item.price}</p>
            </div>
            <div className="flex items-center gap-1 bg-brand-500 text-white rounded-lg overflow-hidden">
              <button
                onClick={() => removeItem(item.menuItemId)}
                className="px-2 py-1 hover:bg-brand-600 transition-colors"
              >
                {item.quantity === 1 ? <Trash2 size={11} /> : <Minus size={11} />}
              </button>
              <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                className="px-2 py-1 hover:bg-brand-600 transition-colors"
              >
                <Plus size={11} />
              </button>
            </div>
            <span className="text-xs font-bold text-gray-800 w-10 text-right">
              ₹{item.price * item.quantity}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-100 p-4 space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span><span>₹{subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Delivery fee</span><span>₹30</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base border-t border-surface-100 pt-1.5">
            <span>Total</span><span>₹{total}</span>
          </div>
        </div>

        <Link href="/cart" className="btn-brand w-full">
          Proceed to Checkout <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
