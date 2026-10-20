'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Movie } from '@/lib/types';
import { Bell, Check } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  isUpcoming?: boolean;
}

export default function MovieCard({ movie, isUpcoming = false }: MovieCardProps) {
  const [reminded, setReminded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const normRelDate = movie.release_date?.includes('/')
    ? movie.release_date.split('/').reverse().join('-')
    : movie.release_date?.slice(0, 10);

  // Phim sắp chiếu nếu có cờ isUpcoming hoặc release_date > hôm nay hoặc status là coming_soon
  const isActualUpcoming = Boolean(
    isUpcoming ||
    (normRelDate && normRelDate > today) ||
    movie.status?.toLowerCase() === 'coming_soon'
  );

  const hasAdvanceTickets = Boolean(movie.has_advance_tickets);

  const handleRemindClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setReminded(!reminded);
  };

  return (
    <div className="group flex flex-col h-full space-y-3">
      {/* Poster Image Container (Figma Screen 1) */}
      <Link
        href={`/movie/${movie.slug}`}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#1A1C26] border border-[#303645] block group-hover:border-[#E63845]/50 transition-colors shadow-lg"
      >
        <img
          src={movie.poster_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80'}
          alt={movie.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          suppressHydrationWarning
        />

        {/* Badge Vé bán trước nếu là phim sắp chiếu có suất chiếu trước */}
        {isActualUpcoming && hasAdvanceTickets && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-gradient-to-r from-[#E63845] to-[#FABF2E] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg shadow-black/60 flex items-center gap-1 border border-white/20">
            <span>🎟 Bán vé trước</span>
          </div>
        )}

        {/* Overlay ngày khởi chiếu cho phim sắp chiếu */}
        {isActualUpcoming && movie.release_date && (
          <div className="absolute bottom-2 left-2 right-2 z-10 bg-black/85 backdrop-blur-md text-amber-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-amber-500/40 text-center shadow-lg">
            Khởi chiếu: {movie.release_date}
          </div>
        )}
      </Link>

      {/* Info: Title & Meta */}
      <div className="space-y-1">
        <Link href={`/movie/${movie.slug}`}>
          <h3 className="font-bold text-white text-sm sm:text-base line-clamp-1 group-hover:text-[#E63845] transition-colors">
            {movie.title}
          </h3>
        </Link>

        {/* Phân loại thể loại từ Admin */}
        {Array.isArray(movie.genres) && movie.genres.length > 0 && (
          <p className="text-[11px] text-[#9EA6B8] line-clamp-1">
            {movie.genres
              .map((g: any) => (typeof g === 'string' ? g : g?.name || g?.slug))
              .filter(Boolean)
              .slice(0, 2)
              .join(' • ')}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-[#9EA6B8]">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              movie.age_rating === 'P'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : movie.age_rating === 'K'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : movie.age_rating === 'T16'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : movie.age_rating === 'T18'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}
          >
            {movie.age_rating || 'T13'}
          </span>
          <span>{movie.duration_min || (movie as any).duration_minutes || 120} phút</span>

          {movie.formats && movie.formats.length > 0 && (
            <span className="text-[10px] font-bold text-white/70 px-1 py-0.2 rounded bg-white/5 border border-white/10">
              {movie.formats[0]}
            </span>
          )}
        </div>
      </div>

      {/* Button: Đặt vé cho Phim đang chiếu, Đặt vé sớm cho Phim có vé bán trước, Nhắc tôi cho Phim sắp chiếu chưa mở bán */}
      <div className="pt-1">
        {isActualUpcoming ? (
          hasAdvanceTickets ? (
            <Link
              href={`/movie/${movie.slug}#schedule-section`}
              className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-[#E63845]/25 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <span>Đặt vé sớm</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleRemindClick}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                reminded
                  ? 'bg-[#33C773]/20 border border-[#33C773] text-[#33C773]'
                  : 'bg-[#1A1C26] border border-[#303645] hover:border-white text-white'
              }`}
            >
              {reminded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#33C773]" />
                  <span>Đã đặt nhắc tôi</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-[#9EA6B8]" />
                  <span>Nhắc tôi</span>
                </>
              )}
            </button>
          )
        ) : (
          <Link
            href={`/movie/${movie.slug}#schedule-section`}
            className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center shadow-md shadow-[#E63845]/25 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            Đặt vé
          </Link>
        )}
      </div>
    </div>
  );
}
