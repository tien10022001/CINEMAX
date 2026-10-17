'use client';

import React from 'react';
import {
  X,
  Ticket,
  QrCode,
  Printer,
  Calendar,
  MapPin,
  Coffee,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Share2
} from 'lucide-react';
import { TicketScannerService } from '@/services/ticket-scanner.service';

export interface UnifiedTicketData {
  id?: string | number;
  bookingCode: string;
  movieTitle: string;
  posterUrl?: string;
  moviePoster?: string;
  ageRating?: 'P' | 'K' | 'T13' | 'T16' | 'T18' | string;
  format?: string;
  cinemaName: string;
  roomName: string;
  auditoriumName?: string;
  showtime: string;
  showtimeDate?: string;
  showtimeTime?: string;
  seats: string | string[];
  seatsStr?: string;
  totalAmount?: number;
  status?: string;
  foodsStr?: string;
  foods?: any[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt?: string;
  isCheckedIn?: boolean;
  checkedInAt?: string;
}

interface UnifiedTicketModalProps {
  ticket: UnifiedTicketData | null;
  onClose: () => void;
  // Optional flag if invoked from staff or guest
  isStaffMode?: boolean;
}

export default function UnifiedTicketModal({
  ticket,
  onClose,
  isStaffMode = false
}: UnifiedTicketModalProps) {
  if (!ticket) return null;

  // Normalize age rating
  const rawRating = (ticket.ageRating || 'P').toUpperCase();
  const validRatings = ['P', 'K', 'T13', 'T16', 'T18'];
  const ageRating = validRatings.includes(rawRating) ? rawRating : 'P';

  const getAgeRatingBadge = (rating: string) => {
    switch (rating) {
      case 'T18':
        return { label: 'T18 - CẤM DƯỚI 18 TUỔI', bg: 'bg-[#EF4444]', text: 'text-white', border: 'border-[#EF4444]' };
      case 'T16':
        return { label: 'T16 - CẤM DƯỚI 16 TUỔI', bg: 'bg-[#F97316]', text: 'text-white', border: 'border-[#F97316]' };
      case 'T13':
        return { label: 'T13 - CẤM DƯỚI 13 TUỔI', bg: 'bg-[#FABF2E]', text: 'text-black', border: 'border-[#FABF2E]' };
      case 'K':
        return { label: 'K - DƯỚI 13 TUỔI CẦN NGƯỜI LỚN', bg: 'bg-[#3B82F6]', text: 'text-white', border: 'border-[#3B82F6]' };
      case 'P':
      default:
        return { label: 'P - PHỔ BIẾN MỌI ĐỘ TUỔI', bg: 'bg-[#22C55E]', text: 'text-black', border: 'border-[#22C55E]' };
    }
  };

  const badgeInfo = getAgeRatingBadge(ageRating);

  // Normalize seats
  const seatsDisplay = ticket.seatsStr
    ? ticket.seatsStr
    : Array.isArray(ticket.seats)
    ? ticket.seats.join(', ')
    : ticket.seats || 'Đang cập nhật';

  // Normalize foods
  let foodsDisplay = ticket.foodsStr;
  if (!foodsDisplay && ticket.foods && ticket.foods.length > 0) {
    foodsDisplay = ticket.foods.map((f: any) => `${f.quantity || f.qty}x ${f.name}`).join(', ');
  }

  // Normalize status
  const isUsed =
    ticket.isCheckedIn ||
    ticket.status === 'ĐÃ SOÁT VÉ' ||
    ticket.status === 'used' ||
    ticket.status === 'ĐÃ XEM';

  const roomDisplay = ticket.roomName || ticket.auditoriumName || 'Phòng chiếu số 1';
  const formatDisplay = ticket.format || (roomDisplay.includes('IMAX') ? 'IMAX Laser' : '2D Digital');
  const qrUrl = TicketScannerService.generateTicketQrUrl(ticket.bookingCode, 260);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#121622] border border-[#253247] rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222B3D] bg-[#161D2B]/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg ${
                isUsed
                  ? 'bg-[#EF4444] text-white shadow-[#EF4444]/20'
                  : 'bg-[#22C55E] text-black shadow-[#22C55E]/20'
              }`}
            >
              {isUsed ? '✕' : '✓'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-[#E63845] uppercase">
                  CINEMAX THEATER
                </span>
                <span className="text-[10px] text-[#5C677D]">•</span>
                <span className="text-[11px] font-mono text-[#8E9AAF]">{ticket.bookingCode}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isUsed ? 'VÉ ĐÃ QUA CỬA SOÁT VÉ' : 'VÉ HỢP LỆ — SẴN SÀNG VÀO RẠP'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                isUsed
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                  : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
              }`}
            >
              {isUsed ? 'ĐÃ DÙNG (USED)' : 'HỢP LỆ (ACTIVE)'}
            </span>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#1A2232] text-[#8E9AAF] hover:text-white hover:bg-[#253247] flex items-center justify-center transition-all cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ticket Body: Two-column layout matching Staff Check-in View */}
        <div className="p-5 sm:p-7 space-y-5">
          {/* Main Grid: Left Details + Right QR Scanner Target */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            {/* Left Column (3/5): Movie, Showtime, Seats & Foods formatted as Staff POS Receipt */}
            <div className="md:col-span-3 space-y-3 bg-[#161D2B]/40 p-4 rounded-2xl border border-[#222B3D]">
              <div className="flex items-center justify-between gap-2 border-b border-[#242E40] pb-2.5">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-black text-[#E63845] tracking-widest uppercase">
                    CINEMAX THEATER
                  </div>
                  <h3 className="text-sm font-black text-white">HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${badgeInfo.bg} ${badgeInfo.text}`}>
                    {ageRating}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] font-bold text-[10px]">
                    {formatDisplay}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#8E9AAF] block text-[11px]">Phim:</span>
                  <span className="text-base font-bold text-white block">{ticket.movieTitle}</span>
                </div>

                <div className="flex justify-between text-[#8E9AAF]">
                  <span>Rạp: <strong className="text-white">{ticket.cinemaName}</strong></span>
                  <span>Trạng thái: <strong className="text-[#22C55E] uppercase">{isUsed ? 'ĐÃ DÙNG' : 'HỢP LỆ'}</strong></span>
                </div>

                <div className="flex justify-between text-[#8E9AAF]">
                  <span>Phòng: <strong className="text-white">{roomDisplay}</strong></span>
                  <span>Định dạng: <strong className="text-[#06B6D4]">{formatDisplay}</strong></span>
                </div>

                <div className="flex justify-between text-[#8E9AAF]">
                  <span>Giờ chiếu:</span>
                  <span className="font-mono text-white font-bold">{ticket.showtime}</span>
                </div>

                {/* Seats breakdown box */}
                <div className="p-2.5 rounded-xl bg-[#171E2D] border border-[#253045] space-y-1">
                  <span className="text-[11px] font-bold text-[#FABF2E] block">Ghế ngồi:</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-mono font-bold text-sm text-[#06B6D4]">{seatsDisplay}</span>
                    <span className="text-[10px] text-[#8E9AAF] bg-[#141924] px-2 py-0.5 rounded border border-[#253045]">
                      Đã giữ chỗ
                    </span>
                  </div>
                </div>

                {/* Foods breakdown box */}
                {foodsDisplay && (
                  <div className="p-2.5 rounded-xl bg-[#171E2D] border border-[#253045] space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-[#FABF2E] block">Bắp nước:</span>
                      <span className="text-[9px] bg-[#FABF2E]/20 text-[#FABF2E] px-2 py-0.5 rounded-full border border-[#FABF2E]/40 font-semibold uppercase">
                        Nhận tại quầy
                      </span>
                    </div>
                    <div className="text-white font-semibold text-xs">{foodsDisplay}</div>
                  </div>
                )}

                {/* Financial breakdown */}
                <div className="pt-2 border-t border-[#242E40] space-y-1">
                  <div className="flex justify-between text-[#8E9AAF] text-xs">
                    <span>Người nhận vé:</span>
                    <span className="text-white font-semibold">
                      {ticket.customerName || 'Khách vãng lai'}{' '}
                      {ticket.customerPhone ? `(${ticket.customerPhone})` : ''}
                    </span>
                  </div>
                  {ticket.totalAmount !== undefined && (
                    <div className="flex justify-between font-bold text-sm text-white">
                      <span>Tổng tiền:</span>
                      <span className="font-mono text-[#22C55E] text-base">
                        {ticket.totalAmount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (2/5): Official QR Scanner & Admission Code */}
            <div className="md:col-span-2 bg-[#171D2B] border border-[#222B3D] rounded-2xl p-5 flex flex-col items-center justify-between text-center space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-wider text-[#FABF2E] uppercase block">
                  MÃ QUÉT SOÁT VÉ / IN KIOSK
                </span>
                <p className="text-[10px] text-[#8E9AAF]">
                  Đưa mã vào mắt đọc Kiosk hoặc cổng soát vé
                </p>
              </div>

              {/* High Contrast QR Code */}
              <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-white inline-block">
                <img
                  src={qrUrl}
                  alt={`Mã QR vé ${ticket.bookingCode}`}
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain mx-auto"
                />
              </div>

              {/* Monospace Booking Code */}
              <div className="w-full space-y-1">
                <div className="font-mono text-xs sm:text-sm font-black text-white bg-[#0F1217] py-1.5 px-3 rounded-xl border border-[#2B3549] tracking-widest break-all">
                  {ticket.bookingCode}
                </div>
                {ticket.checkedInAt ? (
                  <div className="text-[10px] text-[#22C55E] font-semibold flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Qua cửa lúc: {ticket.checkedInAt}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-[#8E9AAF]">
                    Trạng thái: <span className="text-[#22C55E] font-bold">Chưa qua cửa</span>
                  </div>
                )}
              </div>

              {/* Anti-fraud Security Notice */}
              <div className="w-full text-[9px] text-[#F87171] bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-2 text-left space-y-0.5">
                <div className="flex items-center gap-1 font-bold uppercase text-[9px] text-[#EF4444]">
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span>Bảo mật vé:</span>
                </div>
                <p className="text-[#D1D5DB] leading-tight">
                  Mỗi mã QR chỉ được quét vào rạp 1 lần. Vui lòng không chia sẻ mã cho người khác.
                </p>
              </div>
            </div>
          </div>

          {/* CRITICAL AGE RATING ALERT BOX (Synchronized with Staff Gate Rules) */}
          {(ageRating === 'T16' || ageRating === 'T18' || ageRating === 'T13') && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2B1518] to-[#1C1215] border border-[#EF4444]/50 flex items-start gap-3">
              <span
                className={`w-9 h-9 rounded-xl ${badgeInfo.bg} ${badgeInfo.text} font-black text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-md`}
              >
                {ageRating}
              </span>
              <div className="space-y-1 text-xs">
                <h4 className="font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="text-[#EF4444]">LƯU Ý QUY ĐỊNH ĐỘ TUỔI ({badgeInfo.label})</span>
                </h4>
                <p className="text-[#D1D5DB] leading-relaxed text-[11px]">
                  Theo quy định của Luật Điện ảnh Việt Nam, phim này không dành cho khán giả dưới{' '}
                  <strong className="text-white">
                    {ageRating === 'T18' ? '18' : ageRating === 'T16' ? '16' : '13'} tuổi
                  </strong>
                  . Nhân viên soát vé tại rạp sẽ đối chiếu{' '}
                  <strong className="text-[#FABF2E]">CCCD hoặc VNeID</strong> trước khi cho vào phòng chiếu.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons: Print, Download & Close */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#222B3D]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#1F2739] hover:bg-[#2A344A] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Vé / Hóa Đơn</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#1F2739] hover:bg-[#2A344A] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Lưu PDF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-[#E63845]/20"
            >
              Đóng Vé
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
