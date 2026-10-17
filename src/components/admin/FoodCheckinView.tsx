'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  QrCode,
  ScanLine,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Coffee,
  Check,
  X,
  Package,
  Layers,
  Sparkles,
  ShoppingBag,
  User,
  Film,
  Calendar,
  ChevronRight,
  Flame,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Copy
} from 'lucide-react';
import { Product, Order } from '@/lib/types-redesign';

interface FoodCheckinViewProps {
  products: Product[];
  orders?: Order[];
  operatorName: string;
  showToast: (msg: string) => void;
}

export interface FnbOrderItem {
  id: string;
  name: string;
  product_type: 'COMBO' | 'FOOD' | 'BEVERAGE';
  quantity: number;
  popcorn_detail?: string;
  drink_detail?: string;
  extra_detail?: string;
  note?: string;
  fulfilled?: boolean;
}

export interface FnbOrder {
  code: string;
  customer_name: string;
  customer_phone: string;
  order_time: string;
  pickup_time?: string;
  movie_context?: string;
  channel: 'APP_ONLINE' | 'POS_COUNTER' | 'KIOSK';
  status: 'PENDING' | 'PREPARING' | 'FULFILLED' | 'CANCELLED';
  items: FnbOrderItem[];
  fulfilled_by?: string;
  fulfilled_at?: string;
  total_amount?: number;
}

export default function FoodCheckinView({
  products = [],
  orders = [],
  operatorName = 'Quản trị viên Cinemax',
  showToast
}: FoodCheckinViewProps) {
  const [scanInput, setScanInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'FULFILLED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeOrder, setActiveOrder] = useState<FnbOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localFulfilledMap, setLocalFulfilledMap] = useState<Record<string, boolean>>({});

  // 1. Tải danh sách đơn có bắp nước thực tế từ orders prop và localStorage
  const fnbOrders = useMemo(() => {
    const list: FnbOrder[] = [];
    const seenCodes = new Set<string>();

    // 1.1. Lấy từ orders prop (Supabase / AdminDataService)
    (orders || []).forEach((o) => {
      const foodItems = (o.items || []).filter((i) => i.item_type === 'product');
      if (foodItems.length > 0) {
        seenCodes.add(o.order_code);
        seenCodes.add(o.id);

        const movieItem = (o.items || []).find((i) => i.item_type === 'ticket');
        const movieTitle = movieItem?.item_snapshot?.movieTitle;
        const showTime = movieItem?.item_snapshot?.showTime;
        const seats = (o.items || [])
          .filter((i) => i.item_type === 'ticket')
          .map((i) => i.item_snapshot?.seatCode)
          .filter(Boolean)
          .join(', ');

        const isLocalFulfilled = Boolean(localFulfilledMap[o.order_code] || localFulfilledMap[o.id]);
        const isCancelled = o.status === 'cancelled' || o.status === 'expired' || o.status === 'refunded';

        list.push({
          code: o.order_code,
          customer_name: o.contact_name || 'Khách xem phim',
          customer_phone: o.contact_phone || '0901234567',
          order_time: o.created_at ? new Date(o.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(o.created_at).toLocaleDateString('vi-VN') + ')' : 'Hôm nay',
          movie_context: movieTitle ? `${movieTitle} ${showTime ? `(${showTime})` : ''} ${seats ? `• Ghế ${seats}` : ''}` : 'Đặt tại quầy F&B',
          channel: o.channel === 'online' ? 'APP_ONLINE' : 'POS_COUNTER',
          status: isCancelled ? 'CANCELLED' : isLocalFulfilled ? 'FULFILLED' : 'PENDING',
          items: foodItems.map((fi, idx) => ({
            id: fi.id || `f-${idx}`,
            name: fi.item_snapshot?.productName || 'Bắp Nước Combo',
            product_type: 'COMBO',
            quantity: fi.quantity || 1,
            popcorn_detail: '1x Bắp Vừa (Vị Phô Mai / Caramel)',
            drink_detail: 'Nước ngọt Coca / Sprite tiêu chuẩn',
            fulfilled: isLocalFulfilled
          })),
          total_amount: o.total_amount
        });
      }
    });

    // 1.2. Lấy thêm từ localStorage (cinemax_user_tickets & cinemax_my_tickets_v2)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_user_tickets');
        if (stored) {
          const userTickets = JSON.parse(stored);
          if (Array.isArray(userTickets)) {
            userTickets.forEach((ut: any) => {
              const code = ut.bookingCode || ut.id;
              if (code && !seenCodes.has(code)) {
                // Kiểm tra có bắp nước không
                const foods = ut.foods || ut.selectedCombos || [];
                if (foods.length > 0) {
                  seenCodes.add(code);
                  const isLocalFulfilled = Boolean(ut.food_fulfilled || localFulfilledMap[code]);
                  list.push({
                    code,
                    customer_name: ut.customerName || 'Khách đặt online',
                    customer_phone: ut.customerPhone || '0988.123.456',
                    order_time: ut.bookingTime ? new Date(ut.bookingTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(ut.bookingTime).toLocaleDateString('vi-VN') + ')' : 'Hôm nay',
                    movie_context: `${ut.movieTitle || 'Phim rạp'} (${ut.showTime || '19:30'} • ${ut.roomName || 'Phòng 1'} • Ghế ${ut.seats || 'VIP'})`,
                    channel: 'APP_ONLINE',
                    status: isLocalFulfilled ? 'FULFILLED' : 'PENDING',
                    items: foods.map((f: any, idx: number) => ({
                      id: `local-f-${idx}`,
                      name: f.name || f.productName || 'Combo Bắp Nước',
                      product_type: 'COMBO',
                      quantity: f.qty || f.quantity || 1,
                      popcorn_detail: `1x Bắp • ${f.flavor || 'Vị Phô Mai Lắc Thơm Béo'}`,
                      drink_detail: `1x Ly nước • ${f.drinkSize || 'Coca-Cola (L)'}`,
                      fulfilled: isLocalFulfilled
                    })),
                    total_amount: ut.totalPrice
                  });
                }
              }
            });
          }
        }
      } catch {}
    }

    // 1.3. Bổ sung các đơn mẫu demo nếu danh sách chưa nhiều
    if (list.length === 0) {
      list.push(
        {
          code: 'CNM261016-54ADD',
          customer_name: 'Nguyễn Thành Nam',
          customer_phone: '0988.123.456',
          order_time: '16:15 (Hôm nay)',
          movie_context: 'Dune: Hành Tinh Cát 2 (19:30 - Phòng 1 • Ghế E5, E6)',
          channel: 'APP_ONLINE',
          status: 'PENDING',
          items: [
            {
              id: 'demo-1',
              name: 'Combo Solo Bắp Nước',
              product_type: 'COMBO',
              quantity: 1,
              popcorn_detail: '1x Bắp Vừa (64oz) • Vị: Caramel ngọt đậm đà',
              drink_detail: '1x Ly Tiêu Chuẩn (22oz) • Coca-Cola Original'
            }
          ]
        },
        {
          code: 'POS-891023',
          customer_name: 'Trần Thị Thu Thảo',
          customer_phone: '0903.456.789',
          order_time: '16:22 (Hôm nay)',
          movie_context: 'Avatar 3: Lửa & Tro Tàn (20:00 - Phòng 2 IMAX)',
          channel: 'POS_COUNTER',
          status: 'PENDING',
          items: [
            {
              id: 'demo-2',
              name: 'Combo Couple Hẹn Hò',
              product_type: 'COMBO',
              quantity: 1,
              popcorn_detail: '1x Bắp Lớn (85oz) • Vị: Phô Mai Lắc Thơm Béo',
              drink_detail: '2x Ly Lớn (32oz) • Gồm 1 Coca + 1 Sprite'
            }
          ]
        }
      );
    }

    return list;
  }, [orders, localFulfilledMap]);

  // Bộ lọc danh sách
  const filteredOrders = useMemo(() => {
    return fnbOrders.filter((ord) => {
      if (filterStatus === 'PENDING' && ord.status !== 'PENDING') return false;
      if (filterStatus === 'FULFILLED' && ord.status !== 'FULFILLED') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchCode = ord.code.toLowerCase().includes(term);
        const matchName = ord.customer_name.toLowerCase().includes(term);
        const matchPhone = ord.customer_phone.toLowerCase().includes(term);
        const matchMovie = ord.movie_context?.toLowerCase().includes(term);
        const matchItem = ord.items.some((i) => i.name.toLowerCase().includes(term));
        if (!matchCode && !matchName && !matchPhone && !matchMovie && !matchItem) return false;
      }
      return true;
    });
  }, [fnbOrders, filterStatus, searchTerm]);

  // Xử lý quét mã QR
  const handleScanOrder = (codeToScan?: string) => {
    const target = (codeToScan || scanInput).trim();
    if (!target) {
      showToast('Vui lòng nhập hoặc quét mã đơn hàng QR!');
      return;
    }

    const found = fnbOrders.find(
      (o) =>
        o.code.toLowerCase() === target.toLowerCase() ||
        o.code.toLowerCase().includes(target.toLowerCase())
    );

    if (found) {
      setActiveOrder(found);
      setScanInput('');
      if (found.status === 'FULFILLED') {
        showToast(`Đơn hàng #${found.code} ĐÃ ĐƯỢC TRẢ MÓN trước đó!`);
      } else {
        showToast(`Tìm thấy đơn hàng #${found.code} (${found.customer_name})!`);
      }
    } else {
      showToast(`Không tìm thấy đơn bắp nước nào khớp với mã "${target}"!`);
    }
  };

  // Xác nhận trả món bắp nước
  const handleFulfillOrder = (orderToFulfill: FnbOrder) => {
    setIsProcessing(true);
    try {
      // 1. Cập nhật local map
      setLocalFulfilledMap((prev) => ({
        ...prev,
        [orderToFulfill.code]: true
      }));

      // 2. Cập nhật localStorage cinemax_user_tickets
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('cinemax_user_tickets');
          if (stored) {
            const list = JSON.parse(stored);
            const updated = list.map((ut: any) => {
              if (ut.bookingCode === orderToFulfill.code || ut.id === orderToFulfill.code) {
                return {
                  ...ut,
                  food_fulfilled: true,
                  fulfilled_by: operatorName,
                  fulfilled_at: new Date().toISOString()
                };
              }
              return ut;
            });
            localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
            window.dispatchEvent(new Event('cinemax_data_updated'));
            window.dispatchEvent(new Event('storage'));
          }
        } catch {}
      }

      // 3. Tự động cập nhật active order nếu đang mở modal
      if (activeOrder && activeOrder.code === orderToFulfill.code) {
        setActiveOrder({
          ...activeOrder,
          status: 'FULFILLED',
          fulfilled_by: operatorName,
          fulfilled_at: 'Vừa xong'
        });
      }

      showToast(`TRẢ MÓN THÀNH CÔNG! Đã giao bắp nước cho khách ${orderToFulfill.customer_name} (Đơn #${orderToFulfill.code})!`);
    } catch (err: any) {
      showToast('Lỗi trả món: ' + (err.message || 'Thử lại'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header & Operator Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FABF2E]/15 border border-[#FABF2E]/30 flex items-center justify-center">
            <Coffee className="w-4 h-4 text-[#FABF2E]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">QUẦY TRẢ MÓN BẮP NƯỚC (QR TRẢ MÓN & KDS)</span>
              <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] font-black text-[10px]">
                {fnbOrders.filter((o) => o.status === 'PENDING').length} đơn đang chờ trả
              </span>
            </div>
            <p className="text-[11px] text-[#8E9AAF] mt-0.5">
              Quét mã QR từ vé xem phim hoặc nhập mã đơn để xuất bắp nước cho khách hàng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8E9AAF]">Nhân viên phụ trách quầy:</span>
          <span className="font-bold text-white bg-[#141924] border border-[#222B3D] px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{operatorName}</span>
          </span>
        </div>
      </div>

      {/* Quick Scanner Bar */}
      <div className="bg-[#171D2B] border border-[#253045] rounded-2xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FABF2E]/15 border border-[#FABF2E]/30 flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5 text-[#FABF2E] animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-white text-xs block">Đầu Đọc Quét Mã QR Trả Món</span>
            <span className="text-[10px] text-[#8E9AAF]">
              Quét mã vạch/QR từ vé điện tử của khách để bật chi tiết đơn món
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScanOrder();
          }}
          className="flex items-center gap-2 flex-1 max-w-md"
        >
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 absolute left-3 top-2.5 text-[#FABF2E]" />
            <input
              type="text"
              placeholder="Quét hoặc nhập mã đơn / mã vé..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              className="w-full bg-[#121622] border border-[#2B374E] focus:border-[#FABF2E] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-[#5C677D] focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#FABF2E]/20 transition-all shrink-0 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Quét Mã</span>
          </button>
        </form>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#171D2B] border border-[#253045] rounded-xl p-0.5 text-[11px]">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === 'ALL' ? 'bg-[#253045] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              Tất cả ({fnbOrders.length})
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === 'PENDING' ? 'bg-[#F59E0B] text-black shadow-sm font-black' : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              Chờ giao món ({fnbOrders.filter((o) => o.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setFilterStatus('FULFILLED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === 'FULFILLED' ? 'bg-[#22C55E] text-black shadow-sm font-black' : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              Đã giao xong ({fnbOrders.filter((o) => o.status === 'FULFILLED').length})
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E9AAF]" />
          <input
            type="text"
            placeholder="Tìm mã đơn, tên khách, SĐT, combo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#171D2B] border border-[#253045] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#5C677D] focus:outline-none focus:border-[#FABF2E]"
          />
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-[#121622] border border-[#222B3D] rounded-2xl p-12 text-center text-[#8E9AAF] text-xs">
            {searchTerm ? 'Không tìm thấy đơn bắp nước nào phù hợp với từ khóa.' : 'Hiện không có đơn bắp nước nào cần xử lý.'}
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isFulfilled = ord.status === 'FULFILLED';
            const isPending = ord.status === 'PENDING';

            return (
              <div
                key={ord.code}
                className={`bg-[#121622] border rounded-2xl p-4 flex flex-col justify-between space-y-3.5 transition-all shadow-md ${
                  isFulfilled
                    ? 'border-[#22C55E]/30 bg-[#121622]/80 opacity-80'
                    : 'border-[#263147] hover:border-[#FABF2E]'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#222B3D] pb-2.5 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-white text-sm">{ord.code}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ord.code);
                          showToast(`Đã chép mã đơn: ${ord.code}`);
                        }}
                        className="text-[#8E9AAF] hover:text-white p-0.5 cursor-pointer"
                        title="Sao chép"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[10px] text-[#8E9AAF]">{ord.order_time}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                      isFulfilled
                        ? 'bg-[#22C55E]/15 text-[#22C55E]'
                        : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 animate-pulse'
                    }`}
                  >
                    {isFulfilled ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>ĐÃ GIAO</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>CHỜ LẤY</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Customer & Movie Context */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <User className="w-3.5 h-3.5 text-[#8E9AAF] shrink-0" />
                    <span>{ord.customer_name}</span>
                    <span className="text-[#8E9AAF] font-normal text-[11px]">({ord.customer_phone})</span>
                  </div>
                  {ord.movie_context && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#8E9AAF]">
                      <Film className="w-3.5 h-3.5 text-[#E63845] shrink-0" />
                      <span className="truncate">{ord.movie_context}</span>
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-1.5 bg-[#171D2B] p-2.5 rounded-xl border border-[#253045] text-xs">
                  <span className="text-[10px] text-[#8E9AAF] uppercase font-bold block">Danh Sách Món Cần Chuẩn Bị:</span>
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="border-t border-[#222B3D] first:border-0 pt-1.5 first:pt-0 space-y-0.5">
                      <div className="flex justify-between font-bold text-white text-xs">
                        <span className="text-[#FABF2E]">{item.quantity}x {item.name}</span>
                      </div>
                      {item.popcorn_detail && (
                        <div className="text-[11px] text-[#CBD5E1] pl-2">• {item.popcorn_detail}</div>
                      )}
                      {item.drink_detail && (
                        <div className="text-[11px] text-[#94A3B8] pl-2">• {item.drink_detail}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <div className="pt-1">
                  {isFulfilled ? (
                    <div className="text-center py-2 text-[11px] text-[#22C55E] font-bold bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/20 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đã giao xong {ord.fulfilled_by ? `(bởi ${ord.fulfilled_by})` : ''}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleFulfillOrder(ord)}
                      className="w-full py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#22C55E]/20 transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác Nhận Đã Giao Món</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Active Order Detail (Khi quét trúng mã) */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FABF2E]/15 border border-[#FABF2E]/30 flex items-center justify-center">
                  <Coffee className="w-4 h-4 text-[#FABF2E]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Đơn Bắp Nước #{activeOrder.code}</h3>
                  <span className="text-[10px] text-[#8E9AAF]">{activeOrder.order_time}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="text-[#8E9AAF] hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Banner */}
            {activeOrder.status === 'FULFILLED' ? (
              <div className="p-3 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <strong className="block font-bold">ĐƠN HÀNG ĐÃ ĐƯỢC GIAO BẮP NƯỚC</strong>
                  <span>Đã trả món hoàn tất trước đó {activeOrder.fulfilled_by ? `bởi ${activeOrder.fulfilled_by}` : ''}.</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[#FABF2E]/15 border border-[#FABF2E]/30 text-[#FABF2E] flex items-center gap-2.5 text-xs">
                <Clock className="w-5 h-5 shrink-0" />
                <div>
                  <strong className="block font-bold">ĐƠN ĐANG CHỜ TRẢ MÓN</strong>
                  <span>Vui lòng kiểm tra khay combo bắp nước và bấm xác nhận để giao cho khách.</span>
                </div>
              </div>
            )}

            {/* Customer & Movie info */}
            <div className="bg-[#171D2B] p-3 rounded-2xl border border-[#253045] space-y-1 text-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[#8E9AAF]" />
                <span>{activeOrder.customer_name}</span>
                <span className="text-[#8E9AAF] font-normal">({activeOrder.customer_phone})</span>
              </div>
              {activeOrder.movie_context && (
                <div className="text-[11px] text-[#8E9AAF] flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-[#E63845]" />
                  <span>{activeOrder.movie_context}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-white block">Chi Tiết Món Ăn:</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {activeOrder.items.map((i, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#171D2B] border border-[#253045] space-y-0.5">
                    <div className="font-bold text-[#FABF2E]">{i.quantity}x {i.name}</div>
                    {i.popcorn_detail && <div className="text-[11px] text-[#CBD5E1] pl-2">• {i.popcorn_detail}</div>}
                    {i.drink_detail && <div className="text-[11px] text-[#94A3B8] pl-2">• {i.drink_detail}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222B3D]">
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
              {activeOrder.status === 'PENDING' && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleFulfillOrder(activeOrder)}
                  className="px-5 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#22C55E]/20 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Giao Món</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
