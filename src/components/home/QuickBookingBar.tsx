'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Filter, RotateCcw, Sparkles, Film, Ticket } from 'lucide-react';
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
  selectedShowtime?: string;
  onShowtimeChange?: (slot: string) => void;
  searchKeyword?: string;
  onSearchKeywordChange?: (keyword: string) => void;
  totalFilteredCount?: number;
  onResetFilters?: () => void;
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
  selectedShowtime: propShowtime,
  onShowtimeChange,
  searchKeyword: propKeyword,
  onSearchKeywordChange,
  totalFilteredCount,
  onResetFilters,
}: QuickBookingBarProps) {
  const router = useRouter();

  // Internal states if parent doesn't provide them
  const [internalCinema, setInternalCinema] = useState<string>('all');
  const [internalGenre, setInternalGenre] = useState<string>('all');
  const [internalDate, setInternalDate] = useState<string>('all');
  const [internalShowtime, setInternalShowtime] = useState<string>('all');
  const [internalKeyword, setInternalKeyword] = useState<string>('');

  const currentCinema = propCinema !== undefined ? propCinema : internalCinema;
  const currentGenre = propGenre !== undefined ? propGenre : internalGenre;
  const currentDate = propDate !== undefined ? propDate : internalDate;
  const currentShowtime = propShowtime !== undefined ? propShowtime : internalShowtime;
  const currentKeyword = propKeyword !== undefined ? propKeyword : internalKeyword;

  const hasActiveFilters =
    currentCinema !== 'all' ||
    currentGenre !== 'all' ||
    currentDate !== 'all' ||
    currentShowtime !== 'all' ||
    Boolean(currentKeyword.trim());

  // 1. Danh sách rạp đồng bộ từ Admin (ưu tiên cinemas từ Admin, fallback an toàn)
  const availableCinemas = useMemo(() => {
    if (cinemas && cinemas.length > 0) {
      return cinemas;
    }
    return [
      { id: 1, name: 'Cinemax Xuân Thủy' },
      { id: 2, name: 'Cinemax Landmark 81' },
      { id: 3, name: 'Cinemax Cầu Giấy' },
    ] as Cinema[];
  }, [cinemas]);

  // 2. Danh sách Thể loại / Phân loại chuẩn từ Admin & trích xuất từ dữ liệu phim thực tế
  const availableGenres = useMemo(() => {
    const genreMap = new Map<string, string>();

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

  const handleShowtimeChange = (val: string) => {
    if (onShowtimeChange) onShowtimeChange(val);
    else setInternalShowtime(val);
  };

  const handleKeywordChange = (val: string) => {
    if (onSearchKeywordChange) onSearchKeywordChange(val);
    else setInternalKeyword(val);
  };

  const handleReset = () => {
    if (onResetFilters) {
      onResetFilters();
    } else {
      handleCinemaChange('all');
      handleGenreChange('all');
      handleDateChange('all');
      handleShowtimeChange('all');
      handleKeywordChange('');
    }
  };

  return (
    <div id="quick-booking" className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 -mt-6 relative z-20">
      <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/80 space-y-3.5">
        {/* Top Search bar: Tìm theo tên phim & Badge kết quả */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-[#303645]/60">
          <div className="relative flex-1 max-w-xl">
            <div className="flex items-center bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus-within:border-[#E63845] transition-colors">
              <Search className="w-4 h-4 text-[#9EA6B8] mr-2.5 shrink-0" />
              <input
                type="text"
                placeholder="Tìm phim theo tên, đạo diễn, diễn viên..."
                value={currentKeyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                className="bg-transparent text-white placeholder-[#6E7B91] focus:outline-none w-full text-xs sm:text-sm font-medium"
              />
              {currentKeyword && (
                <button
                  type="button"
                  onClick={() => handleKeywordChange('')}
                  title="Xóa tìm kiếm"
                  className="p-1 text-[#9EA6B8] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Reset button if filters active */}
          {hasActiveFilters && (
            <div className="flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#E63845] bg-[#E63845]/10 border border-[#E63845]/30 hover:bg-[#E63845]/20 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            </div>
          )}
        </div>

        {/* 4 Dropdowns lọc theo tiêu chí */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-center">
          {/* 1. Chọn Cụm Rạp */}
          <div className="relative">
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

          {/* 2. Chọn Thể Loại */}
          <div className="relative">
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

          {/* 3. Chọn Ngày Chiếu */}
          <div className="relative">
            <select
              value={currentDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full bg-[#0F1217] border border-[#303645] text-white rounded-xl px-4 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#E63845] transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239EA6B8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-no-repeat bg-[position:right_16px_center]"
            >
              {availableDates.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Chọn Suất Chiếu / Khung Giờ */}
          <div className="relative">
            <select
              value={currentShowtime}
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
