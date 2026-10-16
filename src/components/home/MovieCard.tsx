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
        />
      </Link>

      {/* Info: Title & Meta */}
      <div className="space-y-1">
        <Link href={`/movie/${movie.slug}`}>
          <h3 className="font-bold text-white text-sm sm:text-base line-clamp-1 group-hover:text-[#E63845] transition-colors">
            {movie.title}
          </h3>
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#9EA6B8]">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#E63845] text-white">
            {movie.age_rating}
          </span>
          <span>{movie.duration_min} phút</span>
        </div>
      </div>

      {/* Button: Đặt vé for Now Showing, Nhắc tôi for Upcoming (Figma Screen 1) */}
      <div className="pt-1">
        {isUpcoming ? (
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
