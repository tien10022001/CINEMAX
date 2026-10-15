'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Movie, Cinema } from '@/lib/types';
import { X, MapPin } from 'lucide-react';
import { MOCK_CINEMAS } from '@/lib/mock-data';

interface ShowtimeSlot {
  id: string | number;
  time: string; // "15:30", "22:00"
  availableSeats: number;
  isLate?: boolean; // Suất chiếu muộn từ 22h00
  format?: string; // "2D PHỤ ĐỀ", "IMAX"
}

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

  const activeCinema = cinemas.find((c) => c.id === selectedCinemaId) || cinemas[0];
  const activeDateObj = dates.find((d) => d.date === selectedDate) || dates[0];

  // Danh sách suất chiếu theo đúng mẫu trong ảnh người dùng cung cấp
  const showtimes: ShowtimeSlot[] = [
    { id: 'st-1530', time: '15:30', availableSeats: 89, isLate: false },
    { id: 'st-1600', time: '16:00', availableSeats: 170, isLate: false },
    { id: 'st-1630', time: '16:30', availableSeats: 128, isLate: false },
    { id: 'st-1700', time: '17:00', availableSeats: 123, isLate: false },
    { id: 'st-1730', time: '17:30', availableSeats: 61, isLate: false },
    { id: 'st-1830', time: '18:30', availableSeats: 169, isLate: false },
    { id: 'st-1930', time: '19:30', availableSeats: 97, isLate: false },
    { id: 'st-2000', time: '20:00', availableSeats: 101, isLate: false },
    { id: 'st-2015', time: '20:15', availableSeats: 72, isLate: false },
    { id: 'st-2100', time: '21:00', availableSeats: 146, isLate: false },
    // Suất chiếu muộn từ 22h00 (nền xanh nhạt)
    { id: 'st-2200', time: '22:00', availableSeats: 107, isLate: true },
    { id: 'st-2245', time: '22:45', availableSeats: 89, isLate: true },
    { id: 'st-2330', time: '23:30', availableSeats: 173, isLate: true },
  ];

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
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {activeCinema?.name || 'Rạp CINEMAX'}
            </h3>
          </div>
          {cinemas.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="text-xs text-gray-500">Đổi rạp:</span>
              <select
                value={selectedCinemaId}
                onChange={(e) => setSelectedCinemaId(e.target.value)}
                className="text-xs font-semibold text-blue-600 bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:outline-none"
              >
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>
            </div>
          )}
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
                    : 'text-gray-800 hover:text-gray-900 font-bold opacity-80'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-black">{day}</span>
                <span className="text-xs font-bold text-gray-600">/{month} - {weekday}</span>

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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
            {showtimes.map((slot) => {
              return (
                <div
                  key={slot.id}
                  onClick={() => handleSelectShowtime(slot)}
                  className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 select-none"
                >
                  {/* Ô trên: Giờ chiếu */}
                  <div
                    className={`w-full h-12 rounded-sm flex flex-col items-center justify-center transition-colors shadow-xs ${
                      slot.isLate
                        ? 'bg-[#B9D5F5] group-hover:bg-[#A3C7F0] text-gray-900'
                        : 'bg-[#E5E7EB] group-hover:bg-[#D1D5DB] text-gray-900'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold tracking-tight">
                      {slot.time}
                    </span>
                    {slot.isLate && (
                      <span className="text-[10px] text-gray-700 font-medium -mt-0.5">
                        {activeDateObj.dayStr}
                      </span>
                    )}
                  </div>

                  {/* Chữ dưới: Số ghế trống */}
                  <span className="text-[10px] sm:text-[11px] text-gray-600 font-medium text-center mt-1">
                    {slot.availableSeats} ghế trống
                  </span>
                </div>
              );
            })}
          </div>

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
