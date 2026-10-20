'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TrailerModal from '@/components/common/TrailerModal';
import { useData } from '@/lib/data-context';
import { Star, MapPin, Play, Ticket, Calendar } from 'lucide-react';

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { movies, cinemas, showtimes, soldSeatsByShowtime } = useData();

  const movie = useMemo(
    () => movies.find((m) => m.slug === slug) || movies[0],
    [movies, slug]
  );

  // Chuẩn hóa ngày khởi chiếu về YYYY-MM-DD
  const normReleaseDate = useMemo(() => {
    if (!movie?.release_date) return '';
    return movie.release_date.includes('/')
      ? movie.release_date.split('/').reverse().join('-')
      : movie.release_date.slice(0, 10);
  }, [movie?.release_date]);

  // Tạo danh sách 7 ngày tính từ hôm nay (17/10 - 23/10) khớp lịch chiếu Admin
  const dates = useMemo(() => {
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const base = new Date();
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(base.getTime() + idx * 24 * 60 * 60 * 1000);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return {
        label: idx === 0 ? 'Hôm nay' : idx === 1 ? 'Ngày mai' : dayNames[d.getDay()],
        date: `${yyyy}-${mm}-${dd}`,
        day: `${dd}/${mm}`,
      };
    });
  }, []);

  // Nếu phim chưa tới ngày khởi chiếu và ngày khởi chiếu nằm trong danh sách 7 ngày tới,
  // ưu tiên mặc định chọn thẳng ngày khởi chiếu để người dùng xem suất đặt trước
  const initialDate = useMemo(() => {
    if (normReleaseDate && dates.some((d) => d.date === normReleaseDate)) {
      return normReleaseDate;
    }
    return dates[0]?.date || '2026-10-21';
  }, [normReleaseDate, dates]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [isTrailerOpen, setIsTrailerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

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
            {dates.map((d) => {
              const isBeforeRelease = Boolean(normReleaseDate && d.date < normReleaseDate);
              const isSelected = selectedDate === d.date;
              return (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                      : isBeforeRelease
                      ? 'bg-[#14161F] border border-[#262B38] text-[#5D6475] hover:text-[#9EA6B8]'
                      : 'bg-[#1A1C26] border border-[#303645] text-[#9EA6B8] hover:text-white'
                  }`}
                  title={isBeforeRelease ? `Phim chính thức khởi chiếu từ ${movie.release_date}` : undefined}
                >
                  <span>{d.label} ({d.day})</span>
                  {isBeforeRelease && (
                    <span className="text-[10px] text-amber-500/80 font-normal">● Chưa chiếu</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Banner Thông Báo Khi Chọn Ngày Trước Khởi Chiếu */}
          {normReleaseDate && selectedDate < normReleaseDate && (
            <div className="bg-[#1A1C26] border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-black/40">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5 sm:mt-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-amber-300">Phim chưa khởi chiếu vào ngày này</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Khởi chiếu: {movie.release_date}
                    </span>
                  </div>
                  <p className="text-xs text-[#9EA6B8] mt-1 leading-relaxed max-w-2xl">
                    "{movie.title}" chính thức công chiếu từ ngày <strong className="text-white">{movie.release_date}</strong>. Suất chiếu chỉ mở từ ngày khởi chiếu trở đi. Quý khách vui lòng chọn ngày từ <strong>{movie.release_date}</strong> để xem lịch chiếu và đặt vé sớm.
                  </p>
                </div>
              </div>
              {dates.some((d) => d.date === normReleaseDate) && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(normReleaseDate)}
                  className="px-4 py-2.5 rounded-xl bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold transition-all whitespace-nowrap shadow-md shadow-[#E63845]/30 cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
                >
                  <span>Xem ngày khởi chiếu ({dates.find((d) => d.date === normReleaseDate)?.day})</span>
                  <span>&gt;</span>
                </button>
              )}
            </div>
          )}

          {/* Cinema Blocks with Showtimes */}
          <div className="space-y-4 pt-2">
            {cinemas.map((cinema) => {
              // Tìm suất chiếu của phim này và ngày được chọn từ DB/Admin
              const matchedShowtimes = showtimes.filter((s) => {
                const sStatus = String(s.status || 'OPEN').toUpperCase();
                if (sStatus === 'CANCELLED' || sStatus === 'CLOSED') return false;

                const sMovieId = String(s.movie_id || s.movie?.id || '');
                const mId = String(movie.id || '');
                const mSubId = movie.supabase_id ? String(movie.supabase_id) : '';

                const matchMovie =
                  sMovieId === mId ||
                  (mSubId && sMovieId === mSubId) ||
                  (movie.slug && s.movie?.slug === movie.slug) ||
                  (movie.title && s.movie?.title?.toLowerCase() === movie.title.toLowerCase()) ||
                  (s.movie?.id && (String(s.movie.id) === mId || (mSubId && String(s.movie.id) === mSubId)));
                if (!matchMovie) return false;

                // Khớp ngày đã chọn (YYYY-MM-DD)
                const stTime = s.start_time || (s as any).starts_at;
                if (!stTime) return false;
                const stDate = stTime.slice(0, 10);
                if (selectedDate && stDate && stDate !== selectedDate) return false;

                // Chặn tuyệt đối: Phim chưa khởi chiếu thì không được phép có suất chiếu
                if (normReleaseDate && stDate < normReleaseDate) return false;

                return true;
              });

              const slotsToRender = matchedShowtimes
                .map((st: any) => {
                  const rawTime = st.start_time || st.starts_at;
                  const dt = new Date(rawTime);
                  const timeStr = dt.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const soldCount = (soldSeatsByShowtime[Number(st.id)] || []).length;
                  const totalSeats = Number(st.room?.total_seats || st.auditorium?.total_seats || 80);
                  return {
                    id: st.id,
                    time: timeStr,
                    roomName: st.room?.name || st.auditorium?.name || 'Phòng 1 (2D Tiêu Chuẩn)',
                    screenType: st.room?.screen_type || st.auditorium?.screen_type || st.format || '2D',
                    availableSeats: Math.max(0, totalSeats - soldCount),
                    sortMinutes: dt.getHours() * 60 + dt.getMinutes(),
                  };
                })
                .sort((a, b) => a.sortMinutes - b.sortMinutes);

              const isSelectedToday = selectedDate === dates[0]?.date;
              const now = new Date();
              const currentMinutes = now.getHours() * 60 + now.getMinutes();

              // Tìm ngày gần nhất có suất chiếu nếu ngày hiện tại không có
              const allDatesWithShowtimes = dates.filter((d) => {
                if (normReleaseDate && d.date < normReleaseDate) return false;
                return showtimes.some((s) => {
                  const sStatus = String(s.status || 'OPEN').toUpperCase();
                  if (sStatus === 'CANCELLED' || sStatus === 'CLOSED') return false;
                  const sMovieId = String(s.movie_id || s.movie?.id || '');
                  const mId = String(movie.id || '');
                  const mSubId = movie.supabase_id ? String(movie.supabase_id) : '';
                  const matchMovie =
                    sMovieId === mId ||
                    (mSubId && sMovieId === mSubId) ||
                    (movie.slug && s.movie?.slug === movie.slug) ||
                    (movie.title && s.movie?.title?.toLowerCase() === movie.title.toLowerCase()) ||
                    (s.movie?.id && (String(s.movie.id) === mId || (mSubId && String(s.movie.id) === mSubId)));
                  if (!matchMovie) return false;
                  const stTime = s.start_time || (s as any).starts_at;
                  return stTime && stTime.slice(0, 10) === d.date;
                });
              });
              const nearestAvailableDate = allDatesWithShowtimes[0];

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
                      Chọn giờ chiếu để vào chọn ghế:
                    </div>
                    {slotsToRender.length === 0 ? (
                      nearestAvailableDate ? (
                        <div className="bg-[#14161F] border border-[#303645] rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                          <p className="text-[#9EA6B8]">
                            Chưa có suất chiếu vào ngày đang chọn. Suất chiếu gần nhất: <span className="text-white font-bold">{nearestAvailableDate.label} ({nearestAvailableDate.day})</span>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedDate(nearestAvailableDate.date)}
                            className="px-3 py-1.5 rounded-lg bg-[#E63845]/15 border border-[#E63845]/40 text-[#E63845] hover:bg-[#E63845] hover:text-white font-bold transition-all cursor-pointer"
                          >
                            Xem lịch ngày {nearestAvailableDate.day} &gt;
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-[#9EA6B8] py-2">
                          Phim hiện chưa có suất chiếu nào được xếp lịch tại cụm rạp này trong 7 ngày tới. Vui lòng chọn cụm rạp khác hoặc quay lại sau.
                        </p>
                      )
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {slotsToRender.map((st) => {
                          const [slotH, slotM] = st.time.split(':').map(Number);
                          const slotMinutes = (slotH || 0) * 60 + (slotM || 0);
                          const isPast = isSelectedToday && slotMinutes <= currentMinutes;

                          return (
                            <button
                              key={`${cinema.id}-${st.id}-${st.time}`}
                              disabled={isPast}
                              onClick={() => {
                                if (isPast) return;
                                const savedPromo =
                                  typeof window !== 'undefined'
                                    ? new URLSearchParams(window.location.search).get('promo') ||
                                      sessionStorage.getItem('cinemax_applied_promo') ||
                                      ''
                                    : '';
                                const promoParam = savedPromo ? `&promo=${encodeURIComponent(savedPromo)}` : '';
                                router.push(
                                  `/booking?movie=${movie.id}&cinema=${cinema.id}&date=${encodeURIComponent(
                                    selectedDate
                                  )}&showtime=${st.id}&time=${encodeURIComponent(st.time)}${promoParam}`
                                );
                              }}
                              className={`rounded-xl px-4 py-2.5 text-center transition-all min-w-[110px] ${
                                isPast
                                  ? 'bg-[#12151D] border border-[#232733] opacity-40 cursor-not-allowed select-none'
                                  : 'bg-[#0F1217] border border-[#303645] hover:border-[#E63845] hover:bg-[#E63845]/10 group transform hover:scale-105 cursor-pointer'
                              }`}
                              title={isPast ? 'Suất chiếu này đã qua giờ chiếu' : `${st.roomName} • Còn ${st.availableSeats} ghế trống`}
                            >
                              <div
                                className={`text-sm font-black transition-colors ${
                                  isPast
                                    ? 'text-slate-500 line-through'
                                    : 'text-white group-hover:text-[#E63845]'
                                }`}
                              >
                                {st.time}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[110px] mt-0.5">
                                {st.roomName}
                              </div>
                              <div
                                className={`text-[10px] font-medium mt-0.5 ${
                                  isPast ? 'text-slate-500' : 'text-[#FABF2E]'
                                }`}
                              >
                                {isPast ? 'Đã chiếu' : `Còn ${st.availableSeats} ghế`}
                              </div>
                            </button>
                          );
                        })}
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
    </div>
  );
}
