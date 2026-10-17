'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Movie, Cinema } from '@/lib/types';

interface QuickBookingBarProps {
  movies: Movie[];
  cinemas: Cinema[];
  selectedCinema?: string;
  onCinemaChange?: (cinemaId: string) => void;
  selectedGenre?: string;
  onGenreChange?: (genreSlug: string) => void;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export default function QuickBookingBar({
  movies = [],
  cinemas = [],
  selectedCinema: propCinema,
  onCinemaChange,
  selectedGenre: propGenre,
  onGenreChange,
  selectedDate: propDate,
  onDateChange,
}: QuickBookingBarProps) {
  const router = useRouter();

  // Internal state nếu parent không quản lý
  const [internalCinema, setInternalCinema] = useState<string>('all');
  const [internalGenre, setInternalGenre] = useState<string>('all');
  const [internalDate, setInternalDate] = useState<string>('all');
  const [selectedShowtime, setSelectedShowtime] = useState<string>('all');

  const currentCinema = propCinema !== undefined ? propCinema : internalCinema;
  const currentGenre = propGenre !== undefined ? propGenre : internalGenre;
  const currentDate = propDate !== undefined ? propDate : internalDate;

  // 1. Danh sách rạp đồng bộ từ Admin (ưu tiên cinemas từ Admin, fallback an toàn)
  const availableCinemas = useMemo(() => {
    if (cinemas && cinemas.length > 0) {
      return cinemas;
    }
    return [
      { id: 1, name: 'Cinemax Hà Nội Centre' },
      { id: 2, name: 'Cinemax Cầu Giấy' },
      { id: 3, name: 'Cinemax Landmark 81' },
    ] as Cinema[];
  }, [cinemas]);

  // 2. Danh sách Thể loại / Phân loại chuẩn từ Admin & trích xuất từ dữ liệu phim thực tế
  const availableGenres = useMemo(() => {
    const genreMap = new Map<string, string>(); // slug/id -> name

    // Các thể loại chuẩn trong hệ thống Admin CinemaX
    const standardAdminGenres = [
      { name: 'Hành Động', slug: 'hanh-dong' },
      { name: 'Khoa Học Viễn Tưởng', slug: 'khoa-hoc-vien-tuong' },
      { name: 'Hoạt Hình', slug: 'hoat-hinh' },
      { name: 'Kinh Dị', slug: 'kinh-di' },
      { name: 'Phiêu Lưu', slug: 'phieu-luu' },
      { name: 'Hài Kịch', slug: 'hai-kich' },
      { name: 'Tâm Lý - Tình Cảm', slug: 'tam-ly-tinh-cam' },
      { name: 'Gia Đình', slug: 'gia-dinh' },
    ];

    standardAdminGenres.forEach((g) => genreMap.set(g.slug, g.name));

    // Trích xuất thêm các thể loại thực tế mà Admin đã tạo thêm cho phim
    movies.forEach((m) => {
      if (m.genres && Array.isArray(m.genres)) {
        m.genres.forEach((g: any) => {
          if (g && g.name) {
            const slug =
              g.slug ||
              g.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            genreMap.set(slug, g.name);
          }
        });
      }
    });

    return Array.from(genreMap.entries()).map(([slug, name]) => ({
      slug,
      name,
    }));
  }, [movies]);

  // 3. Danh sách ngày linh hoạt (Tự động tính theo ngày hiện tại thực tế)
  const availableDates = useMemo(() => {
    const days: { value: string; label: string }[] = [{ value: 'all', label: 'Tất cả các ngày' }];
    const today = new Date();
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateVal = `${yyyy}-${mm}-${dd}`;

      let label = `${dayNames[d.getDay()]} (${dd}/${mm})`;
      if (i === 0) label = `Hôm nay (${dd}/${mm})`;
      if (i === 1) label = `Ngày mai (${dd}/${mm})`;

      days.push({ value: dateVal, label });
    }
    return days;
  }, []);

  const handleCinemaChange = (val: string) => {
    if (onCinemaChange) onCinemaChange(val);
    else setInternalCinema(val);
  };

  const handleGenreChange = (val: string) => {
    if (onGenreChange) onGenreChange(val);
    else setInternalGenre(val);
  };

  const handleDateChange = (val: string) => {
    if (onDateChange) onDateChange(val);
    else setInternalDate(val);
  };

  const handleShowtimeChange = (value: string) => {
    setSelectedShowtime(value);
    if (value === 'all') return;

    // Tìm phim phù hợp theo thể loại đã chọn
    const matchedMovie =
      currentGenre !== 'all'
        ? movies.find((m) =>
            m.genres?.some(
              (g: any) =>
                g.slug === currentGenre ||
                g.name?.toLowerCase().includes(currentGenre.toLowerCase())
            )
          ) || movies[0]
        : movies[0];

    const targetMovieId = matchedMovie?.id || '1';
    const targetCinemaId = currentCinema !== 'all' ? currentCinema : '1';
    const targetDate = currentDate !== 'all' ? currentDate : availableDates[1]?.value || '2026-10-17';

    // Map khung giờ sang showtime id tương ứng
    const showtimeMap: Record<string, string> = {
      morning: '101',
      noon: '102',
      afternoon: '103',
      evening: '104',
      night: '105',
    };

    const targetShowtime = showtimeMap[value] || '101';

    router.push(
      `/booking?movie=${targetMovieId}&cinema=${targetCinemaId}&date=${targetDate}&showtime=${targetShowtime}`
    );
  };

  return (
    <div id="quick-booking" className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 -mt-6 relative z-20">
      <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 shadow-2xl shadow-black/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* 1. Chọn Rạp (Đồng bộ theo Admin) */}
          <div>
            <select
              value={currentCinema}
              onChange={(e) => handleCinemaChange(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              <option value="all">Tất cả cụm rạp</option>
              {availableCinemas.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Thể Loại / Phân Loại (Đồng bộ chuẩn từ Admin) */}
          <div>
            <select
              value={currentGenre}
              onChange={(e) => handleGenreChange(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              <option value="all">Thể loại (Tất cả)</option>
              {availableGenres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Chọn Ngày (Động theo thời gian thực) */}
          <div>
            <select
              value={currentDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              {availableDates.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Chọn Suất Chiếu */}
          <div>
            <select
              value={selectedShowtime}
              onChange={(e) => handleShowtimeChange(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              <option value="all">Tất cả suất chiếu</option>
              <option value="morning">Buổi sáng (09:00 - 11:30)</option>
              <option value="noon">Buổi trưa (11:30 - 14:00)</option>
              <option value="afternoon">Buổi chiều (14:00 - 17:30)</option>
              <option value="evening">Buổi tối (17:30 - 21:00)</option>
              <option value="night">Suất khuya (Sau 21:00)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
