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
  className?: string;
}

/**
 * Thẻ Suất Chiếu chuẩn form mẫu (đồng nhất giao diện toàn hệ thống)
 * - Ô trên: Xám nhạt (suất thường) hoặc Xanh nhạt (suất muộn >= 22h)
 * - Chữ dưới: Số ghế trống
 */
export default function ShowtimeCard({
  slot,
  onClick,
  dayStr,
  className = '',
}: ShowtimeCardProps) {
  const hour = parseInt(slot.time.split(':')[0], 10);
  const isLate = slot.isLate ?? hour >= 22;

  return (
    <div
      onClick={() => onClick(slot)}
      className={`group flex flex-col items-center cursor-pointer transition-transform hover:scale-105 select-none ${className}`}
    >
      {/* Ô trên: Giờ chiếu */}
      <div
        className={`w-full h-12 rounded-md flex flex-col items-center justify-center transition-colors shadow-xs ${
          isLate
            ? 'bg-[#B9D5F5] group-hover:bg-[#A3C7F0] text-gray-900'
            : 'bg-[#E5E7EB] group-hover:bg-[#D1D5DB] text-gray-900'
        }`}
      >
        <span className="text-xs sm:text-sm font-bold tracking-tight">
          {slot.time}
        </span>
        {isLate && (
          <span className="text-[10px] text-gray-700 font-medium -mt-0.5">
            {dayStr || slot.dateStr || '19/10'}
          </span>
        )}
      </div>

      {/* Chữ dưới: Số ghế trống */}
      <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium text-center mt-1">
        {slot.availableSeats} ghế trống
      </span>
    </div>
  );
}
