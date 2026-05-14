'use client';
// src/components/restaurant/RestaurantCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import { Star, Clock, Bike, Leaf, Tag } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  coverImage?: string;
  cuisines: string[];
  tags: string[];
  avgRating: number;
  totalReviews: number;
  avgDeliveryMin: number;
  deliveryFee: number;
  minOrderAmount: number;
  isOpen: boolean;
}

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link href={`/restaurant/${restaurant.slug}`}>
      <div className={`card-hover ${!restaurant.isOpen ? 'opacity-60' : ''}`}>
        {/* Cover image */}
        <div className="relative h-48 bg-surface-100 overflow-hidden">
          {restaurant.coverImage ? (
            <Image
              src={restaurant.coverImage}
              alt={restaurant.name}
              fill className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🍽️</div>
          )}

          {/* Closed overlay */}
          {!restaurant.isOpen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-bold text-lg">Currently Closed</span>
            </div>
          )}

          {/* Tags */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {restaurant.tags.slice(0, 2).map(tag => (
              <span key={tag} className={`px-2 py-1 rounded-lg text-xs font-bold ${tag.includes('Veg') ? 'bg-green-500 text-white' : 'bg-brand-500 text-white'}`}>
                {tag}
              </span>
            ))}
          </div>

          {/* Logo */}
          {restaurant.logo && (
            <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
              <Image src={restaurant.logo} alt={restaurant.name} fill className="object-cover" sizes="48px" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-display font-bold text-gray-900 text-base leading-tight">{restaurant.name}</h3>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg shrink-0">
              <Star size={12} className="text-green-600 fill-green-600" />
              <span className="text-xs font-bold text-green-700">{restaurant.avgRating.toFixed(1)}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-3 truncate">{restaurant.cuisines.join(' • ')}</p>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-brand-500" />
              <span className="font-medium">{restaurant.avgDeliveryMin} min</span>
            </div>
            <div className="flex items-center gap-1">
              <Bike size={12} className="text-brand-500" />
              <span className="font-medium">{restaurant.deliveryFee === 0 ? 'Free delivery' : `₹${restaurant.deliveryFee} delivery`}</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-gray-400">{restaurant.totalReviews} reviews</span>
            </div>
          </div>

          {/* Min order */}
          {restaurant.minOrderAmount > 0 && (
            <div className="mt-2 pt-2 border-t border-surface-100 text-xs text-gray-400">
              Min. order ₹{restaurant.minOrderAmount}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
