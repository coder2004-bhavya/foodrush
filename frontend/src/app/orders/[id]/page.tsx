'use client';
// src/app/orders/[id]/page.tsx
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle, Clock, ChefHat, Bike, Home, MessageCircle,
  Send, Star, X, Phone, MapPin, Package
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_STEPS = [
  { key: 'PENDING',           label: 'Order Placed',     icon: Package,      desc: 'Waiting for restaurant to confirm' },
  { key: 'CONFIRMED',         label: 'Confirmed',         icon: CheckCircle,  desc: 'Restaurant accepted your order' },
  { key: 'PREPARING',         label: 'Preparing',         icon: ChefHat,      desc: 'Chef is preparing your food' },
  { key: 'READY_FOR_PICKUP',  label: 'Ready',             icon: CheckCircle,  desc: 'Food is packed and ready' },
  { key: 'OUT_FOR_DELIVERY',  label: 'On the Way',        icon: Bike,         desc: 'Delivery partner is heading to you' },
  { key: 'DELIVERED',         label: 'Delivered',         icon: Home,         desc: 'Enjoy your meal! 🎉' },
];

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();

  const { data: order, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then(r => r.data),
    refetchInterval: (data) => (['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(data?.status) ? 30000 : false),
  });

  const activeStatus = currentStatus || order?.status;
  const activeStep = STATUS_ORDER.indexOf(activeStatus);

  // Socket setup
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('order:join', id);
    if (order?.chatRoom?.id) {
      socket.emit('chat:join', order.chatRoom.id);
    }

    socket.on('order:status', ({ status, message }: any) => {
      setCurrentStatus(status);
      toast.success(message || `Order is now ${status.toLowerCase().replace(/_/g, ' ')}`, { icon: '📦' });
      refetch();
    });

    socket.on('chat:message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    socket.on('chat:typing', ({ userName }: any) => {
      setTypingUser(userName);
      setIsTyping(true);
    });

    socket.on('chat:stop_typing', () => setIsTyping(false));

    return () => {
      socket.emit('order:leave', id);
      socket.off('order:status');
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('chat:stop_typing');
    };
  }, [socket, id, order?.chatRoom?.id]);

  // Load chat history
  useEffect(() => {
    if (order?.chatRoom?.id) {
      api.get(`/orders/${id}/chat`).then(r => setMessages(r.data)).catch(() => {});
    }
  }, [order?.chatRoom?.id]);

  const sendMessage = () => {
    if (!msgInput.trim() || !socket || !order?.chatRoom?.id) return;
    socket.emit('chat:message', { roomId: order.chatRoom.id, content: msgInput.trim() });
    setMsgInput('');
    socket.emit('chat:stop_typing', order.chatRoom.id);
  };

  const handleTyping = (val: string) => {
    setMsgInput(val);
    if (!socket || !order?.chatRoom?.id) return;
    socket.emit('chat:typing', order.chatRoom.id);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit('chat:stop_typing', order.chatRoom.id), 2000);
  };

  const submitReview = async () => {
    if (!rating) { toast.error('Please select a rating'); return; }
    try {
      await api.post('/reviews', { orderId: id, restaurantId: order.restaurantId, rating, comment: reviewText });
      toast.success('Review submitted! Thank you 🙏');
      setReviewOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-surface-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="skeleton h-8 w-48 mb-6" />
          <div className="card p-6 space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900">Order Tracking</h1>
            <p className="text-sm text-gray-500 mt-1">#{order.orderNumber?.slice(-8).toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            {order.status === 'DELIVERED' && !order.review && (
              <button onClick={() => setReviewOpen(true)} className="btn-outline text-sm py-2 px-4">
                <Star size={14} /> Rate Order
              </button>
            )}
            <button onClick={() => setChatOpen(!chatOpen)} className="btn-brand text-sm py-2 px-4 relative">
              <MessageCircle size={14} /> Chat
              {messages.filter(m => !m.isRead && m.senderId !== user?.id).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {messages.filter(m => !m.isRead && m.senderId !== user?.id).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Progress tracker */}
        {activeStatus !== 'CANCELLED' ? (
          <div className="card p-6 mb-4">
            <div className="flex items-start gap-0 relative">
              {/* Progress line */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-surface-200">
                <div
                  className="h-full bg-brand-500 transition-all duration-700"
                  style={{ width: `${Math.max(0, (activeStep / (STATUS_STEPS.length - 1)) * 100)}%` }}
                />
              </div>

              {STATUS_STEPS.map((step, i) => {
                const Icon = step.icon;
                const done = i < activeStep;
                const active = i === activeStep;
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${done ? 'bg-brand-500 border-brand-500' : active ? 'bg-white border-brand-500 shadow-brand scale-110' : 'bg-white border-surface-200'}`}>
                      <Icon size={18} className={done ? 'text-white' : active ? 'text-brand-500' : 'text-gray-300'} />
                    </div>
                    <div className="mt-2 text-center">
                      <p className={`text-[11px] font-semibold leading-tight ${active ? 'text-brand-600' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current status message */}
            <div className="mt-6 p-3 bg-brand-50 rounded-2xl text-center">
              <p className="text-sm font-semibold text-brand-700">
                {STATUS_STEPS[activeStep]?.desc || 'Order processing'}
              </p>
              {order.estimatedDeliveryMin && activeStatus !== 'DELIVERED' && (
                <p className="text-xs text-brand-500 mt-1 flex items-center justify-center gap-1">
                  <Clock size={12} /> Est. {order.estimatedDeliveryMin} min
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-6 mb-4 bg-red-50 border-red-200 text-center">
            <div className="text-4xl mb-2">❌</div>
            <h3 className="font-bold text-red-700 text-lg">Order Cancelled</h3>
            {order.cancellationReason && (
              <p className="text-sm text-red-500 mt-1">Reason: {order.cancellationReason}</p>
            )}
          </div>
        )}

        {/* Order items */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat size={16} className="text-brand-500" />
            <h3 className="font-semibold text-gray-800">{order.restaurant?.name}</h3>
            {order.restaurant?.phone && (
              <a href={`tel:${order.restaurant.phone}`} className="ml-auto text-brand-600 hover:text-brand-700">
                <Phone size={14} />
              </a>
            )}
          </div>
          <div className="space-y-2">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 last:border-0">
                <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                <span className="font-semibold text-gray-800">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          {/* Price summary */}
          <div className="mt-4 pt-3 border-t border-surface-100 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{order.subtotal?.toFixed(0)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Delivery</span><span>₹{order.deliveryFee?.toFixed(0)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Taxes</span><span>₹{order.taxes?.toFixed(0)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Discount</span><span>-₹{order.discount?.toFixed(0)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-surface-100">
              <span>Total</span><span>₹{order.total?.toFixed(0)}</span>
            </div>
            {order.loyaltyPointsEarned > 0 && (
              <div className="flex items-center gap-1 text-xs text-brand-600 font-medium pt-1">
                <Star size={11} /> +{order.loyaltyPointsEarned} loyalty points earned!
              </div>
            )}
          </div>
        </div>

        {/* Delivery address */}
        <div className="card p-4 mb-4">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-brand-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">{order.deliveryAddress?.label}</p>
              <p className="text-sm text-gray-500">{order.deliveryAddress?.line1}, {order.deliveryAddress?.city} - {order.deliveryAddress?.pincode}</p>
            </div>
          </div>
        </div>

        {/* Tracking timeline */}
        {order.tracking?.length > 0 && (
          <div className="card p-4 mb-4">
            <h3 className="font-semibold text-gray-800 mb-3">Activity Log</h3>
            <div className="space-y-3">
              {[...order.tracking].reverse().map((t: any, i: number) => (
                <div key={t.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${i === 0 ? 'border-brand-500 bg-brand-500' : 'border-surface-200 bg-white'}`} />
                    {i < order.tracking.length - 1 && <div className="w-0.5 h-6 bg-surface-200 mt-1" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-medium text-gray-800">{t.message}</p>
                    <p className="text-xs text-gray-400">{format(new Date(t.createdAt), 'hh:mm a, dd MMM')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Chat Panel ── */}
      {chatOpen && (
        <div className="fixed bottom-0 right-4 w-80 bg-white rounded-t-2xl shadow-2xl border border-surface-100 z-50 flex flex-col" style={{ height: '420px' }}>
          <div className="flex items-center justify-between px-4 py-3 bg-brand-500 text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} />
              <span className="font-semibold text-sm">Chat Support</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="hover:bg-brand-600 p-1 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-8">
                <MessageCircle size={24} className="mx-auto mb-2 text-surface-200" />
                <p>Chat with the restaurant or delivery partner</p>
              </div>
            )}
            {messages.map((msg: any) => {
              const mine = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-surface-100 text-gray-800 rounded-bl-sm'}`}>
                    {!mine && <p className="text-[10px] font-semibold text-gray-500 mb-0.5">{msg.sender?.name}</p>}
                    <p>{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'text-brand-200' : 'text-gray-400'}`}>
                      {format(new Date(msg.createdAt), 'hh:mm a')}
                    </p>
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-surface-100 px-3 py-2 rounded-2xl text-xs text-gray-400 flex items-center gap-1">
                  <span>{typingUser} is typing</span>
                  <span className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="p-3 border-t border-surface-100 flex gap-2">
            <input
              type="text"
              value={msgInput}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 text-sm bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-brand-400"
            />
            <button onClick={sendMessage} disabled={!msgInput.trim()} className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-40">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      {reviewOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReviewOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl text-gray-900">Rate Your Order</h3>
              <button onClick={() => setReviewOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-gray-500 text-sm mb-6">{order.restaurant?.name}</p>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-6">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
                  <Star size={40} className={n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-surface-200'} />
                </button>
              ))}
            </div>

            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Tell us about your experience... (optional)"
              className="input-field resize-none mb-4"
              rows={3}
            />

            <div className="flex gap-3">
              <button onClick={() => setReviewOpen(false)} className="btn-ghost flex-1 border border-surface-200">Cancel</button>
              <button onClick={submitReview} className="btn-brand flex-1">Submit Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
