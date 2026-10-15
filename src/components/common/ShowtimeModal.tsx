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
}

export default function ShowtimeModal({
  isOpen,
  onClose,
  movie,
  cinemas = MOCK_CINEMAS,
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

  const [selectedDate, setSelectedDate] = useState<string>(dates[0].date);
  const [selectedCinemaId, setSelectedCinemaId] = useState<string | number>(
    cinemas[0]?.id || 1
  );
  const [slots, setSlots] = useState<ShowtimeSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const activeCinema = cinemas.find((c) => c.id === selectedCinemaId) || cinemas[0];
  const activeDateObj = dates.find((d) => d.date === selectedDate) || dates[0];

  // Lấy dữ liệu suất chiếu từ Supabase Database
  useEffect(() => {
    if (!isOpen || !movie?.id) return;
    let isMounted = true;
    setLoading(true);

    MovieService.getShowtimeSlots(movie.id, selectedDate, selectedCinemaId)
      .then((data) => {
        if (isMounted) {
          setSlots(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load showtime slots:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, movie?.id, selectedDate, selectedCinemaId]);

  if (!isOpen || !movie) return null;

  const handleSelectShowtime = (slot: ShowtimeSlot) => {
    onClose();
    // Chuyển hướng sang màn hình chọn ghế
    router.push(
      `/booking?movie=${movie.id}&cinema=${selectedCinemaId}&date=${selectedDate}&showtime=${slot.id}&time=${slot.time}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white text-gray-900 rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Top Header: Tiêu đề + Nút đóng */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 uppercase tracking-tight">
            LỊCH CHIẾU - {movie.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tên Rạp Chiếu ở chính giữa */}
        <div className="text-center space-y-1.5">
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {activeCinema?.name || 'Cinemax Hà Nội Centre'}
          </h3>
          <div className="flex items-center justify-center gap-2 pt-0.5">
            <span className="text-xs text-gray-500 font-medium">Đổi rạp:</span>
            <div className="relative inline-block">
              <select
                value={selectedCinemaId}
                onChange={(e) => setSelectedCinemaId(e.target.value)}
                className="appearance-none text-xs font-semibold text-blue-600 bg-white border border-gray-300 hover:border-blue-500 rounded-md pl-3 pr-7 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs transition-all"
              >
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-blue-600">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh chọn ngày (Date Selector Row) */}
        <div className="flex items-center justify-start sm:justify-center gap-6 sm:gap-10 border-b border-gray-200 pb-2 overflow-x-auto">
          {dates.map((d) => {
            const isSelected = selectedDate === d.date;
            const [dayNum, weekday] = d.label.split(' - ');
            const [day, month] = dayNum.split('/');

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`flex items-baseline gap-1 pb-2 cursor-pointer transition-all relative ${
                  isSelected
                    ? 'text-blue-600 font-extrabold'
                    : 'text-gray-800 hover:text-gray-900 font-bold opacity-85'
                }`}
              >
                <span className={`text-2xl sm:text-3xl font-black ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                  {day}
                </span>
                <span className="text-xs font-bold text-gray-700">/{month} - {weekday}</span>

                {/* Gạch chân màu xanh khi active */}
                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Khối danh sách Suất chiếu */}
        <div className="space-y-4">
          <div className="text-xs sm:text-sm font-extrabold text-gray-800 tracking-wider uppercase">
            2D PHỤ ĐỀ
          </div>

          {/* Lưới các thẻ suất chiếu (Showtime Cards Grid) theo đúng Form mẫu */}
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 py-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col items-center">
                  <div className="w-full h-12 bg-gray-200 rounded-sm" />
                  <div className="w-12 h-3 bg-gray-200 rounded mt-1.5" />
                </div>
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              Không có suất chiếu nào cho ngày đã chọn.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
              {slots.map((slot) => (
                <ShowtimeCard
                  key={slot.id + '-' + slot.time}
                  slot={slot}
                  onClick={handleSelectShowtime}
                  dayStr={activeDateObj.dayStr}
                />
              ))}
            </div>
          )}

          {/* Chú thích Suất chiếu muộn */}
          <div className="pt-3 flex items-center gap-2 text-xs text-gray-600">
            <div className="w-5 h-3.5 bg-[#B9D5F5] rounded-xs shrink-0" />
            <span>Suất chiếu muộn từ 22h00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
