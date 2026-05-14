'use client';
// src/app/restaurant/[slug]/page.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { Star, Clock, Bike, Phone, ChevronRight, Plus, Minus, Leaf, Info } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { CartSidebar } from '@/components/cart/CartSidebar';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart';
import toast from 'react-hot-toast';

export default function RestaurantPage({ params }: { params: { slug: string } }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const { addItem, items: cartItems, restaurantId: cartRestaurantId } = useCartStore();

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant', params.slug],
    queryFn: () => api.get(`/restaurants/${params.slug}`).then(r => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="skeleton h-64 rounded-3xl mb-6" />
          <div className="grid grid-cols-3 gap-6">
            <div className="skeleton h-96 rounded-2xl" />
            <div className="col-span-2 space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { restaurant, categories } = data || {};
  const filteredCategories = categories?.map((cat: any) => ({
    ...cat,
    items: vegOnly ? cat.items.filter((i: any) => i.isVeg) : cat.items
  })).filter((cat: any) => cat.items.length > 0);

  const addToCart = (item: any) => {
    if (cartRestaurantId && cartRestaurantId !== restaurant.id && cartItems.length > 0) {
      const confirm = window.confirm('Your cart has items from another restaurant. Clear cart and add this item?');
      if (!confirm) return;
    }
    addItem({ ...item, restaurantId: restaurant.id, restaurantName: restaurant.name });
    toast.success(`${item.name} added to cart`, { icon: '🛒' });
  };

  const cartQty = (itemId: string) => cartItems.find(i => i.menuItemId === itemId)?.quantity || 0;

  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />

      {/* Cover */}
      <div className="relative h-56 md:h-72 bg-gray-200 overflow-hidden">
        {restaurant?.coverImage && (
          <Image src={restaurant.coverImage} alt={restaurant.name} fill className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-6 left-6 text-white">
          <h1 className="text-3xl font-display font-bold mb-1">{restaurant?.name}</h1>
          <p className="text-white/80 text-sm">{restaurant?.cuisines?.join(' • ')}</p>
        </div>
        {!restaurant?.isOpen && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-4xl mb-2">😴</div>
              <div className="font-bold text-xl">Currently Closed</div>
              <div className="text-white/70 text-sm">Opens at {restaurant?.openingTime}</div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Info bar */}
        <div className="bg-white rounded-2xl shadow-card -mt-6 relative z-10 p-4 mb-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-1.5">
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
            <span className="font-bold">{restaurant?.avgRating?.toFixed(1)}</span>
            <span className="text-gray-400 text-sm">({restaurant?.totalReviews})</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 text-sm">
            <Clock size={14} className="text-brand-500" /> {restaurant?.avgDeliveryMin} min
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 text-sm">
            <Bike size={14} className="text-brand-500" />
            {restaurant?.deliveryFee === 0 ? 'Free Delivery' : `₹${restaurant?.deliveryFee} delivery`}
          </div>
          <div className="ml-auto">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${vegOnly ? 'bg-green-500' : 'bg-gray-200'} relative`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${vegOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <Leaf size={14} className={vegOnly ? 'text-green-600' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${vegOnly ? 'text-green-700' : 'text-gray-500'}`}>Veg Only</span>
            </label>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Left: Category nav (desktop) */}
          <div className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl shadow-card p-3">
              {filteredCategories?.map((cat: any) => (
                <a
                  key={cat.id}
                  href={`#cat-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`block px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 mb-1 ${activeCategory === cat.id ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-surface-50'}`}
                >
                  {cat.name}
                  <span className="ml-1 text-xs text-gray-400">({cat.items.length})</span>
                </a>
              ))}
            </div>
          </div>

          {/* Center: Menu */}
          <div className="flex-1 space-y-8 pb-32 lg:pb-8">
            {filteredCategories?.map((cat: any) => (
              <section key={cat.id} id={`cat-${cat.id}`}>
                <h2 className="section-title mb-4">{cat.name}</h2>
                <div className="space-y-3">
                  {cat.items.map((item: any) => (
                    <div key={item.id} className="card flex gap-4 p-4">
                      {/* Veg/non-veg indicator */}
                      <div className={`w-4 h-4 shrink-0 mt-0.5 rounded-sm border-2 flex items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                            {item.isPopular && <span className="badge-brand text-[10px] mt-0.5">🔥 Bestseller</span>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-gray-900">₹{item.discountedPrice || item.price}</div>
                            {item.discountedPrice && (
                              <div className="text-xs text-gray-400 line-through">₹{item.price}</div>
                            )}
                          </div>
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        {item.calories && (
                          <p className="text-xs text-gray-400 mt-1">{item.calories} kcal</p>
                        )}
                      </div>

                      {/* Image + Add button */}
                      <div className="relative shrink-0">
                        {item.image ? (
                          <div className="relative w-24 h-20 rounded-xl overflow-hidden">
                            <Image src={item.image} alt={item.name} fill className="object-cover" sizes="96px" />
                          </div>
                        ) : (
                          <div className="w-24 h-20 rounded-xl bg-surface-100 flex items-center justify-center text-3xl">🍽️</div>
                        )}
                        {/* Add/qty control */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                          {cartQty(item.id) === 0 ? (
                            <button
                              onClick={() => addToCart(item)}
                              disabled={!restaurant?.isOpen}
                              className="flex items-center gap-1 px-3 py-1 bg-white border-2 border-brand-500 text-brand-600 font-bold text-xs rounded-lg shadow-sm hover:bg-brand-500 hover:text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus size={12} /> ADD
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 bg-brand-500 text-white rounded-lg shadow-sm overflow-hidden">
                              <button onClick={() => useCartStore.getState().removeItem(item.id)} className="px-2 py-1 hover:bg-brand-600 transition-colors">
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-bold px-1">{cartQty(item.id)}</span>
                              <button onClick={() => addToCart(item)} className="px-2 py-1 hover:bg-brand-600 transition-colors">
                                <Plus size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Right: Cart sidebar (desktop) */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24">
              <CartSidebar restaurantId={restaurant?.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating cart button */}
      <div className="lg:hidden fixed bottom-6 left-4 right-4 z-50">
        {cartItems.length > 0 && cartRestaurantId === restaurant?.id && (
          <a href="/cart" className="flex items-center justify-between btn-brand w-full shadow-brand text-base">
            <span className="bg-brand-400/50 px-2 py-0.5 rounded-lg text-sm">{cartItems.reduce((s, i) => s + i.quantity, 0)}</span>
            <span>View Cart</span>
            <span>₹{cartItems.reduce((s, i) => s + i.price * i.quantity, 0)}</span>
          </a>
        )}
      </div>
    </div>
  );
}
