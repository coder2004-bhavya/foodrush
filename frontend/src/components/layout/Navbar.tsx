'use client';
// src/components/layout/Navbar.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Bell, User, LogOut, ChefHat, Package, Heart, Star } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-surface-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 hover:text-brand-600 transition-colors">
            <span className="text-2xl">🍔</span>
            <span>FoodRush</span>
          </Link>

          {/* Center nav (desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {[['/', 'Home'], ['/orders', 'My Orders'], ['/profile', 'Profile']].map(([href, label]) => (
              <Link key={href} href={href} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${pathname === href ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-surface-100 hover:text-gray-900'}`}>
                {label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2" ref={menuRef}>
            {/* Cart */}
            <Link href="/cart" className="relative btn-ghost px-3">
              <ShoppingCart size={20} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse-brand">
                  {totalItems}
                </span>
              )}
            </Link>

            {user ? (
              <>
                {/* Notifications */}
                <div className="relative">
                  <button onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }} className="btn-ghost px-3 relative">
                    <Bell size={20} />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full" />
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-card-hover border border-surface-100 overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                        <span className="font-semibold text-gray-900">Notifications</span>
                        <button className="text-xs text-brand-600 font-medium">Mark all read</button>
                      </div>
                      <div className="divide-y divide-surface-100 max-h-80 overflow-y-auto">
                        {[
                          { icon: '🛵', title: 'Order out for delivery', time: '2 min ago', read: false },
                          { icon: '⭐', title: 'You earned 25 loyalty points!', time: '1 hr ago', read: false },
                          { icon: '🎁', title: 'New coupon: SAVE20', time: '3 hr ago', read: true },
                        ].map((n, i) => (
                          <div key={i} className={`px-4 py-3 flex gap-3 ${n.read ? 'opacity-60' : 'bg-brand-50/30'}`}>
                            <span className="text-xl">{n.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{n.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link href="/profile#notifications" className="block px-4 py-3 text-center text-sm text-brand-600 font-medium border-t border-surface-100 hover:bg-brand-50 transition-colors">
                        View all notifications
                      </Link>
                    </div>
                  )}
                </div>

                {/* User menu */}
                <div className="relative">
                  <button onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-100 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-brand-600 font-bold text-sm">{user.name[0].toUpperCase()}</span>
                      )}
                    </div>
                    <span className="hidden md:block text-sm font-semibold text-gray-800 max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-card-hover border border-surface-100 overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-surface-100">
                        <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-brand-600 font-medium">
                          <Star size={12} /> {user.loyaltyPoints} points
                        </div>
                      </div>
                      <div className="py-1">
                        {[
                          { href: '/profile', icon: User, label: 'My Profile' },
                          { href: '/orders', icon: Package, label: 'My Orders' },
                          ...(user.role === 'RESTAURANT_OWNER' ? [{ href: '/admin', icon: ChefHat, label: 'Restaurant Dashboard' }] : []),
                        ].map(({ href, icon: Icon, label }) => (
                          <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-surface-50 transition-colors">
                            <Icon size={16} className="text-gray-400" /> {label}
                          </Link>
                        ))}
                        <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-surface-100 mt-1">
                          <LogOut size={16} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="btn-ghost text-sm py-2 px-4">Sign In</Link>
                <Link href="/auth/register" className="btn-brand text-sm py-2 px-4">Get Started</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
