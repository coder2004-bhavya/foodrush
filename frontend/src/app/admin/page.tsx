'use client';
// src/app/admin/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, Package, Star, TrendingUp, Clock, CheckCircle,
  XCircle, ChefHat, Bell, Eye, Search, Filter, RefreshCw
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import { format } from 'date-fns';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const ORDER_STATUS_FLOW: Record<string, string> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-purple-100 text-purple-700',
  READY_FOR_PICKUP: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function RestaurantDashboard() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics' | 'reviews'>('orders');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const { data: dashData } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: orders, refetch: refetchOrders } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: () => api.get('/admin/orders', { params: { status: statusFilter } }).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: reviews } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: () => api.get('/admin/reviews').then(r => r.data),
    enabled: activeTab === 'reviews',
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Listen for new orders
  useEffect(() => {
    if (!socket || !dashData?.restaurantId) return;
    socket.emit('restaurant:join', dashData.restaurantId);
    socket.on('new:order', ({ orderId }: any) => {
      setNewOrderAlert(true);
      toast('🔔 New order received!', { icon: '🍽️', duration: 5000 });
      refetchOrders();
    });
    socket.on('order:cancelled', () => refetchOrders());
    return () => { socket.off('new:order'); socket.off('order:cancelled'); };
  }, [socket, dashData?.restaurantId]);

  const stats = [
    { label: "Today's Orders", value: dashData?.todayOrders || 0, icon: Package, color: 'text-brand-600', bg: 'bg-brand-50' },
    { label: "Today's Revenue", value: `₹${dashData?.todayRevenue || 0}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Avg Rating', value: dashData?.avgRating?.toFixed(1) || '—', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Pending Orders', value: dashData?.pendingOrders || 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const tabs = ['orders', 'menu', 'analytics', 'reviews'] as const;

  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-gray-900">Restaurant Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">{dashData?.restaurantName || 'Loading...'}</p>
          </div>
          <div className="flex items-center gap-3">
            {newOrderAlert && (
              <button
                onClick={() => { setNewOrderAlert(false); setStatusFilter('PENDING'); setActiveTab('orders'); }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold animate-pulse"
              >
                <Bell size={16} /> New Order!
              </button>
            )}
            <button onClick={() => refetchOrders()} className="btn-ghost border border-surface-200">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 font-medium">{label}</span>
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon size={18} className={color} />
                </div>
              </div>
              <div className={`text-2xl font-display font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-100 rounded-2xl mb-6 w-fit">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-150 ${activeTab === tab ? 'bg-white text-gray-900 shadow-card' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            {/* Status filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${statusFilter === s ? STATUS_COLORS[s] : 'bg-white border border-surface-200 text-gray-500 hover:border-brand-300'}`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Orders list */}
            <div className="space-y-3">
              {!orders?.length ? (
                <div className="card p-12 text-center">
                  <Package size={48} className="mx-auto text-surface-200 mb-3" />
                  <p className="font-semibold text-gray-600">No {statusFilter.toLowerCase().replace(/_/g, ' ')} orders</p>
                </div>
              ) : orders.map((order: any) => (
                <div key={order.id} className="card p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">#{order.orderNumber?.slice(-8).toUpperCase()}</span>
                        <span className={`badge text-[10px] ${STATUS_COLORS[order.status]}`}>{order.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{order.user?.name} • {format(new Date(order.createdAt), 'hh:mm a')}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">₹{order.total?.toFixed(0)}</div>
                      <div className="text-xs text-gray-400">{order.paymentMethod}</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="text-sm text-gray-600 mb-3">
                    {order.items?.map((item: any) => (
                      <span key={item.id} className="mr-2">{item.name} ×{item.quantity}</span>
                    ))}
                  </div>

                  {order.specialInstructions && (
                    <div className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mb-3">
                      📝 {order.specialInstructions}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {ORDER_STATUS_FLOW[order.status] && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: ORDER_STATUS_FLOW[order.status] })}
                        disabled={updateStatusMutation.isPending}
                        className="btn-brand text-sm py-2 px-4 flex-1"
                      >
                        <CheckCircle size={14} />
                        Mark as {ORDER_STATUS_FLOW[order.status].replace(/_/g, ' ')}
                      </button>
                    )}
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'CANCELLED' })}
                        className="btn-ghost border border-red-200 text-red-500 hover:bg-red-50 text-sm py-2 px-4"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    )}
                    <Link href={`/orders/${order.id}`} className="btn-ghost border border-surface-200 text-sm py-2 px-3">
                      <Eye size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {reviews?.map((review: any) => (
              <div key={review.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">{review.user?.name}</p>
                    <p className="text-xs text-gray-400">{format(new Date(review.createdAt), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={14} className={n <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-surface-200'} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
              </div>
            ))}
            {!reviews?.length && (
              <div className="card p-12 text-center">
                <Star size={48} className="mx-auto text-surface-200 mb-3" />
                <p className="font-semibold text-gray-600">No reviews yet</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="card p-8 text-center">
            <BarChart3 size={48} className="mx-auto text-surface-200 mb-3" />
            <p className="font-semibold text-gray-700 mb-1">Analytics coming soon</p>
            <p className="text-sm text-gray-400">Revenue charts, peak hours, and customer insights</p>
          </div>
        )}
      </div>
    </div>
  );
}
