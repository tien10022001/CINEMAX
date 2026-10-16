'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  X,
  Armchair,
  Layers,
  ChevronRight,
  Film,
  LayoutGrid,
  List,
  Info,
  CalendarDays,
  Star,
  Check,
  Edit3,
  Zap,
  Copy,
  Sparkles,
  Maximize2,
  Minimize2,
  Eye,
  Flame,
  ShieldAlert,
  Users
} from 'lucide-react';
import {
  Showtime,
  ShowtimePrice,
  Movie,
  Auditorium,
  SeatType,
  AudienceType
} from '@/lib/types-redesign';

interface ShowtimesViewProps {
  showtimes: Showtime[];
  movies: Movie[];
  auditoriums: Auditorium[];
  prices: ShowtimePrice[];
  onSaveShowtime: (showtime: Partial<Showtime>, prices?: Partial<ShowtimePrice>[]) => Promise<void>;
  onDeleteShowtime: (id: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function ShowtimesView({
  showtimes,
  movies,
  auditoriums,
  prices,
  onSaveShowtime,
  onDeleteShowtime,
  showToast
}: ShowtimesViewProps) {
  const [selectedAuditoriumId, setSelectedAuditoriumId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [pricingModalShowtime, setPricingModalShowtime] = useState<Showtime | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmShowtime, setDeleteConfirmShowtime] = useState<{ id: string; title: string; time: string; room: string } | null>(null);

  // Quick Batch Schedule Modal State (Tạo Suất Chiếu Nhanh bằng cách tích ô theo Rule)
  const [quickBatchModalOpen, setQuickBatchModalOpen] = useState(false);
  const [selectedQuickMovieIds, setSelectedQuickMovieIds] = useState<string[]>([]);
  const [selectedQuickAuditoriumIds, setSelectedQuickAuditoriumIds] = useState<string[]>([]);
  const [onlyCompatibleRooms, setOnlyCompatibleRooms] = useState(true);
  const [allow2DInImax, setAllow2DInImax] = useState(false);
  const [scheduleDuration, setScheduleDuration] = useState<'1_DAY' | '7_DAYS' | '1_MONTH'>('1_DAY');
  const [quickStartDate, setQuickStartDate] = useState(selectedDate);
  const [applyAllWeekdays, setApplyAllWeekdays] = useState(true);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [quickOperatingStart, setQuickOperatingStart] = useState('08:00');
  const [quickOperatingEnd, setQuickOperatingEnd] = useState('00:30');
  const [quickCleaningBuffer, setQuickCleaningBuffer] = useState(15);
  const [quickTrailerMinutes, setQuickTrailerMinutes] = useState(10);
  const [staggerRooms, setStaggerRooms] = useState(true);
  const [staggerSameMovie, setStaggerSameMovie] = useState(true);
  const [autoShiftConflicts, setAutoShiftConflicts] = useState(true);
  const [publishStatus, setPublishStatus] = useState<'open' | 'draft'>('open');
  const [isPreviewDrawerOpen, setIsPreviewDrawerOpen] = useState(false);

  // Form State for showtime (create or edit)
  const [form, setForm] = useState({
    id: '',
    movie_id: movies[0]?.id || '',
    auditorium_id: auditoriums[0]?.id || '',
    format: '2D',
    language_version: 'Phụ đề Tiếng Việt',
    date: new Date().toISOString().split('T')[0],
    start_time: '18:30',
    status: 'open' as const
  });
  const [isSlotClicked, setIsSlotClicked] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Price Matrix State for selected showtime
  const [priceMatrix, setPriceMatrix] = useState<Record<string, number>>({
    'STANDARD_ADULT': 85000,
    'STANDARD_STUDENT_U22': 65000,
    'STANDARD_CHILD': 55000,
    'STANDARD_SENIOR': 55000,
    'VIP_ADULT': 105000,
    'VIP_STUDENT_U22': 85000,
    'VIP_CHILD': 75000,
    'VIP_SENIOR': 75000,
    'COUPLE_ADULT': 210000,
    'COUPLE_STUDENT_U22': 170000,
    'WHEELCHAIR_ADULT': 65000,
    'WHEELCHAIR_STUDENT_U22': 50000
  });

  // Quick next 7 days list
  const nextDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const label =
      i === 0
        ? 'Hôm nay'
        : i === 1
        ? 'Ngày mai'
        : d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return { dateStr, label };
  });

  // Filtered showtimes by auditorium and date
  const filteredShowtimes = showtimes.filter((st) => {
    const matchesAud = selectedAuditoriumId === 'all' || st.auditorium_id === selectedAuditoriumId;
    const stDate = st.starts_at ? new Date(st.starts_at).toISOString().split('T')[0] : '';
    return matchesAud && stDate === selectedDate;
  });

  // Overlap Detection
  const checkOverlap = (st: Showtime) => {
    const start = new Date(st.starts_at).getTime();
    const end = new Date(st.ends_at).getTime();
    return showtimes.some((other) => {
      if (other.id === st.id || other.auditorium_id !== st.auditorium_id) return false;
      const otherStart = new Date(other.starts_at).getTime();
      const otherEnd = new Date(other.ends_at).getTime();
      return Math.max(start, otherStart) < Math.min(end, otherEnd);
    });
  };

  const handleCreateShowtime = async (e: React.FormEvent) => {
    e.preventDefault();
    const movie = movies.find((m) => m.id === form.movie_id) || movies[0];
    const auditorium = auditoriums.find((a) => a.id === form.auditorium_id) || auditoriums[0];

    if (!movie || !auditorium) {
      showToast('Vui lòng chọn phim và phòng chiếu!');
      return;
    }

    try {
      setIsSubmitting(true);
      const startsAt = new Date(`${form.date}T${form.start_time}:00`);
      const buffer = auditorium.cleaning_buffer_minutes || 15;
      const totalMinutes = movie.duration_minutes + buffer;
      const endsAt = new Date(startsAt.getTime() + totalMinutes * 60000);

      const generatedPrices: Partial<ShowtimePrice>[] = [
        { seat_type: 'STANDARD', audience_type: 'ADULT', price: 85000, currency: 'VND' },
        { seat_type: 'STANDARD', audience_type: 'STUDENT_U22', price: 65000, currency: 'VND' },
        { seat_type: 'STANDARD', audience_type: 'CHILD', price: 55000, currency: 'VND' },
        { seat_type: 'VIP', audience_type: 'ADULT', price: 105000, currency: 'VND' },
        { seat_type: 'VIP', audience_type: 'STUDENT_U22', price: 85000, currency: 'VND' },
        { seat_type: 'COUPLE', audience_type: 'ADULT', price: 210000, currency: 'VND' }
      ];

      const isEditing = Boolean(form.id);

      await onSaveShowtime(
        {
          ...(form.id ? { id: form.id } : {}),
          movie_id: movie.id,
          auditorium_id: auditorium.id,
          format: form.format || (auditorium.screen_type === 'IMAX' ? 'IMAX' : '2D'),
          language_version: form.language_version || movie.language || 'Phụ đề Tiếng Việt',
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: form.status
        },
        form.id ? undefined : generatedPrices
      );

      showToast(isEditing ? `Đã cập nhật suất chiếu "${movie.title}"!` : `Đã xếp suất chiếu "${movie.title}" vào ${auditorium.name}!`);
      setModalOpen(false);
    } catch (err: any) {
      showToast('Lỗi khi lưu suất chiếu: ' + (err.message || 'Thử lại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPricingMatrix = (st: Showtime) => {
    setPricingModalShowtime(st);
    const existingPrices = prices.filter((p) => p.showtime_id === st.id);
    if (existingPrices.length > 0) {
      const map: Record<string, number> = {};
      existingPrices.forEach((p) => {
        map[`${p.seat_type}_${p.audience_type}`] = p.price;
      });
      setPriceMatrix((prev) => ({ ...prev, ...map }));
    }
  };

  // Timeline Fullscreen & Room Filter State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [roomFilter, setRoomFilter] = useState<'ALL' | '2D' | 'IMAX' | 'CONFLICT'>('ALL');

  // Timeline hours from 08:00 to 03:00 sáng hôm sau (19 hours total: 8..23, 24=00h, 25=01h, 26=02h, kết thúc 03:00)
  const TIMELINE_START_HOUR = 8;
  const TIMELINE_TOTAL_HOURS = 19;
  const timelineHours = Array.from({ length: 19 }, (_, i) => 8 + i);

  // Helper định dạng nhãn mốc giờ (08:00 -> 23:00, 00:00, 01:00, 02:00)
  const getTimelineHourLabel = (h: number) => {
    if (h < 24) return `${String(h).padStart(2, '0')}:00`;
    const late = h - 24;
    return `${String(late).padStart(2, '0')}:00`;
  };

  // Helper kiểm tra một suất chiếu có thuộc ngày kinh doanh (Business Day: 08:00 sáng -> 03:00 sáng hôm sau)
  const isShowtimeInBusinessDay = (st: Showtime, businessDateStr: string) => {
    if (!st.starts_at) return false;
    const stDate = new Date(st.starts_at);
    const ymd = stDate.toISOString().split('T')[0];
    const hour = stDate.getHours() + stDate.getMinutes() / 60;

    const nextD = new Date(businessDateStr);
    nextD.setDate(nextD.getDate() + 1);
    const nextDateStr = nextD.toISOString().split('T')[0];

    // Thuộc ngày businessDateStr và từ 06:00 sáng trở đi
    if (ymd === businessDateStr && hour >= 6) return true;
    // Thuộc rạng sáng ngày hôm sau (00:00 - trước 04:00 sáng)
    if (ymd === nextDateStr && hour < 5) return true;
    // Nếu trong DB lưu cùng ngày nhưng giờ < 6h sáng
    if (ymd === businessDateStr && hour < 6) return true;

    return false;
  };

  // Filtered auditoriums for timeline view
  const displayedAuditoriums = React.useMemo(() => {
    return auditoriums.filter((aud) => {
      if (roomFilter === '2D') return aud.screen_type === '2D';
      if (roomFilter === 'IMAX') return aud.screen_type === 'IMAX';
      if (roomFilter === 'CONFLICT') {
        const roomSts = showtimes.filter((st) => {
          return st.auditorium_id === aud.id && isShowtimeInBusinessDay(st, selectedDate);
        });
        return roomSts.some(checkOverlap);
      }
      return true;
    });
  }, [auditoriums, roomFilter, showtimes, selectedDate]);

  // State lọc phim theo định dạng rạp (mặc định = true: phòng 2D chỉ hiện phim 2D, phòng IMAX chỉ hiện phim IMAX)
  const [filterMoviesByRoomType, setFilterMoviesByRoomType] = useState(true);

  // Hàm kiểm tra định dạng phim có tương thích với loại rạp không theo Rule
  const isMovieCompatibleWithAuditorium = (movie: Movie, aud?: Auditorium | null, allowImax2D?: boolean) => {
    if (!aud) return true;
    const roomType = (aud.screen_type || '2D').toUpperCase();
    const movieFormats = (movie.formats && movie.formats.length > 0) ? movie.formats : ['2D'];

    // Rule: 2D: Chỉ xếp vào phòng 2D; có thể vào IMAX nếu quản lý bật cho phép
    if (roomType === 'IMAX' && (allowImax2D ?? allow2DInImax)) {
      if (movieFormats.some((fmt) => fmt.toUpperCase().includes('2D'))) return true;
    }

    return movieFormats.some((fmt) => {
      const upper = fmt.toUpperCase();
      if (roomType === '2D') return upper.includes('2D');
      if (roomType === 'IMAX') return upper.includes('IMAX');
      if (roomType === '3D') return upper.includes('3D');
      if (roomType === '4DX') return upper.includes('4DX');
      return upper.includes(roomType) || roomType.includes(upper);
    });
  };

  // Preview Movie & Auditorium for Modal
  const selectedModalAuditorium = auditoriums.find((a) => a.id === form.auditorium_id) || auditoriums[0];

  // Danh sách phim tương thích với loại phòng chiếu đang chọn
  const compatibleMoviesForAuditorium = React.useMemo(() => {
    if (!selectedModalAuditorium) return movies;
    return movies.filter((m) => isMovieCompatibleWithAuditorium(m, selectedModalAuditorium));
  }, [movies, selectedModalAuditorium]);

  const displayedModalMovies = filterMoviesByRoomType ? compatibleMoviesForAuditorium : movies;
  const selectedModalMovie = movies.find((m) => m.id === form.movie_id) || displayedModalMovies[0] || movies[0];

  // Quick slot click: Khóa cứng phòng chiếu theo hàng đang bấm, không cần chọn lại phòng, lọc phim tương thích
  const handleQuickSlotClick = (auditoriumId: string, hour: number) => {
    let targetDate = selectedDate;
    let formattedHour = '08:00';

    if (hour >= 24) {
      const nextD = new Date(selectedDate);
      nextD.setDate(nextD.getDate() + 1);
      targetDate = nextD.toISOString().split('T')[0];
      formattedHour = String(hour - 24).padStart(2, '0') + ':00';
    } else {
      formattedHour = String(hour).padStart(2, '0') + ':00';
    }

    const targetAud = auditoriums.find((a) => a.id === auditoriumId) || auditoriums[0];
    const defaultFormat = targetAud?.screen_type === 'IMAX' ? 'IMAX' : '2D';

    // Lọc phim tương thích với loại phòng chiếu này (2D -> phim 2D, IMAX -> phim IMAX)
    const validMovies = movies.filter((m) => isMovieCompatibleWithAuditorium(m, targetAud));
    const currentMovie = movies.find((m) => m.id === form.movie_id);
    const chosenMovie = (currentMovie && isMovieCompatibleWithAuditorium(currentMovie, targetAud))
      ? currentMovie
      : (validMovies[0] || currentMovie || movies[0]);

    const defaultLang = chosenMovie?.language || 'Tiếng Anh - Phụ đề Tiếng Việt';

    setForm((prev) => ({
      ...prev,
      id: '',
      auditorium_id: auditoriumId,
      movie_id: chosenMovie?.id || prev.movie_id,
      date: targetDate,
      start_time: formattedHour,
      format: defaultFormat,
      language_version: defaultLang
    }));
    setIsSlotClicked(true);
    setFilterMoviesByRoomType(true);
    setShowAdvancedOptions(false);
    setModalOpen(true);
  };

  // Mở modal tạo từ nút "+ Xếp Suất Mới" ngoài header
  const handleOpenNewShowtimeModal = () => {
    const targetAud = auditoriums.find((a) => a.id === form.auditorium_id) || auditoriums[0];
    const defaultFormat = targetAud?.screen_type === 'IMAX' ? 'IMAX' : '2D';

    const validMovies = movies.filter((m) => isMovieCompatibleWithAuditorium(m, targetAud));
    const currentMovie = movies.find((m) => m.id === form.movie_id);
    const chosenMovie = (currentMovie && isMovieCompatibleWithAuditorium(currentMovie, targetAud))
      ? currentMovie
      : (validMovies[0] || currentMovie || movies[0]);

    const defaultLang = chosenMovie?.language || 'Tiếng Anh - Phụ đề Tiếng Việt';

    setForm((prev) => ({
      ...prev,
      id: '',
      date: selectedDate,
      movie_id: chosenMovie?.id || prev.movie_id,
      format: defaultFormat,
      language_version: defaultLang
    }));
    setIsSlotClicked(false);
    setFilterMoviesByRoomType(true);
    setShowAdvancedOptions(false);
    setModalOpen(true);
  };

  // Mở modal chỉnh sửa khi click vào ô phim suất chiếu
  const handleOpenEditShowtime = (st: Showtime) => {
    const movie = st.movie || movies.find((m) => m.id === st.movie_id) || movies[0];
    const auditorium = st.auditorium || auditoriums.find((a) => a.id === st.auditorium_id) || auditoriums[0];

    let dateStr = selectedDate;
    let startTimeStr = '18:30';
    if (st.starts_at) {
      const d = new Date(st.starts_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;

      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      startTimeStr = `${hours}:${mins}`;
    }

    setForm({
      id: st.id,
      movie_id: st.movie_id,
      auditorium_id: st.auditorium_id,
      format: st.format || (auditorium?.screen_type === 'IMAX' ? 'IMAX' : '2D'),
      language_version: st.language_version || movie?.language || 'Phụ đề Tiếng Việt',
      date: dateStr,
      start_time: startTimeStr,
      status: ((st.status as string)?.toLowerCase() === 'open' ? 'open' : 'closed') as any
    });
    setIsSlotClicked(true);
    setFilterMoviesByRoomType(true);
    setShowAdvancedOptions(false);
    setModalOpen(true);
  };

  const handleSelectMovie = (movieId: string) => {
    const m = movies.find((movie) => movie.id === movieId);
    setForm((prev) => ({
      ...prev,
      movie_id: movieId,
      language_version: m?.language || prev.language_version
    }));
  };

  const handleSelectAuditorium = (audId: string) => {
    const aud = auditoriums.find((a) => a.id === audId) || auditoriums[0];
    const validMovies = movies.filter((m) => isMovieCompatibleWithAuditorium(m, aud));
    const currentMovie = movies.find((m) => m.id === form.movie_id);
    const chosenMovie = (currentMovie && isMovieCompatibleWithAuditorium(currentMovie, aud))
      ? currentMovie
      : (validMovies[0] || currentMovie || movies[0]);

    setForm((prev) => ({
      ...prev,
      auditorium_id: audId,
      movie_id: chosenMovie?.id || prev.movie_id,
      format: aud?.screen_type === 'IMAX' ? 'IMAX' : '2D',
      language_version: chosenMovie?.language || prev.language_version
    }));
    setIsSlotClicked(true); // Tự động khóa lại dạng thẻ cố định đẹp mắt sau khi chọn xong phòng mới
  };

  // Danh sách phòng chiếu tương thích để đổi phòng:
  // - Nếu rạp hiện tại là IMAX: CHỈ HIỂN THỊ CÁC PHÒNG IMAX KHÁC!
  // - Nếu rạp hiện tại là 2D: CHỈ HIỂN THỊ CÁC PHÒNG 2D KHÁC!
  const compatibleAuditoriums = React.useMemo(() => {
    if (!selectedModalAuditorium) return auditoriums;
    const currentRoomType = (selectedModalAuditorium.screen_type || '2D').toUpperCase();

    return auditoriums.filter((aud) => {
      const audType = (aud.screen_type || '2D').toUpperCase();
      // Bắt buộc cùng loại chuẩn rạp (IMAX chỉ đổi sang IMAX, 2D chỉ đổi sang 2D)
      if (audType !== currentRoomType) return false;

      // Đồng thời phòng đó phải tương thích với định dạng của phim đang chọn
      if (selectedModalMovie) {
        return isMovieCompatibleWithAuditorium(selectedModalMovie, aud);
      }
      return true;
    });
  }, [auditoriums, selectedModalAuditorium, selectedModalMovie]);

  // Tính tự động giờ kết thúc dự kiến
  const calculatedEndTime = React.useMemo(() => {
    if (!form.start_time || !selectedModalMovie) return '';
    const [h, m] = form.start_time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const buffer = selectedModalAuditorium?.cleaning_buffer_minutes || 15;
    const totalMins = (selectedModalMovie?.duration_minutes || 120) + buffer;
    const endTotalMins = h * 60 + m + totalMins;
    const endH = Math.floor(endTotalMins / 60) % 24;
    const endM = endTotalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [form.start_time, selectedModalMovie, selectedModalAuditorium]);

  // Kiểm tra sơ bộ xung đột lịch chiếu dự kiến (loại trừ chính suất chiếu đang sửa nếu có)
  const previewConflict = React.useMemo(() => {
    if (!form.date || !form.start_time || !calculatedEndTime || !form.auditorium_id) return false;
    const newStart = new Date(`${form.date}T${form.start_time}:00`).getTime();
    const newEnd = new Date(`${form.date}T${calculatedEndTime}:00`).getTime();
    if (isNaN(newStart) || isNaN(newEnd)) return false;

    return showtimes.some((st) => {
      if (form.id && st.id === form.id) return false;
      if (st.auditorium_id !== form.auditorium_id) return false;
      const stStart = new Date(st.starts_at).getTime();
      const stEnd = new Date(st.ends_at).getTime();
      return Math.max(newStart, stStart) < Math.min(newEnd, stEnd);
    });
  }, [form.date, form.start_time, calculatedEndTime, form.auditorium_id, form.id, showtimes]);

  const conflictCount = showtimes.filter(checkOverlap).length;

  // QUICK BATCH SCHEDULING LOGIC (TẠO SUẤT CHIẾU THEO RULE)
  const handleOpenQuickBatchModal = () => {
    // Mặc định chọn tất cả phim
    setSelectedQuickMovieIds(movies.map((m) => m.id));
    // Mặc định chọn tất cả phòng
    setSelectedQuickAuditoriumIds(auditoriums.map((a) => a.id));
    setOnlyCompatibleRooms(true);
    setAllow2DInImax(false);
    setScheduleDuration('1_DAY');
    setQuickStartDate(selectedDate);
    setApplyAllWeekdays(true);
    setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0]);
    setQuickOperatingStart('08:00');
    setQuickOperatingEnd('00:30');
    setQuickCleaningBuffer(15);
    setQuickTrailerMinutes(10);
    setStaggerRooms(true);
    setStaggerSameMovie(true);
    setAutoShiftConflicts(true);
    setPublishStatus('open');
    setIsPreviewDrawerOpen(false);
    setQuickBatchModalOpen(true);
  };

  // Danh sách phòng chiếu sau khi áp dụng bộ lọc tương thích
  const filteredAuditoriumsForBatch = React.useMemo(() => {
    if (!onlyCompatibleRooms || selectedQuickMovieIds.length === 0) {
      return auditoriums;
    }
    const chosenMovies = movies.filter((m) => selectedQuickMovieIds.includes(m.id));
    return auditoriums.filter((aud) => {
      return chosenMovies.some((m) => isMovieCompatibleWithAuditorium(m, aud, allow2DInImax));
    });
  }, [auditoriums, movies, selectedQuickMovieIds, onlyCompatibleRooms, allow2DInImax]);

  // Thuật toán sinh danh sách suất chiếu dự kiến theo hệ thống Business Rules (generatedQuickSlots)
  const generatedQuickSlots = React.useMemo(() => {
    if (selectedQuickMovieIds.length === 0 || selectedQuickAuditoriumIds.length === 0) {
      return [];
    }

    const totalDays = scheduleDuration === '1_DAY' ? 1 : scheduleDuration === '7_DAYS' ? 7 : 30;

    const [startH, startM] = (quickOperatingStart || '08:00').split(':').map(Number);
    const [endH, endM] = (quickOperatingEnd || '00:30').split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return [];

    const startMinutesOfDay = startH * 60 + startM;
    let endMinutesOfDay = endH * 60 + endM;
    if (endMinutesOfDay <= startMinutesOfDay) {
      endMinutesOfDay += 24 * 60; // Ca chiếu kéo dài qua nửa đêm
    }

    const selectedMovies = movies.filter((m) => selectedQuickMovieIds.includes(m.id));
    const selectedAuds = auditoriums.filter((a) => selectedQuickAuditoriumIds.includes(a.id));

    // Helper phân loại phim theo Rule
    const getMovieRuleProfile = (m: Movie) => {
      const isBlockbuster = Boolean(m.is_blockbuster || m.tier === 'BLOCKBUSTER' || (m.imdb_score && m.imdb_score >= 8.5));
      const isFamily = m.age_rating === 'P' || m.age_rating === 'K' || Boolean(m.genres && m.genres.some((g) => ['hoạt hình', 'gia đình', 'kids', 'family', 'animation'].includes(g.name.toLowerCase())));
      const isHorror = Boolean(m.genres && m.genres.some((g) => g.name.toLowerCase().includes('kinh dị') || g.name.toLowerCase().includes('horror')));
      const isAdult = m.age_rating === 'T18';
      const isLong = (m.duration_minutes || 0) >= 150;
      const isEvent = m.tier === 'EVENT';
      const isNiche = m.tier === 'NICHE';
      return { isBlockbuster, isFamily, isHorror, isAdult, isLong, isEvent, isNiche };
    };

    const slots: Array<{
      movieId: string;
      movieTitle: string;
      movieDuration: number;
      trailerMinutes: number;
      movieFormat: string;
      auditoriumId: string;
      auditoriumName: string;
      auditoriumScreenType: string;
      dateStr: string;
      startTimeStr: string;
      endTimeStr: string;
      startsAt: Date;
      endsAt: Date;
      isConflict: boolean;
      conflictReason?: string;
      ruleTags: string[];
      isBlockbuster: boolean;
      isFamily: boolean;
      isHorror: boolean;
    }> = [];

    // Ưu tiên xếp phòng lớn và phòng IMAX trước để tối ưu phim bom tấn
    const sortedAuds = [...selectedAuds].sort((a, b) => {
      if (a.screen_type === 'IMAX' && b.screen_type !== 'IMAX') return -1;
      if (b.screen_type === 'IMAX' && a.screen_type !== 'IMAX') return 1;
      return (b.total_seats || 0) - (a.total_seats || 0);
    });

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDayDate = new Date(`${quickStartDate}T00:00:00`);
      currentDayDate.setDate(currentDayDate.getDate() + dayOffset);
      const dayOfWeek = currentDayDate.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7

      if (!applyAllWeekdays && !selectedWeekdays.includes(dayOfWeek)) {
        continue;
      }

      const isWeekend = [5, 6, 0].includes(dayOfWeek); // T6, T7, CN
      const currentDayStr = currentDayDate.toISOString().split('T')[0];

      // Theo dõi lịch bắt đầu của các phim trong ngày để hỗ trợ Rule Staggering (giãn giờ cùng phim)
      const dayMovieStarts: Array<{ movieId: string; startMin: number }> = [];

      sortedAuds.forEach((aud, audIndex) => {
        const compatibleMovies = selectedMovies.filter((m) => isMovieCompatibleWithAuditorium(m, aud, allow2DInImax));
        if (compatibleMovies.length === 0) return;

        const existingRoomShowtimes = showtimes.filter((st) => {
          return st.auditorium_id === aud.id && isShowtimeInBusinessDay(st, currentDayStr);
        });

        // Rule: Tránh dồn khách toàn cụm rạp: So le 10–15 phút giữa các phòng
        const clusterStaggerOffset = staggerRooms ? (audIndex * 15) % 45 : 0;
        let currentMin = startMinutesOfDay + clusterStaggerOffset;

        const movieUsageCount: Record<string, number> = {};
        compatibleMovies.forEach((m) => {
          movieUsageCount[m.id] = 0;
        });

        let loopGuard = 0;

        while (loopGuard < 25) {
          loopGuard++;

          if (currentMin + 60 > endMinutesOfDay) {
            break;
          }

          // Xác định khung giờ hiện tại trong ngày
          const timeOfDayMin = currentMin % 1440;
          const isMorning = timeOfDayMin < 11 * 60 + 30; // 08:00 - 11:30
          const isAfternoon = timeOfDayMin >= 11 * 60 + 30 && timeOfDayMin < 17 * 60 + 30; // 11:30 - 17:30
          const isPeakEvening = timeOfDayMin >= 17 * 60 + 30 && timeOfDayMin < 22 * 60; // 17:30 - 22:00 (Giờ vàng)
          const isLateNight = timeOfDayMin >= 22 * 60 || currentMin >= 1440; // Sau 22:00

          // Lọc danh sách phim hợp lệ cho khung giờ theo Rule
          let candidatePool = compatibleMovies.filter((m) => {
            const prof = getMovieRuleProfile(m);

            // Rule: Phim kinh dị ít hoặc không xếp suất sáng
            if (isMorning && prof.isHorror) return false;

            // Rule: Phim gia đình hạn chế suất muộn sau 20:30
            if ((isLateNight || timeOfDayMin >= 20 * 60 + 30) && prof.isFamily) return false;

            // Rule: Phim giới hạn tuổi T18 ưu tiên sau 18:00
            if (isMorning && prof.isAdult) return false;

            // Rule: Phim dài trên 150p không tạo suất bắt đầu quá muộn
            if (prof.isLong && currentMin + (m.duration_minutes || 150) + 15 > endMinutesOfDay) return false;

            // Rule: Phim ít khách (Niche) ngày thường giảm suất, chỉ chiếu 1-3 suất/ngày giờ thấp điểm
            if (prof.isNiche && (movieUsageCount[m.id] || 0) >= 2) return false;
            if (prof.isNiche && isPeakEvening) return false; // Không xếp Niche vào giờ vàng tối

            return true;
          });

          if (candidatePool.length === 0) {
            candidatePool = compatibleMovies;
          }

          // Sắp xếp ưu tiên phim trong khung giờ
          const sortedCandidates = [...candidatePool].sort((a, b) => {
            const profA = getMovieRuleProfile(a);
            const profB = getMovieRuleProfile(b);

            // Ưu tiên 1: Khung giờ vàng tối (17:30 - 22:00) hoặc Phòng IMAX -> Bom Tấn lên hàng đầu
            if (isPeakEvening || aud.screen_type === 'IMAX') {
              if (profA.isBlockbuster && !profB.isBlockbuster) return -1;
              if (profB.isBlockbuster && !profA.isBlockbuster) return 1;
            }

            // Ưu tiên 2: Cuối tuần / Ban ngày -> Phim Gia Đình / Hoạt Hình
            if ((isWeekend || isMorning) && !isPeakEvening) {
              if (profA.isFamily && !profB.isFamily) return -1;
              if (profB.isFamily && !profA.isFamily) return 1;
            }

            // Ưu tiên 3: Tối & Đêm -> Phim Kinh Dị & Phim T18
            if ((isPeakEvening || isLateNight) && !isMorning) {
              if (profA.isHorror && !profB.isHorror) return -1;
              if (profB.isHorror && !profA.isHorror) return 1;
              if (profA.isAdult && !profB.isAdult) return -1;
              if (profB.isAdult && !profA.isAdult) return 1;
            }

            // Luân phiên chia đều số suất giữa các phim
            return (movieUsageCount[a.id] || 0) - (movieUsageCount[b.id] || 0);
          });

          // Rule: Giãn giờ cùng phim (Staggering cùng phim chiếu nhiều phòng)
          let movie = sortedCandidates[0] || compatibleMovies[0];
          if (staggerSameMovie && sortedCandidates.length > 1) {
            const conflictRecent = dayMovieStarts.find((item) => {
              const diff = Math.abs(item.startMin - currentMin);
              const minGap = getMovieRuleProfile(movie).isBlockbuster ? 25 : 45;
              return item.movieId === movie.id && diff < minGap;
            });
            if (conflictRecent && sortedCandidates[1]) {
              movie = sortedCandidates[1];
            }
          }

          const duration = movie.duration_minutes || 120;
          const trailer = quickTrailerMinutes || 10;
          const buffer = quickCleaningBuffer || 15;
          const showDuration = duration + trailer; // Thời lượng suất = trailer + phim

          // Rule: Không tạo suất kết thúc sau giờ đóng rạp
          if (currentMin + showDuration > endMinutesOfDay) {
            break;
          }

          const startDayOffset = Math.floor(currentMin / 1440);
          const startMinuteInDay = currentMin % 1440;
          const curStartH = Math.floor(startMinuteInDay / 60);
          const curStartM = startMinuteInDay % 60;

          const slotStartDate = new Date(`${quickStartDate}T00:00:00`);
          slotStartDate.setDate(slotStartDate.getDate() + dayOffset + startDayOffset);
          slotStartDate.setHours(curStartH, curStartM, 0, 0);

          const slotEndDate = new Date(slotStartDate.getTime() + showDuration * 60000);

          const startStr = `${String(curStartH).padStart(2, '0')}:${String(curStartM).padStart(2, '0')}`;
          const endStr = `${String(slotEndDate.getHours()).padStart(2, '0')}:${String(slotEndDate.getMinutes()).padStart(2, '0')}`;

          const slotStartMs = slotStartDate.getTime();
          const slotEndWithBufferMs = slotEndDate.getTime() + buffer * 60000;

          // Rule: Kiểm tra xung đột với suất đã có và vé đã bán
          const conflictingShowtimes = existingRoomShowtimes.filter((st) => {
            const stStart = new Date(st.starts_at).getTime();
            const stEnd = new Date(st.ends_at).getTime();
            return Math.max(slotStartMs, stStart) < Math.min(slotEndWithBufferMs, stEnd);
          });

          if (conflictingShowtimes.length > 0) {
            // Rule: Vé đã bán / Suất cố định: Không tự dời hoặc sửa. Tự tìm slot trống gần nhất (Auto-shift)
            if (autoShiftConflicts) {
              const maxConflictEndMs = Math.max(...conflictingShowtimes.map((st) => new Date(st.ends_at).getTime()));
              const shiftMinutes = Math.ceil((maxConflictEndMs - slotStartMs) / 60000) + buffer;
              const nextAvailableMin = currentMin + shiftMinutes;

              if (nextAvailableMin + showDuration <= endMinutesOfDay) {
                currentMin = nextAvailableMin;
                continue; // Xếp slot kế tiếp không bị trùng
              }
            }

            // Nếu không thể shift mà không vượt giờ đóng rạp -> Đánh dấu xung đột
            slots.push({
              movieId: movie.id,
              movieTitle: movie.title,
              movieDuration: duration,
              trailerMinutes: trailer,
              movieFormat: aud.screen_type === 'IMAX' ? (movie.formats?.includes('IMAX') ? 'IMAX' : '2D') : '2D',
              auditoriumId: aud.id,
              auditoriumName: aud.name,
              auditoriumScreenType: aud.screen_type,
              dateStr: currentDayStr,
              startTimeStr: startStr,
              endTimeStr: endStr,
              startsAt: slotStartDate,
              endsAt: slotEndDate,
              isConflict: true,
              conflictReason: 'Trùng lịch suất chiếu hiện có trong phòng',
              ruleTags: ['⚠️ Xung đột lịch phòng'],
              isBlockbuster: getMovieRuleProfile(movie).isBlockbuster,
              isFamily: getMovieRuleProfile(movie).isFamily,
              isHorror: getMovieRuleProfile(movie).isHorror
            });
            break;
          }

          // Gán nhãn các Rule thông minh đã kích hoạt
          const ruleTags: string[] = [];
          const profile = getMovieRuleProfile(movie);

          if (profile.isBlockbuster) ruleTags.push('🔥 Bom tấn');
          if (isPeakEvening && profile.isBlockbuster) ruleTags.push('⭐ Giờ vàng tối');
          if (profile.isFamily) ruleTags.push('👨‍👩‍👧 Gia đình');
          if (profile.isHorror) ruleTags.push('👻 Suất tối kinh dị');
          if (profile.isAdult) ruleTags.push('🔞 T18 (Kiểm tra tuổi)');
          if (profile.isLong) ruleTags.push('⏱️ Phim dài >150p');
          if (aud.screen_type === 'IMAX') ruleTags.push('IMAX Laser');
          if (clusterStaggerOffset > 0) ruleTags.push('⏳ Lệch 15p chống dồn');
          if (profile.isNiche) ruleTags.push('🎞️ Giờ thấp điểm');
          if (profile.isEvent) ruleTags.push('🎤 Suất sự kiện');

          const chosenFormat = aud.screen_type === 'IMAX'
            ? (movie.formats?.includes('IMAX') ? 'IMAX' : '2D')
            : '2D';

          slots.push({
            movieId: movie.id,
            movieTitle: movie.title,
            movieDuration: duration,
            trailerMinutes: trailer,
            movieFormat: chosenFormat,
            auditoriumId: aud.id,
            auditoriumName: aud.name,
            auditoriumScreenType: aud.screen_type,
            dateStr: currentDayStr,
            startTimeStr: startStr,
            endTimeStr: endStr,
            startsAt: slotStartDate,
            endsAt: slotEndDate,
            isConflict: false,
            ruleTags,
            isBlockbuster: profile.isBlockbuster,
            isFamily: profile.isFamily,
            isHorror: profile.isHorror
          });

          dayMovieStarts.push({ movieId: movie.id, startMin: currentMin });
          movieUsageCount[movie.id] = (movieUsageCount[movie.id] || 0) + 1;
          currentMin += showDuration + buffer;
        }
      });
    }

    return slots;
  }, [
    selectedQuickMovieIds,
    selectedQuickAuditoriumIds,
    scheduleDuration,
    quickStartDate,
    applyAllWeekdays,
    selectedWeekdays,
    quickOperatingStart,
    quickOperatingEnd,
    quickCleaningBuffer,
    quickTrailerMinutes,
    allow2DInImax,
    staggerRooms,
    staggerSameMovie,
    autoShiftConflicts,
    movies,
    auditoriums,
    showtimes
  ]);

  // Danh sách các suất hợp lệ có thể tạo
  const validQuickSlots = React.useMemo(() => {
    return generatedQuickSlots.filter((s) => !s.isConflict);
  }, [generatedQuickSlots]);

  // Thực thi tạo suất chiếu hàng loạt theo Rule
  const handleExecuteQuickBatch = async () => {
    if (validQuickSlots.length === 0) {
      showToast('Không có suất chiếu hợp lệ nào để tạo!');
      return;
    }

    setIsSubmitting(true);
    try {
      const defaultPrices: Partial<ShowtimePrice>[] = [
        { seat_type: 'STANDARD', audience_type: 'ADULT', price: 85000, currency: 'VND' },
        { seat_type: 'STANDARD', audience_type: 'STUDENT_U22', price: 65000, currency: 'VND' },
        { seat_type: 'STANDARD', audience_type: 'CHILD', price: 55000, currency: 'VND' },
        { seat_type: 'VIP', audience_type: 'ADULT', price: 105000, currency: 'VND' },
        { seat_type: 'VIP', audience_type: 'STUDENT_U22', price: 85000, currency: 'VND' },
        { seat_type: 'COUPLE', audience_type: 'ADULT', price: 210000, currency: 'VND' }
      ];

      for (const slot of validQuickSlots) {
        const movieObj = movies.find((m) => m.id === slot.movieId);
        await onSaveShowtime(
          {
            movie_id: slot.movieId,
            auditorium_id: slot.auditoriumId,
            format: slot.movieFormat,
            language_version: movieObj?.language || 'Phụ đề Tiếng Việt',
            starts_at: slot.startsAt.toISOString(),
            ends_at: slot.endsAt.toISOString(),
            status: publishStatus // 'open' hoặc 'draft' theo rule
          },
          defaultPrices
        );
      }

      const statusText = publishStatus === 'open' ? 'Mở bán ngay' : 'Bản nháp';
      showToast(`Đã tự động tạo thành công ${validQuickSlots.length} suất chiếu theo Rule (${statusText})!`);
      setQuickBatchModalOpen(false);
    } catch (err: any) {
      showToast('Lỗi khi tạo suất hàng loạt: ' + (err.message || 'Thử lại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`space-y-2 animate-in fade-in duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#0A0D14] p-4 flex flex-col' : ''
      }`}
    >
      {/* Top Action Bar & Date Selector: Cố định trên 1 hàng duy nhất, các nút không bao giờ nhảy vị trí */}
      <div className="flex items-center justify-between gap-2.5 border-b border-[#222B3D] pb-2 text-xs shrink-0 w-full">
        {/* Nhóm Trái: Ribbon chọn ngày - Tự co giãn và cuộn nội bộ khi không gian hẹp */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar pr-1">
          <CalendarDays className="w-3.5 h-3.5 text-[#8E9AAF] mr-0.5 shrink-0" />
          {nextDays.map((d) => (
            <button
              key={d.dateStr}
              onClick={() => setSelectedDate(d.dateStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedDate === d.dateStr
                  ? 'bg-[#E63845] text-white shadow-md'
                  : 'bg-[#141924] text-[#8E9AAF] hover:text-white hover:bg-[#1D2536]'
              }`}
            >
              {d.label}
            </button>
          ))}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#141924] border border-[#222B3D] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#E63845] shrink-0"
          />
        </div>

        {/* Nhóm Phải: Bộ Lọc Phòng + Nút Mở Rộng / Toàn Màn Hình + Tạo Suất Chiếu Nhanh (LUÔN CỐ ĐỊNH GÓC PHẢI) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bộ Lọc Nhanh Phòng & Trạng Thái Xung Đột */}
          <div className="flex items-center gap-1 shrink-0 bg-[#0E121B] p-0.5 rounded-lg border border-[#1E2638]">
            <button
              onClick={() => setRoomFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                roomFilter === 'ALL' ? 'bg-[#1E2638] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              Tất cả ({auditoriums.length})
            </button>
            <button
              onClick={() => setRoomFilter('2D')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                roomFilter === '2D' ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30' : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              2D
            </button>
            <button
              onClick={() => setRoomFilter('IMAX')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                roomFilter === 'IMAX' ? 'bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/30' : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              IMAX
            </button>
            {conflictCount > 0 && (
              <button
                onClick={() => setRoomFilter(roomFilter === 'CONFLICT' ? 'ALL' : 'CONFLICT')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 animate-pulse ${
                  roomFilter === 'CONFLICT'
                    ? 'bg-[#EF4444] text-white shadow'
                    : 'bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30'
                }`}
                title="Click để lọc ngay các phòng có suất chiếu bị trùng"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{conflictCount} Xung đột</span>
              </button>
            )}
          </div>

          {/* Nút Mở Rộng / Thu Gọn (Cố định vị trí không nhảy khi bấm) */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              isFullscreen
                ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] shadow-md shadow-[#06B6D4]/20'
                : 'bg-[#141924] border-[#222B3D] text-[#8E9AAF] hover:text-white hover:border-[#384663]'
            }`}
            title={isFullscreen ? 'Thu nhỏ về giao diện quản trị bình thường' : 'Mở rộng toàn màn hình bảng suất chiếu (không vướng sidebar)'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Thu Gọn</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Mở Rộng</span>
              </>
            )}
          </button>

          {/* Nút Tạo Suất Chiếu Nhanh */}
          <button
            type="button"
            onClick={handleOpenQuickBatchModal}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#E63845] to-[#F43F5E] hover:from-[#D42B38] hover:to-[#E11D48] text-white text-xs font-bold shadow-md shadow-[#E63845]/25 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title="Tự động xếp chuỗi suất chiếu trong ngày hoặc sao chép lịch từ ngày khác"
          >
            <Zap className="w-3.5 h-3.5 fill-current text-white shrink-0" />
            <span className="whitespace-nowrap">Tạo Suất Chiếu Nhanh</span>
          </button>
        </div>
      </div>

      {/* VISUAL TIMELINE MATRIX (GIAO DIỆN MA TRẬN 100% FLUID - ĐỦ 8H-24H KHÔNG CUỘN NGANG) */}
      <div
        className={`bg-[#121622] border border-[#222B3D] rounded-2xl overflow-hidden shadow-2xl flex flex-col ${
          isFullscreen ? 'flex-1' : 'h-[calc(100vh-140px)] min-h-[460px]'
        }`}
      >
        {/* Timeline Scroll Container: Chỉ cuộn dọc nội bộ khi nhiều phòng, KHÔNG cuộn ngang */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar w-full">
          <div className="w-full">
            {/* Timeline Header (Time slots: 08:00 - 03:00 sáng) - Ghim cố định ở đỉnh khi cuộn dọc */}
            <div className="flex border-b border-[#222B3D] bg-[#0E121B] sticky top-0 z-20 shadow-md w-full">
              {/* Giao điểm góc trên bên trái: Ghim cả 2 chiều */}
              <div className="w-32 md:w-36 shrink-0 px-2 py-1.5 text-xs font-bold text-[#8E9AAF] border-r border-[#222B3D] bg-[#0A0D14] sticky left-0 z-30 flex items-center justify-between">
                <span>Phòng Chiếu</span>
                <span className="text-[10px] text-[#FABF2E] font-mono">08h-03h</span>
              </div>

              {/* 19 khoảng giờ từ 08:00 đến 03:00 sáng chia đều 100% chiều rộng */}
              <div className="flex-1 flex w-full relative">
                {timelineHours.map((hour) => {
                  const isLateNight = hour >= 24;
                  return (
                    <div
                      key={hour}
                      className={`flex-1 border-r border-[#1C2433] px-0.5 py-1.5 text-center text-[10px] font-mono font-semibold truncate ${
                        isLateNight ? 'text-[#FABF2E] bg-[#FABF2E]/5' : 'text-[#8E9AAF]'
                      }`}
                      title={isLateNight ? `Suất khuya rạng sáng ${getTimelineHourLabel(hour)}` : undefined}
                    >
                      {getTimelineHourLabel(hour)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows for each auditorium */}
            <div className="divide-y divide-[#1D2536] w-full">
              {displayedAuditoriums.map((aud) => {
                const roomShowtimes = showtimes.filter((st) => {
                  return st.auditorium_id === aud.id && isShowtimeInBusinessDay(st, selectedDate);
                });

                return (
                  <div key={aud.id} className="flex relative hover:bg-[#151B27]/40 transition-colors group w-full">
                    {/* Left Room Label */}
                    <div className="w-32 md:w-36 shrink-0 px-2 py-1.5 border-r border-[#222B3D] bg-[#121622] sticky left-0 z-20 flex flex-col justify-center shadow-sm">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5 truncate">
                        <Armchair className="w-3.5 h-3.5 text-[#E63845] shrink-0" />
                        <span className="truncate">{aud.name}</span>
                      </div>
                      <div className="text-[10px] text-[#8E9AAF] mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-black uppercase ${
                            aud.screen_type === 'IMAX' ? 'bg-[#FABF2E]/20 text-[#FABF2E]' : 'bg-[#1C2433] text-[#06B6D4]'
                          }`}
                        >
                          {aud.screen_type}
                        </span>
                        <span>• {aud.total_seats} ghế</span>
                      </div>
                    </div>

                    {/* Right Timeline Canvas 100% Fluid Width */}
                    <div className="flex-1 relative h-11 flex items-center w-full overflow-hidden">
                      {/* Background Grid: 19 cột giờ cho click nhanh */}
                      <div className="absolute inset-0 flex pointer-events-auto">
                        {timelineHours.map((hour) => {
                          const isLate = hour >= 24;
                          return (
                            <div
                              key={hour}
                              onClick={() => handleQuickSlotClick(aud.id, hour)}
                              className={`flex-1 border-r border-[#1C2433]/60 hover:bg-[#E63845]/15 cursor-pointer transition-colors relative group/slot ${
                                isLate ? 'bg-[#FABF2E]/[0.02]' : ''
                              }`}
                              title={`Click để xếp suất chiếu mới lúc ${getTimelineHourLabel(hour)} tại ${aud.name}`}
                            >
                              <span className="absolute bottom-0.5 right-0.5 text-[8px] text-[#3E4D68] opacity-0 group-hover/slot:opacity-100 font-mono font-bold">
                                +
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Placed Showtimes as Interactive Compact Blocks */}
                      {roomShowtimes.map((st) => {
                        const movie = st.movie || movies.find((m) => m.id === st.movie_id);
                        const isOverlap = checkOverlap(st);

                        const startDate = new Date(st.starts_at);
                        const endDate = new Date(st.ends_at);

                        let startHours = startDate.getHours() + startDate.getMinutes() / 60;
                        if (startHours < 6) {
                          startHours += 24;
                        }

                        const durationHours = Math.max(0.5, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));

                        // Tọa độ % chính xác từ 08:00 (0%) đến 03:00 sáng hôm sau (100% - 19 tiếng)
                        const leftPercent = Math.max(0, ((startHours - TIMELINE_START_HOUR) / TIMELINE_TOTAL_HOURS) * 100);
                        const widthPercent = Math.min(100 - leftPercent, (durationHours / TIMELINE_TOTAL_HOURS) * 100);

                        const bufferMinutes = aud.cleaning_buffer_minutes || 15;
                        const bufferWidthPercent = ((bufferMinutes / 60) / TIMELINE_TOTAL_HOURS) * 100;

                        const startTimeStr = startDate.toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        const endTimeStr = endDate.toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            key={st.id}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`
                            }}
                            onClick={() => handleOpenEditShowtime(st)}
                            className={`absolute h-8.5 rounded-lg px-1.5 py-0.5 z-10 shadow-md transition-all flex flex-col justify-between overflow-hidden cursor-pointer select-none group/card min-w-[32px] ${
                              isOverlap
                                ? 'bg-[#3B191C] border-2 border-[#EF4444] animate-pulse text-[#EF4444]'
                                : 'bg-gradient-to-r from-[#172233] to-[#141B29] border border-[#2D3F5E] hover:border-[#06B6D4] hover:shadow-cyan-900/40'
                            }`}
                            title={`Bấm để chỉnh sửa: ${movie?.title || 'Phim'} (${startTimeStr} - ${endTimeStr})`}
                          >
                            {/* Top Bar: Title & Format */}
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="font-bold text-white text-[10px] truncate max-w-[75%]">
                                {movie?.title || 'Phim'}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="px-1 py-0.2 rounded text-[7px] font-black bg-[#E63845] text-white">
                                  {st.format || '2D'}
                                </span>
                                {isOverlap && (
                                  <AlertTriangle className="w-2.5 h-2.5 text-[#EF4444] shrink-0" />
                                )}
                              </div>
                            </div>

                            {/* Bottom Bar: Giờ chiếu */}
                            <div className="flex items-center justify-between text-[9px] text-[#8E9AAF] leading-none">
                              <span className="font-mono text-[#06B6D4] font-semibold text-[8.5px] truncate">
                                {startTimeStr} - {endTimeStr}
                              </span>

                              <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPricingMatrix(st);
                                  }}
                                  className="p-0.5 rounded bg-[#253247] hover:bg-[#FABF2E] hover:text-black text-white transition-all cursor-pointer"
                                  title="Chỉnh bảng giá vé"
                                >
                                  <DollarSign className="w-2 h-2" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmShowtime({
                                      id: st.id,
                                      title: movie?.title || 'Suất chiếu',
                                      time: `${startTimeStr} - ${endTimeStr}`,
                                      room: aud?.name || 'Phòng chiếu'
                                    });
                                  }}
                                  className="p-0.5 rounded bg-[#253247] hover:bg-[#EF4444] text-[#8E9AAF] hover:text-white transition-all cursor-pointer"
                                  title="Xóa suất"
                                >
                                  <Trash2 className="w-2 h-2" />
                                </button>
                              </div>
                            </div>

                            {/* Cleaning Buffer Stripe Visual (Mép phải thẻ) */}
                            <div
                              style={{ width: `${Math.min(16, bufferWidthPercent * 8)}px` }}
                              className="absolute right-0 top-0 bottom-0 bg-[#06B6D4]/10 border-l border-dashed border-[#06B6D4]/30 pointer-events-none"
                              title={`Đệm dọn rạp ${bufferMinutes} phút`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

          {/* Timeline Bottom Legend - Thu gọn chỉ 1 dòng mỏng */}
          <div className="px-3 py-1.5 bg-[#0E121B] border-t border-[#222B3D] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#8E9AAF] shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded bg-[#172233] border border-[#2D3F5E]" />
                <span>Suất chuẩn</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded bg-[#06B6D4]/20 border border-dashed border-[#06B6D4]" />
                <span>Đệm dọn rạp</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded bg-[#3B191C] border border-[#EF4444]" />
                <span className="text-[#EF4444] font-bold">Xung đột / Trùng</span>
              </div>
            </div>

            <div className="text-[10px] text-[#5C677D]">
              💡 Bấm vào ô trống bất kỳ trên ma trận để xếp suất mới nhanh.
            </div>
          </div>
        </div>

      {/* Modal 0: TẠO SUẤT CHIẾU NHANH THEO FORM TÍCH Ô 4 BƯỚC */}
      {quickBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#121622] border border-[#26334D] rounded-3xl w-full max-w-3xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#222B3D] flex items-center justify-between bg-[#0E121B] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E63845] to-[#F43F5E] flex items-center justify-center text-white shadow-lg shadow-[#E63845]/25">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base tracking-wide uppercase">
                    Tạo Suất Chiếu Nhanh
                  </h3>
                  <p className="text-xs text-[#8E9AAF]">
                    Tự động tính toán và xếp chuỗi suất chiếu hàng loạt theo phòng và thời gian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickBatchModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content cuộn nội bộ */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
              {/* 1. Chọn phim */}
              <div className="space-y-2.5 bg-[#0E121B]/80 border border-[#1E2638] p-4 rounded-2xl">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#1E2638]">
                  <label className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#E63845] text-white text-[11px] font-black flex items-center justify-center">1</span>
                    <span>Chọn phim</span>
                    <span className="text-xs text-[#8E9AAF] font-normal">
                      (Đã chọn {selectedQuickMovieIds.length}/{movies.length})
                    </span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedQuickMovieIds(movies.map((m) => m.id))}
                      className="text-[#06B6D4] hover:underline cursor-pointer font-semibold"
                    >
                      [Chọn tất cả]
                    </button>
                    <span className="text-[#3A4760]">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedQuickMovieIds([])}
                      className="text-[#8E9AAF] hover:text-white cursor-pointer"
                    >
                      [Bỏ chọn]
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {movies.map((m) => {
                    const isChecked = selectedQuickMovieIds.includes(m.id);
                    const mFormats = m.formats && m.formats.length > 0 ? m.formats.join(' / ') : '2D';
                    const isBlockbuster = Boolean(m.is_blockbuster || m.tier === 'BLOCKBUSTER' || (m.imdb_score && m.imdb_score >= 8.5));
                    const isFamily = m.age_rating === 'P' || m.age_rating === 'K' || Boolean(m.genres && m.genres.some((g) => ['hoạt hình', 'gia đình', 'kids', 'family'].includes(g.name.toLowerCase())));
                    const isHorror = Boolean(m.genres && m.genres.some((g) => g.name.toLowerCase().includes('kinh dị') || g.name.toLowerCase().includes('horror')));

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedQuickMovieIds((prev) =>
                            prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-[#152336] border-[#06B6D4]/60 shadow-sm text-white'
                            : 'bg-[#141924] border-[#222B3D] text-[#8E9AAF] hover:bg-[#1A2232] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 accent-[#E63845] rounded cursor-pointer pointer-events-none shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs truncate text-white" title={m.title}>
                                {m.title}
                              </span>
                              {isBlockbuster && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-gradient-to-r from-[#E63845] to-[#F59E0B] text-white flex items-center gap-0.5 shrink-0">
                                  <Flame className="w-2.5 h-2.5 fill-current" />
                                  <span>Bom tấn</span>
                                </span>
                              )}
                              {isFamily && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30 shrink-0">
                                  Gia đình
                                </span>
                              )}
                              {isHorror && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/30 shrink-0">
                                  Kinh dị
                                </span>
                              )}
                              {m.age_rating === 'T18' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#EF4444]/20 text-[#F87171] border border-[#EF4444]/30 shrink-0">
                                  T18
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[11px]">
                          <span className="text-[#8E9AAF]">{m.duration_minutes} phút</span>
                          <span className="text-[#5C677D]">|</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-[#1C2536] text-[#06B6D4] border border-[#28354A]">
                            {mFormats}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Chọn phòng chiếu */}
              <div className="space-y-2.5 bg-[#0E121B]/80 border border-[#1E2638] p-4 rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#1E2638]">
                  <label className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#E63845] text-white text-[11px] font-black flex items-center justify-center">2</span>
                    <span>Chọn phòng chiếu</span>
                    <span className="text-xs text-[#8E9AAF] font-normal">
                      (Đã chọn {selectedQuickAuditoriumIds.length}/{filteredAuditoriumsForBatch.length})
                    </span>
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 text-[#FABF2E] cursor-pointer font-medium select-none">
                      <input
                        type="checkbox"
                        checked={onlyCompatibleRooms}
                        onChange={(e) => setOnlyCompatibleRooms(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#FABF2E] rounded cursor-pointer"
                      />
                      <span>Chỉ hiện phòng tương thích với phim đã chọn</span>
                    </label>
                    <span className="text-[#3A4760]">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedQuickAuditoriumIds(filteredAuditoriumsForBatch.map((a) => a.id))}
                      className="text-[#06B6D4] hover:underline cursor-pointer font-semibold"
                    >
                      [Chọn tất cả]
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQuickAuditoriumIds([])}
                      className="text-[#8E9AAF] hover:text-white cursor-pointer"
                    >
                      [Bỏ chọn]
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  {filteredAuditoriumsForBatch.map((aud) => {
                    const isChecked = selectedQuickAuditoriumIds.includes(aud.id);
                    return (
                      <div
                        key={aud.id}
                        onClick={() => {
                          setSelectedQuickAuditoriumIds((prev) =>
                            prev.includes(aud.id) ? prev.filter((id) => id !== aud.id) : [...prev, aud.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-[#152336] border-[#06B6D4]/60 shadow-sm text-white'
                            : 'bg-[#141924] border-[#222B3D] text-[#8E9AAF] hover:bg-[#1A2232] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 accent-[#E63845] rounded cursor-pointer pointer-events-none shrink-0"
                          />
                          <div className="font-bold text-xs truncate text-white">
                            {aud.name} – {aud.screen_type === 'IMAX' ? 'IMAX Laser' : '2D Tiêu chuẩn'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] shrink-0 text-[#8E9AAF]">
                          <span>• {aud.total_seats} ghế</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tùy chọn tương thích nâng cao */}
                <div className="pt-2 border-t border-[#1E2638]/70 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-[#CBD5E1] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allow2DInImax}
                      onChange={(e) => setAllow2DInImax(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#06B6D4] rounded cursor-pointer"
                    />
                    <span>Cho phép xếp phim 2D vào phòng IMAX (nếu phòng trống / phim hot)</span>
                  </label>
                  <span className="text-[11px] text-[#8E9AAF]">Rule tương thích phòng</span>
                </div>
              </div>

              {/* 3. Thời gian tạo lịch */}
              <div className="space-y-3 bg-[#0E121B]/80 border border-[#1E2638] p-4 rounded-2xl">
                <label className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#E63845] text-white text-[11px] font-black flex items-center justify-center">3</span>
                  <span>Thời gian tạo lịch</span>
                </label>

                {/* Radio chọn khoảng thời gian */}
                <div className="flex flex-wrap items-center gap-5 pt-0.5">
                  {[
                    { id: '1_DAY', label: '1 ngày' },
                    { id: '7_DAYS', label: '7 ngày' },
                    { id: '1_MONTH', label: '1 tháng (30 ngày)' }
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-white font-medium select-none">
                      <input
                        type="radio"
                        name="scheduleDurationRadio"
                        value={opt.id}
                        checked={scheduleDuration === opt.id}
                        onChange={() => setScheduleDuration(opt.id as any)}
                        className="w-4 h-4 accent-[#E63845] cursor-pointer"
                      />
                      <span className="text-xs">{opt.label}</span>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Ngày bắt đầu:</label>
                    <input
                      type="date"
                      value={quickStartDate}
                      onChange={(e) => setQuickStartDate(e.target.value)}
                      className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E63845]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-white font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={applyAllWeekdays}
                        onChange={(e) => setApplyAllWeekdays(e.target.checked)}
                        className="w-4 h-4 accent-[#E63845] rounded cursor-pointer"
                      />
                      <span>Áp dụng tất cả các ngày trong tuần</span>
                    </label>

                    {!applyAllWeekdays && (
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        <span className="text-[#8E9AAF] text-[11px] mr-1">hoặc:</span>
                        {[
                          { day: 1, label: 'T2' },
                          { day: 2, label: 'T3' },
                          { day: 3, label: 'T4' },
                          { day: 4, label: 'T5' },
                          { day: 5, label: 'T6' },
                          { day: 6, label: 'T7' },
                          { day: 0, label: 'CN' }
                        ].map((w) => {
                          const isChecked = selectedWeekdays.includes(w.day);
                          return (
                            <button
                              key={w.day}
                              type="button"
                              onClick={() => {
                                setSelectedWeekdays((prev) =>
                                  prev.includes(w.day) ? prev.filter((d) => d !== w.day) : [...prev, w.day]
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-[#E63845] text-white shadow'
                                  : 'bg-[#141924] border border-[#222B3D] text-[#8E9AAF] hover:text-white'
                              }`}
                            >
                              {w.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Cấu hình suất & Smart Rules */}
              <div className="space-y-3 bg-[#0E121B]/80 border border-[#1E2638] p-4 rounded-2xl">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#1E2638]">
                  <label className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#E63845] text-white text-[11px] font-black flex items-center justify-center">4</span>
                    <span>Cấu hình suất & Quy tắc xếp lịch thông minh</span>
                  </label>
                  <span className="text-[11px] text-[#06B6D4] font-medium">Rule Engine tự động</span>
                </div>

                {/* Hàng 1: Giờ hoạt động & Thời lượng buffer/trailer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Giờ hoạt động:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={quickOperatingStart}
                        onChange={(e) => setQuickOperatingStart(e.target.value)}
                        className="flex-1 bg-[#141924] border border-[#222B3D] rounded-xl px-2 py-1.5 text-white font-mono font-bold text-xs"
                      />
                      <span className="text-[#8E9AAF] text-[11px]">đến</span>
                      <input
                        type="time"
                        value={quickOperatingEnd}
                        onChange={(e) => setQuickOperatingEnd(e.target.value)}
                        className="flex-1 bg-[#141924] border border-[#222B3D] rounded-xl px-2 py-1.5 text-white font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Trailer / Quảng cáo:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        step={5}
                        value={quickTrailerMinutes}
                        onChange={(e) => setQuickTrailerMinutes(Number(e.target.value))}
                        className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-1.5 text-white font-mono font-bold text-xs text-center"
                      />
                      <span className="text-[#8E9AAF] text-xs">phút</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-medium text-[11px]">Thời gian dọn phòng:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={10}
                        max={30}
                        step={5}
                        value={quickCleaningBuffer}
                        onChange={(e) => setQuickCleaningBuffer(Number(e.target.value))}
                        className="w-full bg-[#141924] border border-[#222B3D] rounded-xl px-3 py-1.5 text-white font-mono font-bold text-xs text-center"
                      />
                      <span className="text-[#8E9AAF] text-xs">phút</span>
                    </div>
                  </div>
                </div>

                {/* Hàng 2: Các quy tắc chống dồn khách, né xung đột */}
                <div className="p-3 rounded-xl bg-[#131926] border border-[#20293B] space-y-2">
                  <div className="text-[11px] font-bold text-[#FABF2E] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quy tắc vận hành rạp chiếu tự động (Business Rules)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={staggerRooms}
                        onChange={(e) => setStaggerRooms(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#06B6D4] rounded cursor-pointer"
                      />
                      <span>Tránh dồn khách sảnh (So le giờ bắt đầu 10-15p giữa các phòng)</span>
                    </label>

                    <label className="flex items-center gap-2 text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={staggerSameMovie}
                        onChange={(e) => setStaggerSameMovie(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#06B6D4] rounded cursor-pointer"
                      />
                      <span>Giãn giờ cùng phim (Lệch 15-30p với phim hot, 30-60p phim thường)</span>
                    </label>

                    <label className="flex items-center gap-2 text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoShiftConflicts}
                        onChange={(e) => setAutoShiftConflicts(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#22C55E] rounded cursor-pointer"
                      />
                      <span>Tự động né suất trùng / vé đã bán (Auto-shift sang slot trống gần nhất)</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <span className="text-[#8E9AAF] text-[11px]">Trạng thái xuất bản:</span>
                      <label className="flex items-center gap-1.5 text-white cursor-pointer select-none text-xs">
                        <input
                          type="radio"
                          name="publishStatusRadio"
                          value="open"
                          checked={publishStatus === 'open'}
                          onChange={() => setPublishStatus('open')}
                          className="w-3.5 h-3.5 accent-[#22C55E] cursor-pointer"
                        />
                        <span className="text-[#22C55E] font-bold">Mở bán ngay</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-white cursor-pointer select-none text-xs">
                        <input
                          type="radio"
                          name="publishStatusRadio"
                          value="draft"
                          checked={publishStatus === 'draft'}
                          onChange={() => setPublishStatus('draft')}
                          className="w-3.5 h-3.5 accent-[#FABF2E] cursor-pointer"
                        />
                        <span className="text-[#FABF2E] font-bold">Bản nháp (Duyệt sau)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ngăn kéo Xem trước chi tiết các suất chiếu dự kiến theo Rule */}
              {isPreviewDrawerOpen && (
                <div className="p-4 rounded-2xl bg-[#090D15] border border-[#06B6D4]/40 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-[#1E2638] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#06B6D4]" />
                      <h4 className="font-bold text-white text-xs">
                        Xem trước danh sách suất chiếu sinh theo Rule ({generatedQuickSlots.length} suất)
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPreviewDrawerOpen(false)}
                      className="text-xs text-[#8E9AAF] hover:text-white cursor-pointer"
                    >
                      Đóng xem trước ✕
                    </button>
                  </div>

                  {/* Thẻ thống kê KPI thông minh */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-[#121824] border border-[#1E283C]">
                      <div className="text-[10px] text-[#8E9AAF]">Tổng suất hợp lệ</div>
                      <div className="text-base font-black text-[#22C55E]">{validQuickSlots.length}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#121824] border border-[#E63845]/30">
                      <div className="text-[10px] text-[#E63845] font-semibold flex items-center justify-center gap-1">
                        <Flame className="w-3 h-3 fill-current" />
                        <span>Bom tấn (Giờ vàng)</span>
                      </div>
                      <div className="text-base font-black text-[#E63845]">
                        {validQuickSlots.filter((s) => s.isBlockbuster).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#121824] border border-[#10B981]/30">
                      <div className="text-[10px] text-[#34D399]">👨‍👩‍👧 Suất gia đình</div>
                      <div className="text-base font-black text-[#34D399]">
                        {validQuickSlots.filter((s) => s.isFamily).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#121824] border border-[#8B5CF6]/30">
                      <div className="text-[10px] text-[#C4B5FD]">👻 Tối & Kinh dị</div>
                      <div className="text-base font-black text-[#C4B5FD]">
                        {validQuickSlots.filter((s) => s.isHorror).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#121824] border border-[#EF4444]/30">
                      <div className="text-[10px] text-[#EF4444]">⚠️ Xung đột né/bỏ qua</div>
                      <div className="text-base font-black text-[#EF4444]">
                        {generatedQuickSlots.length - validQuickSlots.length}
                      </div>
                    </div>
                  </div>

                  {/* Danh sách suất chiếu chi tiết */}
                  {generatedQuickSlots.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#5C677D]">
                      Chưa có suất chiếu nào được tạo. Vui lòng chọn ít nhất 1 phim và 1 phòng chiếu!
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                      {generatedQuickSlots.map((slot, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                            slot.isConflict
                              ? 'bg-[#3B191C]/40 border-[#EF4444]/40 text-[#EF4444]'
                              : 'bg-[#121824] border-[#1E283C] text-white hover:border-[#2C3B57]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-mono text-[10px] text-[#06B6D4] font-bold">#{idx + 1}</span>
                            <span className="font-bold text-white truncate max-w-[160px]" title={slot.movieTitle}>
                              {slot.movieTitle}
                            </span>
                            <span className="text-[10px] text-[#8E9AAF]">({slot.auditoriumName})</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#E63845] text-white font-bold">{slot.movieFormat}</span>
                            
                            {/* Tags Rule áp dụng */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {slot.ruleTags.slice(0, 3).map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-[#1C2538] border border-[#2B3952] text-[#06B6D4] font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <span className="font-mono text-[11px] text-[#FABF2E] font-bold block">
                                {slot.dateStr} | {slot.startTimeStr} - {slot.endTimeStr}
                              </span>
                              <span className="text-[9px] text-[#8E9AAF]">
                                (Trailer: {slot.trailerMinutes}p + Phim: {slot.movieDuration}p)
                              </span>
                            </div>
                            {slot.isConflict ? (
                              <span className="text-[10px] text-[#EF4444] font-bold flex items-center gap-1 shrink-0">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{slot.conflictReason || 'Trùng!'}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30 font-bold shrink-0">
                                Hợp lệ
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="px-6 py-4 border-t border-[#222B3D] bg-[#0E121B] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsPreviewDrawerOpen(!isPreviewDrawerOpen)}
                className="px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1D2536] border border-[#222B3D] hover:border-[#06B6D4] text-[#06B6D4] font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <Eye className="w-4 h-4" />
                <span>Xem trước: {validQuickSlots.length} suất</span>
                {generatedQuickSlots.length > validQuickSlots.length && (
                  <span className="text-[10px] text-[#EF4444]">
                    (né {generatedQuickSlots.length - validQuickSlots.length} suất trùng)
                  </span>
                )}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuickBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] hover:bg-[#252E42] text-[#8E9AAF] hover:text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || validQuickSlots.length === 0}
                  onClick={handleExecuteQuickBatch}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#E63845] to-[#F43F5E] hover:from-[#D42B38] hover:to-[#E11D48] text-white font-bold text-xs cursor-pointer shadow-lg shadow-[#E63845]/30 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Đang tạo {validQuickSlots.length} suất...</span>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>
                        {publishStatus === 'open'
                          ? `Tạo & Mở Bán ${validQuickSlots.length} Suất Chiếu`
                          : `Lưu ${validQuickSlots.length} Suất Chiếu Bản Nháp`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Add Showtime */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header - Gọn gàng không mô tả thừa */}
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E63845]/15 border border-[#E63845]/30 flex items-center justify-center text-[#E63845]">
                  {form.id ? <Edit3 className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-white text-base">
                  {form.id ? 'Chỉnh Sửa Suất Chiếu' : 'Xếp Lịch Suất Chiếu Mới'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShowtime} className="space-y-4 text-xs">
              {/* PHẦN 1: THÔNG TIN PHÒNG CHIẾU */}
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold text-[11px]">Phòng chiếu</label>

                {isSlotClicked ? (
                  /* Hiển thị cố định dạng thẻ đẹp mắt, tinh gọn */
                  <div className="p-2.5 rounded-xl bg-[#161D2B] border border-[#253247] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#E63845]/15 border border-[#E63845]/30 flex items-center justify-center text-[#E63845] shrink-0">
                        <Armchair className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <span>{selectedModalAuditorium?.name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              selectedModalAuditorium?.screen_type === 'IMAX'
                                ? 'bg-[#FABF2E]/20 text-[#FABF2E]'
                                : 'bg-[#06B6D4]/20 text-[#06B6D4]'
                            }`}
                          >
                            {selectedModalAuditorium?.screen_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8E9AAF] mt-0.5">
                          {selectedModalAuditorium?.total_seats} ghế • Đệm {selectedModalAuditorium?.cleaning_buffer_minutes || 15}p
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsSlotClicked(false)}
                      className="text-[10px] text-[#8E9AAF] hover:text-white underline cursor-pointer"
                    >
                      Đổi phòng
                    </button>
                  </div>
                ) : (
                  /* Khi đổi phòng: CHỈ HIỂN THỊ CÁC PHÒNG CÙNG LOẠI RẠP (IMAX chỉ đổi sang IMAX, 2D chỉ sang 2D) */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8E9AAF]">
                        Phòng chuẩn <strong className="text-white font-bold">{selectedModalAuditorium?.screen_type}</strong> ({compatibleAuditoriums.length} phòng)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSlotClicked(true)}
                        className="text-[10px] text-[#06B6D4] hover:underline cursor-pointer font-medium"
                      >
                        Giữ phòng hiện tại
                      </button>
                    </div>

                    <select
                      required
                      value={form.auditorium_id}
                      onChange={(e) => handleSelectAuditorium(e.target.value)}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-[#E63845]"
                    >
                      {compatibleAuditoriums.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.screen_type} • {a.total_seats} ghế)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* PHẦN 2: CHỌN PHIM CHIẾU & THẺ TÓM TẮT PHIM TINH GỌN (BỎ HẾT MÔ TẢ THỪA) */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="text-[#8E9AAF] font-semibold flex items-center gap-1.5">
                      <span>Phim chiếu</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#E63845]/15 text-[#E63845] border border-[#E63845]/30">
                        Chuẩn {selectedModalAuditorium?.screen_type} ({compatibleMoviesForAuditorium.length})
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setFilterMoviesByRoomType(!filterMoviesByRoomType)}
                      className="text-[10px] text-[#8E9AAF] hover:text-[#06B6D4] underline cursor-pointer"
                    >
                      {filterMoviesByRoomType ? 'Xem tất cả' : `Chỉ xem ${selectedModalAuditorium?.screen_type}`}
                    </button>
                  </div>

                  {displayedModalMovies.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#2D1B1F] border border-[#EF4444]/40 text-xs text-[#EF4444] space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Chưa có phim nào bật định dạng {selectedModalAuditorium?.screen_type}!</span>
                      </div>
                    </div>
                  ) : (
                    <select
                      required
                      value={form.movie_id}
                      onChange={(e) => handleSelectMovie(e.target.value)}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#E63845]"
                    >
                      {displayedModalMovies.map((m) => {
                        const mFormats = m.formats && m.formats.length > 0 ? m.formats.join('/') : '2D';
                        return (
                          <option key={m.id} value={m.id}>
                            {m.title} ({m.duration_minutes}p • {m.age_rating}) — [{mFormats}]
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Thẻ Phim Tinh Gọn: Chỉ giữ Poster, Tên, Thời lượng & Định dạng */}
                {selectedModalMovie && (
                  <div className="p-2.5 rounded-xl bg-[#141A26] border border-[#222E42] flex gap-3 items-center">
                    {/* Poster Phim */}
                    <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-[#1A1F2C] border border-[#2A344A] shrink-0">
                      <img
                        src={
                          selectedModalMovie.poster_url ||
                          'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'
                        }
                        alt={selectedModalMovie.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-black bg-black/85 text-[#FABF2E] border border-[#FABF2E]/30">
                        {selectedModalMovie.age_rating}
                      </span>
                      {selectedModalMovie.imdb_score && (
                        <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded text-[7px] font-black bg-black/85 text-[#FABF2E] flex items-center gap-0.5">
                          <Star className="w-2 h-2 fill-[#FABF2E]" />
                          {selectedModalMovie.imdb_score}
                        </span>
                      )}
                    </div>

                    {/* Khung Thông Tin Cốt Lõi */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-white text-sm truncate" title={selectedModalMovie.title}>
                          {selectedModalMovie.title}
                        </h4>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                            selectedModalMovie.status === 'now_showing'
                              ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                              : 'bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30'
                          }`}
                        >
                          {selectedModalMovie.status === 'now_showing' ? 'Đang Chiếu' : 'Sắp Chiếu'}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#8E9AAF] flex items-center gap-2">
                        <span>Thời lượng: <strong className="text-[#06B6D4]">{selectedModalMovie.duration_minutes} phút</strong></span>
                        {selectedModalMovie.genres && selectedModalMovie.genres.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="truncate">{selectedModalMovie.genres.map((g: any) => g.name).join(', ')}</span>
                          </>
                        )}
                      </div>

                      {/* Định dạng hỗ trợ đối chiếu với phòng chiếu */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-[#8E9AAF]">Định dạng:</span>
                        {(selectedModalMovie.formats && selectedModalMovie.formats.length > 0
                          ? selectedModalMovie.formats
                          : ['2D']
                        ).map((fmt) => {
                          const isMatch = fmt.toUpperCase().includes((selectedModalAuditorium?.screen_type || '2D').toUpperCase());
                          return (
                            <span
                              key={fmt}
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold flex items-center gap-1 ${
                                isMatch
                                  ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 font-black'
                                  : 'bg-[#1C2536] text-[#8E9AAF] border border-[#28354A]'
                              }`}
                            >
                              {isMatch && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              <span>{fmt}</span>
                            </span>
                          );
                        })}

                        {!isMovieCompatibleWithAuditorium(selectedModalMovie, selectedModalAuditorium) && (
                          <span className="text-[10px] text-[#EF4444] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Thiếu bản {selectedModalAuditorium?.screen_type}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PHẦN 3: NGÀY & GIỜ CHIẾU */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold text-[11px]">Ngày chiếu</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold text-[11px]">Giờ bắt đầu</label>
                  <input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              {/* PHẦN 4: DỰ KIẾN KẾT THÚC & TRẠNG THÁI KHUNG GIỜ (GỌN GÀNG 1 DÒNG) */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  previewConflict
                    ? 'bg-[#3B191C]/60 border-[#EF4444] text-[#EF4444]'
                    : 'bg-[#14202E]/60 border-[#22354F] text-[#8E9AAF]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 shrink-0 ${previewConflict ? 'text-[#EF4444]' : 'text-[#06B6D4]'}`} />
                  <span className="font-semibold text-white text-xs">
                    Suất chiếu: <span className="text-[#06B6D4] font-mono font-bold">{form.start_time} ➔ {calculatedEndTime}</span>
                  </span>
                </div>

                {previewConflict ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Trùng lịch!</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" />
                    <span>Khung giờ trống</span>
                  </span>
                )}
              </div>

              {/* TÙY CHỌN NÂNG CAO (MẶC ĐỊNH ẨN ĐỂ KHÔNG PHẢI SỬA GÌ THÊM) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-[11px] text-[#8E9AAF] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{showAdvancedOptions ? '▾ Thu gọn tùy chỉnh' : '▸ Tùy chỉnh nâng cao (Định dạng & Ngôn ngữ)'}</span>
                </button>

                {showAdvancedOptions && (
                  <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in">
                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] text-[10px]">Định dạng chiếu</label>
                      <select
                        value={form.format}
                        onChange={(e) => setForm({ ...form, format: e.target.value })}
                        className="w-full bg-[#171D2B] border border-[#253045] rounded-lg px-2.5 py-1.5 text-white"
                      >
                        <option value="2D">2D Digital</option>
                        <option value="3D">3D RealD</option>
                        <option value="IMAX">IMAX Laser</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] text-[10px]">Phiên bản ngôn ngữ</label>
                      <input
                        type="text"
                        value={form.language_version}
                        onChange={(e) => setForm({ ...form, language_version: e.target.value })}
                        className="w-full bg-[#171D2B] border border-[#253045] rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ACTIONS FOOTER */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222B3D]">
                {form.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setDeleteConfirmShowtime({
                        id: form.id,
                        title: selectedModalMovie?.title || 'Suất chiếu',
                        time: `${form.start_time} ➔ ${calculatedEndTime}`,
                        room: selectedModalAuditorium?.name || 'Phòng chiếu'
                      });
                    }}
                    className="mr-auto px-3.5 py-2 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Suất Này</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] hover:bg-[#252E42] text-[#8E9AAF] hover:text-white font-bold cursor-pointer transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white font-bold cursor-pointer shadow-lg shadow-[#E63845]/30 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Đang Lưu...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{form.id ? 'Lưu Thay Đổi' : 'Xác Nhận Xếp Suất'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Multidimensional Pricing Matrix */}
      {pricingModalShowtime && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#FABF2E]" />
                  <span>Cấu Hình Ma Trận Giá Vé Đa Tầng (Showtime Prices)</span>
                </h3>
                <p className="text-xs text-[#8E9AAF]">
                  Suất: {pricingModalShowtime.movie?.title} • {pricingModalShowtime.auditorium?.name}
                </p>
              </div>
              <button
                onClick={() => setPricingModalShowtime(null)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2D Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222B3D] text-[#8E9AAF]">
                    <th className="py-2.5 px-3 font-bold">Loại Ghế \ Đối Tượng</th>
                    <th className="py-2.5 px-3 font-bold text-center">ADULT (Người lớn)</th>
                    <th className="py-2.5 px-3 font-bold text-center">STUDENT_U22 (HSSV)</th>
                    <th className="py-2.5 px-3 font-bold text-center">CHILD (Trẻ em)</th>
                    <th className="py-2.5 px-3 font-bold text-center">SENIOR (Cao tuổi)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D2536]">
                  {(['STANDARD', 'VIP', 'COUPLE', 'WHEELCHAIR'] as SeatType[]).map((seatType) => (
                    <tr key={seatType} className="hover:bg-[#161C2A]">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            seatType === 'VIP'
                              ? 'bg-[#FABF2E]'
                              : seatType === 'COUPLE'
                              ? 'bg-[#E63845]'
                              : seatType === 'WHEELCHAIR'
                              ? 'bg-[#06B6D4]'
                              : 'bg-[#8E9AAF]'
                          }`}
                        />
                        <span>{seatType}</span>
                      </td>

                      {(['ADULT', 'STUDENT_U22', 'CHILD', 'SENIOR'] as AudienceType[]).map((audType) => {
                        const key = `${seatType}_${audType}`;
                        const isCoupleChild = seatType === 'COUPLE' && (audType === 'CHILD' || audType === 'SENIOR');

                        return (
                          <td key={audType} className="py-2 px-3 text-center">
                            {isCoupleChild ? (
                              <span className="text-[#5C677D] text-[10px] italic">Không áp dụng</span>
                            ) : (
                              <input
                                type="number"
                                step={5000}
                                min={0}
                                value={priceMatrix[key] || 0}
                                onChange={(e) =>
                                  setPriceMatrix({ ...priceMatrix, [key]: Number(e.target.value) })
                                }
                                className="w-24 bg-[#171D2B] border border-[#253045] rounded-lg px-2.5 py-1.5 text-center text-white font-mono text-xs focus:outline-none focus:border-[#FABF2E]"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#222B3D]">
              <div className="text-[11px] text-[#8E9AAF]">
                Giá vé được lưu phân tầng theo cấu trúc 28 bảng chuẩn hóa `showtime_prices`.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPricingModalShowtime(null)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] font-bold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pricingModalShowtime) {
                      const updatedPriceRows: Partial<ShowtimePrice>[] = Object.entries(priceMatrix).map(([key, price]) => {
                        const [seat_type, audience_type] = key.split('_');
                        return {
                          showtime_id: pricingModalShowtime.id,
                          seat_type: seat_type as SeatType,
                          audience_type: audience_type as AudienceType,
                          price,
                          currency: 'VND'
                        };
                      });
                      onSaveShowtime(pricingModalShowtime, updatedPriceRows);
                      showToast(`Đã lưu bảng giá vé phân tầng cho suất chiếu!`);
                    }
                    setPricingModalShowtime(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black cursor-pointer shadow-lg"
                >
                  Lưu Bảng Giá
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Showtime Delete Confirmation Modal */}
      {deleteConfirmShowtime && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2E1F24] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#3B191C] text-[#EF4444] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Xác Nhận Xóa Suất Chiếu</h3>
                <p className="text-xs text-[#8E9AAF]">Suất chiếu này sẽ bị gỡ khỏi lịch chiếu của rạp.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1A1F2C] border border-[#263147] text-xs text-white space-y-1">
              <div>Phim: <strong className="text-[#FABF2E]">{deleteConfirmShowtime.title}</strong></div>
              <div>Giờ chiếu: <strong className="font-mono text-white">{deleteConfirmShowtime.time}</strong> ({deleteConfirmShowtime.room})</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmShowtime(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmShowtime.id;
                  setDeleteConfirmShowtime(null);
                  await onDeleteShowtime(id);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold transition-all shadow-lg shadow-[#EF4444]/30 cursor-pointer"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
