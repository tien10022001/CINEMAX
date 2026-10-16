'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { Ticket, QrCode, Download, Calendar, MapPin, X, Lock, Search, ShieldCheck, Coffee } from 'lucide-react';
import { TicketScannerService } from '@/services/ticket-scanner.service';

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
  foodsStr?: string;
  foods?: any[];
}

export default function MyTicketsPage() {
  const { currentUser, openAuthModal } = useAuth();
  const [allTickets, setAllTickets] = useState<StoredTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [selectedQrTicket, setSelectedQrTicket] = useState<StoredTicket | null>(null);

  // Admin toggle to view all tickets in system
  const [adminViewAll, setAdminViewAll] = useState<boolean>(false);

  // Guest lookup states
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [lookupError, setLookupError] = useState<string>('');
  const [lookupResult, setLookupResult] = useState<StoredTicket | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setAllTickets(parsed);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setAllTickets([]);
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
                  <div className="bg-[#0F1217] border border-[#303645] rounded-2xl p-4 space-y-2 text-xs">
                    <div className="font-bold text-white text-sm">{lookupResult.movieTitle}</div>
                    <div className="text-[#9EA6B8]">{lookupResult.cinemaName} • {lookupResult.roomName}</div>
                    <div className="text-[#FABF2E] font-semibold">
                      Suất: {lookupResult.showtime} - Ghế: {Array.isArray(lookupResult.seats) ? lookupResult.seats.join(', ') : lookupResult.seats}
                    </div>
                    <div className="text-white">Người đặt: {lookupResult.customerName || 'Khách vãng lai'}</div>

                    {/* Hiển thị Bắp Nước & Combo */}
                    {lookupResult.foodsStr ? (
                      <div className="mt-2.5 pt-2.5 border-t border-[#303645] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4 text-[#FABF2E] shrink-0" />
                          <span className="text-[#FABF2E] font-bold">Bắp Nước & Combo:</span>
                          <span className="text-white font-medium">{lookupResult.foodsStr}</span>
                        </div>
                        <span className="text-[10px] bg-[#FABF2E]/20 text-[#FABF2E] px-2 py-0.5 rounded-full border border-[#FABF2E]/40 font-semibold">
                          Nhận tại quầy
                        </span>
                      </div>
                    ) : lookupResult.foods && lookupResult.foods.length > 0 ? (
                      <div className="mt-2.5 pt-2.5 border-t border-[#303645] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4 text-[#FABF2E] shrink-0" />
                          <span className="text-[#FABF2E] font-bold">Bắp Nước & Combo:</span>
                          <span className="text-white font-medium">
                            {lookupResult.foods.map((f: any) => `${f.quantity}x ${f.name}`).join(', ')}
                          </span>
                        </div>
                        <span className="text-[10px] bg-[#FABF2E]/20 text-[#FABF2E] px-2 py-0.5 rounded-full border border-[#FABF2E]/40 font-semibold">
                          Nhận tại quầy
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-[#303645]/60 flex items-center gap-2 text-[#9EA6B8] text-[11px]">
                        <Coffee className="w-3.5 h-3.5 text-[#9EA6B8]/60" />
                        <span>Bắp nước: Không có bắp nước đi kèm đơn vé này</span>
                      </div>
                    )}
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
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
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
                src={TicketScannerService.generateTicketQrUrl(selectedQrTicket.bookingCode, 240)}
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
                {selectedQrTicket.cinemaName} • Ghế {Array.isArray(selectedQrTicket.seats) ? selectedQrTicket.seats.join(', ') : selectedQrTicket.seats}
              </div>
              {selectedQrTicket.foodsStr ? (
                <div className="p-2.5 rounded-xl bg-[#0F1217] border border-[#FABF2E]/30 text-xs text-left space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#FABF2E] font-bold uppercase flex items-center gap-1">
                      <Coffee className="w-3 h-3" /> Combo Bắp Nước:
                    </span>
                    <span className="text-[9px] bg-[#FABF2E]/20 text-[#FABF2E] px-1.5 py-0.5 rounded border border-[#FABF2E]/40 font-semibold">
                      Nhận tại quầy
                    </span>
                  </div>
                  <div className="text-white font-bold">{selectedQrTicket.foodsStr}</div>
                </div>
              ) : selectedQrTicket.foods && selectedQrTicket.foods.length > 0 ? (
                <div className="p-2.5 rounded-xl bg-[#0F1217] border border-[#FABF2E]/30 text-xs text-left space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#FABF2E] font-bold uppercase flex items-center gap-1">
                      <Coffee className="w-3 h-3" /> Combo Bắp Nước:
                    </span>
                    <span className="text-[9px] bg-[#FABF2E]/20 text-[#FABF2E] px-1.5 py-0.5 rounded border border-[#FABF2E]/40 font-semibold">
                      Nhận tại quầy
                    </span>
                  </div>
                  <div className="text-white font-bold">
                    {selectedQrTicket.foods.map((f: any) => `${f.quantity}x ${f.name}`).join(', ')}
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-[#0F1217] border border-[#303645] text-[11px] text-[#9EA6B8] text-center">
                  🍿 Không có bắp nước đi kèm đơn vé này
                </div>
              )}
              <div className="text-[11px] text-[#9EA6B8]">
                Người đặt: <span className="text-white font-medium">{selectedQrTicket.customerName || 'Khách vãng lai'}</span>
              </div>
              <div className="text-[10px] text-gray-400 italic pt-0.5">
                Đưa mã này vào đầu đọc Kiosk để in vé giấy hoặc cửa soát vé
              </div>
            </div>

            <button
              onClick={() => setSelectedQrTicket(null)}
              className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
