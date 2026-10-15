'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Movie, Cinema } from '@/lib/types';
import { X, MapPin } from 'lucide-react';
import { MOCK_CINEMAS } from '@/lib/mock-data';

import { MovieService } from '@/services/movie.service';
import ShowtimeCard, { ShowtimeSlot } from './ShowtimeCard';

interface ShowtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie | null;
  cinemas?: Cinema[];
  initialDate?: string;
  onSelectShowtime?: (slot: ShowtimeSlot, cinemaId: string | number, date: string) => void;
}

export default function ShowtimeModal({
  isOpen,
  onClose,
  movie,
  cinemas = MOCK_CINEMAS,
  initialDate,
  onSelectShowtime,
}: ShowtimeModalProps) {
  const router = useRouter();

  // Danh sách ngày chiếu mẫu chuẩn theo form
  const dates = [
    { label: '15/10 - T5', date: '2026-10-15', dayStr: '15/10' },
    { label: '16/10 - T6', date: '2026-10-16', dayStr: '16/10' },
    { label: '17/10 - T7', date: '2026-10-17', dayStr: '17/10' },
    { label: '18/10 - CN', date: '2026-10-18', dayStr: '18/10' },
    { label: '19/10 - T2', date: '2026-10-19', dayStr: '19/10' },
  ];

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || dates[0].date);
  const [selectedCinemaId, setSelectedCinemaId] = useState<string | number>(
    cinemas[0]?.id || 1
  );
  const [slots, setSlots] = useState<ShowtimeSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeCinema = cinemas.find((c) => c.id === selectedCinemaId) || cinemas[0];
  const activeDateObj = dates.find((d) => d.date === selectedDate) || dates[0];

  const loadSlots = () => {
    if (!isOpen || !movie?.id) return;
    const reqTimestamp = Date.now();
    setLoading(true);
    setError(null);

    MovieService.getShowtimeSlots(movie.id, selectedDate, selectedCinemaId)
      .then((data) => {
        setSlots(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load showtime slots:', err);
        setError('Không thể tải danh sách suất chiếu. Vui lòng thử lại.');
        setLoading(false);
      });
  };

  // Lấy dữ liệu suất chiếu từ Supabase Database
  useEffect(() => {
    loadSlots();
  }, [isOpen, movie?.id, selectedDate, selectedCinemaId]);

  if (!isOpen || !movie) return null;

  const handleSelectShowtime = (slot: ShowtimeSlot) => {
    onClose();
    if (onSelectShowtime) {
      // P0.2: Gọi callback chuyên biệt cho trang Booking để làm sạch ghế cũ và tính lại giá
      onSelectShowtime(slot, selectedCinemaId, selectedDate);
    } else {
      // Mặc định chuyển hướng sang màn hình chọn ghế
      router.push(
        `/booking?movie=${movie.id}&cinema=${selectedCinemaId}&date=${selectedDate}&showtime=${slot.id}&time=${slot.time}`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#1A1C26] border border-[#303645] text-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Top Header: Tiêu đề + Nút đóng */}
        <div className="flex items-center justify-between pb-3 border-b border-[#303645]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E63845] animate-pulse" />
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
              LỊCH CHIẾU - {movie.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#9EA6B8] hover:text-white transition-colors p-1.5 rounded-full hover:bg-[#303645]/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tên Rạp Chiếu ở chính giữa */}
        <div className="text-center space-y-2">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {activeCinema?.name || 'Cinemax Hà Nội Centre'}
          </h3>
          <div className="flex items-center justify-center gap-2 pt-0.5">
            <span className="text-xs text-[#9EA6B8] font-medium">Đổi rạp:</span>
            <div className="relative inline-block">
              <select
                value={selectedCinemaId}
                onChange={(e) => setSelectedCinemaId(e.target.value)}
                className="appearance-none text-xs font-bold text-[#E63845] bg-[#0F1217] border border-[#303645] hover:border-[#E63845] rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E63845] cursor-pointer shadow-inner transition-all"
              >
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1A1C26] text-white">
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#E63845]">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh chọn ngày (Date Selector Row) */}
        <div className="flex items-center justify-start sm:justify-center gap-6 sm:gap-10 border-b border-[#303645] pb-2 overflow-x-auto">
          {dates.map((d) => {
            const isSelected = selectedDate === d.date;
            const [dayNum, weekday] = d.label.split(' - ');
            const [day, month] = dayNum.split('/');

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`flex items-baseline gap-1 pb-2 cursor-pointer transition-all relative group ${
                  isSelected
                    ? 'text-[#E63845] font-extrabold'
                    : 'text-[#9EA6B8] hover:text-white font-bold opacity-85'
                }`}
              >
                <span
                  className={`text-2xl sm:text-3xl font-black transition-colors ${
                    isSelected ? 'text-[#E63845]' : 'text-[#9EA6B8] group-hover:text-white'
                  }`}
                >
                  {day}
                </span>
                <span
                  className={`text-xs font-bold transition-colors ${
                    isSelected ? 'text-[#E63845]' : 'text-[#9EA6B8] group-hover:text-white'
                  }`}
                >
                  /{month} - {weekday}
                </span>

                {/* Gạch chân màu đỏ thương hiệu khi active */}
                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E63845] rounded-full shadow-[0_0_8px_rgba(230,56,69,0.8)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Khối danh sách Suất chiếu */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#E63845] rounded-full inline-block" />
            <div className="text-xs sm:text-sm font-extrabold text-white tracking-wider uppercase">
              2D PHỤ ĐỀ
            </div>
          </div>

          {/* Lưới các thẻ suất chiếu (Showtime Cards Grid) theo đúng Form mẫu */}
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 py-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col items-center">
                  <div className="w-full h-12 bg-[#242836] border border-[#303645] rounded-md" />
                  <div className="w-14 h-3 bg-[#242836] rounded mt-1.5" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-[#E63845] font-medium">{error}</p>
              <button
                type="button"
                onClick={loadSlots}
                className="text-xs text-white hover:bg-[#CC2B37] font-bold px-4 py-2 bg-[#E63845] rounded-lg cursor-pointer transition-colors shadow-sm"
              >
                Tải lại suất chiếu
              </button>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-[#9EA6B8] text-sm font-medium">
                Không có suất chiếu nào cho ngày đã chọn tại cụm rạp này.
              </p>
              <p className="text-xs text-[#9EA6B8]/70">
                Vui lòng chọn ngày khác hoặc chuyển sang cụm rạp gần nhất.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
              {slots.map((slot) => (
                <ShowtimeCard
                  key={slot.id + '-' + slot.time}
                  slot={slot}
                  theme="dark"
                  onClick={handleSelectShowtime}
                  dayStr={activeDateObj.dayStr}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
