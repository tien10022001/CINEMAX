'use client';

import React from 'react';

export interface ShowtimeSlot {
  id: string | number;
  time: string; // e.g. "15:30", "22:00"
  dateStr?: string; // e.g. "15/10"
  availableSeats: number;
  isLate?: boolean;
  format?: string;
}

interface ShowtimeCardProps {
  slot: ShowtimeSlot;
  onClick: (slot: ShowtimeSlot) => void;
  dayStr?: string;
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * Thẻ Suất Chiếu chuẩn form mẫu (đồng nhất giao diện toàn hệ thống)
 * - Light theme: Nền sáng (xám #E5E7EB / xanh #B9D5F5) dùng cho Modal popup
 * - Dark theme: Nền tối (#0F1217 / xanh đêm #132238) đồng nhất với giao diện website
 * - Chữ dưới: Số ghế trống thực tế
 */
export default function ShowtimeCard({
  slot,
  onClick,
  dayStr,
  theme = 'light',
  className = '',
}: ShowtimeCardProps) {
  const hour = parseInt(slot.time.split(':')[0], 10);
  const isLate = slot.isLate ?? hour >= 22;
  const isDark = theme === 'dark';

  return (
    <div
      onClick={() => onClick(slot)}
      className={`group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 select-none ${className}`}
    >
      {/* Ô trên: Giờ chiếu */}
      <div
        className={`w-full h-12 rounded-md flex flex-col items-center justify-center transition-all shadow-xs ${
          isDark
            ? isLate
              ? 'bg-[#132238] border border-[#2563EB]/70 group-hover:border-blue-400 text-blue-100 shadow-blue-900/20'
              : 'bg-[#0F1217] border border-[#303645] group-hover:border-[#E63845] text-white shadow-black/40'
            : isLate
              ? 'bg-[#B9D5F5] group-hover:bg-[#A3C7F0] text-gray-900'
              : 'bg-[#E5E7EB] group-hover:bg-[#D1D5DB] text-gray-900'
        }`}
      >
        <span
          className={`text-xs sm:text-sm font-bold tracking-tight transition-colors ${
            isDark
              ? isLate
                ? 'text-blue-200 group-hover:text-blue-100'
                : 'text-white group-hover:text-[#E63845]'
              : 'text-gray-900'
          }`}
        >
          {slot.time}
        </span>
        {isLate && (
          <span
            className={`text-[10px] font-medium -mt-0.5 ${
              isDark ? 'text-blue-300/80' : 'text-gray-700'
            }`}
          >
            {dayStr || slot.dateStr || '19/10'}
          </span>
        )}
      </div>

      {/* Chữ dưới: Số ghế trống */}
      <span
        className={`text-[10px] sm:text-[11px] font-medium text-center mt-1 transition-colors ${
          isDark ? 'text-[#FABF2E] group-hover:text-yellow-300' : 'text-gray-500'
        }`}
      >
        {slot.availableSeats} ghế trống
      </span>
    </div>
  );
}
