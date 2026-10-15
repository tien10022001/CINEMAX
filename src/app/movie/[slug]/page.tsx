'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TrailerModal from '@/components/common/TrailerModal';
import ShowtimeModal from '@/components/common/ShowtimeModal';
import ShowtimeCard, { ShowtimeSlot } from '@/components/common/ShowtimeCard';
import { MovieService } from '@/services/movie.service';
import { MOCK_MOVIES, MOCK_CINEMAS } from '@/lib/mock-data';
import { Star, MapPin, Play, Ticket } from 'lucide-react';

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const movie = MOCK_MOVIES.find((m) => m.slug === slug) || MOCK_MOVIES[0];
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-15');
  const [isTrailerOpen, setIsTrailerOpen] = useState<boolean>(false);
  const [isShowtimeModalOpen, setIsShowtimeModalOpen] = useState<boolean>(false);
  const [cinemaSlots, setCinemaSlots] = useState<Record<string | number, ShowtimeSlot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  const dates = [
    { label: 'Hôm nay', date: '2026-10-15', day: '15/10' },
    { label: 'Thứ sáu', date: '2026-10-16', day: '16/10' },
    { label: 'Thứ bảy', date: '2026-10-17', day: '17/10' },
    { label: 'Chủ nhật', date: '2026-10-18', day: '18/10' },
    { label: 'Thứ hai', date: '2026-10-19', day: '19/10' },
  ];

  const activeDateObj = dates.find((d) => d.date === selectedDate) || dates[0];

  useEffect(() => {
    if (!movie?.id) return;
    let isMounted = true;
    setLoadingSlots(true);

    const loadAllCinemas = async () => {
      try {
        const results: Record<string | number, ShowtimeSlot[]> = {};
        await Promise.all(
          MOCK_CINEMAS.map(async (cinema) => {
            const data = await MovieService.getShowtimeSlots(movie.id, selectedDate, cinema.id);
            results[cinema.id] = data;
          })
        );
        if (isMounted) {
          setCinemaSlots(results);
          setLoadingSlots(false);
        }
      } catch (err) {
        console.error('Error fetching showtimes:', err);
        if (isMounted) setLoadingSlots(false);
      }
    };

    loadAllCinemas();

    return () => {
      isMounted = false;
    };
  }, [movie?.id, selectedDate]);

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
                onClick={() => setIsShowtimeModalOpen(true)}
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
              const slots = cinemaSlots[cinema.id] || [];
              return (
                <div
                  key={cinema.id}
                  className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
                >
                  <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
                    <MapPin className="w-4 h-4 text-[#E63845]" />
                    <span>{cinema.name}</span>
                  </div>
                  <p className="text-xs text-[#9EA6B8]">{cinema.address}</p>

                  {/* Showtimes Row */}
                  <div className="pt-3 border-t border-[#303645]/60 space-y-4">
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      2D PHỤ ĐỀ
                    </div>

                    {loadingSlots ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 py-2">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="animate-pulse flex flex-col items-center">
                            <div className="w-full h-12 bg-[#242836] rounded-sm" />
                            <div className="w-12 h-3 bg-[#242836] rounded mt-1.5" />
                          </div>
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="text-xs text-[#9EA6B8] py-2">
                        Chưa có suất chiếu cho ngày này tại cụm rạp.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(
                          slots.reduce((acc: Record<string, ShowtimeSlot[]>, slot) => {
                            const fmt = slot.format || '2D';
                            if (!acc[fmt]) acc[fmt] = [];
                            acc[fmt].push(slot);
                            return acc;
                          }, {})
                        ).map(([formatName, formatSlots]) => (
                          <div key={formatName} className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-3.5 bg-[#E63845] rounded-full inline-block" />
                              <div className="text-xs font-bold text-white uppercase tracking-wider">
                                {formatName.toUpperCase().includes('IMAX')
                                  ? 'IMAX LASER PHỤ ĐỀ'
                                  : `${formatName.toUpperCase()} PHỤ ĐỀ`}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                              {formatSlots.map((st: ShowtimeSlot) => (
                                <ShowtimeCard
                                  key={cinema.id + '-' + st.id + '-' + st.time}
                                  slot={st}
                                  theme="dark"
                                  dayStr={activeDateObj.day}
                                  onClick={(selectedSlot) =>
                                    router.push(
                                      `/booking?movie=${movie.id}&cinema=${cinema.id}&date=${selectedDate}&showtime=${selectedSlot.id}&time=${selectedSlot.time}`
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

      {/* Showtime Modal Form Mẫu Chuẩn */}
      <ShowtimeModal
        isOpen={isShowtimeModalOpen}
        onClose={() => setIsShowtimeModalOpen(false)}
        movie={movie}
      />
    </div>
  );
}
