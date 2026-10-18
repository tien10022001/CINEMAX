'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Movie,
  Cinema,
  Showtime,
  Promotion,
  FoodItem,
  NewsArticle,
  SiteSettings,
} from './types';
import {
  MOCK_MOVIES,
  MOCK_CINEMAS,
  MOCK_SHOWTIMES,
  MOCK_PROMOTIONS,
  MOCK_FOODS,
} from './mock-data';
import { createClient } from './supabase/client';
import { fetchSupabaseCatalog, probeSupabaseWriteAccess } from './supabase/queries';

const DEFAULT_NEWS: NewsArticle[] = [
  {
    id: 1,
    title: 'Dune: Hành Tinh Cát 2 lập kỷ lục phòng vé toàn cầu với định dạng IMAX',
    date: '28/09/2026',
    summary: 'Siêu phẩm của đạo diễn Denis Villeneuve tiếp tục phá vỡ mọi cột mốc doanh thu phòng vé với định dạng IMAX Laser độc quyền.',
    content: 'Dune: Hành Tinh Cát 2 tiếp tục khẳng định vị thế của một siêu phẩm điện ảnh đỉnh cao khi liên tiếp lập các kỷ lục doanh thu phòng vé toàn cầu, đặc biệt tại các phòng chiếu định dạng IMAX Laser độc quyền của Cinemax.',
    img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    category: 'Phòng vé',
    author: 'Cinemax Editorial',
  },
  {
    id: 2,
    title: 'Trải nghiệm công nghệ âm thanh Dolby Atmos thế hệ mới tại Cinemax',
    date: '25/09/2026',
    summary: 'Hệ thống âm thanh đa chiều 64 kênh mang đến cảm giác sống động như đang thực sự hiện diện giữa bối cảnh phim.',
    content: 'Với hệ thống loa âm vòm 360 độ và công nghệ xử lý âm thanh kỹ thuật số tiên tiến nhất, khán giả sẽ cảm nhận rõ từng rung chấn, tiếng mưa rơi và những pha cháy nổ chân thực đến từng khoảnh khắc.',
    img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
    category: 'Công nghệ',
    author: 'Kỹ thuật Cinemax',
  },
  {
    id: 3,
    title: 'Chương trình Ngày Hội Thành Viên Cinemax: Nhân đôi điểm thưởng và tặng bắp nước',
    date: '20/09/2026',
    summary: 'Mỗi thứ 4 hàng tuần, thành viên CINEMAX được nhân đôi điểm thưởng loyalty và nhận combo bắp nước với giá ưu đãi đặc biệt.',
    content: 'Chào mừng quý khách hàng thân thiết, chương trình Member Day được áp dụng tại tất cả các cụm rạp Cinemax trên toàn quốc vào mỗi thứ 4 hàng tuần với vô vàn đặc quyền hấp dẫn.',
    img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    category: 'Khuyến mãi',
    author: 'CSKH Cinemax',
  },
];

const DEFAULT_SETTINGS: SiteSettings = {
  hero_title: 'Dune: Hành Tinh Cát - Phần 2',
  hero_subtitle: 'T13 • 148 phút • Hành Động, Phiêu Lưu • Phụ đề Việt',
  hotline: '1900 1234',
  support_email: 'hotro@cinemax.vn',
  announcement_banner: 'Chào mừng bạn đến với Cinemax — Trải nghiệm điện ảnh đỉnh cao!',
  featured_movie_id: 1,
};

interface DataContextType {
  movies: Movie[];
  cinemas: Cinema[];
  showtimes: Showtime[];
  promotions: Promotion[];
  foods: FoodItem[];
  news: NewsArticle[];
  siteSettings: SiteSettings;
  isLoaded: boolean;
  supabaseConnected: boolean;
  supabaseWritable: boolean;
  soldSeatsByShowtime: Record<number, string[]>;
  seatUuidLookup: Record<string, string>;
  tableCounts: Record<string, number>;
  auditoriums: any[];
  refreshFromSupabase: () => Promise<void>;

  // Movies CRUD
  addMovie: (movieData: Partial<Movie>) => Movie;
  updateMovie: (id: number | string, movieData: Partial<Movie>) => void;
  deleteMovie: (id: number | string) => void;

  // Cinemas CRUD
  addCinema: (cinemaData: Partial<Cinema>) => Cinema;
  updateCinema: (id: number | string, cinemaData: Partial<Cinema>) => void;
  deleteCinema: (id: number | string) => void;

  // Showtimes CRUD
  addShowtime: (showtimeData: Partial<Showtime>) => Showtime;
  updateShowtime: (id: number | string, showtimeData: Partial<Showtime>) => void;
  deleteShowtime: (id: number | string) => void;

  // Promotions CRUD
  addPromotion: (promoData: Partial<Promotion>) => Promotion;
  updatePromotion: (id: number | string, promoData: Partial<Promotion>) => void;
  deletePromotion: (id: number | string) => void;

  // Food Items CRUD
  addFoodItem: (foodData: Partial<FoodItem>) => FoodItem;
  updateFoodItem: (id: number | string, foodData: Partial<FoodItem>) => void;
  deleteFoodItem: (id: number | string) => void;

  // News CRUD
  addNewsArticle: (newsData: Partial<NewsArticle>) => NewsArticle;
  updateNewsArticle: (id: number | string, newsData: Partial<NewsArticle>) => void;
  deleteNewsArticle: (id: number | string) => void;

  // Site Settings
  updateSiteSettings: (settings: Partial<SiteSettings>) => void;

  // Reset to default
  resetAllDataToDefault: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STALE_MOCK_NAMES = [
  'cinemax hà nội centre',
  'cinemax cầu giấy',
  'cinemax landmark 81',
  'cinemax giải phóng',
  'cinemax landmark',
];

export function sanitizeCinemas(raw: any[]): Cinema[] {
  if (!Array.isArray(raw) || raw.length === 0) return MOCK_CINEMAS;
  const filtered = raw.filter((c: any) => {
    if (!c || !c.name || typeof c.name !== 'string') return false;
    const nameLower = c.name.trim().toLowerCase();
    return !STALE_MOCK_NAMES.includes(nameLower);
  });
  if (filtered.length === 0) return MOCK_CINEMAS;
  return filtered.map((c: any, idx: number) => ({
    id: c.id && typeof c.id === 'number' ? c.id : idx + 1,
    name: c.name,
    address: c.address || '',
    city: c.city || 'Hà Nội',
    district: c.district || c.city || 'Hà Nội',
    phone: c.phone || c.hotline || '1900 1081',
    is_active: true,
  }));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [movies, setMovies] = useState<Movie[]>(MOCK_MOVIES);
  const [cinemas, setCinemas] = useState<Cinema[]>(MOCK_CINEMAS);
  const [showtimes, setShowtimes] = useState<Showtime[]>(MOCK_SHOWTIMES);
  const [promotions, setPromotions] = useState<Promotion[]>(MOCK_PROMOTIONS);
  const [foods, setFoods] = useState<FoodItem[]>(MOCK_FOODS);
  const [news, setNews] = useState<NewsArticle[]>(DEFAULT_NEWS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [supabaseWritable, setSupabaseWritable] = useState<boolean>(false);
  const [soldSeatsByShowtime, setSoldSeatsByShowtime] = useState<Record<number, string[]>>({});
  const [seatUuidLookup, setSeatUuidLookup] = useState<Record<string, string>>({});
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [auditoriums, setAuditoriums] = useState<any[]>([]);

  const refreshFromSupabase = useCallback(async () => {
    try {
      const [catalog, writeStatus] = await Promise.all([
        fetchSupabaseCatalog(),
        probeSupabaseWriteAccess(),
      ]);
      const supabase = createClient();
      const { data: supaAuds } = await supabase.from('auditoriums').select('*').order('name', { ascending: true });
      if (supaAuds && supaAuds.length > 0) {
        setAuditoriums(supaAuds);
        localStorage.setItem('cinemax_auditoriums_v2', JSON.stringify(supaAuds));
      }
      if (catalog.connected) {
        setSupabaseConnected(true);
        setSupabaseWritable(writeStatus.writable);
        setMovies(catalog.movies);
        setCinemas(catalog.cinemas);
        setShowtimes(catalog.showtimes);
        setFoods(catalog.foods);
        setPromotions(catalog.promotions);
        setSoldSeatsByShowtime(catalog.soldSeatsByShowtime);
        setSeatUuidLookup(catalog.seatUuidLookup);
        setTableCounts(catalog.tableCounts);
        if (catalog.siteSettings) {
          setSiteSettings((prev) => ({ ...prev, ...catalog.siteSettings }));
        }
        localStorage.setItem('cinemax_movies_v2', JSON.stringify(catalog.movies));
        localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(catalog.cinemas));
        localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(catalog.showtimes));
        localStorage.setItem('cinemax_foods_v2', JSON.stringify(catalog.foods));
        localStorage.setItem('cinemax_promotions_v2', JSON.stringify(catalog.promotions));
      }
    } catch (err) {
      console.error('Supabase sync warning:', err);
    }
  }, []);

  // Sync state from Supabase first, with LocalStorage & Server Store fallback
  const syncFromSupabaseAndStorage = async () => {
    try {
      // 1. Initial hydration from local storage for 0ms paint
      try {
        const storedMovies = localStorage.getItem('cinemax_movies_v2');
        if (storedMovies) {
          const parsed = JSON.parse(storedMovies);
          if (Array.isArray(parsed) && parsed.length > 0) setMovies(parsed);
        }
        const storedCinemas = localStorage.getItem('cinemax_cinemas_v2') || localStorage.getItem('cinemax_cinemas_list');
        if (storedCinemas) {
          try {
            const parsed = JSON.parse(storedCinemas);
            const sanitized = sanitizeCinemas(parsed);
            setCinemas(sanitized);
            if (sanitized.length !== parsed.length || (sanitized[0] && sanitized[0].name !== parsed[0]?.name)) {
              localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(sanitized));
            }
          } catch {}
        }
        const storedShowtimes = localStorage.getItem('cinemax_showtimes_v2');
        if (storedShowtimes) setShowtimes(JSON.parse(storedShowtimes));
        const storedPromotions = localStorage.getItem('cinemax_promotions_v2');
        if (storedPromotions) setPromotions(JSON.parse(storedPromotions));
        const storedFoods = localStorage.getItem('cinemax_foods_v2');
        if (storedFoods) setFoods(JSON.parse(storedFoods));
        const storedNews = localStorage.getItem('cinemax_news_v2');
        if (storedNews) setNews(JSON.parse(storedNews));
        const storedSettings = localStorage.getItem('cinemax_site_settings_v2');
        if (storedSettings) setSiteSettings(JSON.parse(storedSettings));
        const storedAuds = localStorage.getItem('cinemax_auditoriums_v2');
        if (storedAuds) setAuditoriums(JSON.parse(storedAuds));
      } catch (hydrateErr) {
        console.warn('Hydration from localStorage warning:', hydrateErr);
      }

      // 2. Fetch fresh authoritative data from Supabase Cloud
      const [catalog, writeStatus] = await Promise.all([
        fetchSupabaseCatalog(),
        probeSupabaseWriteAccess(),
      ]);

      if (catalog.connected && catalog.movies?.length > 0) {
        setSupabaseConnected(true);
        setSupabaseWritable(writeStatus.writable);
        setMovies(catalog.movies);
        setCinemas(catalog.cinemas);
        setShowtimes(catalog.showtimes);
        setFoods(catalog.foods);
        setPromotions(catalog.promotions);
        setSoldSeatsByShowtime(catalog.soldSeatsByShowtime);
        setSeatUuidLookup(catalog.seatUuidLookup);
        setTableCounts(catalog.tableCounts);
        if (catalog.siteSettings) {
          setSiteSettings((prev) => ({ ...prev, ...catalog.siteSettings }));
        }

        // Cache fresh Supabase data to localStorage
        localStorage.setItem('cinemax_movies_v2', JSON.stringify(catalog.movies));
        localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(catalog.cinemas));
        localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(catalog.showtimes));
        localStorage.setItem('cinemax_foods_v2', JSON.stringify(catalog.foods));
        localStorage.setItem('cinemax_promotions_v2', JSON.stringify(catalog.promotions));

        const supabase = createClient();
        const { data: freshAuds } = await supabase.from('auditoriums').select('*').order('name', { ascending: true });
        if (freshAuds && freshAuds.length > 0) {
          setAuditoriums(freshAuds);
          localStorage.setItem('cinemax_auditoriums_v2', JSON.stringify(freshAuds));
        }
      } else {
        // 3. Fallback to /api/sync if Supabase is offline
        try {
          const syncRes = await fetch('/api/sync');
          if (syncRes.ok) {
            const syncJson = await syncRes.json();
            if (syncJson.success && syncJson.data) {
              const d = syncJson.data;
              if (d.movies?.length) setMovies(d.movies);
              if (d.foods?.length) setFoods(d.foods);
              if (d.promotions?.length) setPromotions(d.promotions);
            }
          }
        } catch (syncErr) {
          console.warn('Fallback sync store warning:', syncErr);
        }
      }
    } catch (err) {
      console.error('Failed to sync data:', err);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    syncFromSupabaseAndStorage();

    // Listen to live database update events from Admin for ALL entities
    const handleDbUpdated = (e: any) => {
      queueMicrotask(() => {
        let handled = false;
        if (e?.detail?.movies && Array.isArray(e.detail.movies)) {
          setMovies(e.detail.movies);
          localStorage.setItem('cinemax_movies_v2', JSON.stringify(e.detail.movies));
          handled = true;
        }
        if (e?.detail?.promotions && Array.isArray(e.detail.promotions)) {
          setPromotions(e.detail.promotions);
          localStorage.setItem('cinemax_promotions_v2', JSON.stringify(e.detail.promotions));
          handled = true;
        }
        if (e?.detail?.foods && Array.isArray(e.detail.foods)) {
          setFoods(e.detail.foods);
          localStorage.setItem('cinemax_foods_v2', JSON.stringify(e.detail.foods));
          handled = true;
        }
        if (e?.detail?.showtimes && Array.isArray(e.detail.showtimes)) {
          setShowtimes(e.detail.showtimes);
          localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(e.detail.showtimes));
          handled = true;
        }
        if (e?.detail?.cinemas && Array.isArray(e.detail.cinemas)) {
          setCinemas(e.detail.cinemas);
          localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(e.detail.cinemas));
          handled = true;
        }
        if (e?.detail?.siteSettings) {
          setSiteSettings(e.detail.siteSettings);
          localStorage.setItem('cinemax_site_settings_v2', JSON.stringify(e.detail.siteSettings));
          handled = true;
        }
        if (e?.detail?.auditoriums && Array.isArray(e.detail.auditoriums)) {
          setAuditoriums(e.detail.auditoriums);
          localStorage.setItem('cinemax_auditoriums_v2', JSON.stringify(e.detail.auditoriums));
          handled = true;
        }

        if (!handled) {
          // Fallback to local storage reads
          const localM = localStorage.getItem('cinemax_movies_v2');
          if (localM) try { setMovies(JSON.parse(localM)); } catch {}
          const localA = localStorage.getItem('cinemax_auditoriums_v2');
          if (localA) try { setAuditoriums(JSON.parse(localA)); } catch {}
          const localP = localStorage.getItem('cinemax_promotions_v2');
          if (localP) try { setPromotions(JSON.parse(localP)); } catch {}
          const localF = localStorage.getItem('cinemax_foods_v2');
          if (localF) try { setFoods(JSON.parse(localF)); } catch {}
          const localS = localStorage.getItem('cinemax_showtimes_v2');
          if (localS) try { setShowtimes(JSON.parse(localS)); } catch {}
          const localC = localStorage.getItem('cinemax_cinemas_v2') || localStorage.getItem('cinemax_cinemas_list');
          if (localC) {
            try {
              const parsed = JSON.parse(localC);
              const sanitized = sanitizeCinemas(parsed);
              setCinemas(sanitized);
            } catch {}
          }
          const localSet = localStorage.getItem('cinemax_site_settings_v2');
          if (localSet) try { setSiteSettings(JSON.parse(localSet)); } catch {}
        }
      });
    };

    window.addEventListener('cinemax_db_updated', handleDbUpdated);
    window.addEventListener('cinemax_data_updated', handleDbUpdated);
    window.addEventListener('storage', handleDbUpdated);

    // Cross-tab broadcast sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('cinemax_sync_channel');
      bc.onmessage = (msg) => {
        if (msg?.data?.promotions && Array.isArray(msg.data.promotions)) {
          setPromotions(msg.data.promotions);
          localStorage.setItem('cinemax_promotions_v2', JSON.stringify(msg.data.promotions));
        }
        if (msg?.data?.cinemas && Array.isArray(msg.data.cinemas)) {
          setCinemas(msg.data.cinemas);
        }
        refreshFromSupabase();
      };
    } catch {}

    // Subscribe to Supabase Realtime changes
    const supabase = createClient();
    const channel = supabase
      .channel('cinemax-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showtimes' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showtime_seats' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auditoriums' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, () => {
        refreshFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cinema_settings' }, () => {
        refreshFromSupabase();
      })
      .subscribe();

    return () => {
      window.removeEventListener('cinemax_db_updated', handleDbUpdated);
      window.removeEventListener('cinemax_data_updated', handleDbUpdated);
      window.removeEventListener('storage', handleDbUpdated);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [refreshFromSupabase]);

  // Helper save functions
  const saveMovies = (newMovies: Movie[]) => {
    setMovies(newMovies);
    localStorage.setItem('cinemax_movies_v2', JSON.stringify(newMovies));
  };

  const saveCinemas = (newCinemas: Cinema[]) => {
    setCinemas(newCinemas);
    localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(newCinemas));
  };

  const saveShowtimes = (newShowtimes: Showtime[]) => {
    setShowtimes(newShowtimes);
    localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(newShowtimes));
  };

  const savePromotions = (newPromos: Promotion[]) => {
    setPromotions(newPromos);
    localStorage.setItem('cinemax_promotions_v2', JSON.stringify(newPromos));
  };

  const saveFoods = (newFoods: FoodItem[]) => {
    setFoods(newFoods);
    localStorage.setItem('cinemax_foods_v2', JSON.stringify(newFoods));
  };

  const saveNews = (newNews: NewsArticle[]) => {
    setNews(newNews);
    localStorage.setItem('cinemax_news_v2', JSON.stringify(newNews));
  };

  const saveSettings = (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
    localStorage.setItem('cinemax_site_settings_v2', JSON.stringify(newSettings));
  };

  // Movies CRUD (Local + Supabase)
  const addMovie = (movieData: Partial<Movie>): Movie => {
    const slug = (movieData.title || `phim-moi-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const movie: Movie = {
      id: Date.now(),
      title: movieData.title || 'Phim mới',
      original_title: movieData.original_title || '',
      slug,
      synopsis: movieData.synopsis || 'Nội dung tóm tắt phim.',
      duration_min: movieData.duration_min || 120,
      release_date: movieData.release_date || '2026-10-15',
      age_rating: movieData.age_rating || 'T13',
      country: movieData.country || 'Việt Nam',
      director: movieData.director || '',
      cast_list: movieData.cast_list || '',
      poster_url: movieData.poster_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
      banner_url: movieData.banner_url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1440&q=80',
      trailer_url: movieData.trailer_url || 'https://www.youtube.com/watch?v=Way9Dexny3w',
      imdb_score: movieData.imdb_score || 8.0,
      status: movieData.status || 'NOW_SHOWING',
      is_deleted: false,
      genres: movieData.genres || [{ id: 1, name: 'Hành Động', slug: 'hanh-dong' }],
    };
    saveMovies([movie, ...movies]);

    const supabase = createClient();
    supabase
      .from('movies')
      .insert({
        title: movie.title,
        slug: movie.slug,
        synopsis: movie.synopsis,
        director: movie.director,
        cast_list: movie.cast_list,
        language: 'Tiếng Việt',
        duration_minutes: movie.duration_min,
        age_rating: movie.age_rating,
        poster_url: movie.poster_url,
        banner_url: movie.banner_url,
        trailer_url: movie.trailer_url,
        status: movie.status.toLowerCase(),
      })
      .then(() => refreshFromSupabase());

    return movie;
  };

  const updateMovie = (id: number | string, movieData: Partial<Movie>) => {
    const target = movies.find((m) => String(m.id) === String(id));
    const updated = movies.map((m) => (String(m.id) === String(id) ? { ...m, ...movieData } : m));
    saveMovies(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('movies')
        .update({
          ...(movieData.title ? { title: movieData.title } : {}),
          ...(movieData.synopsis ? { synopsis: movieData.synopsis } : {}),
          ...(movieData.duration_min ? { duration_minutes: movieData.duration_min } : {}),
          ...(movieData.age_rating ? { age_rating: movieData.age_rating } : {}),
          ...(movieData.status ? { status: movieData.status.toLowerCase() } : {}),
          ...(movieData.poster_url ? { poster_url: movieData.poster_url } : {}),
        })
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  const deleteMovie = (id: number | string) => {
    const target = movies.find((m) => String(m.id) === String(id));
    const updated = movies.filter((m) => String(m.id) !== String(id));
    saveMovies(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('movies')
        .delete()
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  // Cinemas CRUD
  const addCinema = (cinemaData: Partial<Cinema>): Cinema => {
    const cinema: Cinema = {
      id: Date.now(),
      name: cinemaData.name || 'Cinemax Chi Nhánh Mới',
      address: cinemaData.address || 'Địa chỉ rạp chiếu',
      city: cinemaData.city || 'TP. Hồ Chí Minh',
      phone: cinemaData.phone || '1900 1234',
      is_active: true,
      image_url: cinemaData.image_url,
    };
    saveCinemas([...cinemas, cinema]);
    return cinema;
  };

  const updateCinema = (id: number | string, cinemaData: Partial<Cinema>) => {
    const updated = cinemas.map((c) => (String(c.id) === String(id) ? { ...c, ...cinemaData } : c));
    saveCinemas(updated);
  };

  const deleteCinema = (id: number | string) => {
    const updated = cinemas.filter((c) => String(c.id) !== String(id));
    saveCinemas(updated);
  };

  // Showtimes CRUD (Local + Supabase)
  const addShowtime = (showtimeData: Partial<Showtime>): Showtime => {
    const movieObj = movies.find((m) => m.id === showtimeData.movie_id) || movies[0];
    const showtime: Showtime = {
      id: Date.now(),
      movie_id: showtimeData.movie_id || (movies[0]?.id ?? 1),
      room_id: showtimeData.room_id || 101,
      start_time: showtimeData.start_time || new Date().toISOString(),
      end_time: showtimeData.end_time || new Date(Date.now() + 2 * 3600000).toISOString(),
      language_type: showtimeData.language_type || 'SUBTITLED',
      status: showtimeData.status || 'OPEN',
      movie: movieObj,
      available_seats: 80,
    };
    saveShowtimes([showtime, ...showtimes]);

    if (movieObj?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('showtimes')
        .insert({
          movie_id: movieObj.supabase_id,
          auditorium_id: 'd8eae7e2-cf8d-40c6-96d2-bc690626e180',
          format: '2D',
          language_version: showtime.language_type === 'DUBBED' ? 'Lồng tiếng Việt' : 'Phụ đề Tiếng Việt',
          starts_at: showtime.start_time,
          ends_at: showtime.end_time,
          status: 'open',
        })
        .then(() => refreshFromSupabase());
    }
    return showtime;
  };

  const updateShowtime = (id: number | string, showtimeData: Partial<Showtime>) => {
    const target = showtimes.find((s) => String(s.id) === String(id));
    const updated = showtimes.map((s) => (String(s.id) === String(id) ? { ...s, ...showtimeData } : s));
    saveShowtimes(updated);

    if (target?.supabase_id && showtimeData.status) {
      const supabase = createClient();
      supabase
        .from('showtimes')
        .update({ status: showtimeData.status.toLowerCase() })
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  const deleteShowtime = (id: number | string) => {
    const target = showtimes.find((s) => String(s.id) === String(id));
    const updated = showtimes.filter((s) => String(s.id) !== String(id));
    saveShowtimes(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('showtimes')
        .delete()
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  // Promotions CRUD (Local + Supabase coupons)
  const addPromotion = (promoData: Partial<Promotion>): Promotion => {
    const promo: Promotion = {
      id: Date.now(),
      code: (promoData.code || 'SALE20').toUpperCase(),
      description: promoData.description || 'Giảm giá ưu đãi đặc biệt',
      discount_type: promoData.discount_type || 'FIXED',
      discount_value: promoData.discount_value || 20000,
      min_order: promoData.min_order || 100000,
      per_user_limit: promoData.per_user_limit || 1,
      used_count: 0,
      valid_from: promoData.valid_from || '2026-01-01',
      valid_to: promoData.valid_to || '2026-12-31',
      is_active: promoData.is_active !== undefined ? promoData.is_active : true,
    };
    savePromotions([promo, ...promotions]);

    const supabase = createClient();
    supabase
      .from('coupons')
      .insert({
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        min_order_amount: promo.min_order,
        apply_scope: 'ALL',
        starts_at: new Date(promo.valid_from).toISOString(),
        ends_at: new Date(promo.valid_to).toISOString(),
        active: promo.is_active,
      })
      .then(() => refreshFromSupabase());

    return promo;
  };

  const updatePromotion = (id: number | string, promoData: Partial<Promotion>) => {
    const target = promotions.find((p) => String(p.id) === String(id));
    const updated = promotions.map((p) => (String(p.id) === String(id) ? { ...p, ...promoData } : p));
    savePromotions(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('coupons')
        .update({
          ...(promoData.code ? { code: promoData.code } : {}),
          ...(promoData.discount_value !== undefined ? { discount_value: promoData.discount_value } : {}),
          ...(promoData.is_active !== undefined ? { active: promoData.is_active } : {}),
        })
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  const deletePromotion = (id: number | string) => {
    const target = promotions.find((p) => String(p.id) === String(id));
    const updated = promotions.filter((p) => String(p.id) !== String(id));
    savePromotions(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('coupons')
        .delete()
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  // Food Items CRUD (Local + Supabase products)
  const addFoodItem = (foodData: Partial<FoodItem>): FoodItem => {
    const food: FoodItem = {
      id: Date.now(),
      name: foodData.name || 'Combo mới',
      category: foodData.category || 'COMBO',
      description: foodData.description || 'Thơm ngon hấp dẫn',
      price: foodData.price || 59000,
      stock: foodData.stock ?? 100,
      image_url: foodData.image_url || 'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=400&q=80',
      is_active: true,
    };
    saveFoods([food, ...foods]);

    const supabase = createClient();
    supabase
      .from('products')
      .insert({
        name: food.name,
        product_type: food.category === 'POPCORN' ? 'FOOD' : food.category === 'DRINK' ? 'BEVERAGE' : 'COMBO',
        base_price: food.price,
        available_stock: food.stock ?? 100,
        active: true,
        image_url: food.image_url,
      })
      .then(() => refreshFromSupabase());

    return food;
  };

  const updateFoodItem = (id: number | string, foodData: Partial<FoodItem>) => {
    const target = foods.find((f) => String(f.id) === String(id));
    const updated = foods.map((f) => (String(f.id) === String(id) ? { ...f, ...foodData } : f));
    saveFoods(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('products')
        .update({
          ...(foodData.name ? { name: foodData.name } : {}),
          ...(foodData.price !== undefined ? { base_price: foodData.price } : {}),
          ...(foodData.stock !== undefined ? { available_stock: foodData.stock } : {}),
          ...(foodData.is_active !== undefined ? { active: foodData.is_active } : {}),
        })
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  const deleteFoodItem = (id: number | string) => {
    const target = foods.find((f) => String(f.id) === String(id));
    const updated = foods.filter((f) => String(f.id) !== String(id));
    saveFoods(updated);

    if (target?.supabase_id) {
      const supabase = createClient();
      supabase
        .from('products')
        .delete()
        .eq('id', target.supabase_id)
        .then(() => refreshFromSupabase());
    }
  };

  // News Articles CRUD
  const addNewsArticle = (newsData: Partial<NewsArticle>): NewsArticle => {
    const article: NewsArticle = {
      id: Date.now(),
      title: newsData.title || 'Tiêu đề bài viết mới',
      date: newsData.date || new Date().toLocaleDateString('vi-VN'),
      summary: newsData.summary || 'Tóm tắt bài viết.',
      content: newsData.content || 'Nội dung chi tiết bài viết.',
      img: newsData.img || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      category: newsData.category || 'Điện ảnh',
      author: newsData.author || 'Ban biên tập',
    };
    saveNews([article, ...news]);
    return article;
  };

  const updateNewsArticle = (id: number | string, newsData: Partial<NewsArticle>) => {
    const updated = news.map((n) => (String(n.id) === String(id) ? { ...n, ...newsData } : n));
    saveNews(updated);
  };

  const deleteNewsArticle = (id: number | string) => {
    const updated = news.filter((n) => String(n.id) !== String(id));
    saveNews(updated);
  };

  // Site Settings
  const updateSiteSettings = (settings: Partial<SiteSettings>) => {
    const updated = { ...siteSettings, ...settings };
    saveSettings(updated);
  };

  // Reset all to default
  const resetAllDataToDefault = () => {
    saveMovies(MOCK_MOVIES);
    saveCinemas(MOCK_CINEMAS);
    saveShowtimes(MOCK_SHOWTIMES);
    savePromotions(MOCK_PROMOTIONS);
    saveFoods(MOCK_FOODS);
    saveNews(DEFAULT_NEWS);
    saveSettings(DEFAULT_SETTINGS);
    refreshFromSupabase();
  };

  return (
    <DataContext.Provider
      value={{
        movies,
        cinemas,
        showtimes,
        promotions,
        foods,
        news,
        siteSettings,
        isLoaded,
        supabaseConnected,
        supabaseWritable,
        soldSeatsByShowtime,
        seatUuidLookup,
        tableCounts,
        refreshFromSupabase,
        addMovie,
        updateMovie,
        deleteMovie,
        addCinema,
        updateCinema,
        deleteCinema,
        addShowtime,
        updateShowtime,
        deleteShowtime,
        addPromotion,
        updatePromotion,
        deletePromotion,
        addFoodItem,
        updateFoodItem,
        deleteFoodItem,
        addNewsArticle,
        updateNewsArticle,
        deleteNewsArticle,
        updateSiteSettings,
        resetAllDataToDefault,
        auditoriums,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
