'use client';

import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { Product, Order } from '@/lib/types-redesign';

interface FoodCheckinViewProps {
  products: Product[];
  orders?: Order[];
  operatorName: string;
  showToast: (msg: string) => void;
}

interface FnbOrderItem {
  id: string;
  name: string;
  product_type: 'COMBO' | 'FOOD' | 'BEVERAGE';
  quantity: number;
  popcorn_detail?: string;
  drink_detail?: string;
  extra_detail?: string;
  note?: string;
}

interface FnbOrder {
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
}

export default function FoodCheckinView({
  products,
  orders = [],
  operatorName,
  showToast
}: FoodCheckinViewProps) {
  const [scanInput, setScanInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'FULFILLED'>('ALL');

  // Danh sách đơn hàng bắp nước mẫu thời gian thực
  const [fnbOrders, setFnbOrders] = useState<FnbOrder[]>([
    {
      code: 'CMX-FNB-8921',
      customer_name: 'Nguyễn Thành Nam',
      customer_phone: '0988.123.456',
      order_time: '16:15 (Hôm nay)',
      movie_context: 'Dune: Hành Tinh Cát 2 (19:30 - Phòng 2 IMAX)',
      channel: 'APP_ONLINE',
      status: 'PENDING',
      items: [
        {
          id: 'i-1',
          name: 'Combo Couple Hẹn Hò',
          product_type: 'COMBO',
          quantity: 1,
          popcorn_detail: '1x Bắp Lớn (85oz) • Vị: Phô Mai Lắc Thơm Béo',
          drink_detail: '2x Ly Lớn (32oz) • Gồm: 1 Coca-Cola Original + 1 Sprite Chanh',
          extra_detail: '1x Hộp xúc xích nướng phô mai',
          note: 'Bắp lắc nhiều phô mai, nước ít đá'
        }
      ]
    },
    {
      code: 'CMX-FNB-9042',
      customer_name: 'Trần Thị Thu Thảo',
      customer_phone: '0903.456.789',
      order_time: '16:22 (Hôm nay)',
      movie_context: 'Avatar 3: Dòng Chảy (20:00 - Phòng 3 IMAX)',
      channel: 'APP_ONLINE',
      status: 'PENDING',
      items: [
        {
          id: 'i-2',
          name: 'Combo Solo Bắp Nước',
          product_type: 'COMBO',
          quantity: 2,
          popcorn_detail: '2x Bắp Vừa (64oz) • Vị: 1 Bơ Pháp + 1 Caramel Ngọt',
          drink_detail: '2x Ly Tiêu Chuẩn (22oz) • Gồm: 2 Coca-Cola Zero (Không đường)'
        },
        {
          id: 'i-3',
          name: 'Bắp Ngọt Caramel Nóng Hổi',
          product_type: 'FOOD',
          quantity: 1,
          popcorn_detail: '1x Hộp Lớn (85oz) • Vị: Caramel ngọt đậm đà'
        }
      ]
    },
    {
      code: 'CMX-FNB-7721',
      customer_name: 'Lê Hoàng Minh',
      customer_phone: '0912.888.999',
      order_time: '15:50 (Hôm nay)',
      movie_context: 'Thám Tử Lừng Danh Conan (16:30 - Phòng 1)',
      channel: 'KIOSK',
      status: 'FULFILLED',
      fulfilled_by: operatorName || 'Admin Quầy',
      fulfilled_at: '16:02',
      items: [
        {
          id: 'i-4',
          name: 'Combo Solo Bắp Nước',
          product_type: 'COMBO',
          quantity: 1,
          popcorn_detail: '1x Bắp Vừa (64oz) • Vị: Bơ truyền thống',
          drink_detail: '1x Ly Tiêu Chuẩn (22oz) • Loại: Coca-Cola Original'
        }
      ]
    }
  ]);

  // Đơn hàng đang được xem hoặc quét kiểm tra
  const [activeOrder, setActiveOrder] = useState<FnbOrder | null>(fnbOrders[0]);

  // Xử lý quét hoặc tra cứu mã đơn hàng QR
  const handleLookupOrder = (codeToSearch?: string) => {
    const raw = (codeToSearch || scanInput).trim().toUpperCase();
    if (!raw) {
      showToast('Vui lòng nhập hoặc quét mã QR đơn hàng!');
      return;
    }

    const found = fnbOrders.find(
      (o) => o.code.toUpperCase() === raw || o.code.toUpperCase().includes(raw)
    );

    if (found) {
      setActiveOrder(found);
      showToast(`Đã tìm thấy đơn bắp nước ${found.code}!`);
    } else {
      showToast(`Không tìm thấy đơn hàng mã "${raw}". Vui lòng kiểm tra lại!`);
    }
  };

  // Xác nhận trả món cho khách hàng
  const handleConfirmFulfillment = (orderCode: string) => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setFnbOrders((prev) =>
      prev.map((ord) => {
        if (ord.code === orderCode) {
          return {
            ...ord,
            status: 'FULFILLED',
            fulfilled_by: operatorName || 'Thu Ngân Quầy',
            fulfilled_at: nowTime
          };
        }
        return ord;
      })
    );

    if (activeOrder && activeOrder.code === orderCode) {
      setActiveOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'FULFILLED',
              fulfilled_by: operatorName || 'Thu Ngân Quầy',
              fulfilled_at: nowTime
            }
          : null
      );
    }

    showToast(`✅ Đã xác nhận trả bắp nước thành công cho đơn #${orderCode}!`);
  };

  const pendingOrders = fnbOrders.filter((o) => o.status === 'PENDING');
  const fulfilledOrders = fnbOrders.filter((o) => o.status === 'FULFILLED');

  const displayedOrders = fnbOrders.filter((o) => {
    if (filterStatus === 'PENDING') return o.status === 'PENDING';
    if (filterStatus === 'FULFILLED') return o.status === 'FULFILLED';
    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header & Overview KPI */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0E121B] border border-[#222B3D] p-4 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FABF2E] to-[#F59E0B] flex items-center justify-center text-black shadow-lg shadow-[#FABF2E]/25">
            <QrCode className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
              <span>QUẦY TRẢ MÓN BẮP NƯỚC (QR TRẢ MÓN & KDS)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                Live
              </span>
            </h2>
            <p className="text-xs text-[#8E9AAF]">
              Quét mã QR trên vé hoặc nhập mã đơn hàng để đối soát chi tiết bắp, nước, vị và trả món
            </p>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#141926] border border-[#20293B] text-center">
            <div className="text-[10px] text-[#8E9AAF] font-medium">Đơn chờ lấy</div>
            <div className="text-base font-black text-[#FABF2E] font-mono">{pendingOrders.length}</div>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-[#141926] border border-[#20293B] text-center">
            <div className="text-[10px] text-[#8E9AAF] font-medium">Đã trả hôm nay</div>
            <div className="text-base font-black text-[#22C55E] font-mono">{fulfilledOrders.length}</div>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-[#141926] border border-[#20293B] text-center hidden sm:block">
            <div className="text-[10px] text-[#8E9AAF] font-medium">Nhân viên quầy</div>
            <div className="text-xs font-bold text-white truncate max-w-[100px]">{operatorName || 'Admin'}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Scanner & Active Order, Right Live Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CỘT TRÁI (7 COLS): QUÉT MÃ QR & CHI TIẾT ĐƠN HÀNG ĐỐI SOÁT */}
        <div className="lg:col-span-7 space-y-4">
          {/* Scanner Box */}
          <div className="p-4 rounded-2xl bg-[#121622] border border-[#25324A] shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ScanLine className="w-4 h-4 text-[#06B6D4]" />
                <span>Quét mã QR hoặc nhập mã đơn nhận món</span>
              </label>
              <span className="text-[10px] text-[#8E9AAF]">Mã định dạng: CMX-FNB-xxxx</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <QrCode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9AAF]" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookupOrder()}
                  placeholder="Quét mã QR trên vé hoặc nhập mã: CMX-FNB-8921..."
                  className="w-full bg-[#182030] border border-[#26354D] focus:border-[#FABF2E] rounded-xl pl-9 pr-3 py-2.5 text-white font-mono font-bold text-xs focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleLookupOrder()}
                className="px-4 py-2.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Kiểm Tra</span>
              </button>
            </div>

            {/* Quick Demo Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
              <span className="text-[#8E9AAF] text-[10px]">Thử nhanh mã mẫu:</span>
              {fnbOrders.map((ord) => (
                <button
                  key={ord.code}
                  type="button"
                  onClick={() => {
                    setScanInput(ord.code);
                    handleLookupOrder(ord.code);
                  }}
                  className={`px-2 py-0.5 rounded-lg border font-mono transition-colors cursor-pointer ${
                    activeOrder?.code === ord.code
                      ? 'bg-[#FABF2E]/20 text-[#FABF2E] border-[#FABF2E]/40 font-bold'
                      : 'bg-[#182030] text-[#8E9AAF] border-[#222E42] hover:text-white'
                  }`}
                >
                  {ord.code} ({ord.status === 'PENDING' ? 'Chờ trả' : 'Đã trả'})
                </button>
              ))}
            </div>
          </div>

          {/* ACTIVE ORDER DETAIL CARD (ĐỐI SOÁT CHI TIẾT BẮP & NƯỚC) */}
          {activeOrder ? (
            <div className="p-5 rounded-3xl bg-[#121622] border border-[#26354D] shadow-xl space-y-4">
              {/* Order Header */}
              <div className="flex items-start justify-between border-b border-[#222E44] pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white text-base tracking-wide">
                      #{activeOrder.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        activeOrder.status === 'PENDING'
                          ? 'bg-[#FABF2E] text-black'
                          : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                      }`}
                    >
                      {activeOrder.status === 'PENDING' ? 'CHỜ TRẢ MÓN' : 'ĐÃ TRẢ MÓN'}
                    </span>
                  </div>
                  <div className="text-xs text-[#8E9AAF] mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-white font-medium">
                      <User className="w-3.5 h-3.5 text-[#06B6D4]" />
                      {activeOrder.customer_name} ({activeOrder.customer_phone})
                    </span>
                    <span>• {activeOrder.order_time}</span>
                  </div>
                  {activeOrder.movie_context && (
                    <div className="text-[11px] text-[#FABF2E] font-medium mt-1 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      <span>{activeOrder.movie_context}</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <span className="px-2 py-1 rounded-lg bg-[#182030] text-[10px] text-[#8E9AAF] font-bold block">
                    Kênh: {activeOrder.channel}
                  </span>
                  {activeOrder.fulfilled_at && (
                    <span className="text-[10px] text-[#22C55E] block mt-1">
                      Đã trả lúc: {activeOrder.fulfilled_at}
                    </span>
                  )}
                </div>
              </div>

              {/* LIST ITEMS IN ORDER: RÕ RÀNG BẮP GÌ, NƯỚC GÌ, VỊ GÌ */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-[#8E9AAF] uppercase tracking-wider flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Danh sách bắp nước cần chuẩn bị & bàn giao ({activeOrder.items.length} món)</span>
                </div>

                <div className="space-y-2.5">
                  {activeOrder.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[#0E121B] border border-[#1E2638] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-lg bg-[#182030] text-white font-mono font-bold text-[11px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-white text-sm">{item.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#E63845] text-white uppercase">
                            SL: {item.quantity}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#06B6D4] font-bold uppercase">
                          {item.product_type}
                        </span>
                      </div>

                      {/* Chi tiết Bắp */}
                      {item.popcorn_detail && (
                        <div className="flex items-start gap-2 bg-[#161D2B] p-2 rounded-xl border border-[#222E42]">
                          <span className="text-base shrink-0">🍿</span>
                          <div className="leading-tight">
                            <span className="font-bold text-[#FABF2E]">Bắp rang:</span>{' '}
                            <span className="text-white font-medium">{item.popcorn_detail}</span>
                          </div>
                        </div>
                      )}

                      {/* Chi tiết Nước */}
                      {item.drink_detail && (
                        <div className="flex items-start gap-2 bg-[#161D2B] p-2 rounded-xl border border-[#222E42]">
                          <span className="text-base shrink-0">🥤</span>
                          <div className="leading-tight">
                            <span className="font-bold text-[#06B6D4]">Nước uống:</span>{' '}
                            <span className="text-white font-medium">{item.drink_detail}</span>
                          </div>
                        </div>
                      )}

                      {/* Đồ ăn kèm / Quà tặng */}
                      {item.extra_detail && (
                        <div className="flex items-start gap-2 bg-[#161D2B] p-2 rounded-xl border border-[#222E42]">
                          <span className="text-base shrink-0">🎁</span>
                          <div className="leading-tight">
                            <span className="font-bold text-[#C4B5FD]">Kèm theo:</span>{' '}
                            <span className="text-white font-medium">{item.extra_detail}</span>
                          </div>
                        </div>
                      )}

                      {/* Ghi chú của khách */}
                      {item.note && (
                        <div className="text-[11px] text-[#EF4444] bg-[#3B191C]/30 px-2 py-1 rounded-lg border border-[#EF4444]/20">
                          ⚠️ <strong>Ghi chú khách:</strong> {item.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION: NÚT XÁC NHẬN TRẢ MÓN */}
              <div className="pt-2 border-t border-[#222E44] flex items-center justify-between gap-3">
                <div className="text-xs text-[#8E9AAF]">
                  {activeOrder.status === 'PENDING' ? (
                    <span>Kiểm tra đúng bắp nước trước khi bấm xác nhận.</span>
                  ) : (
                    <span className="text-[#22C55E] font-semibold">
                      ✓ Đơn hàng đã được bàn giao đầy đủ cho khách.
                    </span>
                  )}
                </div>

                {activeOrder.status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => handleConfirmFulfillment(activeOrder.code)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#1EA34D] hover:to-[#15803D] text-black font-black text-xs shadow-lg shadow-[#22C55E]/25 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>XÁC NHẬN ĐÃ TRẢ MÓN CHO KHÁCH</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-[#22C55E]/15 text-[#22C55E] font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ĐÃ BÀN GIAO THÀNH CÔNG</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#121622] border border-[#222B3D] rounded-3xl space-y-2">
              <Coffee className="w-10 h-10 text-[#5C677D] mx-auto" />
              <p className="text-sm font-bold text-white">Chưa chọn đơn hàng nào để đối soát!</p>
              <p className="text-xs text-[#8E9AAF]">
                Vui lòng quét mã QR hoặc chọn một đơn hàng từ danh sách chờ bên phải.
              </p>
            </div>
          )}
        </div>

        {/* CỘT PHẢI (5 COLS): HÀNG ĐỢI KDS TRẢ MÓN THỜI GIAN THỰC */}
        <div className="lg:col-span-5 space-y-3">
          {/* Queue Header & Filters */}
          <div className="p-3.5 rounded-2xl bg-[#121622] border border-[#222B3D] flex items-center justify-between gap-2">
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#FABF2E]" />
              <span>Hàng đợi làm món & trả tại quầy</span>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-[#182030] p-0.5 rounded-xl border border-[#26324A] text-[10px]">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  filterStatus === 'ALL' ? 'bg-[#FABF2E] text-black' : 'text-[#8E9AAF] hover:text-white'
                }`}
              >
                Tất cả ({fnbOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PENDING')}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  filterStatus === 'PENDING' ? 'bg-[#FABF2E] text-black' : 'text-[#8E9AAF] hover:text-white'
                }`}
              >
                Chờ trả ({pendingOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('FULFILLED')}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  filterStatus === 'FULFILLED' ? 'bg-[#FABF2E] text-black' : 'text-[#8E9AAF] hover:text-white'
                }`}
              >
                Đã trả ({fulfilledOrders.length})
              </button>
            </div>
          </div>

          {/* List of Orders in Queue */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto custom-scrollbar pr-1">
            {displayedOrders.map((ord) => {
              const isSelected = activeOrder?.code === ord.code;
              const isPending = ord.status === 'PENDING';

              return (
                <div
                  key={ord.code}
                  onClick={() => setActiveOrder(ord)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none space-y-2 ${
                    isSelected
                      ? 'bg-[#172236] border-[#06B6D4] ring-2 ring-[#06B6D4]/40 shadow-lg'
                      : 'bg-[#121622] border-[#222B3D] hover:border-[#384663]'
                  }`}
                >
                  {/* Order Top Bar */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">#{ord.code}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          isPending
                            ? 'bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/30'
                            : 'bg-[#22C55E]/20 text-[#22C55E]'
                        }`}
                      >
                        {isPending ? 'CHỜ LẤY' : 'ĐÃ TRẢ'}
                      </span>
                    </div>

                    <span className="text-[10px] text-[#8E9AAF] font-mono">{ord.order_time}</span>
                  </div>

                  {/* Customer info */}
                  <div className="text-[11px] text-[#8E9AAF]">
                    Khách: <strong className="text-white">{ord.customer_name}</strong> ({ord.customer_phone})
                  </div>

                  {/* Summary of items */}
                  <div className="space-y-1 bg-[#0E121B] p-2 rounded-xl text-[11px] border border-[#1A2232]">
                    {ord.items.map((item) => (
                      <div key={item.id} className="text-[#E2E8F0]">
                        <span className="font-bold text-white">• {item.quantity}x {item.name}:</span>{' '}
                        {item.popcorn_detail ? <span className="text-[#FABF2E]">{item.popcorn_detail}</span> : null}
                        {item.drink_detail ? <span className="text-[#06B6D4] ml-1">| {item.drink_detail}</span> : null}
                      </div>
                    ))}
                  </div>

                  {/* Quick Action Button */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[10px] text-[#06B6D4] hover:underline flex items-center gap-1 font-semibold">
                      <span>Xem & Đối soát</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>

                    {isPending ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmFulfillment(ord.code);
                        }}
                        className="px-3 py-1 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-bold text-[11px] transition-all cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Trả Món Nhanh</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#22C55E] font-medium">✓ Đã trả xong</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
