'use client';

import React, { useState } from 'react';
import {
  ScanLine,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  ShieldCheck,
  Armchair,
  Film,
  Building2,
  Search
} from 'lucide-react';
import { Ticket } from '@/lib/types-redesign';

interface CheckinViewProps {
  tickets: Ticket[];
  operatorName: string;
  onCheckInTicket: (qrToken: string, checkedInBy: string, agePassed: boolean) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function CheckinView({
  tickets,
  operatorName,
  onCheckInTicket,
  showToast
}: CheckinViewProps) {
  const [scanCode, setScanCode] = useState('');
  const [activeTicket, setActiveTicket] = useState<{
    qr_token_hash: string;
    movie_title: string;
    age_rating: 'P' | 'K' | 'T13' | 'T16' | 'T18';
    auditorium_name: string;
    seat_label: string;
    starts_at_str: string;
    status: 'issued' | 'used' | 'cancelled';
    checked_in_at?: string;
    checked_in_by?: string;
  } | null>({
    qr_token_hash: 'CMX-QR-89102-DUNE2',
    movie_title: 'Dune: Hành Tinh Cát - Phần 2',
    age_rating: 'T16',
    auditorium_name: 'Phòng 2 (IMAX Laser)',
    seat_label: 'F12 (VIP)',
    starts_at_str: 'Hôm nay, 19:30',
    status: 'issued'
  });

  const [ageCheckConfirmed, setAgeCheckConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Recent checked-in log
  const [recentCheckedIn, setRecentCheckedIn] = useState<any[]>([
    {
      code: 'CMX-QR-7721',
      movie: 'Thám Tử Conan',
      seat: 'E08',
      time: '19:15',
      staff: operatorName
    },
    {
      code: 'CMX-QR-7720',
      movie: 'Dune 2',
      seat: 'D04',
      time: '19:10',
      staff: operatorName
    }
  ]);

  const handleSimulateScan = (codeToScan?: string) => {
    const targetCode = codeToScan || scanCode.trim();
    if (!targetCode) {
      showToast('Vui lòng nhập hoặc quét mã vé QR!');
      return;
    }

    // Check if code matches any known ticket
    if (targetCode.includes('USED') || targetCode.includes('7721')) {
      setActiveTicket({
        qr_token_hash: targetCode,
        movie_title: 'Thám Tử Lừng Danh Conan',
        age_rating: 'T13',
        auditorium_name: 'Phòng 1 (2D Tiêu Chuẩn)',
        seat_label: 'E08 (VIP)',
        starts_at_str: 'Hôm nay, 19:00',
        status: 'used',
        checked_in_at: '19:15',
        checked_in_by: operatorName
      });
      setAgeCheckConfirmed(false);
      return;
    }

    // Default valid scan
    setActiveTicket({
      qr_token_hash: targetCode,
      movie_title: 'Dune: Hành Tinh Cát - Phần 2',
      age_rating: 'T16',
      auditorium_name: 'Phòng 2 (IMAX Laser)',
      seat_label: 'F12 (VIP)',
      starts_at_str: 'Hôm nay, 19:30',
      status: 'issued'
    });
    setAgeCheckConfirmed(false);
  };

  const handleConfirmAdmission = async () => {
    if (!activeTicket) return;

    if (activeTicket.status === 'used') {
      showToast('VÉ ĐÃ SỬ DỤNG TRƯỚC ĐÓ! TỪ CHỐI CHO VÀO RẠP!');
      return;
    }

    if ((activeTicket.age_rating === 'T16' || activeTicket.age_rating === 'T18') && !ageCheckConfirmed) {
      showToast('BẮT BUỘC TICK XÁC NHẬN ĐÃ KIỂM TRA ĐỘ TUỔI / CCCD CỦA KHÁCH!');
      return;
    }

    try {
      setIsProcessing(true);
      await onCheckInTicket(activeTicket.qr_token_hash, operatorName, ageCheckConfirmed);

      setActiveTicket((prev) => (prev ? { ...prev, status: 'used', checked_in_at: 'Vừa xong' } : null));
      setRecentCheckedIn((prev) => [
        {
          code: activeTicket.qr_token_hash,
          movie: activeTicket.movie_title,
          seat: activeTicket.seat_label,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          staff: operatorName
        },
        ...prev
      ]);

      showToast(`HỢP LỆ! Khách hàng đã được chấp thuận vào xem ${activeTicket.movie_title}!`);
    } catch (err: any) {
      showToast('Lỗi soát vé: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Compact Top Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-[#222B3D] pb-2 text-xs">
        <div className="flex items-center gap-2 text-[#8E9AAF]">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="font-bold text-white">Trạm Quét QR Soát Vé</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8E9AAF]">Nhân viên:</span>
          <span className="font-bold text-white bg-[#141924] border border-[#222B3D] px-2.5 py-1 rounded-xl flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{operatorName}</span>
          </span>
        </div>
      </div>

      {/* Scanner & Ticket Card Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (1/3): Barcode Input & Scanner Simulator */}
        <div className="space-y-3">
          <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#FABF2E]" />
              <span>Đầu Đọc Mã Vạch / QR</span>
            </h2>

            <div className="space-y-2">
              <label className="text-[11px] text-[#8E9AAF]">Nhập hoặc quét mã QR vé:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="CMX-QR-89102-DUNE2..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSimulateScan()}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#FABF2E]"
                />
                <button
                  onClick={() => handleSimulateScan()}
                  className="px-4 py-2.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black text-xs cursor-pointer shrink-0"
                >
                  Quét
                </button>
              </div>
            </div>

            {/* Quick Presets for Demo */}
            <div className="pt-2 border-t border-[#1F2739] space-y-2">
              <span className="text-[10px] text-[#5C677D] uppercase font-bold block">
                Mã Thử Nghiệm Nhanh:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSimulateScan('CMX-QR-89102-DUNE2')}
                  className="px-2.5 py-1 rounded-lg bg-[#1F2739] hover:bg-[#28324A] text-[10px] text-white font-mono cursor-pointer"
                >
                  Vé Dune 2 (T16 - Hợp lệ)
                </button>
                <button
                  onClick={() => handleSimulateScan('CMX-QR-7721-USED')}
                  className="px-2.5 py-1 rounded-lg bg-[#3B191C] hover:bg-[#4E1E22] text-[10px] text-[#EF4444] font-mono cursor-pointer"
                >
                  Vé Đã Dùng (Cảnh báo gian lận)
                </button>
              </div>
            </div>
          </div>

          {/* Recent Checked-in Log */}
          <div className="bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Vừa Vào Cửa Rạp</span>
            </h3>

            <div className="space-y-2 text-xs">
              {recentCheckedIn.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#171D2B] border border-[#222B3D] flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white">{item.movie}</div>
                    <div className="text-[10px] text-[#8E9AAF]">
                      Ghế <strong className="text-white">{item.seat}</strong> • {item.code}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-[#22C55E] font-bold">
                    {item.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (2/3): Admission Verification Screen */}
        <div className="lg:col-span-2">
          {activeTicket ? (
            <div
              className={`rounded-3xl p-7 border space-y-6 shadow-2xl transition-all ${
                activeTicket.status === 'used'
                  ? 'bg-[#211417] border-[#EF4444]'
                  : 'bg-[#121622] border-[#253247]'
              }`}
            >
              {/* Ticket Result Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-[#222B3D]">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${
                      activeTicket.status === 'used'
                        ? 'bg-[#EF4444] text-white shadow-[#EF4444]/30'
                        : 'bg-[#22C55E] text-black shadow-[#22C55E]/30'
                    }`}
                  >
                    {activeTicket.status === 'used' ? '✕' : '✓'}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">
                      {activeTicket.status === 'used' ? 'VÉ NÀY ĐÃ ĐƯỢC SỬ DỤNG' : 'VÉ HỢP LỆ — CHỜ KIỂM DUYỆT'}
                    </h2>
                    <p className="text-xs font-mono text-[#8E9AAF]">{activeTicket.qr_token_hash}</p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                    activeTicket.status === 'used'
                      ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                      : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                  }`}
                >
                  {activeTicket.status === 'used' ? 'ĐÃ DÙNG (USED)' : 'CHƯA DÙNG (ISSUED)'}
                </span>
              </div>

              {/* Movie & Showtime Detail Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#171D2B] border border-[#222B3D] space-y-1">
                  <span className="text-[#5C677D] text-[10px] font-bold uppercase block">Phim chiếu</span>
                  <div className="text-base font-black text-white">{activeTicket.movie_title}</div>
                  <div className="text-[11px] text-[#FABF2E] font-semibold">{activeTicket.starts_at_str}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#171D2B] border border-[#222B3D] space-y-1">
                  <span className="text-[#5C677D] text-[10px] font-bold uppercase block">Vị trí ghế ngồi</span>
                  <div className="text-base font-black text-[#06B6D4] font-mono">{activeTicket.seat_label}</div>
                  <div className="text-[11px] text-[#8E9AAF]">{activeTicket.auditorium_name}</div>
                </div>
              </div>

              {/* CRITICAL AGE RATING ALERT BOX */}
              {(activeTicket.age_rating === 'T16' || activeTicket.age_rating === 'T18') && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-[#3B191C] to-[#2B1518] border-2 border-[#EF4444] space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-[#EF4444] text-white font-black text-sm flex items-center justify-center shrink-0">
                      {activeTicket.age_rating}
                    </span>
                    <div>
                      <h4 className="font-black text-white text-sm uppercase tracking-wide text-[#EF4444]">
                        CẢNH BÁO BẮT BUỘC: PHIM DÁN NHÃN {activeTicket.age_rating}
                      </h4>
                      <p className="text-xs text-[#FCA5A5]">
                        Theo quy định Luật Điện ảnh: Phim cấm khán giả dưới{' '}
                        {activeTicket.age_rating === 'T18' ? '18' : '16'} tuổi. Nhân viên soát vé bắt buộc kiểm tra
                        CCCD/VNeID của khách hàng.
                      </p>
                    </div>
                  </div>

                  {activeTicket.status !== 'used' && (
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-[#1C1215] border border-[#EF4444]/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ageCheckConfirmed}
                        onChange={(e) => setAgeCheckConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded text-[#EF4444] focus:ring-[#EF4444] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">
                        Tôi xác nhận đã đối chiếu CCCD và khách hàng đủ điều kiện độ tuổi xem phim
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* FRAUD WARNING (If already used) */}
              {activeTicket.status === 'used' && (
                <div className="p-4 rounded-xl bg-[#3B191C] border border-[#EF4444] text-xs text-[#EF4444] font-bold space-y-1">
                  <div>CẢNH BÁO: Vé này đã được quét vào cửa lúc {activeTicket.checked_in_at || '19:15'}.</div>
                  <div className="text-[11px] text-white">
                    Tuyệt đối từ chối cho khách vào rạp để tránh trùng chỗ ngồi bên trong phòng chiếu!
                  </div>
                </div>
              )}

              {/* Admission Confirmation Button */}
              {activeTicket.status !== 'used' && (
                <div className="pt-2">
                  <button
                    onClick={handleConfirmAdmission}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black text-sm tracking-wide shadow-xl shadow-[#22C55E]/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? 'Đang Đóng Dấu...' : 'XÁC NHẬN CHO KHÁCH VÀO RẠP (CHECK-IN)'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-3xl bg-[#121622] border border-[#222B3D] flex flex-col items-center justify-center p-8 text-center space-y-3">
              <ScanLine className="w-12 h-12 text-[#5C677D]" />
              <div className="text-white font-bold text-sm">Chưa có vé nào được quét</div>
              <p className="text-xs text-[#8E9AAF] max-w-sm">
                Sử dụng máy quét mã vạch USB hoặc nhập mã QR vé vào ô bên trái để kiểm tra tính hợp lệ.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
