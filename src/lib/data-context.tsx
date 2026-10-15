'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [movies, setMovies] = useState<Movie[]>(MOCK_MOVIES);
  const [cinemas, setCinemas] = useState<Cinema[]>(MOCK_CINEMAS);
  const [showtimes, setShowtimes] = useState<Showtime[]>(MOCK_SHOWTIMES);
  const [promotions, setPromotions] = useState<Promotion[]>(MOCK_PROMOTIONS);
  const [foods, setFoods] = useState<FoodItem[]>(MOCK_FOODS);
  const [news, setNews] = useState<NewsArticle[]>(DEFAULT_NEWS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Initialize from LocalStorage or seed defaults
  useEffect(() => {
    try {
      const storedMovies = localStorage.getItem('cinemax_movies_v2');
      if (storedMovies) {
        setMovies(JSON.parse(storedMovies));
      } else {
        localStorage.setItem('cinemax_movies_v2', JSON.stringify(MOCK_MOVIES));
      }

      const storedCinemas = localStorage.getItem('cinemax_cinemas_v2');
      if (storedCinemas) {
        setCinemas(JSON.parse(storedCinemas));
      } else {
        localStorage.setItem('cinemax_cinemas_v2', JSON.stringify(MOCK_CINEMAS));
      }

      const storedShowtimes = localStorage.getItem('cinemax_showtimes_v2');
      if (storedShowtimes) {
        setShowtimes(JSON.parse(storedShowtimes));
      } else {
        localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(MOCK_SHOWTIMES));
      }

      const storedPromotions = localStorage.getItem('cinemax_promotions_v2');
      if (storedPromotions) {
        setPromotions(JSON.parse(storedPromotions));
      } else {
        localStorage.setItem('cinemax_promotions_v2', JSON.stringify(MOCK_PROMOTIONS));
      }

      const storedFoods = localStorage.getItem('cinemax_foods_v2');
      if (storedFoods) {
        setFoods(JSON.parse(storedFoods));
      } else {
        localStorage.setItem('cinemax_foods_v2', JSON.stringify(MOCK_FOODS));
      }

      const storedNews = localStorage.getItem('cinemax_news_v2');
      if (storedNews) {
        setNews(JSON.parse(storedNews));
      } else {
        localStorage.setItem('cinemax_news_v2', JSON.stringify(DEFAULT_NEWS));
      }

      const storedSettings = localStorage.getItem('cinemax_site_settings_v2');
      if (storedSettings) {
        setSiteSettings(JSON.parse(storedSettings));
      } else {
        localStorage.setItem('cinemax_site_settings_v2', JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (err) {
      console.error('Failed to load local database', err);
    } finally {
      setIsLoaded(true);
    }

    // Tự động đồng bộ dữ liệu thật từ Supabase (Chức năng 4.1)
    const syncFromSupabase = async () => {
      try {
        const { MovieService } = await import('@/services/movie.service');
        const [nowShowing, comingSoon] = await Promise.all([
          MovieService.getNowShowingMovies(),
          MovieService.getComingSoonMovies()
        ]);

        const allSupabaseMovies = [...nowShowing, ...comingSoon];
        if (allSupabaseMovies.length > 0) {
          const mappedMovies: Movie[] = allSupabaseMovies.map((m: any, index: number) => ({
            id: m.id,
            title: m.title,
            slug: m.slug,
            synopsis: m.synopsis || '',
            duration_min: m.duration_minutes || 120,
            duration_minutes: m.duration_minutes,
            release_date: m.release_date,
            end_date: m.end_date,
            age_rating: m.age_rating as any,
            director: m.director,
            cast_list: m.cast_list,
            language: m.language,
            poster_url: m.poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
            banner_url: m.banner_url || m.poster_url,
            trailer_url: m.trailer_url,
            status: (m.status === 'now_showing' || m.status === 'SHOWING') ? 'NOW_SHOWING' : 'COMING_SOON',
            genres: m.genres || [],
            created_at: m.created_at,
          }));

          setMovies(mappedMovies);
          localStorage.setItem('cinemax_movies_v2', JSON.stringify(mappedMovies));
        }
      } catch (e) {
        console.warn('Lưu ý: Không thể kết nối Supabase, đang dùng cache/mock data:', e);
      }
    };

    syncFromSupabase();
  }, []);

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

  // Movies CRUD
  const addMovie = (movieData: Partial<Movie>): Movie => {
    const movie: Movie = {
      id: Date.now(),
      title: movieData.title || 'Phim mới',
      original_title: movieData.original_title || '',
      slug: (movieData.title || 'phim-moi').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      synopsis: movieData.synopsis || 'Nội dung tóm tắt phim.',
      duration_min: movieData.duration_min || 120,
      release_date: movieData.release_date || '01/10/2026',
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
    return movie;
  };

  const updateMovie = (id: number | string, movieData: Partial<Movie>) => {
    const updated = movies.map((m) => (m.id == id ? { ...m, ...movieData } : m));
    saveMovies(updated);
  };

  const deleteMovie = (id: number | string) => {
    const updated = movies.filter((m) => m.id != id);
    saveMovies(updated);
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
    const updated = cinemas.map((c) => (c.id == id ? { ...c, ...cinemaData } : c));
    saveCinemas(updated);
  };

  const deleteCinema = (id: number | string) => {
    const updated = cinemas.filter((c) => c.id != id);
    saveCinemas(updated);
  };

  // Showtimes CRUD
  const addShowtime = (showtimeData: Partial<Showtime>): Showtime => {
    const showtime: Showtime = {
      id: Date.now(),
      movie_id: showtimeData.movie_id || (movies[0]?.id ?? 1),
      room_id: showtimeData.room_id || 1,
      start_time: showtimeData.start_time || new Date().toISOString(),
      end_time: showtimeData.end_time || new Date().toISOString(),
      language_type: showtimeData.language_type || 'SUBTITLED',
      status: showtimeData.status || 'OPEN',
      movie: movies.find((m) => m.id == showtimeData.movie_id) || movies[0],
      available_seats: 80,
    };
    saveShowtimes([showtime, ...showtimes]);
    return showtime;
  };

  const updateShowtime = (id: number | string, showtimeData: Partial<Showtime>) => {
    const updated = showtimes.map((s) => (s.id == id ? { ...s, ...showtimeData } : s));
    saveShowtimes(updated);
  };

  const deleteShowtime = (id: number | string) => {
    const updated = showtimes.filter((s) => s.id != id);
    saveShowtimes(updated);
  };

  // Promotions CRUD
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
    return promo;
  };

  const updatePromotion = (id: number | string, promoData: Partial<Promotion>) => {
    const updated = promotions.map((p) => (p.id == id ? { ...p, ...promoData } : p));
    savePromotions(updated);
  };

  const deletePromotion = (id: number | string) => {
    const updated = promotions.filter((p) => p.id != id);
    savePromotions(updated);
  };

  // Food Items CRUD
  const addFoodItem = (foodData: Partial<FoodItem>): FoodItem => {
    const food: FoodItem = {
      id: Date.now(),
      name: foodData.name || 'Combo mới',
      category: foodData.category || 'COMBO',
      description: foodData.description || 'Thơm ngon hấp dẫn',
      price: foodData.price || 59000,
      image_url: foodData.image_url || 'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=400&q=80',
      is_active: true,
    };
    saveFoods([food, ...foods]);
    return food;
  };

  const updateFoodItem = (id: number | string, foodData: Partial<FoodItem>) => {
    const updated = foods.map((f) => (f.id == id ? { ...f, ...foodData } : f));
    saveFoods(updated);
  };

  const deleteFoodItem = (id: number | string) => {
    const updated = foods.filter((f) => f.id != id);
    saveFoods(updated);
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
    const updated = news.map((n) => (n.id == id ? { ...n, ...newsData } : n));
    saveNews(updated);
  };

  const deleteNewsArticle = (id: number | string) => {
    const updated = news.filter((n) => n.id != id);
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
