'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { Ticket, QrCode, Download, Calendar, MapPin, X, Lock, Search, ShieldCheck, Coffee, Printer } from 'lucide-react';
import { TicketScannerService } from '@/services/ticket-scanner.service';
import { createClient } from '@/lib/supabase/client';
import UnifiedTicketModal from '@/components/common/UnifiedTicketModal';

interface StoredTicket {
  id: number | string;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  bookingCode: string;
  movieTitle: string;
  posterUrl?: string;
  moviePoster?: string;
  cinemaName: string;
  roomName: string;
  auditoriumName?: string;
  format?: string;
  showtime: string;
  showtimeDate?: string;
  showtimeTime?: string;
  seats: string | string[];
  seatsStr?: string;
  totalAmount: number;
  createdAt?: string;
  status: string;
  foodsStr?: string;
  foods?: any[];
  ageRating?: string;
  age_rating?: string;
  isCheckedIn?: boolean;
  checkedInAt?: string;
}

export default function MyTicketsPage() {
  const { currentUser, openAuthModal } = useAuth();
  const [allTickets, setAllTickets] = useState<StoredTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [selectedQrTicket, setSelectedQrTicket] = useState<StoredTicket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Admin toggle to view all tickets in system
  const [adminViewAll, setAdminViewAll] = useState<boolean>(false);

  // Guest lookup states
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [lookupError, setLookupError] = useState<string>('');
  const [lookupResult, setLookupResult] = useState<StoredTicket | null>(null);

  useEffect(() => {
    if (!selectedQrTicket) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(selectedQrTicket.bookingCode, {
      width: 240,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [selectedQrTicket]);

  const deduplicateTickets = (tickets: StoredTicket[]): StoredTicket[] => {
    const seenCodes = new Set<string>();
    const seenIds = new Set<string | number>();
    const seenSignatures = new Set<string>();
    const unique: StoredTicket[] = [];

    for (const t of tickets) {
      if (!t) continue;
      const code = (t.bookingCode || '').trim().toUpperCase();
      const id = t.id;
      const sig = `${(t.movieTitle || '').trim().toLowerCase()}_${(t.showtime || '').trim()}_${(t.seats || '').trim().toLowerCase()}_${(t.customerPhone || t.customerEmail || '').trim()}`;

      if (code) {
        if (seenCodes.has(code)) continue;
        seenCodes.add(code);
      }
      if (id) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }
      if (sig && t.seats) {
        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);
      }
      unique.push(t);
    }
    return unique;
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = deduplicateTickets(parsed);
          setAllTickets(cleaned);
          localStorage.setItem('cinemax_user_tickets', JSON.stringify(cleaned));
          try {
            cleaned.forEach((t: any) => {
              fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_order', data: t })
              }).catch(() => {});
            });
            window.dispatchEvent(new Event('cinemax_data_updated'));
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    // Tải dữ liệu đơn hàng và vé thực tế từ Supabase Cloud
    const loadSupabaseOrders = async () => {
      try {
        const supabase = createClient();
        const { data: supaOrders, error } = await supabase
          .from('orders')
          .select('*, order_items(*, tickets(*))')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && supaOrders && supaOrders.length > 0) {
          const mapped: StoredTicket[] = supaOrders.map((o: any, idx: number) => {
            const rawItems = o.order_items || [];
            const ticketItem = rawItems.find((i: any) => i.item_type === 'ticket') || rawItems[0];
            const snap = ticketItem?.item_snapshot || {};
            const seats = rawItems
              .filter((i: any) => i.item_type === 'ticket')
              .map((i: any) => i.item_snapshot?.seatCode)
              .filter(Boolean);

            const rawStatus = (o.status || 'paid').toUpperCase();
            const statusMapped =
              rawStatus === 'USED' || rawStatus === 'CHECKED_IN'
                ? 'ĐÃ XEM'
                : rawStatus === 'CANCELLED' || rawStatus === 'EXPIRED' || rawStatus === 'REFUNDED'
                ? 'HẾT HẠN'
                : 'ĐÃ THANH TOÁN';

            return {
              id: idx + 1000,
              userId: o.user_id || undefined,
              customerName: o.contact_name || 'Khách hàng',
              customerEmail: o.contact_email || undefined,
              customerPhone: o.contact_phone || undefined,
              bookingCode: o.order_code || `CMX-${o.id.slice(0, 8).toUpperCase()}`,
              movieTitle: snap.movieTitle || 'Dune: Hành Tinh Cát - Phần 2',
              posterUrl: snap.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
              cinemaName: snap.cinemaName || 'CINEMAX Plaza',
              roomName: snap.roomName || 'Phòng 1 (2D Tiêu Chuẩn)',
              showtime: snap.showTime && snap.showDate ? `${snap.showTime} - ${snap.showDate}` : new Date(o.created_at).toLocaleString('vi-VN'),
              seats: seats.length > 0 ? seats.join(', ') : 'E5, E6',
              totalAmount: Number(o.total_amount || 0),
              createdAt: new Date(o.created_at).toLocaleString('vi-VN'),
              status: statusMapped,
            };
          });

          setAllTickets((prev) => {
            const combined = deduplicateTickets([...prev, ...mapped]);
            localStorage.setItem('cinemax_user_tickets', JSON.stringify(combined));
            return combined;
          });
        }
      } catch (err) {
        console.warn('Could not load tickets from Supabase:', err);
      }
    };

    loadSupabaseOrders();
  }, []);

  // Filter tickets specifically for the logged in user or admin
  const userTickets = React.useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role_code === 'ADMIN' && adminViewAll) {
      return allTickets;
    }

    return allTickets.filter(
      (t) =>
        t.userId === currentUser.id ||
        (t.customerEmail && t.customerEmail.toLowerCase() === currentUser.email.toLowerCase())
    );
  }, [allTickets, currentUser, adminViewAll]);

  const filteredTickets = userTickets.filter((t) => {
    if (activeTab === 'UPCOMING') return t.status === 'ĐÃ THANH TOÁN';
    return t.status === 'ĐÃ XEM' || t.status === 'HẾT HẠN';
  });

  const handleGuestLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setLookupResult(null);

    const cleanCode = lookupCode.trim().toUpperCase();
    const cleanPhone = lookupPhone.trim();

    const found = allTickets.find(
      (t) =>
        t.bookingCode.toUpperCase() === cleanCode &&
        (!cleanPhone || (t.customerPhone && t.customerPhone.includes(cleanPhone)))
    );

    if (found) {
      setLookupResult(found);
    } else {
      setLookupError('Không tìm thấy vé với thông tin đã cung cấp. Vui lòng kiểm tra lại mã vé.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-8 lg:px-20 py-10 space-y-8">
        {/* Title & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#303645] pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E63845]/10 border border-[#E63845]/30 flex items-center justify-center text-[#E63845]">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Vé của tôi</h1>
              <p className="text-xs text-[#9EA6B8]">
                {currentUser
                  ? `Tài khoản: ${currentUser.full_name} (${currentUser.email})`
                  : 'Quản lý và tra cứu vé điện tử đã đặt'}
              </p>
            </div>
          </div>

          {/* Right Controls: Tabs or Admin Toggle */}
          {currentUser ? (
            <div className="flex items-center gap-3 flex-wrap">
              {currentUser.role_code === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setAdminViewAll(!adminViewAll)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    adminViewAll
                      ? 'bg-[#FABF2E] text-black border-[#FABF2E]'
                      : 'bg-[#1A1C26] text-[#FABF2E] border-[#FABF2E]/40 hover:bg-[#FABF2E]/10'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{adminViewAll ? 'Đang xem: Tất cả vé hệ thống' : 'Xem toàn bộ vé (Admin)'}</span>
                </button>
              )}

              <div className="flex bg-[#1A1C26] p-1 rounded-full border border-[#303645]">
                <button
                  onClick={() => setActiveTab('UPCOMING')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'UPCOMING'
                      ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                      : 'text-[#9EA6B8] hover:text-white'
                  }`}
                >
                  Vé sắp xem ({userTickets.filter((t) => t.status === 'ĐÃ THANH TOÁN').length})
                </button>
                <button
                  onClick={() => setActiveTab('HISTORY')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'HISTORY'
                      ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                      : 'text-[#9EA6B8] hover:text-white'
                  }`}
                >
                  Lịch sử ({userTickets.filter((t) => t.status !== 'ĐÃ THANH TOÁN').length})
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('LOGIN')}
              className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              Đăng nhập để xem vé
            </button>
          )}
        </div>

        {/* ======================================================== */}
        {/* CASE 1: UNLOGGED GUEST (Khách chưa đăng nhập) */}
        {/* Bảo mật thông tin, không tự động rò rỉ vé của người khác */}
        {/* ======================================================== */}
        {!currentUser && (
          <div className="max-w-2xl mx-auto space-y-8 pt-4">
            {/* Banner yêu cầu đăng nhập */}
            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-8 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-[#E63845]/15 border border-[#E63845]/30 text-[#E63845] flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Bạn chưa đăng nhập tài khoản</h2>
              <p className="text-xs sm:text-sm text-[#9EA6B8] max-w-md mx-auto leading-relaxed">
                Để bảo vệ quyền riêng tư và thông tin cá nhân của bạn, danh sách vé đã đặt chỉ được hiển thị khi bạn đăng nhập tài khoản thành viên.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openAuthModal('LOGIN')}
                  className="w-full sm:w-auto bg-[#E63845] hover:bg-[#CC2B37] text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
                <button
                  onClick={() => openAuthModal('REGISTER')}
                  className="w-full sm:w-auto bg-[#0F1217] border border-[#303645] hover:border-white text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Tạo tài khoản mới
                </button>
              </div>
            </div>

            {/* Hoặc tra cứu vé nhanh bằng mã vé cho khách vãng lai */}
            <div className="bg-[#14161F] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-[#FABF2E]" />
                Tra cứu vé vãng lai dành cho khách không có tài khoản
              </h3>
              <form onSubmit={handleGuestLookup} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#9EA6B8] block mb-1">Mã đặt vé (VD: CMX-20260930-XXXX) *</label>
                    <input
                      type="text"
                      required
                      placeholder="CMX-..."
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9EA6B8] block mb-1">Số điện thoại đặt vé</label>
                    <input
                      type="tel"
                      placeholder="0912..."
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                      className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>
                </div>

                {lookupError && (
                  <p className="text-xs text-[#E63845] font-semibold">{lookupError}</p>
                )}

                <button
                  type="submit"
                  className="bg-[#1A1C26] border border-[#303645] hover:border-[#FABF2E] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Tra cứu vé
                </button>
              </form>

              {/* Kết quả tra cứu vé cho khách (Formatted according to Staff POS Ticket Receipt) */}
              {lookupResult && (
                <div className="mt-4 pt-4 border-t border-[#303645] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#22C55E] font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                      ✓ Đã tìm thấy vé của bạn:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedQrTicket(lookupResult)}
                      className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#E63845]/20"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Xem Thẻ Vé & QR
                    </button>
                  </div>

                  <div className="bg-[#121622] border border-[#2C384E] rounded-2xl p-5 space-y-3 text-xs shadow-xl">
                    <div className="border-b border-[#242E40] pb-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-black text-[#E63845] tracking-widest uppercase">
                          CINEMAX THEATER
                        </div>
                        <h4 className="text-sm font-black text-white">HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC</h4>
                      </div>
                      <span className="font-mono text-[11px] text-[#FABF2E] font-bold">
                        {lookupResult.bookingCode}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[#8E9AAF] block text-[11px]">Phim:</span>
                        <span className="text-sm font-bold text-white block">{lookupResult.movieTitle}</span>
                      </div>

                      <div className="flex justify-between text-[#8E9AAF]">
                        <span>Rạp: <strong className="text-white">{lookupResult.cinemaName}</strong></span>
                        <span>Trạng thái: <strong className="text-[#22C55E] uppercase">{lookupResult.status}</strong></span>
                      </div>

                      <div className="flex justify-between text-[#8E9AAF]">
                        <span>Phòng: <strong className="text-white">{lookupResult.roomName}</strong></span>
                        <span>Định dạng: <strong className="text-[#06B6D4]">{lookupResult.format || (lookupResult.roomName?.includes('IMAX') ? 'IMAX Laser' : '2D Digital')}</strong></span>
                      </div>

                      <div className="flex justify-between text-[#8E9AAF]">
                        <span>Giờ chiếu:</span>
                        <span className="font-mono text-white font-bold">{lookupResult.showtime}</span>
                      </div>

                      {/* Seats breakdown box */}
                      <div className="p-2.5 rounded-xl bg-[#171E2D] border border-[#253045] space-y-1">
                        <span className="text-[11px] font-bold text-[#FABF2E] block">Ghế ngồi:</span>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white font-mono font-bold text-sm text-[#06B6D4]">
                            {Array.isArray(lookupResult.seats) ? lookupResult.seats.join(', ') : lookupResult.seats}
                          </span>
                          <span className="text-[10px] text-[#8E9AAF] bg-[#141924] px-2 py-0.5 rounded border border-[#253045]">
                            Đã giữ chỗ
                          </span>
                        </div>
                      </div>

                      {/* Foods breakdown box */}
                      {(lookupResult.foodsStr || (lookupResult.foods && lookupResult.foods.length > 0)) && (
                        <div className="p-2.5 rounded-xl bg-[#171E2D] border border-[#253045] space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-[#FABF2E] block">Bắp nước:</span>
                            <span className="text-[9px] bg-[#FABF2E]/20 text-[#FABF2E] px-2 py-0.5 rounded-full border border-[#FABF2E]/40 font-semibold uppercase">
                              Nhận tại quầy
                            </span>
                          </div>
                          <div className="text-white font-semibold text-xs">
                            {lookupResult.foodsStr || lookupResult.foods?.map((f: any) => `${f.quantity || f.qty}x ${f.name}`).join(', ')}
                          </div>
                        </div>
                      )}

                      {/* Financial breakdown */}
                      <div className="pt-2 border-t border-[#242E40] space-y-1">
                        <div className="flex justify-between text-[#8E9AAF] text-xs">
                          <span>Người nhận vé:</span>
                          <span className="text-white font-semibold">
                            {lookupResult.customerName || 'Khách vãng lai'}{' '}
                            {lookupResult.customerPhone ? `(${lookupResult.customerPhone})` : ''}
                          </span>
                        </div>
                        {lookupResult.totalAmount !== undefined && (
                          <div className="flex justify-between font-bold text-sm text-white">
                            <span>Tổng tiền:</span>
                            <span className="font-mono text-[#22C55E] text-base">
                              {lookupResult.totalAmount.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CASE 2: LOGGED IN USER (Thành viên / Admin) */}
        {/* Chỉ hiện đúng các vé của tài khoản đó */}
        {/* ======================================================== */}
        {currentUser && (
          <div>
            {filteredTickets.length === 0 ? (
              <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-12 text-center max-w-md mx-auto space-y-4">
                <Ticket className="w-12 h-12 text-[#9EA6B8] mx-auto opacity-50" />
                <h3 className="text-lg font-bold text-white">Bạn chưa có vé nào trong mục này</h3>
                <p className="text-xs text-[#9EA6B8]">
                  Khám phá ngay các siêu phẩm điện ảnh đang khởi chiếu tại CINEMAX và tích lũy điểm thưởng!
                </p>
                <Link
                  href="/"
                  className="inline-block bg-[#E63845] hover:bg-[#CC2B37] text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Đặt vé xem phim ngay
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTickets.map((ticket, idx) => (
                  <div
                    key={`${ticket.bookingCode || ticket.id}-${idx}`}
                    className="bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden flex flex-col sm:flex-row hover:border-[#E63845]/50 transition-all shadow-xl group"
                  >
                    {/* Poster */}
                    <div className="sm:w-40 h-48 sm:h-auto flex-shrink-0 relative overflow-hidden bg-black">
                      <img
                        src={ticket.posterUrl}
                        alt={ticket.movieTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3">
                        <span
                          className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wider ${
                            ticket.status === 'ĐÃ THANH TOÁN'
                              ? 'bg-[#33C773] text-black font-extrabold'
                              : 'bg-[#383D4D] text-[#9EA6B8]'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white line-clamp-1">
                            {ticket.movieTitle}
                          </h3>
                        </div>

                        <div className="space-y-1.5 text-xs text-[#9EA6B8]">
                          <div className="flex items-center gap-1.5 text-white">
                            <MapPin className="w-3.5 h-3.5 text-[#E63845] flex-shrink-0" />
                            <span className="font-semibold line-clamp-1">{ticket.cinemaName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#FABF2E]">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{ticket.showtime}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <span>Phòng: </span>
                              <span className="text-white font-semibold">{ticket.roomName}</span>
                            </div>
                            <div>
                              <span>Ghế: </span>
                              <span className="text-white font-bold">{Array.isArray(ticket.seats) ? ticket.seats.join(', ') : ticket.seats}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span>Mã vé: </span>
                              <span className="font-mono font-bold text-[#FABF2E]">{ticket.bookingCode}</span>
                            </div>
                            {adminViewAll && (
                              <span className="text-[11px] text-[#9EA6B8]">
                                Khách: {ticket.customerName || 'N/A'}
                              </span>
                            )}
                          </div>
                          {(ticket.foodsStr || (ticket.foods && ticket.foods.length > 0)) && (
                            <div className="bg-[#141722] px-2.5 py-1.5 rounded-xl border border-[#FABF2E]/30 text-xs">
                              <span className="text-[#FABF2E] font-bold">🍿 Bắp nước: </span>
                              <span className="text-white font-medium">
                                {ticket.foodsStr || ticket.foods?.map((f: any) => `${f.quantity}x ${f.name}`).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-[#303645] flex items-center justify-between gap-3">
                        <span className="font-black text-white text-sm sm:text-base">
                          {ticket.totalAmount.toLocaleString('vi-VN')} đ
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedQrTicket(ticket)}
                            className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Xem QR</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="border border-[#303645] hover:border-white text-white p-1.5 rounded-full transition-colors cursor-pointer"
                            title="Tải PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      {/* Unified Cinema Ticket Modal (Synchronized with Staff Gate Check-in & POS View) */}
      <UnifiedTicketModal
        ticket={selectedQrTicket}
        onClose={() => setSelectedQrTicket(null)}
      />
    </div>
  );
}
