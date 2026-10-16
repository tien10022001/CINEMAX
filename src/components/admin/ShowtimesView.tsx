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
  Minimize2
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

  // Quick Batch Schedule Modal State
  const [quickBatchModalOpen, setQuickBatchModalOpen] = useState(false);
  const [quickMode, setQuickMode] = useState<'AUTO_FILL' | 'COPY_DAY'>('AUTO_FILL');
  const [quickAudId, setQuickAudId] = useState<string>('');
  const [quickMovieId, setQuickMovieId] = useState<string>('');
  const [quickStartTime, setQuickStartTime] = useState<string>('08:30');
  const [quickBuffer, setQuickBuffer] = useState<number>(15);
  const [quickEndTimeDay, setQuickEndTimeDay] = useState<string>('23:30');
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<number[]>([]);
  const [copySourceDate, setCopySourceDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });

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

  // Timeline hours from 08:00 to 24:00 (16 hours total: 8, 9, ..., 23)
  const TIMELINE_START_HOUR = 8;
  const TIMELINE_TOTAL_HOURS = 16;
  const timelineHours = Array.from({ length: 16 }, (_, i) => 8 + i);

  // Filtered auditoriums for timeline view
  const displayedAuditoriums = React.useMemo(() => {
    return auditoriums.filter((aud) => {
      if (roomFilter === '2D') return aud.screen_type === '2D';
      if (roomFilter === 'IMAX') return aud.screen_type === 'IMAX';
      if (roomFilter === 'CONFLICT') {
        const roomSts = showtimes.filter((st) => {
          const stDate = st.starts_at ? new Date(st.starts_at).toISOString().split('T')[0] : '';
          return st.auditorium_id === aud.id && stDate === selectedDate;
        });
        return roomSts.some(checkOverlap);
      }
      return true;
    });
  }, [auditoriums, roomFilter, showtimes, selectedDate]);

  // State lọc phim theo định dạng rạp (mặc định = true: phòng 2D chỉ hiện phim 2D, phòng IMAX chỉ hiện phim IMAX)
  const [filterMoviesByRoomType, setFilterMoviesByRoomType] = useState(true);

  // Hàm kiểm tra định dạng phim có tương thích với loại rạp không
  const isMovieCompatibleWithAuditorium = (movie: Movie, aud?: Auditorium | null) => {
    if (!aud) return true;
    const roomType = (aud.screen_type || '2D').toUpperCase();
    const movieFormats = (movie.formats && movie.formats.length > 0) ? movie.formats : ['2D'];
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
    const formattedHour = String(hour).padStart(2, '0') + ':00';
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
      date: selectedDate,
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

  // QUICK BATCH SCHEDULING LOGIC
  const handleOpenQuickBatchModal = () => {
    const firstAud = auditoriums[0];
    const initialAudId = firstAud?.id || '';
    setQuickAudId(initialAudId);

    const validMovies = movies.filter((m) => isMovieCompatibleWithAuditorium(m, firstAud));
    const initialMovieId = validMovies[0]?.id || movies[0]?.id || '';
    setQuickMovieId(initialMovieId);
    setQuickBuffer(firstAud?.cleaning_buffer_minutes || 15);
    setQuickStartTime('08:30');
    setQuickEndTimeDay('23:30');

    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setCopySourceDate(d.toISOString().split('T')[0]);

    setQuickBatchModalOpen(true);
  };

  const targetQuickAud = auditoriums.find((a) => a.id === quickAudId) || auditoriums[0];
  const compatibleMoviesForQuickAud = React.useMemo(() => {
    if (!targetQuickAud) return movies;
    return movies.filter((m) => isMovieCompatibleWithAuditorium(m, targetQuickAud));
  }, [movies, targetQuickAud]);

  const targetQuickMovie = movies.find((m) => m.id === quickMovieId) || compatibleMoviesForQuickAud[0] || movies[0];

  const generatedQuickSlots = React.useMemo(() => {
    if (!targetQuickMovie || !targetQuickAud || !quickStartTime || !quickEndTimeDay) return [];
    const duration = targetQuickMovie.duration_minutes || 120;
    const buffer = quickBuffer || 15;
    const totalSlotMins = duration + buffer;

    const [startH, startM] = quickStartTime.split(':').map(Number);
    const [endDayH, endDayM] = quickEndTimeDay.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endDayH) || isNaN(endDayM)) return [];

    const startMinutesOfDay = startH * 60 + startM;
    const endMinutesOfDay = endDayH * 60 + endDayM;

    const existingRoomShowtimes = showtimes.filter((st) => {
      const stDate = st.starts_at ? new Date(st.starts_at).toISOString().split('T')[0] : '';
      return st.auditorium_id === targetQuickAud.id && stDate === selectedDate;
    });

    const slots: Array<{
      index: number;
      startStr: string;
      endStr: string;
      startsAt: Date;
      endsAt: Date;
      isConflict: boolean;
    }> = [];

    let currentStartMins = startMinutesOfDay;
    let idx = 0;

    while (currentStartMins + duration <= endMinutesOfDay + 60 && idx < 10) {
      const curH = Math.floor(currentStartMins / 60) % 24;
      const curM = currentStartMins % 60;
      const startStr = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;

      const movieEndMins = currentStartMins + duration;
      const endH = Math.floor(movieEndMins / 60) % 24;
      const endM = movieEndMins % 60;
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      const startsAt = new Date(`${selectedDate}T${startStr}:00`);
      const endsAt = new Date(startsAt.getTime() + totalSlotMins * 60000);

      const slotStartTime = startsAt.getTime();
      const slotEndTime = endsAt.getTime();

      const hasConflict = existingRoomShowtimes.some((st) => {
        const stStart = new Date(st.starts_at).getTime();
        const stEnd = new Date(st.ends_at).getTime();
        return Math.max(slotStartTime, stStart) < Math.min(slotEndTime, stEnd);
      });

      slots.push({
        index: idx,
        startStr,
        endStr,
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60000),
        isConflict: hasConflict
      });

      currentStartMins += totalSlotMins;
      idx++;
    }

    return slots;
  }, [targetQuickMovie, targetQuickAud, quickStartTime, quickEndTimeDay, quickBuffer, selectedDate, showtimes]);

  // Cập nhật slot selection khi generated slots thay đổi
  React.useEffect(() => {
    if (generatedQuickSlots.length > 0) {
      setSelectedSlotIndices(generatedQuickSlots.filter((s) => !s.isConflict).map((s) => s.index));
    }
  }, [generatedQuickSlots]);

  // Danh sách suất của ngày nguồn để sao chép
  const sourceDayShowtimes = React.useMemo(() => {
    return showtimes.filter((st) => {
      const d = st.starts_at ? new Date(st.starts_at).toISOString().split('T')[0] : '';
      return d === copySourceDate;
    });
  }, [showtimes, copySourceDate]);

  // Thực thi tạo hàng loạt
  const handleExecuteQuickBatch = async () => {
    if (quickMode === 'AUTO_FILL') {
      if (!targetQuickMovie || !targetQuickAud) {
        showToast('Vui lòng chọn phim và phòng!');
        return;
      }
      const slotsToCreate = generatedQuickSlots.filter((s) => selectedSlotIndices.includes(s.index));
      if (slotsToCreate.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 khung giờ hợp lệ!');
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

        for (const slot of slotsToCreate) {
          await onSaveShowtime(
            {
              movie_id: targetQuickMovie.id,
              auditorium_id: targetQuickAud.id,
              format: targetQuickAud.screen_type === 'IMAX' ? 'IMAX' : '2D',
              language_version: targetQuickMovie.language || 'Phụ đề Tiếng Việt',
              starts_at: slot.startsAt.toISOString(),
              ends_at: slot.endsAt.toISOString(),
              status: 'open'
            },
            defaultPrices
          );
        }

        showToast(`Đã tạo thành công ${slotsToCreate.length} suất chiếu cho ${targetQuickAud.name}!`);
        setQuickBatchModalOpen(false);
      } catch (err: any) {
        showToast('Lỗi khi tạo suất hàng loạt: ' + (err.message || 'Thử lại'));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // COPY_DAY MODE
      if (sourceDayShowtimes.length === 0) {
        showToast(`Không có suất chiếu nào trong ngày nguồn (${copySourceDate})!`);
        return;
      }

      setIsSubmitting(true);
      try {
        let copiedCount = 0;
        for (const st of sourceDayShowtimes) {
          const oldStart = new Date(st.starts_at);
          const oldEnd = new Date(st.ends_at);

          const startH = String(oldStart.getHours()).padStart(2, '0');
          const startM = String(oldStart.getMinutes()).padStart(2, '0');
          const newStart = new Date(`${selectedDate}T${startH}:${startM}:00`);
          const durationMs = oldEnd.getTime() - oldStart.getTime();
          const newEnd = new Date(newStart.getTime() + durationMs);

          await onSaveShowtime({
            movie_id: st.movie_id,
            auditorium_id: st.auditorium_id,
            format: st.format,
            language_version: st.language_version,
            starts_at: newStart.toISOString(),
            ends_at: newEnd.toISOString(),
            status: st.status
          });
          copiedCount++;
        }

        showToast(`Đã sao chép thành công ${copiedCount} suất chiếu sang ngày ${selectedDate}!`);
        setQuickBatchModalOpen(false);
      } catch (err: any) {
        showToast('Lỗi khi sao chép lịch: ' + (err.message || 'Thử lại'));
      } finally {
        setIsSubmitting(false);
      }
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
            {/* Timeline Header (Time slots: 08:00 - 24:00) - Ghim cố định ở đỉnh khi cuộn dọc */}
            <div className="flex border-b border-[#222B3D] bg-[#0E121B] sticky top-0 z-20 shadow-md w-full">
              {/* Giao điểm góc trên bên trái: Ghim cả 2 chiều */}
              <div className="w-36 md:w-40 shrink-0 px-2.5 py-2 text-xs font-bold text-[#8E9AAF] border-r border-[#222B3D] bg-[#0A0D14] sticky left-0 z-30 flex items-center justify-between">
                <span>Phòng Chiếu</span>
                <span className="text-[10px] text-[#5C677D] font-mono">08h-24h</span>
              </div>

              {/* 16 khoảng giờ từ 08:00 đến 24:00 chia đều 100% chiều rộng */}
              <div className="flex-1 flex w-full relative">
                {timelineHours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-r border-[#1C2433] px-0.5 py-2 text-center text-[10px] font-mono font-semibold text-[#8E9AAF] truncate"
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
                <div className="absolute right-0 top-0 bottom-0 pr-1 flex items-center text-[9px] font-mono text-[#5C677D] pointer-events-none">
                  24h
                </div>
              </div>
            </div>

            {/* Rows for each auditorium */}
            <div className="divide-y divide-[#1D2536] w-full">
              {displayedAuditoriums.map((aud) => {
                const roomShowtimes = showtimes.filter((st) => {
                  const stDate = st.starts_at ? new Date(st.starts_at).toISOString().split('T')[0] : '';
                  return st.auditorium_id === aud.id && stDate === selectedDate;
                });

                return (
                  <div key={aud.id} className="flex relative hover:bg-[#151B27]/40 transition-colors group w-full">
                    {/* Left Room Label */}
                    <div className="w-36 md:w-40 shrink-0 px-2.5 py-2 border-r border-[#222B3D] bg-[#121622] sticky left-0 z-20 flex flex-col justify-center shadow-sm">
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
                    <div className="flex-1 relative h-14 flex items-center w-full overflow-hidden">
                      {/* Background Grid: 16 cột giờ cho click nhanh */}
                      <div className="absolute inset-0 flex pointer-events-auto">
                        {timelineHours.map((hour) => (
                          <div
                            key={hour}
                            onClick={() => handleQuickSlotClick(aud.id, hour)}
                            className="flex-1 border-r border-[#1C2433]/60 hover:bg-[#E63845]/15 cursor-pointer transition-colors relative group/slot"
                            title={`Click để xếp suất chiếu mới lúc ${String(hour).padStart(2, '0')}:00 tại ${aud.name}`}
                          >
                            <span className="absolute bottom-1 right-1 text-[8px] text-[#3E4D68] opacity-0 group-hover/slot:opacity-100 font-mono font-bold">
                              +
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Placed Showtimes as Interactive Blocks */}
                      {roomShowtimes.map((st) => {
                        const movie = st.movie || movies.find((m) => m.id === st.movie_id);
                        const isOverlap = checkOverlap(st);

                        const startDate = new Date(st.starts_at);
                        const endDate = new Date(st.ends_at);

                        const startHours = startDate.getHours() + startDate.getMinutes() / 60;
                        let endHours = endDate.getHours() + endDate.getMinutes() / 60;
                        if (endHours < startHours) {
                          endHours += 24;
                        }

                        // Tọa độ % chính xác từ 08:00 (0%) đến 24:00 (100%)
                        const leftPercent = Math.max(0, ((startHours - TIMELINE_START_HOUR) / TIMELINE_TOTAL_HOURS) * 100);
                        const durationHours = Math.max(0.6, endHours - startHours);
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
                            className={`absolute h-11 rounded-lg px-2 py-0.5 z-10 shadow-md transition-all flex flex-col justify-between overflow-hidden cursor-pointer select-none group/card min-w-[36px] ${
                              isOverlap
                                ? 'bg-[#3B191C] border-2 border-[#EF4444] animate-pulse text-[#EF4444]'
                                : 'bg-gradient-to-r from-[#172233] to-[#141B29] border border-[#2D3F5E] hover:border-[#06B6D4] hover:shadow-cyan-900/40'
                            }`}
                            title={`Bấm để chỉnh sửa: ${movie?.title || 'Phim'} (${startTimeStr} - ${endTimeStr})`}
                          >
                            {/* Top Bar: Title & Format */}
                            <div className="flex items-center justify-between gap-1 leading-tight">
                              <span className="font-bold text-white text-[11px] truncate">
                                {movie?.title || 'Phim'}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="px-1 py-0.2 rounded text-[8px] font-black bg-[#E63845] text-white">
                                  {st.format || '2D'}
                                </span>
                                {isOverlap && (
                                  <AlertTriangle className="w-3 h-3 text-[#EF4444] shrink-0" />
                                )}
                              </div>
                            </div>

                            {/* Bottom Bar: Giờ chiếu */}
                            <div className="flex items-center justify-between text-[10px] text-[#8E9AAF] leading-tight">
                              <span className="font-mono text-[#06B6D4] font-semibold text-[9px] sm:text-[10px] truncate">
                                {startTimeStr} - {endTimeStr}
                              </span>

                              <div className="flex items-center gap-1 opacity-90 group-hover/card:opacity-100 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPricingMatrix(st);
                                  }}
                                  className="p-0.5 rounded bg-[#253247] hover:bg-[#FABF2E] hover:text-black text-white transition-all cursor-pointer"
                                  title="Chỉnh bảng giá vé"
                                >
                                  <DollarSign className="w-2.5 h-2.5" />
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
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            {/* Cleaning Buffer Stripe Visual (Mép phải thẻ) */}
                            <div
                              style={{ width: `${Math.min(20, bufferWidthPercent * 10)}px` }}
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

      {/* Modal 0: Quick Batch Showtime Generator */}
      {quickBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121622] border border-[#2D3A54] rounded-3xl w-full max-w-2xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E63845] to-[#F43F5E] flex items-center justify-center text-white shadow-md shadow-[#E63845]/20">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Tạo Suất Chiếu Nhanh</h3>
                  <p className="text-[11px] text-[#8E9AAF]">Ngày áp dụng: <strong className="text-[#06B6D4]">{selectedDate}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setQuickBatchModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex items-center bg-[#0E121B] p-1 rounded-xl border border-[#222B3D]">
              <button
                type="button"
                onClick={() => setQuickMode('AUTO_FILL')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  quickMode === 'AUTO_FILL'
                    ? 'bg-[#E63845] text-white shadow'
                    : 'text-[#8E9AAF] hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Tự Động Lên Lịch Phòng</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickMode('COPY_DAY')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  quickMode === 'COPY_DAY'
                    ? 'bg-[#E63845] text-white shadow'
                    : 'text-[#8E9AAF] hover:text-white'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao Chép Lịch Từ Ngày Khác</span>
              </button>
            </div>

            {/* TAB 1: AUTO_FILL MODE */}
            {quickMode === 'AUTO_FILL' && (
              <div className="space-y-3.5 text-xs">
                {/* Phòng & Phim */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-semibold text-[11px]">Phòng chiếu</label>
                    <select
                      value={quickAudId}
                      onChange={(e) => {
                        const newAudId = e.target.value;
                        setQuickAudId(newAudId);
                        const aud = auditoriums.find((a) => a.id === newAudId);
                        if (aud) {
                          setQuickBuffer(aud.cleaning_buffer_minutes || 15);
                          const validMovies = movies.filter((m) => isMovieCompatibleWithAuditorium(m, aud));
                          if (!validMovies.some((m) => m.id === quickMovieId)) {
                            setQuickMovieId(validMovies[0]?.id || movies[0]?.id || '');
                          }
                        }
                      }}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-[#E63845]"
                    >
                      {auditoriums.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.screen_type} • {a.total_seats} ghế)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] font-semibold text-[11px]">
                      Phim ({compatibleMoviesForQuickAud.length} phim chuẩn {targetQuickAud?.screen_type})
                    </label>
                    <select
                      value={quickMovieId}
                      onChange={(e) => setQuickMovieId(e.target.value)}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-[#E63845]"
                    >
                      {compatibleMoviesForQuickAud.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.duration_minutes}p)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Giờ bắt đầu, Giờ kết thúc ngày, Buffer */}
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#0E121B] border border-[#20293A]">
                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] text-[10px] font-semibold">Suất đầu tiên</label>
                    <input
                      type="time"
                      value={quickStartTime}
                      onChange={(e) => setQuickStartTime(e.target.value)}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-lg px-2 py-1.5 text-white font-mono font-bold text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] text-[10px] font-semibold">Kết thúc trước</label>
                    <input
                      type="time"
                      value={quickEndTimeDay}
                      onChange={(e) => setQuickEndTimeDay(e.target.value)}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-lg px-2 py-1.5 text-white font-mono font-bold text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#8E9AAF] text-[10px] font-semibold">Đệm dọn rạp</label>
                    <select
                      value={quickBuffer}
                      onChange={(e) => setQuickBuffer(Number(e.target.value))}
                      className="w-full bg-[#171D2B] border border-[#253045] rounded-lg px-2 py-1.5 text-white text-xs font-medium"
                    >
                      <option value={10}>10 phút</option>
                      <option value={15}>15 phút</option>
                      <option value={20}>20 phút</option>
                      <option value={30}>30 phút</option>
                    </select>
                  </div>
                </div>

                {/* Danh sách các suất chiếu dự kiến sinh tự động */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#8E9AAF]">
                    <span>Danh sách suất chiếu tự động tính toán ({generatedQuickSlots.length} suất)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const validIdx = generatedQuickSlots.filter((s) => !s.isConflict).map((s) => s.index);
                        setSelectedSlotIndices(selectedSlotIndices.length === validIdx.length ? [] : validIdx);
                      }}
                      className="text-[#06B6D4] hover:underline cursor-pointer font-medium"
                    >
                      {selectedSlotIndices.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả suất hợp lệ'}
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar p-1">
                    {generatedQuickSlots.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#5C677D] border border-dashed border-[#222B3D] rounded-xl">
                        Không có khung giờ nào phù hợp trong khoảng thời gian đã chọn.
                      </div>
                    ) : (
                      generatedQuickSlots.map((slot) => {
                        const isChecked = selectedSlotIndices.includes(slot.index);
                        return (
                          <div
                            key={slot.index}
                            onClick={() => {
                              if (slot.isConflict) return;
                              setSelectedSlotIndices((prev) =>
                                prev.includes(slot.index)
                                  ? prev.filter((i) => i !== slot.index)
                                  : [...prev, slot.index]
                              );
                            }}
                            className={`p-2.5 rounded-xl border flex items-center justify-between transition-all select-none ${
                              slot.isConflict
                                ? 'bg-[#3B191C]/40 border-[#EF4444]/40 opacity-60 cursor-not-allowed'
                                : isChecked
                                ? 'bg-[#152336] border-[#06B6D4]/60 text-white cursor-pointer shadow-sm'
                                : 'bg-[#161D2B] border-[#222B3D] text-[#8E9AAF] hover:border-[#33425E] cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={slot.isConflict}
                                onChange={() => {}}
                                className="w-4 h-4 accent-[#E63845] rounded cursor-pointer pointer-events-none"
                              />
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">Suất {slot.index + 1}:</span>
                                <span className="font-mono font-bold text-[#06B6D4] text-xs">
                                  {slot.startStr} ➔ {slot.endStr}
                                </span>
                                <span className="text-[10px] text-[#5C677D]">({targetQuickMovie?.duration_minutes}p + {quickBuffer}p)</span>
                              </div>
                            </div>

                            {slot.isConflict ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Trùng suất có sẵn!</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E]">
                                Hợp lệ
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COPY_DAY MODE */}
            {quickMode === 'COPY_DAY' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0E121B] border border-[#20293A] space-y-2">
                  <label className="text-[#8E9AAF] font-semibold text-[11px] block">
                    Chọn ngày nguồn cần sao chép lịch:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={copySourceDate}
                      onChange={(e) => setCopySourceDate(e.target.value)}
                      className="flex-1 bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E63845]"
                    />
                  </div>
                  <p className="text-[11px] text-[#8E9AAF]">
                    Toàn bộ suất chiếu của ngày <strong className="text-white">{copySourceDate}</strong> sẽ được nhân bản sang ngày <strong className="text-[#06B6D4]">{selectedDate}</strong> với cùng khung giờ và phòng chiếu tương ứng.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#161D2B] border border-[#222B3D] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white">
                      Suất chiếu tìm thấy trong ngày {copySourceDate}:
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#06B6D4]/20 text-[#06B6D4]">
                      {sourceDayShowtimes.length} suất
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {sourceDayShowtimes.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#5C677D]">
                        Không có suất chiếu nào trong ngày nguồn đã chọn.
                      </div>
                    ) : (
                      sourceDayShowtimes.map((st) => {
                        const m = st.movie || movies.find((movie) => movie.id === st.movie_id);
                        const aud = st.auditorium || auditoriums.find((a) => a.id === st.auditorium_id);
                        const startTime = new Date(st.starts_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        const endTime = new Date(st.ends_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div
                            key={st.id}
                            className="p-2 rounded-lg bg-[#0E121B] border border-[#1F2739] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{m?.title || 'Phim'}</span>
                              <span className="text-[10px] text-[#06B6D4]">({aud?.name})</span>
                            </div>
                            <span className="font-mono text-[11px] text-[#8E9AAF]">
                              {startTime} - {endTime}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222B3D]">
              <button
                type="button"
                onClick={() => setQuickBatchModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1A202E] hover:bg-[#252E42] text-[#8E9AAF] hover:text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting || (quickMode === 'AUTO_FILL' ? selectedSlotIndices.length === 0 : sourceDayShowtimes.length === 0)}
                onClick={handleExecuteQuickBatch}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#E63845] to-[#F43F5E] hover:from-[#D42B38] hover:to-[#E11D48] text-white font-bold text-xs cursor-pointer shadow-lg shadow-[#E63845]/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Đang Tạo...</span>
                ) : quickMode === 'AUTO_FILL' ? (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Tạo {selectedSlotIndices.length} Suất Chiếu Nhanh</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao Chép {sourceDayShowtimes.length} Suất Sang Hôm Nay</span>
                  </>
                )}
              </button>
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
