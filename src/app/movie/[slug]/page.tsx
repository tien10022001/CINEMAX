'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TrailerModal from '@/components/common/TrailerModal';
import { MOCK_MOVIES, MOCK_CINEMAS, MOCK_SHOWTIMES } from '@/lib/mock-data';
import { Star, MapPin, Play, Ticket } from 'lucide-react';

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const movie = MOCK_MOVIES.find((m) => m.slug === slug) || MOCK_MOVIES[0];
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-29');
  const [isTrailerOpen, setIsTrailerOpen] = useState<boolean>(false);

  const dates = [
    { label: 'Hôm nay', date: '2026-09-29', day: '29/09' },
    { label: 'Thứ tư', date: '2026-09-30', day: '30/09' },
    { label: 'Thứ năm', date: '2026-10-01', day: '01/10' },
    { label: 'Thứ sáu', date: '2026-10-02', day: '02/10' },
    { label: 'Thứ bảy', date: '2026-10-03', day: '03/10' },
    { label: 'Chủ nhật', date: '2026-10-04', day: '04/10' },
  ];

  const scrollToSchedule = () => {
    const el = document.getElementById('schedule-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-8 lg:px-20 py-10 space-y-12">
        {/* Top: Movie Info & Poster (Figma Screen 2) */}
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
          {/* Poster Left */}
          <div className="w-full sm:w-64 md:w-80 flex-shrink-0">
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="w-full aspect-[2/3] object-cover rounded-2xl border border-[#303645] shadow-2xl shadow-black/80"
            />
          </div>

          {/* Details Right */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-black bg-[#E63845] text-white">
                {movie.age_rating}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#1A1C26] text-white border border-[#303645]">
                2D
              </span>
              {movie.id === 1 && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#1A1C26] text-[#FABF2E] border border-[#FABF2E]/40">
                  IMAX
                </span>
              )}
              {movie.imdb_score && (
                <div className="flex items-center gap-1 text-[#FABF2E] text-xs font-bold bg-[#1A1C26] px-2.5 py-1 rounded border border-[#303645]">
                  <Star className="w-3.5 h-3.5 fill-[#FABF2E]" />
                  <span>{movie.imdb_score} IMDb</span>
                </div>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white">{movie.title}</h1>
            <p className="text-xs sm:text-sm text-[#9EA6B8]">{movie.original_title}</p>

            <div className="space-y-2 text-xs sm:text-sm text-[#9EA6B8] pt-2">
              <div>
                <span className="font-semibold text-white">Đạo diễn: </span>
                <span>{movie.director || 'Đang cập nhật'}</span>
              </div>
              <div>
                <span className="font-semibold text-white">Diễn viên: </span>
                <span>{movie.cast_list || 'Đang cập nhật'}</span>
              </div>
              <div>
                <span className="font-semibold text-white">Thể loại: </span>
                <span>{movie.genres?.map((g) => g.name).join(', ')}</span>
              </div>
              <div>
                <span className="font-semibold text-white">Thời lượng: </span>
                <span>{movie.duration_min} phút</span>
              </div>
              <div>
                <span className="font-semibold text-white">Khởi chiếu: </span>
                <span>{movie.release_date}</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#9EA6B8] leading-relaxed pt-2 line-clamp-4">
              {movie.synopsis}
            </p>

            {/* Action Buttons: Mua vé (Red) & Xem trailer (Outline) */}
            <div className="pt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={scrollToSchedule}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Ticket className="w-4 h-4" />
                Mua vé
              </button>

              {movie.trailer_url && (
                <button
                  type="button"
                  onClick={() => setIsTrailerOpen(true)}
                  className="border border-[#303645] bg-[#1A1C26] hover:bg-[#242836] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Xem trailer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: LỊCH CHIẾU (Figma Screen 2) */}
        <section id="schedule-section" className="space-y-6 pt-6">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
            Lịch chiếu
          </h2>

          {/* Date Selector Pills */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {dates.map((d) => (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedDate === d.date
                    ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                    : 'bg-[#1A1C26] border border-[#303645] text-[#9EA6B8] hover:text-white'
                }`}
              >
                {d.label} {d.day}
              </button>
            ))}
          </div>

          {/* Cinema Blocks with Showtimes */}
          <div className="space-y-4 pt-2">
            {MOCK_CINEMAS.map((cinema) => {
              const cinemaShowtimes = MOCK_SHOWTIMES.filter((s) => s.room?.cinema_id === cinema.id);
              return (
                <div
                  key={cinema.id}
                  className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
                    <MapPin className="w-4 h-4 text-[#E63845]" />
                    <span>{cinema.name}</span>
                  </div>
                  <p className="text-xs text-[#9EA6B8]">{cinema.address}</p>

                  {/* Showtimes Row */}
                  <div className="pt-2 border-t border-[#303645]/60 space-y-3">
                    <div className="text-xs font-semibold text-white/80">2D Phụ đề</div>
                    <div className="flex flex-wrap gap-3">
                      {cinemaShowtimes.map((st) => (
                        <button
                          key={st.id}
                          onClick={() =>
                            router.push(
                              `/booking?movie=${movie.id}&cinema=${cinema.id}&date=${selectedDate}&showtime=${st.id}`
                            )
                          }
                          className="bg-[#0F1217] border border-[#303645] hover:border-[#E63845] rounded-xl px-4 py-2.5 text-center group transition-all transform hover:scale-105 cursor-pointer"
                        >
                          <div className="text-sm font-bold text-white group-hover:text-[#E63845] transition-colors">
                            {new Date(st.start_time).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-[11px] text-[#FABF2E] font-medium mt-0.5">
                            {st.available_seats} ghế trống
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />

      {/* Trailer Modal Player */}
      <TrailerModal
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
        videoUrl={movie.trailer_url || ''}
        title={movie.title}
      />
    </div>
  );
}
