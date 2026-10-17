'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { Ticket, QrCode, Download, Calendar, MapPin, X, Lock, Search, ShieldCheck } from 'lucide-react';
import { TicketScannerService } from '@/services/ticket-scanner.service';
import { createClient } from '@/lib/supabase/client';

interface StoredTicket {
  id: number;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  bookingCode: string;
  movieTitle: string;
  posterUrl: string;
  cinemaName: string;
  roomName: string;
  showtime: string;
  seats: string;
  totalAmount: number;
  createdAt: string;
  status: string;
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

              {/* Kết quả tra cứu vé cho khách */}
              {lookupResult && (
                <div className="mt-4 pt-4 border-t border-[#303645] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#33C773] font-bold">✓ Đã tìm thấy vé của bạn:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedQrTicket(lookupResult)}
                      className="bg-[#E63845] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Xem QR
                    </button>
                  </div>
                  <div className="bg-[#0F1217] border border-[#303645] rounded-2xl p-4 space-y-1 text-xs">
                    <div className="font-bold text-white text-sm">{lookupResult.movieTitle}</div>
                    <div className="text-[#9EA6B8]">{lookupResult.cinemaName} • {lookupResult.roomName}</div>
                    <div className="text-[#FABF2E] font-semibold">Suất: {lookupResult.showtime} - Ghế: {lookupResult.seats}</div>
                    <div className="text-white">Người đặt: {lookupResult.customerName || 'Khách vãng lai'}</div>
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
                              <span className="text-white font-bold">{ticket.seats}</span>
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

      {/* QR Code Popup Modal */}
      {selectedQrTicket && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 relative shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setSelectedQrTicket(null)}
              className="absolute top-4 right-4 text-[#9EA6B8] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Vé Điện Tử</h3>
            <p className="text-xs text-[#9EA6B8]">{selectedQrTicket.movieTitle}</p>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-lg">
              <img
                src={qrDataUrl || TicketScannerService.generateTicketQrUrl(selectedQrTicket.bookingCode, 240)}
                alt={`Mã QR vé ${selectedQrTicket.bookingCode}`}
                className="w-48 h-48 object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] text-[#FABF2E] font-bold uppercase tracking-wider">
                MÃ QUÉT SOÁT VÉ / IN KIOSK
              </div>
              <div className="font-mono text-base font-black text-white bg-[#0F1217] py-1 px-3 rounded-lg border border-[#303645] inline-block tracking-widest">
                {selectedQrTicket.bookingCode}
              </div>
              <div className="text-xs text-white/90">
                {selectedQrTicket.cinemaName} • Ghế {selectedQrTicket.seats}
              </div>
              <div className="text-[11px] text-[#9EA6B8]">
                Người đặt: <span className="text-white font-medium">{selectedQrTicket.customerName || 'Khách vãng lai'}</span>
              </div>
              <div className="text-[10px] text-gray-400 italic pt-0.5">
                Đưa mã này vào đầu đọc Kiosk để in vé giấy hoặc cửa soát vé
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`QR-${selectedQrTicket.bookingCode}.png`}
                  className="bg-[#0F1217] border border-[#303645] hover:border-white text-white py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải ảnh QR</span>
                </a>
              )}
              <button
                onClick={() => setSelectedQrTicket(null)}
                className={`${qrDataUrl ? '' : 'col-span-2'} bg-[#E63845] hover:bg-[#CC2B37] text-white py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
