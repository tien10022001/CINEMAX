'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Play, ChevronLeft, ChevronRight, Film, Clock, Sparkles } from 'lucide-react';
import { Movie } from '@/lib/types';
import TrailerModal from '@/components/common/TrailerModal';
import ShowtimeModal from '@/components/common/ShowtimeModal';

interface HeroBannerProps {
  movies: Movie[];
}

const DEFAULT_MOVIE_BACKDROPS = [
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=85', // Dune / Sci-Fi
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=85', // Drama / Cinema
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1600&q=85', // Action / Adventure
  'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=1600&q=85', // Superhero
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=85', // Thriller
];

function getValidMovieImage(movie: Movie, index: number): string {
  if (movie.banner_url && movie.banner_url.trim().startsWith('http')) {
    return movie.banner_url.trim();
  }
  if (movie.poster_url && movie.poster_url.trim().startsWith('http')) {
    return movie.poster_url.trim();
  }
  return DEFAULT_MOVIE_BACKDROPS[index % DEFAULT_MOVIE_BACKDROPS.length];
}

export default function HeroBanner({ movies }: HeroBannerProps) {
  // Lấy tối đa 5 phim đang chiếu cho thẻ trượt tự động
  const sliderMovies = useMemo(() => {
    const active = movies.filter(
      (m) => m.status?.toUpperCase() === 'NOW_SHOWING' || m.status === 'now_showing'
    );
    const source = active.length >= 3 ? active : movies;
    return source.slice(0, 5);
  }, [movies]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [showtimeOpen, setShowtimeOpen] = useState(false);

  // Đảm bảo currentIndex không vượt quá độ dài mảng khi movies thay đổi
  useEffect(() => {
    if (currentIndex >= sliderMovies.length && sliderMovies.length > 0) {
      setCurrentIndex(0);
    }
  }, [sliderMovies.length, currentIndex]);

  // Tự động trượt sau mỗi 4.5 giây (Tạm dừng khi người dùng rê chuột vào banner)
  useEffect(() => {
    if (isPaused || sliderMovies.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliderMovies.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused, sliderMovies.length]);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + sliderMovies.length) % sliderMovies.length);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % sliderMovies.length);
  };

  if (!sliderMovies || sliderMovies.length === 0) return null;

  const featured = sliderMovies[currentIndex] || sliderMovies[0];

  return (
    <>
      <div
        className="relative w-full h-[500px] sm:h-[560px] overflow-hidden bg-[#0B0D13] select-none group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Layer 1: Các ảnh nền phim chuyển đổi chéo sắc nét, rõ ràng (Crossfade Backdrop) */}
        {sliderMovies.map((movie, idx) => {
          const isActive = idx === currentIndex;
          const imgUrl = getValidMovieImage(movie, idx);
          return (
            <div
              key={`bg-${movie.id || idx}`}
              className={`absolute inset-0 transition-opacity duration-1000 ease-out transform ${
                isActive ? 'opacity-85 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}
            >
              <img
                src={imgUrl}
                alt={movie.title}
                className="w-full h-full object-cover object-center md:object-right"
                onError={(e) => {
                  (e.target as any).src = DEFAULT_MOVIE_BACKDROPS[idx % DEFAULT_MOVIE_BACKDROPS.length];
                }}
              />
            </div>
          );
        })}

        {/* Layer 2: Gradient điện ảnh - Tối mờ bên trái để đọc chữ, TRONG SUỐT bên phải để nhìn rõ ảnh phim */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D13] via-[#0B0D13]/85 via-40% to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1217] via-transparent to-black/25 pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-[#E63845]/15 to-transparent pointer-events-none" />

        {/* Content Container */}
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 h-full flex flex-col justify-center">
          {/* Thông tin chi tiết phim đang hiển thị */}
          <div className="max-w-xl sm:max-w-2xl space-y-4 py-8 z-10">
            {/* ĐANG CHIẾU Badge & Thứ tự slide */}
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-md text-[11px] font-black bg-[#E63845] text-white tracking-wider uppercase inline-flex items-center gap-1.5 shadow-md shadow-[#E63845]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                ĐANG CHIẾU
              </span>

              <span className="text-[11px] font-mono text-[#9EA6B8] bg-black/40 border border-[#303645] px-2.5 py-0.5 rounded-md">
                Phim {currentIndex + 1} / {sliderMovies.length}
              </span>
            </div>

            {/* Tên phim (Title) */}
            <h1
              key={`title-${featured.id || currentIndex}`}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2 animate-in fade-in slide-in-from-bottom-2 duration-300 drop-shadow-md"
            >
              {featured.title}
            </h1>

            {/* Phụ đề meta: Phân loại độ tuổi chuẩn Admin, định dạng, thời lượng, thể loại, ngôn ngữ */}
            <div
              key={`meta-${featured.id || currentIndex}`}
              className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-[#9EA6B8] font-medium animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {/* Phân loại độ tuổi chuẩn Admin */}
              <span
                className={`px-2.5 py-0.5 rounded-md font-black text-[11px] border tracking-wide uppercase ${
                  featured.age_rating === 'P'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : featured.age_rating === 'K'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                    : featured.age_rating === 'T16'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                    : featured.age_rating === 'T18'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {featured.age_rating
                  ? `${featured.age_rating} • ${
                      featured.age_rating === 'P'
                        ? 'Mọi lứa tuổi'
                        : featured.age_rating === 'K'
                        ? 'Dưới 13 tuổi (giám hộ)'
                        : featured.age_rating === 'T13'
                        ? 'Khán giả từ 13 tuổi'
                        : featured.age_rating === 'T16'
                        ? 'Khán giả từ 16 tuổi'
                        : featured.age_rating === 'T18'
                        ? 'Khán giả từ 18 tuổi'
                        : featured.age_rating
                    }`
                  : 'T13 • Khán giả từ 13 tuổi'}
              </span>

              {/* Định dạng chiếu từ Admin (IMAX, 3D, 2D) */}
              {featured.formats && featured.formats.length > 0 && (
                <div className="flex items-center gap-1">
                  {featured.formats.map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white font-black text-[10px] tracking-wider uppercase"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              )}

              <span>•</span>

              {/* Thời lượng */}
              <span className="flex items-center gap-1 text-white font-semibold">
                <Clock className="w-3.5 h-3.5 text-[#FABF2E]" />
                {featured.duration_min || (featured as any).duration_minutes || 120} phút
              </span>

              <span>•</span>

              {/* Thể loại phân loại từ Admin */}
              <span className="text-gray-200 font-medium">
                {Array.isArray(featured.genres) && featured.genres.length > 0
                  ? featured.genres
                      .map((g: any) => (typeof g === 'string' ? g : g?.name || g?.slug))
                      .filter(Boolean)
                      .join(', ')
                  : 'Hành Động, Phiêu Lưu'}
              </span>

              <span>•</span>

              {/* Ngôn ngữ & phụ đề từ Admin */}
              <span className="text-[#9EA6B8]">{featured.language || 'Tiếng Anh - Phụ đề Tiếng Việt'}</span>
            </div>

            {/* Tóm tắt nội dung (Tối đa 2 dòng như trong thiết kế) */}
            <p
              key={`synopsis-${featured.id || currentIndex}`}
              className="text-xs sm:text-sm text-[#C4CBD8] leading-relaxed line-clamp-2 max-w-xl animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {featured.synopsis ||
                'Mô tả ngắn về nội dung phim, tối đa 2 dòng, hiển thị trên banner trang chủ.'}
            </p>

            {/* 2 Nút hành động: Đặt vé ngay & Xem trailer */}
            <div className="pt-3 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => setShowtimeOpen(true)}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-7 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xl shadow-[#E63845]/30 hover:shadow-[#E63845]/50 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                Đặt vé ngay
              </button>

              <button
                type="button"
                onClick={() => setTrailerOpen(true)}
                className="border border-[#303645] bg-[#14161F]/80 hover:bg-[#1E2230] text-white px-6 py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:border-[#FABF2E]/60 transform hover:-translate-y-0.5"
              >
                <div className="w-5 h-5 rounded-full bg-[#E63845] flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-white text-white ml-0.5" />
                </div>
                <span>Xem trailer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nút điều hướng Trái & Phải (Previous / Next Arrows) */}
        {sliderMovies.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-[#E63845] border border-[#303645] hover:border-transparent text-white flex items-center justify-center transition-all cursor-pointer opacity-70 group-hover:opacity-100 z-20"
              title="Phim trước"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-[#E63845] border border-[#303645] hover:border-transparent text-white flex items-center justify-center transition-all cursor-pointer opacity-70 group-hover:opacity-100 z-20"
              title="Phim tiếp theo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Thanh chỉ báo tiến trình / Pagination Dots (5 Thẻ) */}
        {sliderMovies.length > 1 && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-black/40 border border-[#303645]/60 px-3.5 py-1.5 rounded-full backdrop-blur-md">
            {sliderMovies.map((_, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={`dot-${idx}`}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive ? 'w-8 bg-[#E63845] shadow-md shadow-[#E63845]/50' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                  title={`Xem phim ${idx + 1}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Trailer Modal (Phát video YouTube chuẩn của đúng phim đang chọn) */}
      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videoUrl={featured.trailer_url}
        title={featured.title}
      />

      {/* Showtime Modal Đặt vé nhanh */}
      <ShowtimeModal
        isOpen={showtimeOpen}
        onClose={() => setShowtimeOpen(false)}
        movie={featured}
      />
    </>
  );
}
