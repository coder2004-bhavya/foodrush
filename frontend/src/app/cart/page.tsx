'use client';
// src/app/cart/page.tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Minus, Trash2, Tag, Star, MapPin, ChevronDown, CreditCard, Smartphone, Banknote, Wallet, ArrowRight, ShoppingBag } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

const PAYMENT_METHODS = [
  { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: Banknote },
  { id: 'WALLET', label: 'FoodRush Wallet', icon: Wallet },
];

export default function CartPage() {
  const router = useRouter();
  const { items, restaurantId, removeItem, updateQuantity, clearCart, couponCode, setCoupon } = useCartStore();
  const { user } = useAuthStore();
  const [couponInput, setCouponInput] = useState('');
  const [couponData, setCouponData] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then(r => r.data),
    enabled: !!user,
  });

  // Set default address
  useState(() => {
    if (addresses?.length > 0) {
      const def = addresses.find((a: any) => a.isDefault) || addresses[0];
      setSelectedAddressId(def?.id);
    }
  });

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = couponData?.type === 'FREE_DELIVERY' ? 0 : 30;
  const couponDiscount = couponData
    ? couponData.type === 'FLAT' ? couponData.value
    : couponData.type === 'PERCENTAGE' ? Math.min(subtotal * couponData.value / 100, couponData.maxDiscount || Infinity)
    : couponData.type === 'FREE_DELIVERY' ? 30 : 0
    : 0;
  const loyaltyDiscount = loyaltyPoints * 0.25;
  const taxes = (subtotal - couponDiscount - loyaltyDiscount) * 0.05;
  const total = Math.max(0, subtotal - couponDiscount - loyaltyDiscount + taxes + deliveryFee);

  const applyCoupon = async () => {
    try {
      const { data } = await api.post('/coupons/validate', { code: couponInput, subtotal, restaurantId });
      setCouponData(data.coupon);
      setCoupon(couponInput);
      setCouponError('');
      toast.success(`Coupon "${couponInput}" applied! Saved ₹${Math.round(couponDiscount)}`);
    } catch (err: any) {
      setCouponError(err.response?.data?.error || 'Invalid coupon');
    }
  };

  const orderMutation = useMutation({
    mutationFn: (orderData: any) => api.post('/orders', orderData).then(r => r.data),
    onSuccess: (order) => {
      clearCart();
      toast.success('Order placed successfully! 🎉');
      router.push(`/orders/${order.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to place order');
    }
  });

  const placeOrder = () => {
    if (!user) { router.push('/auth/login'); return; }
    if (!selectedAddressId) { toast.error('Please select a delivery address'); return; }
    if (items.length === 0) { toast.error('Your cart is empty'); return; }

    orderMutation.mutate({
      restaurantId,
      deliveryAddressId: selectedAddressId,
      items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes, customizations: i.customizations })),
      paymentMethod,
      couponCode: couponCode || undefined,
      loyaltyPointsToUse: loyaltyPoints,
      specialInstructions: specialInstructions || undefined,
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
          <ShoppingBag size={64} className="text-surface-200" />
          <h2 className="text-2xl font-display font-bold text-gray-800">Your cart is empty</h2>
          <p className="text-gray-500 max-w-xs">Looks like you haven't added anything yet. Explore restaurants and find something delicious!</p>
          <Link href="/" className="btn-brand mt-2">Browse Restaurants</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="section-title mb-8">Your Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Cart items + details */}
          <div className="lg:col-span-3 space-y-4">
            {/* Items */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-800">{items[0]?.restaurantName}</h2>
                <button onClick={() => { if (confirm('Clear entire cart?')) clearCart(); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear all</button>
              </div>
              {items.map(item => (
                <div key={item.menuItemId} className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                    <p className="text-brand-600 font-semibold text-sm">₹{item.price}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-brand-500 text-white rounded-xl overflow-hidden">
                    <button onClick={() => removeItem(item.menuItemId)} className="px-2.5 py-1.5 hover:bg-brand-600 transition-colors">
                      {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)} className="px-2.5 py-1.5 hover:bg-brand-600 transition-colors">
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="w-16 text-right font-bold text-gray-900 text-sm">₹{item.price * item.quantity}</div>
                </div>
              ))}
            </div>

            {/* Special instructions */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Special Instructions</h3>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Any allergies, preferences, or notes for the restaurant..."
                className="input-field resize-none"
                rows={3}
              />
            </div>

            {/* Delivery Address */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MapPin size={16} className="text-brand-500" /> Delivery Address
              </h3>
              {!user ? (
                <p className="text-sm text-gray-500">
                  <Link href="/auth/login" className="text-brand-600 font-medium">Sign in</Link> to add a delivery address
                </p>
              ) : addresses?.length > 0 ? (
                <div className="space-y-2">
                  {addresses.map((addr: any) => (
                    <label key={addr.id} className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${selectedAddressId === addr.id ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-brand-300'}`}>
                      <input type="radio" name="address" value={addr.id} checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} className="mt-0.5 accent-brand-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-800">{addr.label}</span>
                          {addr.isDefault && <span className="badge-brand text-[10px]">Default</span>}
                        </div>
                        <p className="text-sm text-gray-500">{addr.line1}, {addr.city} - {addr.pincode}</p>
                      </div>
                    </label>
                  ))}
                  <Link href="/profile#addresses" className="text-sm text-brand-600 font-medium hover:underline">+ Add new address</Link>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-3">No saved addresses</p>
                  <Link href="/profile#addresses" className="btn-outline text-sm py-2 px-4">Add Address</Link>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CreditCard size={16} className="text-brand-500" /> Payment Method
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <label key={id} className={`flex items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${paymentMethod === id ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-brand-300'}`}>
                    <input type="radio" name="payment" value={id} checked={paymentMethod === id} onChange={() => setPaymentMethod(id)} className="accent-brand-500" />
                    <Icon size={16} className={paymentMethod === id ? 'text-brand-500' : 'text-gray-400'} />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Order summary */}
          <div className="lg:col-span-2">
            <div className="card p-4 sticky top-24 space-y-4">
              <h2 className="font-display font-bold text-gray-900">Order Summary</h2>

              {/* Coupon */}
              <div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder="Enter coupon code"
                      className="input-field pl-9 py-2.5 text-sm uppercase font-mono"
                    />
                  </div>
                  <button onClick={applyCoupon} disabled={!couponInput} className="btn-outline py-2.5 px-4 text-sm disabled:opacity-40">Apply</button>
                </div>
                {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
                {couponData && <p className="text-green-600 text-xs mt-1 font-medium">✓ Coupon applied! Saving ₹{Math.round(couponDiscount)}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {['WELCOME50', 'SAVE20', 'FREEDEL'].map(c => (
                    <button key={c} onClick={() => { setCouponInput(c); }} className="text-xs px-2 py-1 bg-brand-50 text-brand-600 font-mono rounded-lg hover:bg-brand-100 transition-colors">{c}</button>
                  ))}
                </div>
              </div>

              {/* Loyalty Points */}
              {user && user.loyaltyPoints > 0 && (
                <div className="bg-yellow-50 rounded-2xl p-3 border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Star size={14} className="text-yellow-500" />
                      <span className="text-sm font-semibold text-gray-800">Use Loyalty Points</span>
                    </div>
                    <span className="text-xs text-gray-500">{user.loyaltyPoints} pts available (worth ₹{(user.loyaltyPoints * 0.25).toFixed(0)})</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.min(user.loyaltyPoints, Math.floor(subtotal / 0.25))}
                    value={loyaltyPoints}
                    onChange={e => setLoyaltyPoints(parseInt(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0 pts</span>
                    <span className="font-medium text-brand-600">Using {loyaltyPoints} pts = ₹{loyaltyDiscount.toFixed(0)} off</span>
                    <span>{Math.min(user.loyaltyPoints, Math.floor(subtotal / 0.25))} pts</span>
                  </div>
                </div>
              )}

              {/* Price breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Delivery fee</span><span className={deliveryFee === 0 ? 'text-green-600 font-medium' : ''}>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span></div>
                {couponDiscount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Coupon discount</span><span>-₹{couponDiscount.toFixed(0)}</span></div>}
                {loyaltyDiscount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Loyalty discount</span><span>-₹{loyaltyDiscount.toFixed(0)}</span></div>}
                <div className="flex justify-between text-gray-600"><span>Taxes (5% GST)</span><span>₹{taxes.toFixed(0)}</span></div>
                <div className="border-t border-surface-200 pt-2 flex justify-between font-bold text-gray-900 text-base">
                  <span>Total</span><span>₹{total.toFixed(0)}</span>
                </div>
              </div>

              {/* Loyalty points you'll earn */}
              <div className="bg-brand-50 rounded-xl p-2.5 flex items-center gap-2 text-xs text-brand-700">
                <Star size={12} className="text-brand-500" />
                You'll earn <strong>{Math.floor(total / 10)} loyalty points</strong> on this order!
              </div>

              <button
                onClick={placeOrder}
                disabled={orderMutation.isPending || !selectedAddressId}
                className="btn-brand w-full text-base disabled:opacity-50"
              >
                {orderMutation.isPending ? (
                  <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Placing Order...</span>
                ) : (
                  <span className="flex items-center gap-2">Place Order <ArrowRight size={18} /></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
