'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Movie } from '@/lib/types';
import TrailerModal from '@/components/common/TrailerModal';
import ShowtimeModal from '@/components/common/ShowtimeModal';

interface HeroBannerProps {
  movies: Movie[];
}

export default function HeroBanner({ movies }: HeroBannerProps) {
  const [currentIndex] = useState(0);
  const featured = movies[currentIndex] || movies[0];
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [showtimeOpen, setShowtimeOpen] = useState(false);

  if (!featured) return null;

  return (
    <>
      <div className="relative w-full h-[460px] sm:h-[500px] overflow-hidden bg-[#0F1217]">
        {/* Background with Ambient Red Glow & Backdrop as in Figma Screen 1 */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 transition-all duration-700"
          style={{
            backgroundImage: `url(${featured.banner_url || featured.poster_url})`,
          }}
        />

        {/* Ambient Red Glow Gradient from left */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4A0E17] via-[#2A0B11]/90 to-[#0F1217]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1217] via-transparent to-transparent" />

        {/* Content Container (Figma Screen 1) */}
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 h-full flex flex-col justify-center">
          <div className="max-w-xl space-y-4">
            {/* ĐANG CHIẾU Badge */}
            <div>
              <span className="px-3 py-1 rounded-md text-[11px] font-black bg-[#E63845] text-white tracking-wider uppercase inline-block">
                ĐANG CHIẾU
              </span>
            </div>

            {/* Heading Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              {featured.title}
            </h1>

            {/* Subtitle meta */}
            <p className="text-xs sm:text-sm text-[#9EA6B8] font-medium">
              {featured.age_rating} • {featured.duration_min} phút • {featured.genres?.map((g) => g.name).join(', ') || 'Hành động, Phiêu lưu'} • Phụ đề Việt
            </p>

            {/* Synopsis (2 lines as in Figma) */}
            <p className="text-xs sm:text-sm text-[#9EA6B8] leading-relaxed line-clamp-2 max-w-lg">
              {featured.synopsis || 'Mô tả ngắn về nội dung phim, tối đa 2 dòng, hiển thị trên banner trang chủ.'}
            </p>

            {/* 2 Buttons: Đặt vé ngay & Xem trailer (Figma Screen 1) */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowtimeOpen(true)}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-7 py-3 rounded-lg font-bold text-xs sm:text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer"
              >
                Đặt vé ngay
              </button>

              <button
                type="button"
                onClick={() => setTrailerOpen(true)}
                className="border border-[#303645] bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Xem trailer</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Modal */}
      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videoUrl={featured.trailer_url}
        title={featured.title}
      />

      {/* Showtime Modal Form Mẫu */}
      <ShowtimeModal
        isOpen={showtimeOpen}
        onClose={() => setShowtimeOpen(false)}
        movie={featured}
      />
    </>
  );
}
