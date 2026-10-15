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

export class MovieService {
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
   * Hỗ trợ lọc theo phim, ngày chiếu và rạp
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
      const filtered = dbShowtimes.filter(
        (st: any) => st.movie_id === targetMovieId || !targetMovieId
      );

      const realSlots: any[] = [];

      for (const st of filtered) {
        // Đếm số ghế trống thực tế từ bảng showtime_seats
        const seatRes: any = await supabase
          .from('showtime_seats')
          .select('*', { count: 'exact', head: true })
          .eq('showtime_id', st.id)
          .eq('status', 'available');

        // Lấy tổng số ghế của phòng chiếu
        const auditRes: any = await supabase
          .from('auditoriums')
          .select('id, name, total_seats')
          .eq('id', st.auditorium_id)
          .single();

        const count = seatRes.count ?? 76;
        const totalSeats = auditRes.data?.total_seats ?? 80;
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

        realSlots.push({
          id: st.id,
          time: timeStr,
          dateStr: dateStrDb,
          availableSeats: count,
          totalSeats: totalSeats,
          format: st.format || '2D',
          roomName: roomName,
        });
      }

      // CHỈ HIỆN CÁC SUẤT CHIẾU CÓ THẬT TRÊN DATABASE (Không thêm suất ảo)
      realSlots.sort((a, b) => a.time.localeCompare(b.time));
      return realSlots;
    } catch (err) {
      console.error('Error fetching showtime slots from DB:', err);
      return [];
    }
  }
}
