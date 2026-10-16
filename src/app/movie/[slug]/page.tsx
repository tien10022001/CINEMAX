'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TrailerModal from '@/components/common/TrailerModal';
import { useData } from '@/lib/data-context';
import { Star, MapPin, Play, Ticket } from 'lucide-react';

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { movies, cinemas, showtimes, soldSeatsByShowtime } = useData();

  const movie = useMemo(
    () => movies.find((m) => m.slug === slug) || movies[0],
    [movies, slug]
  );

  // Tạo danh sách 6 ngày tính từ hôm nay
  const dates = useMemo(() => {
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const base = new Date();
    return Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(base);
      d.setDate(base.getDate() + idx);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return {
        label: idx === 0 ? 'Hôm nay' : idx === 1 ? 'Ngày mai' : dayNames[d.getDay()],
        date: `${dd}/${mm}/${yyyy}`,
        day: `${dd}/${mm}`,
      };
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => dates[0]?.date || '16/10/2026');
  const [isTrailerOpen, setIsTrailerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#schedule-section') {
      setTimeout(() => {
        const el = document.getElementById('schedule-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, []);

  const scrollToSchedule = () => {
    const el = document.getElementById('schedule-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!movie) return null;

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
              {Number(movie.id) === 1 && (
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
                <span>{movie.genres?.map((g) => g.name).join(', ') || 'Điện ảnh'}</span>
              </div>
              <div>
                <span className="font-semibold text-white">Thời lượng: </span>
                <span>{movie.duration_min} phút</span>
              </div>
              <div>
                <span className="font-semibold text-white">Khởi chiếu: </span>
                <span>{movie.release_date || 'Đang chiếu'}</span>
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
                Chọn rạp & suất chiếu
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
                1. Chọn Ngày & Rạp Chiếu
              </h2>
              <p className="text-xs text-[#9EA6B8] mt-1">
                Vui lòng chọn ngày chiếu và bấm vào khung giờ bạn muốn xem để tiến hành chọn ghế
              </p>
            </div>
          </div>

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
                {d.label} ({d.day})
              </button>
            ))}
          </div>

          {/* Cinema Blocks with Showtimes */}
          <div className="space-y-4 pt-2">
            {cinemas.map((cinema, cIdx) => {
              // Tìm suất chiếu của phim này hoặc tạo danh sách khung giờ chuẩn cho từng rạp
              const matchedShowtimes = showtimes.filter(
                (s) =>
                  s.status === 'OPEN' &&
                  (Number(s.movie_id) === Number(movie.id) || Number(movie.id) === 1) &&
                  (!s.room?.cinema_id || Number(s.room.cinema_id) === Number(cinema.id))
              );

              const defaultTimeSlots = [
                { time: '09:30', roomName: 'Phòng 1 (2D Tiêu Chuẩn)', baseSeats: 76 },
                { time: '12:15', roomName: 'Phòng 2 (2D Phụ đề)', baseSeats: 72 },
                { time: '15:00', roomName: 'Phòng 1 (IMAX Laser)', baseSeats: 68 },
                { time: '18:30', roomName: 'Phòng 3 (2D Tiêu Chuẩn)', baseSeats: 64 },
                { time: '21:15', roomName: 'Phòng 1 (IMAX Laser)', baseSeats: 74 },
              ];

              const slotsToRender =
                matchedShowtimes.length > 0
                  ? matchedShowtimes
                      .map((st) => {
                        const dt = new Date(st.start_time);
                        const timeStr = dt.toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const soldCount = (soldSeatsByShowtime[Number(st.id)] || []).length;
                        return {
                          id: st.id,
                          time: timeStr,
                          roomName: st.room?.name || 'Phòng 1 (2D)',
                          availableSeats: Math.max(0, 80 - soldCount),
                          sortMinutes: dt.getHours() * 60 + dt.getMinutes(),
                        };
                      })
                      .sort((a, b) => a.sortMinutes - b.sortMinutes)
                  : defaultTimeSlots.map((slot, sIdx) => {
                      const syntheticId = Number(movie.id) * 10000 + (cIdx + 1) * 100 + (sIdx + 1);
                      const soldCount = (soldSeatsByShowtime[syntheticId] || []).length;
                      return {
                        id: syntheticId,
                        time: slot.time,
                        roomName: slot.roomName,
                        availableSeats: Math.max(0, 80 - soldCount),
                        sortMinutes: sIdx,
                      };
                    });

              return (
                <div
                  key={cinema.id}
                  className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg">
                        <MapPin className="w-4 h-4 text-[#E63845]" />
                        <span>{cinema.name}</span>
                      </div>
                      <p className="text-xs text-[#9EA6B8] mt-0.5">{cinema.address}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#33C773] bg-[#33C773]/10 border border-[#33C773]/30 px-2.5 py-1 rounded-full">
                      Đang mở bán
                    </span>
                  </div>

                  {/* Showtimes Row */}
                  <div className="pt-3 border-t border-[#303645]/60 space-y-3">
                    <div className="text-xs font-semibold text-white/80">
                      2D Phụ đề Việt • Chọn giờ chiếu để vào chọn ghế:
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {slotsToRender.map((st) => (
                        <button
                          key={`${cinema.id}-${st.id}-${st.time}`}
                          onClick={() =>
                            router.push(
                              `/booking?movie=${movie.id}&cinema=${cinema.id}&date=${encodeURIComponent(
                                selectedDate
                              )}&showtime=${st.id}&time=${encodeURIComponent(st.time)}`
                            )
                          }
                          className="bg-[#0F1217] border border-[#303645] hover:border-[#E63845] hover:bg-[#E63845]/10 rounded-xl px-4 py-2.5 text-center group transition-all transform hover:scale-105 cursor-pointer min-w-[105px]"
                        >
                          <div className="text-sm font-black text-white group-hover:text-[#E63845] transition-colors">
                            {st.time}
                          </div>
                          <div className="text-[11px] text-[#FABF2E] font-medium mt-0.5">
                            {st.availableSeats}/80 ghế trống
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
