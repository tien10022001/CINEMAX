'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Movie, Cinema } from '@/lib/types';
import { MOCK_GENRES } from '@/lib/mock-data';

interface QuickBookingBarProps {
  movies: Movie[];
  cinemas: Cinema[];
}

export default function QuickBookingBar({ movies, cinemas }: QuickBookingBarProps) {
  const router = useRouter();
  const [selectedCinema, setSelectedCinema] = useState<string>('1');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedShowtime, setSelectedShowtime] = useState<string>('all');
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const val = `${yyyy}-${mm}-${dd}`;
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const label = i === 0 ? `Hôm nay (${dd}/${mm})` : `${dayNames[d.getDay()]} (${dd}/${mm})`;
    return { val, label };
  });

  const handleShowtimeChange = (value: string) => {
    setSelectedShowtime(value);
    if (value === 'all') return;

    const defaultMovieId = movies?.[0]?.id || 1;
    const dateParam = selectedDate === 'all' ? dateOptions[0]?.val : selectedDate;

    router.push(
      `/booking?movie=${defaultMovieId}&cinema=${selectedCinema}&date=${dateParam}&timeframe=${value}`
    );
  };

  return (
    <div id="quick-booking" className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 -mt-6 relative z-20">
      <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 shadow-2xl shadow-black/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* 1. Chọn Rạp */}
          <div>
            <select
              value={selectedCinema}
              onChange={(e) => setSelectedCinema(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              {cinemas && cinemas.length > 0 ? (
                cinemas.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value="1">CINEMAX Xuân Thủy</option>
              )}
            </select>
          </div>

          {/* 2. Thể Loại */}
          <div>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              <option value="all">Thể loại (Tất cả)</option>
              {MOCK_GENRES.map((g) => (
                <option key={g.id} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Chọn Ngày / Thứ (Có mục Tất cả các ngày) */}
          <div>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              <option value="all">Tất cả các ngày</option>
              {dateOptions.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Chọn Suất Chiếu (Chỉ để các khung giờ: Sáng - Trưa - Chiều - Tối, k để số ghế, có Tất cả) */}
          <div>
            <select
              value={selectedShowtime}
              onChange={(e) => handleShowtimeChange(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              <option value="all">Tất cả suất chiếu</option>
              <option value="morning">Sáng</option>
              <option value="noon">Trưa</option>
              <option value="afternoon">Chiều</option>
              <option value="evening">Tối</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
