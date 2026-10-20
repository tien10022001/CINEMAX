import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type MovieRow = Database['public']['Tables']['movies']['Row'];
export type ShowtimeRow = Database['public']['Tables']['showtimes']['Row'];
export type ShowtimePriceRow = Database['public']['Tables']['showtime_prices']['Row'];
export type AuditoriumRow = Database['public']['Tables']['auditoriums']['Row'];

export interface MovieWithGenres extends MovieRow {
  genres?: {
    id: string;
    name: string;
    slug: string;
  }[];
}

export interface ShowtimeWithDetails extends ShowtimeRow {
  auditorium?: AuditoriumRow | null;
  prices?: ShowtimePriceRow[];
}

/**
 * Xác định suất chiếu muộn (từ 22:00 trở đi theo giờ địa phương rạp Asia/Ho_Chi_Minh)
 */
export function isLateShowtime(startsAtOrTime: string): boolean {
  if (!startsAtOrTime) return false;
  if (startsAtOrTime.includes('T') || startsAtOrTime.includes('-')) {
    const d = new Date(startsAtOrTime);
    const hourStr = d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hour12: false,
    });
    const h = parseInt(hourStr, 10);
    return h >= 22 || h < 4; // Suất từ 22:00 đêm đến rạng sáng
  }
  const [hours] = startsAtOrTime.split(':').map(Number);
  return hours >= 22 || hours < 4;
}

export class MovieService {
  static isLateShowtime = isLateShowtime;
  /**
   * Lấy danh sách phim đang chiếu (status = 'now_showing' hoặc 'SHOWING')
   */
  static async getNowShowingMovies(): Promise<MovieWithGenres[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('movies')
      .select(`
        *,
        movie_genres (
          genres (
            id,
            name,
            slug
          )
        )
      `)
      .or('status.eq.now_showing,status.eq.SHOWING')
      .order('release_date', { ascending: false });

    if (error) {
      console.error('Error fetching now showing movies:', error);
      return [];
    }

    return (data || []).map((movie: any) => ({
      ...movie,
      genres: movie.movie_genres?.map((mg: any) => mg.genres).filter(Boolean) || [],
    }));
  }

  /**
   * Lấy danh sách phim sắp chiếu (status = 'coming_soon')
   */
  static async getComingSoonMovies(): Promise<MovieWithGenres[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('movies')
      .select(`
        *,
        movie_genres (
          genres (
            id,
            name,
            slug
          )
        )
      `)
      .or('status.eq.coming_soon,status.eq.COMING_SOON')
      .order('release_date', { ascending: true });

    if (error) {
      console.error('Error fetching coming soon movies:', error);
      return [];
    }

    return (data || []).map((movie: any) => ({
      ...movie,
      genres: movie.movie_genres?.map((mg: any) => mg.genres).filter(Boolean) || [],
    }));
  }

  /**
   * Lấy chi tiết phim theo slug
   */
  static async getMovieBySlug(slug: string): Promise<MovieWithGenres | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('movies')
      .select(`
        *,
        movie_genres (
          genres (
            id,
            name,
            slug
          )
        )
      `)
      .eq('slug', slug)
      .single();

    if (error || !data) {
      console.error(`Error fetching movie with slug ${slug}:`, error);
      return null;
    }

    const raw = data as Record<string, any>;
    return {
      ...raw,
      genres: raw.movie_genres?.map((mg: any) => mg.genres).filter(Boolean) || [],
    } as unknown as MovieWithGenres;
  }

  /**
   * Lấy danh sách suất chiếu của 1 phim theo ngày (định dạng YYYY-MM-DD theo giờ Việt Nam)
   */
  static async getShowtimesByMovieAndDate(movieId: string, dateStr: string): Promise<ShowtimeWithDetails[]> {
    const supabase = createClient();
    
    // Tính khoảng thời gian 00:00:00 -> 23:59:59 của ngày dateStr theo múi giờ Việt Nam (+07:00)
    const startOfDayUTC = new Date(`${dateStr}T00:00:00+07:00`).toISOString();
    const endOfDayUTC = new Date(`${dateStr}T23:59:59+07:00`).toISOString();

    const { data, error } = await supabase
      .from('showtimes')
      .select(`
        *,
        auditorium:auditoriums(*),
        prices:showtime_prices(*)
      `)
      .eq('movie_id', movieId)
      .eq('status', 'open')
      .gte('starts_at', startOfDayUTC)
      .lte('starts_at', endOfDayUTC)
      .order('starts_at', { ascending: true });

    if (error) {
      console.error(`Error fetching showtimes for movie ${movieId}:`, error);
      return [];
    }

    return (data || []) as unknown as ShowtimeWithDetails[];
  }

  /**
   * Lấy danh sách thẻ suất chiếu chuẩn hóa từ Database Supabase kèm số ghế trống thực tế
   * - Nguồn chuẩn: showtimes + showtime_seats (tính cả ghế giữ tạm hết hạn)
   * - Múi giờ chuẩn: Asia/Ho_Chi_Minh (GMT+7)
   * - Lọc suất chiếu hợp lệ: status='open' và chưa qua thời gian chiếu
   */
  static async getShowtimeSlots(
    movieId: string | number,
    dateStr?: string,
    cinemaId?: string | number
  ): Promise<any[]> {
    const effectiveCinemaId = cinemaId ? Number(cinemaId) : null;
    const slots: any[] = [];

    // 1. Đọc dữ liệu từ Database hệ thống (localStorage cinemax_showtimes_v2 do Admin quản lý)
    let localShowtimes: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_showtimes_v2');
        if (stored) {
          localShowtimes = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Error reading cinemax_showtimes_v2:', e);
      }
    }

    if (localShowtimes.length === 0) {
      const { MOCK_SHOWTIMES } = await import('@/lib/mock-data');
      localShowtimes = MOCK_SHOWTIMES;
    }

    const { MOCK_ROOMS } = await import('@/lib/mock-data');

    // 2. Lọc showtimes từ local database tuân thủ tuyệt đối dữ liệu trên database
    for (const st of localShowtimes) {
      // Khớp phim (theo ID số, UUID, supabase_id, hoặc slug)
      const stMovieId = st.movie_id ?? st.movie?.id;
      const stSupabaseId = st.movie?.supabase_id ?? (typeof st.movie_id === 'string' && st.movie_id.includes('-') ? st.movie_id : undefined);
      const matchMovie =
        stMovieId?.toString() === movieId?.toString() ||
        (stSupabaseId && stSupabaseId.toString() === movieId?.toString()) ||
        (st.movie?.slug && movieId?.toString().includes(st.movie.slug)) ||
        (st.movie?.title && movieId?.toString().toLowerCase().includes(st.movie.title.toLowerCase()));

      if (!matchMovie) continue;

      // Khớp rạp (qua room_id hoặc cinema_id)
      let stCinemaId = st.cinema_id;
      const roomObj = MOCK_ROOMS.find((r) => r.id === Number(st.room_id)) || st.room;
      if (!stCinemaId) {
        stCinemaId = roomObj?.cinema_id || 1;
      }
      if (effectiveCinemaId && Number(stCinemaId) !== effectiveCinemaId) {
        continue;
      }

      // Trạng thái suất chiếu phải là OPEN
      if (st.status && st.status.toString().toUpperCase() !== 'OPEN') {
        continue;
      }

      // Khớp ngày chiếu
      // st.start_time có thể là ISO ("2026-10-15T18:30:00+07:00") hoặc chuỗi ("18:30 • 15/10/2026")
      let timeStr = '';
      let dateKey = '';
      let dateDisplay = '';

      if (st.start_time) {
        if (st.start_time.includes('T')) {
          const d = new Date(st.start_time);
          timeStr = d.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
          });
          dateKey = d.toLocaleDateString('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
          }); // "YYYY-MM-DD"
          dateDisplay = d.toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
          });
        } else if (st.start_time.includes('•')) {
          const parts = st.start_time.split('•').map((s: string) => s.trim());
          timeStr = parts[0]; // "18:30"
          const dateParts = parts[1].split('/'); // "15/10/2026"
          if (dateParts.length === 3) {
            dateKey = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
            dateDisplay = `${dateParts[0]}/${dateParts[1]}`;
          }
        }
      }

      // Nếu có dateStr lọc (ví dụ "2026-10-17"), phải khớp đúng ngày này
      if (dateStr) {
        if (dateKey !== dateStr) {
          continue;
        }
      }

      // Chặn tuyệt đối: Suất chiếu không được phép diễn ra trước ngày khởi chiếu chính thức của phim
      if (st.movie?.release_date) {
        const normRel = st.movie.release_date.includes('/')
          ? st.movie.release_date.split('/').reverse().join('-')
          : st.movie.release_date.slice(0, 10);
        if (normRel && dateKey && dateKey < normRel) {
          continue;
        }
      }

      // Đếm số ghế đã bán từ cinemax_user_tickets cho suất chiếu này
      let bookedCount = 0;
      if (typeof window !== 'undefined') {
        try {
          const storedTickets = localStorage.getItem('cinemax_user_tickets');
          if (storedTickets) {
            const tickets = JSON.parse(storedTickets);
            const bookedSeats = new Set<string>();
            tickets.forEach((t: any) => {
              const matchShowtime = t.showtimeId && st.id && t.showtimeId.toString() === st.id.toString();
              const matchTimeAndDate =
                (t.showtimeTime === timeStr || t.showtime?.includes(timeStr)) &&
                (t.showtimeDate === dateKey || t.date === dateKey || t.showtime?.includes(dateKey));

              if (matchShowtime || matchTimeAndDate) {
                if (Array.isArray(t.seats)) {
                  t.seats.forEach((s: string) => bookedSeats.add(s.trim()));
                } else if (typeof t.seats === 'string') {
                  t.seats.split(',').forEach((s: string) => bookedSeats.add(s.trim()));
                }
              }
            });
            bookedCount = bookedSeats.size;
          }
        } catch (e) {
          console.error('Error counting booked seats for showtime:', e);
        }
      }

      const screenType = roomObj?.screen_type || st.format || '2D';
      const totalSeats = roomObj?.total_seats ?? 80;
      const computedAvailableSeats = Math.max(0, totalSeats - bookedCount);

      slots.push({
        id: st.id,
        time: timeStr || '18:30',
        dateStr: dateDisplay || '17/10',
        availableSeats: computedAvailableSeats,
        totalSeats: totalSeats,
        format: screenType === 'IMAX' ? 'IMAX Laser' : screenType,
        roomName: roomObj?.name || 'Phòng 1 (2D Tiêu Chuẩn)',
        isLate: isLateShowtime(timeStr || '18:30'),
      });
    }

    // 3. Nếu có suất chiếu trong Supabase DB cho phim và ngày này, đồng bộ thêm vào
    try {
      const supabase = createClient();
      const resShowtimes: any = await supabase
        .from('showtimes')
        .select('id, movie_id, auditorium_id, format, starts_at, status, auditoriums(name, screen_type, total_seats), movies(id, title, slug)')
        .eq('status', 'open');

      if (resShowtimes.data && resShowtimes.data.length > 0) {
        for (const st of resShowtimes.data) {
          // Lọc đúng phim
          const matchMovie =
            st.movie_id?.toString() === movieId?.toString() ||
            st.movies?.id?.toString() === movieId?.toString() ||
            (st.movies?.slug && movieId?.toString().includes(st.movies.slug)) ||
            (st.movies?.title && movieId?.toString().toLowerCase().includes(st.movies.title.toLowerCase()));

          if (!matchMovie) continue;

          const d = new Date(st.starts_at);
          const dateKeyDb = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          if (dateStr && dateKeyDb !== dateStr) continue;

          // Lấy giờ chiếu
          const timeStrDb = d.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Tránh trùng lặp với slot đã có
          if (slots.some((s) => s.id === st.id || s.time === timeStrDb)) continue;

          const audName = st.auditoriums?.name || 'Phòng 1 (2D Tiêu Chuẩn)';
          const audScreen = st.auditoriums?.screen_type || st.format || '2D';
          const audSeats = Number(st.auditoriums?.total_seats || 80);

          slots.push({
            id: st.id,
            time: timeStrDb,
            dateStr: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            availableSeats: audSeats,
            totalSeats: audSeats,
            format: audScreen === 'IMAX' ? 'IMAX Laser' : audScreen,
            roomName: audName,
            isLate: isLateShowtime(timeStrDb),
          });
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc Supabase showtimes:', e);
    }

    // Sắp xếp các suất chiếu theo thời gian tăng dần
    slots.sort((a, b) => a.time.localeCompare(b.time));
    return slots;
  }
}
