'use client';
// src/app/page.tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, ChevronDown, Star, Clock, Bike, Flame, Leaf, Zap, Tag } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { RestaurantCard } from '@/components/restaurant/RestaurantCard';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const CUISINES = ['All', 'North Indian', 'South Indian', 'Chinese', 'Italian', 'American', 'Mughlai', 'Fast Food', 'Desserts', 'Beverages'];
const FILTERS = [
  { label: 'Pure Veg', icon: Leaf, color: 'text-green-600' },
  { label: 'Offers', icon: Tag, color: 'text-brand-600' },
  { label: 'Fast Delivery', icon: Zap, color: 'text-yellow-500' },
  { label: 'Top Rated', icon: Flame, color: 'text-red-500' },
];

const HERO_BANNERS = [
  { id: 1, title: 'Weekend Special', subtitle: 'Up to 40% off', bg: 'from-orange-400 to-red-500', emoji: '🍕' },
  { id: 2, title: 'Free Delivery', subtitle: 'On orders above ₹199', bg: 'from-green-400 to-teal-500', emoji: '🛵' },
  { id: 3, title: 'New Restaurants', subtitle: 'Just added near you', bg: 'from-purple-400 to-indigo-500', emoji: '⭐' },
];

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [heroBanner, setHeroBanner] = useState(0);
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['restaurants', search, selectedCuisine, activeFilters, sortBy],
    queryFn: () => api.get('/restaurants', {
      params: {
        search: search || undefined,
        cuisine: selectedCuisine !== 'All' ? selectedCuisine : undefined,
        filters: activeFilters.join(',') || undefined,
        sort: sortBy,
      }
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const t = setInterval(() => setHeroBanner(b => (b + 1) % HERO_BANNERS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const toggleFilter = (f: string) => setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />

      {/* ── Hero ── */}
      <section className="bg-white border-b border-surface-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Greeting */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <MapPin size={14} className="text-brand-500" />
                <span>Delivering to</span>
                <button className="font-semibold text-gray-800 flex items-center gap-1 hover:text-brand-600 transition-colors">
                  Lucknow, UP <ChevronDown size={14} />
                </button>
              </div>
              <h1 className="text-3xl font-display font-bold text-gray-900">
                {user ? `Hey ${user.name.split(' ')[0]}! 👋` : 'What are you craving? 🍽️'}
              </h1>
            </div>
            {/* Mini hero banners */}
            <div className="hidden md:flex gap-3">
              {HERO_BANNERS.map((b, i) => (
                <div
                  key={b.id}
                  onClick={() => setHeroBanner(i)}
                  className={`cursor-pointer px-5 py-4 rounded-2xl bg-gradient-to-br ${b.bg} text-white transition-all duration-300 ${i === heroBanner ? 'scale-105 shadow-lg' : 'opacity-60 scale-100'}`}
                >
                  <div className="text-2xl mb-1">{b.emoji}</div>
                  <div className="font-bold text-sm">{b.title}</div>
                  <div className="text-xs opacity-90">{b.subtitle}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-2xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search restaurants, dishes, cuisines..."
              className="w-full pl-12 pr-4 py-4 bg-surface-50 border-2 border-surface-200 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:bg-white transition-all duration-200 text-base font-medium shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* ── Cuisine Tabs ── */}
      <section className="bg-white border-b border-surface-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-3 overflow-x-auto no-scrollbar">
            {CUISINES.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCuisine(c)}
                className={selectedCuisine === c ? 'tag-chip-active whitespace-nowrap' : 'tag-chip whitespace-nowrap'}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters + Sort row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ label, icon: Icon, color }) => (
              <button
                key={label}
                onClick={() => toggleFilter(label)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${activeFilters.includes(label) ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-surface-200 bg-white text-gray-600 hover:border-brand-300'}`}
              >
                <Icon size={14} className={activeFilters.includes(label) ? 'text-brand-500' : color} />
                {label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-4 py-2 border border-surface-200 rounded-xl text-sm font-medium text-gray-700 bg-white focus:outline-none focus:border-brand-400"
          >
            <option value="relevance">Sort: Relevance</option>
            <option value="rating">Top Rated</option>
            <option value="delivery_time">Fastest Delivery</option>
            <option value="price_low">Price: Low to High</option>
          </select>
        </div>

        {/* Loyalty banner for logged-in users */}
        {user && (
          <Link href="/profile#loyalty" className="block mb-8">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-brand-500 to-orange-400 rounded-2xl text-white cursor-pointer hover:shadow-brand transition-all duration-200">
              <div className="text-3xl">⭐</div>
              <div>
                <div className="font-bold">You have {user.loyaltyPoints} loyalty points</div>
                <div className="text-sm opacity-90">Worth ₹{(user.loyaltyPoints * 0.25).toFixed(0)} — redeem on your next order!</div>
              </div>
              <div className="ml-auto text-sm font-semibold opacity-90">View &rarr;</div>
            </div>
          </Link>
        )}

        {/* Restaurants grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">
            {selectedCuisine === 'All' ? 'All Restaurants' : selectedCuisine}
            <span className="ml-2 text-lg font-normal text-gray-400">({data?.total || 0})</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card">
                <div className="skeleton h-48 rounded-none" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-5 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.restaurants?.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">😢</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No restaurants found</h3>
            <p className="text-gray-500">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.restaurants?.map((restaurant: any, i: number) => (
              <div key={restaurant.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                <RestaurantCard restaurant={restaurant} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-white font-display font-bold text-xl mb-4">🍔 FoodRush</div>
              <p className="text-sm">Your neighbourhood food delivery marketplace.</p>
            </div>
            {[
              { title: 'Company', links: ['About', 'Careers', 'Blog', 'Press'] },
              { title: 'For Restaurants', links: ['Partner With Us', 'Restaurant Login', 'Marketing'] },
              { title: 'Support', links: ['Help Center', 'Contact Us', 'Privacy Policy', 'Terms'] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-white font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2 text-sm">{col.links.map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm">© 2026 FoodRush. All rights reserved.</p>
            <div className="flex gap-4 text-sm">
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
