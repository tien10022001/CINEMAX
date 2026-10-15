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
    const supabase = createClient();

    try {
      // 1. Tìm UUID của phim trong DB
      let targetMovieId = movieId.toString();
      if (targetMovieId.length !== 36) {
        const resMovies: any = await supabase.from('movies').select('id, title, slug');
        if (resMovies.data && resMovies.data.length > 0) {
          targetMovieId = resMovies.data[0].id;
        }
      }

      // 2. Query showtimes từ Supabase kèm thông tin phòng chiếu
      const resShowtimes: any = await supabase
        .from('showtimes')
        .select('id, movie_id, auditorium_id, format, starts_at, status')
        .eq('status', 'open')
        .order('starts_at', { ascending: true });

      const dbShowtimes: any[] = resShowtimes.data || [];
      const now = new Date();
      // Ngưỡng trễ tối đa 15 phút sau giờ chiếu
      const cutOffTime = new Date(now.getTime() - 15 * 60 * 1000);

      const filtered = dbShowtimes.filter((st: any) => {
        // Khớp phim
        if (targetMovieId && st.movie_id !== targetMovieId) return false;
        // Bỏ qua suất đã qua thời gian chiếu
        const startTime = new Date(st.starts_at);
        if (startTime < cutOffTime) return false;
        return true;
      });

      const realSlots: any[] = [];

      for (const st of filtered) {
        // Lấy tất cả ghế của suất chiếu để tính ghế khả dụng (kể cả ghế held đã hết hạn)
        const seatRes: any = await supabase
          .from('showtime_seats')
          .select('id, status, held_until')
          .eq('showtime_id', st.id);

        const allSeats: any[] = seatRes.data || [];
        const availableCount = allSeats.filter((s) => {
          if (s.status === 'available') return true;
          // P0.1: Ghế đang giữ nhưng đã hết hạn (held_until < now) thì tính là khả dụng
          if (s.status === 'held' && s.held_until && new Date(s.held_until) < now) {
            return true;
          }
          return false;
        }).length;

        // Lấy tổng số ghế của phòng chiếu
        const auditRes: any = await supabase
          .from('auditoriums')
          .select('id, name, total_seats')
          .eq('id', st.auditorium_id)
          .single();

        const totalSeats = auditRes.data?.total_seats ?? (allSeats.length > 0 ? allSeats.length : 80);
        const roomName = auditRes.data?.name || 'Phòng 1';

        const d = new Date(st.starts_at);
        const timeStr = d.toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
        });
        const dateStrDb = d.toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
        });
        const dateKeyDb = d.toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }); // "YYYY-MM-DD"

        // Nếu có dateStr cụ thể, chỉ lấy suất trùng ngày hoặc hiển thị suất đang mở của phim
        if (dateStr && dateStr.includes('-')) {
          if (dateKeyDb !== dateStr) {
            // Không trùng ngày -> bỏ qua
            continue;
          }
        }

        realSlots.push({
          id: st.id,
          time: timeStr,
          dateStr: dateStrDb,
          availableSeats: availableCount,
          totalSeats: totalSeats,
          format: st.format || '2D',
          roomName: roomName,
          isLate: isLateShowtime(st.starts_at),
        });
      }

      // Sắp xếp theo giờ chiếu tăng dần
      realSlots.sort((a, b) => a.time.localeCompare(b.time));
      return realSlots;
    } catch (err) {
      console.error('Error fetching showtime slots from DB:', err);
      return [];
    }
  }
}
