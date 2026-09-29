'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroBanner from '@/components/home/HeroBanner';
import QuickBookingBar from '@/components/home/QuickBookingBar';
import MovieCard from '@/components/home/MovieCard';
import { useData } from '@/lib/data-context';
import Link from 'next/link';
import { MapPin, Sparkles, Newspaper, ArrowRight, Film, Flame } from 'lucide-react';

function HomeContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'home';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Sub-filter for movies tab: 'ALL' | 'NOW_SHOWING' | 'SPECIAL' | 'COMING_SOON'
  const [movieSubFilter, setMovieSubFilter] = useState<'ALL' | 'NOW_SHOWING' | 'SPECIAL' | 'COMING_SOON'>('ALL');

  // Dynamic state from DataContext (editable by Admin in real-time)
  const { movies, cinemas, promotions, news } = useData();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['home', 'movies', 'cinemas', 'promotions', 'news'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const nowShowingMovies = movies.filter((m) => m.status === 'NOW_SHOWING');
  const upcomingMovies = movies.filter((m) => m.status === 'COMING_SOON');
  // Suất chiếu đặc biệt (Sneak Show / Suất chiếu sớm)
  const specialMovies = movies.filter((m) => m.id === 1 || m.id === 4 || m.id === 2);

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 space-y-12 pb-16">
        {/* ======================================================== */}
        {/* TAB 1: TRANG CHỦ (Home) */}
        {/* ======================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-16">
            {/* 1. Hero Banner Phim Nổi Bật */}
            <HeroBanner movies={nowShowingMovies} />

            {/* 2. Thanh Mua Vé Nhanh */}
            <QuickBookingBar movies={movies} cinemas={cinemas} />

            {/* 3. Phim đang chiếu */}
            <section id="movies" className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 pt-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Phim đang chiếu
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('movies');
                    setMovieSubFilter('NOW_SHOWING');
                  }}
                  className="text-xs sm:text-sm font-semibold text-[#E63845] hover:text-[#CC2B37] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Tất cả &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                {nowShowingMovies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>
            </section>

            {/* 4. Phim sắp chiếu */}
            <section id="upcoming" className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Phim sắp chiếu
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('movies');
                    setMovieSubFilter('COMING_SOON');
                  }}
                  className="text-xs sm:text-sm font-semibold text-[#E63845] hover:text-[#CC2B37] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Tất cả &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                {upcomingMovies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} isUpcoming={true} />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PHIM (Movies) */}
        {/* Giữ nguyên 1 thanh ở trên cùng như ảnh (QuickBookingBar) */}
        {/* Chỉ hiện: Đang chiếu, Sắp chiếu, Suất chiếu đặc biệt */}
        {/* ======================================================== */}
        {activeTab === 'movies' && (
          <div className="space-y-10 pt-6">
            {/* 1 thanh Quick Booking Bar ở trên cùng giữ nguyên như ảnh */}
            <QuickBookingBar movies={movies} cinemas={cinemas} />

            {/* Filter pills: Tất cả, Đang chiếu, Suất chiếu đặc biệt, Sắp chiếu */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20">
              <div className="flex items-center justify-between border-b border-[#303645] pb-4 gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-[#E63845]" />
                  <h1 className="text-xl sm:text-2xl font-black text-white">Danh Mục Phim</h1>
                </div>

                <div className="flex bg-[#1A1C26] p-1.5 rounded-full border border-[#303645] gap-1.5 flex-wrap">
                  <button
                    onClick={() => setMovieSubFilter('ALL')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      movieSubFilter === 'ALL'
                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                        : 'text-[#9EA6B8] hover:text-white'
                    }`}
                  >
                    Tất cả phim ({movies.length})
                  </button>
                  <button
                    onClick={() => setMovieSubFilter('NOW_SHOWING')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      movieSubFilter === 'NOW_SHOWING'
                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                        : 'text-[#9EA6B8] hover:text-white'
                    }`}
                  >
                    Đang chiếu ({nowShowingMovies.length})
                  </button>
                  <button
                    onClick={() => setMovieSubFilter('SPECIAL')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      movieSubFilter === 'SPECIAL'
                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                        : 'text-[#9EA6B8] hover:text-white'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-[#FABF2E]" />
                    Suất chiếu đặc biệt ({specialMovies.length})
                  </button>
                  <button
                    onClick={() => setMovieSubFilter('COMING_SOON')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      movieSubFilter === 'COMING_SOON'
                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                        : 'text-[#9EA6B8] hover:text-white'
                    }`}
                  >
                    Sắp chiếu ({upcomingMovies.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Section 1: Suất chiếu đặc biệt (Khi chọn ALL hoặc SPECIAL) */}
            {(movieSubFilter === 'ALL' || movieSubFilter === 'SPECIAL') && (
              <section className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2.5 h-6 rounded-full bg-[#FABF2E]" />
                  <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                    Suất chiếu đặc biệt (Sneak Show)
                    <span className="text-xs font-bold text-[#FABF2E] bg-[#FABF2E]/10 border border-[#FABF2E]/30 px-2.5 py-0.5 rounded-full">
                      Hot
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {specialMovies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </section>
            )}

            {/* Section 2: Phim đang chiếu (Khi chọn ALL hoặc NOW_SHOWING) */}
            {(movieSubFilter === 'ALL' || movieSubFilter === 'NOW_SHOWING') && (
              <section className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2.5 h-6 rounded-full bg-[#E63845]" />
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Phim đang chiếu
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {nowShowingMovies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </section>
            )}

            {/* Section 3: Phim sắp chiếu (Khi chọn ALL hoặc COMING_SOON) */}
            {(movieSubFilter === 'ALL' || movieSubFilter === 'COMING_SOON') && (
              <section className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2.5 h-6 rounded-full bg-[#9EA6B8]" />
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Phim sắp chiếu
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {upcomingMovies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} isUpcoming={true} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: RẠP CHIẾU (Cinemas) */}
        {/* Chỉ hiện thông tin hệ thống rạp chiếu */}
        {/* ======================================================== */}
        {activeTab === 'cinemas' && (
          <section className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 pt-8 space-y-8">
            <div className="border-b border-[#303645] pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E63845]/10 border border-[#E63845]/30 flex items-center justify-center text-[#E63845]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Hệ Thống Rạp Chiếu CINEMAX
                  </h1>
                  <p className="text-xs sm:text-sm text-[#9EA6B8] mt-1">
                    Trải nghiệm điện ảnh đỉnh cao với phòng chiếu IMAX Laser, 3D Atmos và ghế VIP sang trọng
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cinemas.map((cinema) => (
                <div
                  key={cinema.id}
                  className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-7 space-y-5 hover:border-[#E63845]/60 transition-all shadow-xl group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-[#E63845]/10 border border-[#E63845]/30 flex items-center justify-center text-[#E63845] group-hover:scale-110 transition-transform">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0F1217] border border-[#303645] text-[#FABF2E]">
                        IMAX Laser
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-[#E63845] transition-colors">
                        {cinema.name}
                      </h3>
                      <p className="text-xs text-[#9EA6B8] mt-2 leading-relaxed">
                        {cinema.address}
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#9EA6B8] pt-2 border-t border-[#303645]/60">
                      <div>
                        <span>Hotline: </span>
                        <span className="text-white font-semibold">1900 6868 (08:00 - 24:00)</span>
                      </div>
                      <div>
                        <span>Công nghệ: </span>
                        <span className="text-[#FABF2E] font-semibold">IMAX Laser, 2D Dolby Atmos</span>
                      </div>
                      <div>
                        <span>Khu vực: </span>
                        <span className="text-white font-semibold">{cinema.city}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#303645]/60">
                    <Link
                      href={`/booking?movie=1&cinema=${cinema.id}`}
                      className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-3 rounded-full font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#E63845]/25 transition-all cursor-pointer"
                    >
                      Đặt vé tại rạp này <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 4: KHUYẾN MÃI (Promotions) */}
        {/* Chỉ hiện các mã khuyến mãi & ưu đãi */}
        {/* ======================================================== */}
        {activeTab === 'promotions' && (
          <section className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 pt-8 space-y-8">
            <div className="border-b border-[#303645] pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FABF2E]/10 border border-[#FABF2E]/30 flex items-center justify-center text-[#FABF2E]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Ưu Đãi & Khuyến Mãi
                  </h1>
                  <p className="text-xs sm:text-sm text-[#9EA6B8] mt-1">
                    Áp dụng mã giảm giá trực tiếp khi thanh toán để nhận ngay quà tặng và vé xem phim ưu đãi
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 flex flex-col justify-between space-y-5 hover:border-[#FABF2E]/60 transition-all shadow-xl group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-lg text-xs font-mono font-black bg-[#E63845]/20 text-[#E63845] border border-[#E63845]/40 tracking-wider">
                        {promo.code}
                      </span>
                      <span className="text-xs text-[#33C773] font-bold">
                        {promo.discount_type === 'PERCENT' ? `Giảm ${promo.discount_value}%` : `Giảm ${(promo.discount_value / 1000)}k`}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base group-hover:text-[#FABF2E] transition-colors">
                      Mã {promo.code}
                    </h3>

                    <p className="text-xs text-[#9EA6B8] leading-relaxed">
                      {promo.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#303645]/60 space-y-3 text-xs">
                    <div className="flex justify-between text-[#9EA6B8]">
                      <span>Đơn tối thiểu:</span>
                      <span className="font-bold text-white">{promo.min_order.toLocaleString('vi-VN')} đ</span>
                    </div>

                    <Link
                      href={`/booking?promo=${promo.code}`}
                      className="w-full bg-[#FABF2E] hover:bg-[#E5AC25] text-black py-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      Dùng mã ngay <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 5: TIN TỨC (News) */}
        {/* Chỉ hiện các bài viết tin tức điện ảnh */}
        {/* ======================================================== */}
        {activeTab === 'news' && (
          <section className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 pt-8 space-y-8">
            <div className="border-b border-[#303645] pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E63845]/10 border border-[#E63845]/30 flex items-center justify-center text-[#E63845]">
                  <Newspaper className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Tin Tức Điện Ảnh
                  </h1>
                  <p className="text-xs sm:text-sm text-[#9EA6B8] mt-1">
                    Cập nhật tin tức phòng vé, hậu trường bom tấn và công nghệ chiếu phim độc quyền
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {news.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden hover:border-[#E63845]/50 transition-all shadow-xl group flex flex-col justify-between"
                >
                  <div className="aspect-video w-full overflow-hidden bg-black">
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[#FABF2E] font-medium">{item.date}</span>
                        {item.category && (
                          <span className="text-[#9EA6B8] bg-[#0F1217] px-2 py-0.5 rounded border border-[#303645]">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-base group-hover:text-[#E63845] transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#9EA6B8] mt-2 leading-relaxed line-clamp-3">
                        {item.summary}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-[#303645]/60 flex items-center justify-between">
                      <span className="text-[11px] text-[#9EA6B8]">{item.author || 'Cinemax'}</span>
                      <span className="text-xs font-semibold text-[#E63845] group-hover:underline flex items-center gap-1 cursor-pointer">
                        Đọc tiếp <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F1217] flex items-center justify-center text-white">
          Đang tải trang...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
