'use client';

import React, { useState } from 'react';
import {
  Film,
  Plus,
  Search,
  Edit3,
  Trash2,
  Clock,
  Calendar,
  X,
  Check,
  AlertCircle,
  Eye,
  CheckCircle2,
  Image as ImageIcon,
  Video,
  Layers,
  Globe,
  Building2,
  Users,
  Star,
  Tag,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Upload,
  Loader2,
  Flame
} from 'lucide-react';
import { Movie, Genre, AgeRating, MovieStatus, MovieTier } from '@/lib/types-redesign';

interface MoviesViewProps {
  movies: Movie[];
  genres: Genre[];
  onSaveMovie: (movie: Partial<Movie>) => Promise<void>;
  onDeleteMovie: (id: string) => Promise<void>;
  showToast: (msg: string) => void;
}

// Preset Reference Lists
const PRESET_FORMATS = ['2D', '3D', 'IMAX', '4DX', 'Dolby Atmos', 'ScreenX'];

const PRESET_LANGUAGES = [
  'Tiếng Anh - Phụ đề Tiếng Việt',
  'Tiếng Việt - Bản gốc',
  'Tiếng Anh - Lồng tiếng Tiếng Việt',
  'Tiếng Hàn - Phụ đề Tiếng Việt',
  'Tiếng Nhật - Phụ đề Tiếng Việt',
  'Tiếng Trung - Phụ đề Tiếng Việt',
  'Lồng tiếng Việt (Gia đình / Trẻ em)',
  'Phụ đề Tiếng Anh'
];

const PRESET_COUNTRIES = [
  'Việt Nam',
  'Mỹ (Hollywood)',
  'Hàn Quốc',
  'Nhật Bản',
  'Anh Quốc',
  'Pháp',
  'Thái Lan',
  'Trung Quốc',
  'Đức',
  'Khác'
];

const PRESET_STUDIOS = [
  'Warner Bros. Pictures',
  'Universal Pictures',
  'Walt Disney Studios',
  'Sony Pictures Entertainment',
  'Paramount Pictures',
  'CJ HK Entertainment',
  'Galaxy Studio',
  'BHD Media',
  'Studio 68',
  'A24 Films',
  'Toho Animation',
  'Khác'
];

type ModalTab = 'BASIC' | 'SCREENING' | 'MEDIA' | 'SEO_DETAILS';

export default function MoviesView({
  movies,
  genres,
  onSaveMovie,
  onDeleteMovie,
  showToast
}: MoviesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MovieStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('BASIC');
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [deleteConfirmMovie, setDeleteConfirmMovie] = useState<{ id: string; title: string } | null>(null);

  // Form state
  const [form, setForm] = useState<{
    id?: string;
    // Nhóm cơ bản
    title: string;
    original_title: string;
    slug: string;
    duration_minutes: number;
    age_rating: AgeRating;
    status: MovieStatus;
    release_date: string;
    end_date: string;
    synopsis: string;

    // 1. Phân loại & Cấu hình suất chiếu
    selectedGenreIds: string[];
    formats: string[];
    language: string;

    // 2. Đa phương tiện (Media & UI)
    poster_url: string;
    banner_url: string;
    trailer_url: string;

    // 3. Thông tin chi tiết & Quan hệ
    director: string;
    cast_list: string;
    country: string;
    studio: string;

    // 4. SEO & Marketing
    meta_title: string;
    meta_description: string;
    imdb_score: number;

    // 5. Hạng mục & Ưu tiên xếp suất
    tier: MovieTier;
    is_blockbuster: boolean;
  }>({
    title: '',
    original_title: '',
    slug: '',
    duration_minutes: 120,
    age_rating: 'T13',
    status: 'now_showing',
    release_date: new Date().toISOString().split('T')[0],
    end_date: '',
    synopsis: '',
    selectedGenreIds: [],
    formats: ['2D'],
    language: 'Tiếng Anh - Phụ đề Tiếng Việt',
    poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
    banner_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600',
    trailer_url: '',
    director: '',
    cast_list: '',
    country: 'Mỹ (Hollywood)',
    studio: 'Warner Bros. Pictures',
    meta_title: '',
    meta_description: '',
    imdb_score: 8.5,
    tier: 'STANDARD',
    is_blockbuster: false
  });

  // Custom options state for "Khác" (user-defined additions)
  const [customGenres, setCustomGenres] = useState<Genre[]>([]);
  const [isAddingCustomGenre, setIsAddingCustomGenre] = useState(false);
  const [newGenreInput, setNewGenreInput] = useState('');

  const [customFormats, setCustomFormats] = useState<string[]>([]);
  const [isAddingCustomFormat, setIsAddingCustomFormat] = useState(false);
  const [newFormatInput, setNewFormatInput] = useState('');

  const [isCustomLang, setIsCustomLang] = useState(false);
  const [isCustomCountry, setIsCustomCountry] = useState(false);
  const [isCustomStudio, setIsCustomStudio] = useState(false);

  // Effective genres list (combining DB genres with fallback)
  const availableGenres: Genre[] = genres && genres.length > 0 ? genres : [
    { id: '1', name: 'Hành Động', slug: 'hanh-dong', active: true },
    { id: '2', name: 'Khoa Học Viễn Tưởng', slug: 'khoa-hoc-vien-tuong', active: true },
    { id: '3', name: 'Kinh Dị', slug: 'kinh-di', active: true },
    { id: '4', name: 'Hoạt Hình', slug: 'hoat-hinh', active: true },
    { id: '5', name: 'Phiêu Lưu', slug: 'phieu-luu', active: true },
    { id: '6', name: 'Hài Kịch', slug: 'hai-kich', active: true },
    { id: '7', name: 'Tâm Lý', slug: 'tam-ly', active: true },
    { id: '8', name: 'Gia Đình', slug: 'gia-dinh', active: true }
  ];

  const allGenres = [...availableGenres, ...customGenres];
  const allFormats = Array.from(new Set([...PRESET_FORMATS, ...customFormats]));
  const isPresetLang = PRESET_LANGUAGES.includes(form.language);
  const isPresetCountry = PRESET_COUNTRIES.filter((c) => c !== 'Khác').includes(form.country);
  const isPresetStudio = PRESET_STUDIOS.filter((s) => s !== 'Khác').includes(form.studio);

  const openAddModal = () => {
    setEditingMovie(null);
    setActiveTab('BASIC');
    setCustomGenres([]);
    setCustomFormats([]);
    setIsAddingCustomGenre(false);
    setIsAddingCustomFormat(false);
    setNewGenreInput('');
    setNewFormatInput('');
    setIsCustomLang(false);
    setIsCustomCountry(false);
    setIsCustomStudio(false);

    setForm({
      title: '',
      original_title: '',
      slug: '',
      duration_minutes: 120,
      age_rating: 'T13',
      status: 'now_showing',
      release_date: new Date().toISOString().split('T')[0],
      end_date: '',
      synopsis: '',
      selectedGenreIds: availableGenres.slice(0, 2).map((g) => g.id),
      formats: ['2D', 'IMAX'],
      language: 'Tiếng Anh - Phụ đề Tiếng Việt',
      poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
      banner_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600',
      trailer_url: 'https://www.youtube.com/watch?v=Way9Dexny3w',
      director: '',
      cast_list: '',
      country: 'Mỹ (Hollywood)',
      studio: 'Warner Bros. Pictures',
      meta_title: '',
      meta_description: '',
      imdb_score: 8.5,
      tier: 'STANDARD',
      is_blockbuster: false
    });
    setModalOpen(true);
  };

  const openEditModal = (m: Movie) => {
    setEditingMovie(m);
    setActiveTab('BASIC');
    setIsAddingCustomGenre(false);
    setIsAddingCustomFormat(false);
    setNewGenreInput('');
    setNewFormatInput('');
    
    // Extract genre IDs and collect any custom genres
    const extraGenres: Genre[] = [];
    const currentGenreIds: string[] = [];
    if (m.genres && Array.isArray(m.genres)) {
      m.genres.forEach((g: any) => {
        const match = availableGenres.find((ag) => ag.id === String(g.id) || ag.name === g.name);
        if (match) {
          currentGenreIds.push(match.id);
        } else {
          const customId = String(g.id || `custom_${Date.now()}_${Math.random()}`);
          extraGenres.push({
            id: customId,
            name: g.name,
            slug: g.slug || generateSlug(g.name),
            active: true
          });
          currentGenreIds.push(customId);
        }
      });
    }
    setCustomGenres(extraGenres);

    // Detect any custom formats
    const extraFormats: string[] = [];
    if (m.formats && Array.isArray(m.formats)) {
      m.formats.forEach((f: string) => {
        if (!PRESET_FORMATS.includes(f) && !extraFormats.includes(f)) {
          extraFormats.push(f);
        }
      });
    }
    setCustomFormats(extraFormats);

    setIsCustomLang(!PRESET_LANGUAGES.includes(m.language || ''));
    setIsCustomCountry(!PRESET_COUNTRIES.filter((c) => c !== 'Khác').includes(m.country || ''));
    setIsCustomStudio(!PRESET_STUDIOS.filter((s) => s !== 'Khác').includes(m.studio || ''));

    setForm({
      id: m.id,
      title: m.title || '',
      original_title: m.original_title || m.title || '',
      slug: m.slug || '',
      duration_minutes: m.duration_minutes || 120,
      age_rating: m.age_rating || 'T13',
      status: m.status || 'now_showing',
      release_date: m.release_date || '',
      end_date: m.end_date || '',
      synopsis: m.synopsis || '',
      selectedGenreIds: currentGenreIds.length > 0 ? currentGenreIds : availableGenres.slice(0, 1).map(g => g.id),
      formats: (m.formats && m.formats.length > 0) ? m.formats : ['2D'],
      language: m.language || 'Tiếng Anh - Phụ đề Tiếng Việt',
      poster_url: m.poster_url || '',
      banner_url: m.banner_url || m.poster_url || '',
      trailer_url: m.trailer_url || '',
      director: m.director || '',
      cast_list: m.cast_list || '',
      country: m.country || 'Việt Nam',
      studio: m.studio || '',
      meta_title: m.meta_title || m.title || '',
      meta_description: m.meta_description || m.synopsis || '',
      imdb_score: m.imdb_score || 8.0,
      tier: m.tier || (m.is_blockbuster ? 'BLOCKBUSTER' : 'STANDARD'),
      is_blockbuster: m.is_blockbuster ?? (m.tier === 'BLOCKBUSTER' || false)
    });
    setModalOpen(true);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  const handleTitleChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      title: val,
      slug: editingMovie ? prev.slug : generateSlug(val),
      meta_title: prev.meta_title && prev.meta_title !== prev.title ? prev.meta_title : `${val} | Lịch Chiếu & Đặt Vé Rạp CINEMAX`
    }));
  };

  const toggleGenre = (genreId: string) => {
    setForm((prev) => {
      const exists = prev.selectedGenreIds.includes(genreId);
      return {
        ...prev,
        selectedGenreIds: exists
          ? prev.selectedGenreIds.filter((id) => id !== genreId)
          : [...prev.selectedGenreIds, genreId]
      };
    });
  };

  const handleAddCustomGenre = () => {
    const name = newGenreInput.trim();
    if (!name) return;
    const existing = allGenres.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!form.selectedGenreIds.includes(existing.id)) {
        setForm((prev) => ({ ...prev, selectedGenreIds: [...prev.selectedGenreIds, existing.id] }));
      }
    } else {
      const newG: Genre = {
        id: `custom_${Date.now()}`,
        name,
        slug: generateSlug(name),
        active: true
      };
      setCustomGenres((prev) => [...prev, newG]);
      setForm((prev) => ({ ...prev, selectedGenreIds: [...prev.selectedGenreIds, newG.id] }));
    }
    setNewGenreInput('');
    setIsAddingCustomGenre(false);
  };

  const toggleFormat = (fmt: string) => {
    setForm((prev) => {
      const exists = prev.formats.includes(fmt);
      return {
        ...prev,
        formats: exists
          ? (prev.formats.length > 1 ? prev.formats.filter((f) => f !== fmt) : prev.formats)
          : [...prev.formats, fmt]
      };
    });
  };

  const handleAddCustomFormat = () => {
    const fmt = newFormatInput.trim();
    if (!fmt) return;
    if (!allFormats.includes(fmt)) {
      setCustomFormats((prev) => [...prev, fmt]);
    }
    if (!form.formats.includes(fmt)) {
      setForm((prev) => ({ ...prev, formats: [...prev.formats, fmt] }));
    }
    setNewFormatInput('');
    setIsAddingCustomFormat(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'poster_url' | 'banner_url' | 'trailer_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      showToast('Kích thước tệp quá lớn! Vui lòng chọn tệp nhỏ hơn 30MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, [field]: reader.result as string }));
        showToast(`Đã tải lên tệp cho ${field === 'poster_url' ? 'Poster' : field === 'banner_url' ? 'Banner' : 'Trailer'} thành công!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const autoGenerateSEO = async () => {
    try {
      setIsGeneratingSEO(true);
      const genreNames = allGenres
        .filter((g) => form.selectedGenreIds.includes(g.id))
        .map((g) => g.name);

      const res = await fetch('/api/ai/generate-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          original_title: form.original_title,
          genres: genreNames,
          formats: form.formats,
          duration_minutes: form.duration_minutes,
          director: form.director,
          cast_list: form.cast_list,
          synopsis: form.synopsis
        })
      });

      const data = await res.json();
      if (data && data.success) {
        setForm((prev) => ({
          ...prev,
          meta_title: data.meta_title || prev.meta_title,
          meta_description: data.meta_description || prev.meta_description
        }));
        if (data.source === 'gemini_ai') {
          showToast('Gemini AI đã tạo nội dung chuẩn Sale thành công!');
        } else {
          showToast('Đã tạo nội dung chuẩn Sale phòng vé!');
        }
      } else {
        showToast('Không thể tạo tự động, vui lòng thử lại!');
      }
    } catch (err) {
      console.error('Error auto-generating SEO:', err);
      showToast('Lỗi kết nối khi tạo nội dung SEO.');
    } finally {
      setIsGeneratingSEO(false);
    }
  };

  const extractYoutubeEmbedId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setActiveTab('BASIC');
      showToast('Vui lòng nhập tên phim!');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedGenres = allGenres.filter((g) => form.selectedGenreIds.includes(g.id));

      await onSaveMovie({
        id: editingMovie ? editingMovie.id : undefined,
        title: form.title.trim(),
        original_title: form.original_title.trim() || form.title.trim(),
        slug: form.slug.trim() || generateSlug(form.title),
        duration_minutes: Number(form.duration_minutes) || 90,
        age_rating: form.age_rating,
        status: form.status,
        release_date: form.release_date || null,
        end_date: form.end_date || null,
        synopsis: form.synopsis.trim() || null,

        // 1. Phân loại & Cấu hình suất chiếu
        genres: selectedGenres,
        formats: form.formats,
        language: form.language,

        // 2. Đa phương tiện
        poster_url: form.poster_url.trim() || null,
        banner_url: form.banner_url.trim() || form.poster_url.trim() || null,
        trailer_url: form.trailer_url.trim() || null,

        // 3. Chi tiết & Quan hệ
        director: form.director.trim() || null,
        cast_list: form.cast_list.trim() || null,
        country: form.country.trim() || 'Việt Nam',
        studio: form.studio.trim() || null,

        // 4. SEO & Marketing
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
        imdb_score: Number(form.imdb_score) || 8.0,

        // 5. Hạng mục & Ưu tiên xếp suất
        tier: form.tier,
        is_blockbuster: form.is_blockbuster
      });

      showToast(`Đã lưu thông tin phim "${form.title}" thành công!`);
      setModalOpen(false);
    } catch (err: any) {
      showToast('Lỗi khi lưu phim: ' + (err.message || 'Thử lại sau'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter movies & Pagination (Hạn chế cuộn trang, tối đa 6 phim/trang)
  const ITEMS_PER_PAGE = 6;

  const filteredMovies = movies.filter((m) => {
    const matchSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.director && m.director.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.cast_list && m.cast_list.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === 'ALL' || m.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMovies.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMovies = filteredMovies.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getPaginationNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  };

  return (
    <div
      style={{ minHeight: 'calc(100vh - 120px)' }}
      className="flex-1 flex flex-col justify-between space-y-3 animate-in fade-in duration-200"
    >
      <div className="space-y-3 flex-1 flex flex-col">
        {/* Compact Action & Filter Bar (Single row, no large header) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-[#1E2638] pb-2.5">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {[
            { id: 'ALL', label: 'Tất cả', count: movies.length },
            { id: 'now_showing', label: 'Đang Chiếu', count: movies.filter((m) => m.status?.toLowerCase() === 'now_showing').length },
            { id: 'coming_soon', label: 'Sắp Chiếu', count: movies.filter((m) => m.status?.toLowerCase() === 'coming_soon').length },
            { id: 'ended', label: 'Kết Thúc', count: movies.filter((m) => m.status?.toLowerCase() === 'ended').length },
            { id: 'draft', label: 'Nháp', count: movies.filter((m) => m.status?.toLowerCase() === 'draft').length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id as any);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-[#E63845] text-white shadow-md'
                  : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                  statusFilter === tab.id ? 'bg-white text-black' : 'bg-[#1F2739] text-[#8E9AAF]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Add Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E9AAF]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm phim, đạo diễn, diễn viên..."
              className="w-full bg-[#141924] border border-[#222B3D] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#5C677D] focus:outline-none focus:border-[#E63845]"
            />
          </div>

          <button
            onClick={openAddModal}
            className="px-3.5 py-1.5 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#E63845]/20 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Phim</span>
          </button>
        </div>
      </div>

      {/* Movies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMovies.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-[#121622]/50 border border-[#222B3D] rounded-2xl">
            <Film className="w-10 h-10 text-[#5C677D] mx-auto mb-3 opacity-50" />
            <p className="text-sm font-semibold text-white">Không tìm thấy phim phù hợp</p>
            <p className="text-xs text-[#8E9AAF] mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái</p>
          </div>
        ) : (
          paginatedMovies.map((movie) => {
          const genreNames =
            movie.genres && movie.genres.length > 0
              ? movie.genres.map((g: any) => g.name).join(', ')
              : 'Đang cập nhật';

          return (
            <div
              key={movie.id}
              className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 flex gap-4 hover:border-[#384663] transition-all group relative overflow-hidden"
            >
              {/* Poster */}
              <div className="relative w-28 sm:w-32 h-44 rounded-xl overflow-hidden bg-[#1A1F2C] border border-[#2A344A] shrink-0 self-start">
                <img
                  src={movie.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-black/80 text-[#FABF2E] border border-[#FABF2E]/30">
                  {movie.age_rating}
                </span>
                {movie.imdb_score && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-black/85 text-[#FABF2E] flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-[#FABF2E]" />
                    {movie.imdb_score}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white text-base truncate" title={movie.title}>
                      {movie.title}
                    </h3>
                    {(movie.is_blockbuster || movie.tier === 'BLOCKBUSTER') && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-[#E63845] to-[#F59E0B] text-white flex items-center gap-1 shadow-sm shrink-0">
                        <Flame className="w-3 h-3 fill-current" />
                        <span>BOM TẤN</span>
                      </span>
                    )}
                    {movie.tier === 'EVENT' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B5CF6]/25 text-[#C4B5FD] border border-[#8B5CF6]/40 shrink-0">
                        Sự kiện
                      </span>
                    )}
                    {movie.tier === 'NICHE' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1E293B] text-[#94A3B8] border border-[#334155] shrink-0">
                        Ít khách
                      </span>
                    )}
                  </div>

                  {/* Structured vertical key-value info */}
                  <div className="space-y-1 text-xs text-[#CBD5E1]">
                    <div className="truncate">
                      <span className="font-bold text-white">Đạo diễn:</span>{' '}
                      <span className="text-[#8E9AAF]">{movie.director || 'Đang cập nhật'}</span>
                    </div>

                    <div className="truncate" title={movie.cast_list || 'Đang cập nhật'}>
                      <span className="font-bold text-white">Diễn viên:</span>{' '}
                      <span className="text-[#8E9AAF]">{movie.cast_list || 'Đang cập nhật'}</span>
                    </div>

                    <div className="truncate" title={genreNames}>
                      <span className="font-bold text-white">Thể loại:</span>{' '}
                      <span className="text-[#8E9AAF]">{genreNames}</span>
                    </div>

                    <div>
                      <span className="font-bold text-white">Thời lượng:</span>{' '}
                      <span className="text-[#8E9AAF]">{movie.duration_minutes} phút</span>
                    </div>

                    <div className="truncate">
                      <span className="font-bold text-white">Khởi chiếu:</span>{' '}
                      <span className="text-[#8E9AAF]">
                        {movie.release_date || 'Đang cập nhật'}
                        {movie.end_date ? ` • Kết thúc: ${movie.end_date}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="pt-2.5 border-t border-[#1F2739] flex items-center justify-between mt-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      movie.status?.toLowerCase() === 'now_showing'
                        ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                        : movie.status?.toLowerCase() === 'coming_soon'
                        ? 'bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30'
                        : 'bg-[#6B7280]/15 text-[#9CA3AF] border border-[#6B7280]/30'
                    }`}
                  >
                    {movie.status?.toLowerCase() === 'now_showing'
                      ? 'Đang Chiếu'
                      : movie.status?.toLowerCase() === 'coming_soon'
                      ? 'Sắp Chiếu'
                      : movie.status?.toLowerCase() === 'ended'
                      ? 'Đã Dừng'
                      : 'Bản Nháp'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(movie)}
                      className="p-1.5 rounded-lg bg-[#1A202E] hover:bg-[#28324A] text-[#8E9AAF] hover:text-white transition-all cursor-pointer"
                      title="Chỉnh sửa phim"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmMovie({ id: movie.id, title: movie.title })}
                      className="p-1.5 rounded-lg bg-[#1A202E] hover:bg-[#E63845]/20 text-[#8E9AAF] hover:text-[#E63845] transition-all cursor-pointer"
                      title="Xóa phim"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }))}
      </div>
      </div>

      {/* Pagination Bar - Cố định ở đáy màn hình */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 bg-[#0A0D14]/95 backdrop-blur-md pt-3 pb-2 border-t border-[#1E2638] mt-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-10">
          <div className="text-[#8E9AAF] text-xs">
            Hiển thị <span className="font-bold text-white">{startIndex + 1}</span> -{' '}
            <span className="font-bold text-white">
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredMovies.length)}
            </span>{' '}
            trên tổng số <span className="font-bold text-[#E63845]">{filteredMovies.length}</span> phim
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              className="px-3 py-1.5 rounded-xl bg-[#141924] border border-[#222B3D] text-[#8E9AAF] hover:text-white hover:border-[#384663] disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Trước</span>
            </button>

            <div className="flex items-center gap-1">
              {getPaginationNumbers().map((pageNum, idx) => {
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-[#5C677D] select-none">
                      ...
                    </span>
                  );
                }
                const isCurrent = pageNum === safeCurrentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum as number)}
                    className={`min-w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                        : 'bg-[#141924] border border-[#222B3D] text-[#8E9AAF] hover:text-white hover:border-[#384663]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              className="px-3 py-1.5 rounded-xl bg-[#141924] border border-[#222B3D] text-[#8E9AAF] hover:text-white hover:border-[#384663] disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer font-semibold"
            >
              <span>Sau</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modern Add / Edit Movie Modal with 4 Organized Tabs */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[#10141E] border border-[#253045] rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1E2638] flex items-center justify-between shrink-0 bg-[#141926]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E63845]/15 text-[#E63845] flex items-center justify-center font-bold">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingMovie ? 'Cập Nhật Thông Tin Phim' : 'Thêm Phim Mới Vào Hệ Thống'}
                  </h3>
                  <p className="text-[11px] text-[#8E9AAF]">
                    Cấu hình thông tin phim, suất chiếu, định dạng & hình ảnh
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Navigation Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[#1E2638] bg-[#0E121B] text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('BASIC')}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'BASIC'
                    ? 'border-[#E63845] text-white bg-[#E63845]/10 font-bold'
                    : 'border-transparent text-[#8E9AAF] hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>1. Cơ Bản & Lịch</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SCREENING')}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'SCREENING'
                    ? 'border-[#E63845] text-white bg-[#E63845]/10 font-bold'
                    : 'border-transparent text-[#8E9AAF] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#FABF2E]" />
                <span>2. Suất Chiếu & Thể Loại</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MEDIA')}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'MEDIA'
                    ? 'border-[#E63845] text-white bg-[#E63845]/10 font-bold'
                    : 'border-transparent text-[#8E9AAF] hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>3. Đa Phương Tiện</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SEO_DETAILS')}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'SEO_DETAILS'
                    ? 'border-[#E63845] text-white bg-[#E63845]/10 font-bold'
                    : 'border-transparent text-[#8E9AAF] hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />
                <span>4. Chi Tiết & SEO</span>
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
              
              {/* TAB 1: THÔNG TIN CƠ BẢN & LỊCH CHIẾU (Dạng Bảng Gọn Gàng) */}
              {activeTab === 'BASIC' && (
                <div className="animate-in fade-in">
                  <div className="border border-[#222B3D] rounded-2xl overflow-hidden bg-[#121622] shadow-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#151B27] border-b border-[#222B3D] text-[#8E9AAF] text-xs">
                          <th className="py-2.5 px-4 w-44 sm:w-52 font-bold uppercase tracking-wider text-[11px]">Hạng mục</th>
                          <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-[11px]">Thông tin chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1D2536] text-xs">
                        {/* Hàng 1: Tên Phim */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Film className="w-4 h-4 text-[#E63845]" />
                              <span>Tên Phim</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Tiếng Việt & Quốc tế</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Tên tiếng Việt *</label>
                                <input
                                  type="text"
                                  required
                                  value={form.title}
                                  onChange={(e) => handleTitleChange(e.target.value)}
                                  placeholder="Vd: Dune: Hành Tinh Cát - Phần 2"
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Tên gốc tiếng Anh / Quốc tế</label>
                                <input
                                  type="text"
                                  value={form.original_title}
                                  onChange={(e) => setForm({ ...form, original_title: e.target.value })}
                                  placeholder="Vd: Dune: Part Two"
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng Mới: Hạng Mục Bom Tấn & Mức Độ Ưu Tiên Xếp Suất */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Flame className="w-4 h-4 text-[#E63845]" />
                              <span>Hạng Mục Phim</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Ưu tiên auto xếp suất</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-2.5">
                              {/* 4 Lựa chọn Hạng mục */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                  {
                                    id: 'BLOCKBUSTER' as MovieTier,
                                    label: 'Bom Tấn / Hot',
                                    badge: 'Ưu tiên cao',
                                    desc: 'Phòng lớn/IMAX, giờ vàng chiều-tối',
                                    color: 'border-[#E63845] bg-[#E63845]/15 text-white',
                                    icon: <Flame className="w-3.5 h-3.5 text-[#E63845] fill-current" />
                                  },
                                  {
                                    id: 'STANDARD' as MovieTier,
                                    label: 'Phổ Thông',
                                    badge: 'Tiêu chuẩn',
                                    desc: 'Phân bổ đều trưa, chiều, tối',
                                    color: 'border-[#06B6D4] bg-[#06B6D4]/15 text-white',
                                    icon: <Film className="w-3.5 h-3.5 text-[#06B6D4]" />
                                  },
                                  {
                                    id: 'NICHE' as MovieTier,
                                    label: 'Ít Khách / Kén',
                                    badge: 'Ưu tiên thấp',
                                    desc: 'Phòng nhỏ, 1-3 suất, giờ thấp điểm',
                                    color: 'border-[#64748B] bg-[#64748B]/15 text-[#CBD5E1]',
                                    icon: <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                                  },
                                  {
                                    id: 'EVENT' as MovieTier,
                                    label: 'Sự Kiện Đặc Biệt',
                                    badge: 'Giữ giờ cố định',
                                    desc: 'Concert, thể thao, không tự dời',
                                    color: 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#E2E8F0]',
                                    icon: <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                                  }
                                ].map((item) => {
                                  const isSelected = form.tier === item.id || (item.id === 'BLOCKBUSTER' && form.is_blockbuster);
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => {
                                        setForm((prev) => ({
                                          ...prev,
                                          tier: item.id,
                                          is_blockbuster: item.id === 'BLOCKBUSTER'
                                        }));
                                      }}
                                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                                        isSelected
                                          ? `${item.color} shadow-sm`
                                          : 'bg-[#161C28] border-[#243147] text-[#8E9AAF] hover:border-[#384663] hover:text-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5 font-bold text-xs">
                                          {item.icon}
                                          <span>{item.label}</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-[#E63845]" />}
                                      </div>
                                      <div className="text-[10px] text-[#8E9AAF] leading-tight line-clamp-2">
                                        {item.desc}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Checkbox Đánh dấu nhanh là Bom Tấn */}
                              <label className="flex items-center gap-2 p-2 rounded-xl bg-[#182030] border border-[#2B3952] cursor-pointer text-white font-medium select-none w-fit">
                                <input
                                  type="checkbox"
                                  checked={form.is_blockbuster}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setForm((prev) => ({
                                      ...prev,
                                      is_blockbuster: checked,
                                      tier: checked ? 'BLOCKBUSTER' : (prev.tier === 'BLOCKBUSTER' ? 'STANDARD' : prev.tier)
                                    }));
                                  }}
                                  className="w-4 h-4 accent-[#E63845] rounded cursor-pointer"
                                />
                                <span className="text-xs flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-[#E63845] fill-current" />
                                  <span>Đánh dấu là <strong>Phim Bom Tấn (Blockbuster)</strong> – Tự động kích hoạt phòng lớn & giờ cao điểm</span>
                                </span>
                              </label>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 2: Thời Lượng & Phân Loại */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Clock className="w-4 h-4 text-[#FABF2E]" />
                              <span>Thông Số Phim</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Thời lượng & độ tuổi</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Đường dẫn (Slug)</label>
                                <input
                                  type="text"
                                  value={form.slug}
                                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                                  placeholder="dune-hanh-tinh-cat-2"
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Thời lượng (phút) *</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={1}
                                    required
                                    value={form.duration_minutes}
                                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                                    className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 pr-12 text-white font-mono text-xs focus:outline-none focus:border-[#E63845]"
                                  />
                                  <span className="absolute right-3 top-2 text-[#8E9AAF] text-xs pointer-events-none">phút</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Độ tuổi khán giả *</label>
                                <select
                                  value={form.age_rating}
                                  onChange={(e) => setForm({ ...form, age_rating: e.target.value as AgeRating })}
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                                >
                                  <option value="P">P - Phổ biến mọi độ tuổi</option>
                                  <option value="K">K - Dưới 13 tuổi có bảo hộ</option>
                                  <option value="T13">T13 - Khán giả từ 13 tuổi</option>
                                  <option value="T16">T16 - Khán giả từ 16 tuổi</option>
                                  <option value="T18">T18 - Khán giả từ 18 tuổi</option>
                                </select>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 3: Lịch Khởi Chiếu & Kết Thúc */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Calendar className="w-4 h-4 text-[#38BDF8]" />
                              <span>Lịch Chiếu</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Trạng thái & ngày chiếu</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Trạng thái phát hành *</label>
                                <select
                                  value={form.status}
                                  onChange={(e) => setForm({ ...form, status: e.target.value as MovieStatus })}
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                                >
                                  <option value="now_showing">Đang Chiếu (Now Showing)</option>
                                  <option value="coming_soon">Sắp Chiếu (Coming Soon)</option>
                                  <option value="ended">Đã Kết Thúc (Ended)</option>
                                  <option value="draft">Bản Nháp (Draft)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Ngày khởi chiếu</label>
                                <input
                                  type="date"
                                  value={form.release_date}
                                  onChange={(e) => setForm({ ...form, release_date: e.target.value })}
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Ngày kết thúc chiếu</label>
                                <input
                                  type="date"
                                  value={form.end_date}
                                  min={form.release_date || undefined}
                                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 4: Tóm Tắt Cốt Truyện */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Sparkles className="w-4 h-4 text-[#A855F7]" />
                              <span>Tóm Tắt Nội Dung</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Cốt truyện giới thiệu</div>
                          </td>
                          <td className="py-3 px-4">
                            <textarea
                              rows={2}
                              value={form.synopsis}
                              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                              placeholder="Mô tả tóm tắt cốt truyện phim cuốn hút người xem..."
                              className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845] resize-none"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: CẤU HÌNH SUẤT CHIẾU & THỂ LOẠI (Gọn gàng trong 1 bảng không cần cuộn) */}
              {activeTab === 'SCREENING' && (
                <div className="animate-in fade-in">
                  <div className="border border-[#222B3D] rounded-2xl overflow-hidden bg-[#121622] shadow-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#151B27] border-b border-[#222B3D] text-[#8E9AAF] text-xs">
                          <th className="py-2.5 px-4 w-44 sm:w-52 font-bold uppercase tracking-wider text-[11px]">Hạng mục</th>
                          <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-[11px]">Tùy chọn cấu hình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1D2536] text-xs">
                        {/* Hàng 1: Thể Loại */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Tag className="w-4 h-4 text-[#E63845]" />
                              <span>Thể Loại Phim</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">
                              Đã chọn: <span className="text-white font-bold">{form.selectedGenreIds.length}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {allGenres.map((genre) => {
                                const isSelected = form.selectedGenreIds.includes(genre.id);
                                return (
                                  <button
                                    type="button"
                                    key={genre.id}
                                    onClick={() => toggleGenre(genre.id)}
                                    className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/20 font-bold'
                                        : 'bg-[#182030] text-[#8E9AAF] hover:text-white border border-[#243147]'
                                    }`}
                                  >
                                    {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 opacity-60" />}
                                    <span>{genre.name}</span>
                                  </button>
                                );
                              })}

                              {/* Thể loại khác: Cho phép tự nhập */}
                              {isAddingCustomGenre ? (
                                <div className="flex items-center gap-1.5 bg-[#182030] px-2 py-1 rounded-xl border border-[#E63845] animate-in fade-in">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Tên thể loại..."
                                    value={newGenreInput}
                                    onChange={(e) => setNewGenreInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomGenre();
                                      } else if (e.key === 'Escape') {
                                        setIsAddingCustomGenre(false);
                                        setNewGenreInput('');
                                      }
                                    }}
                                    className="bg-transparent text-white text-xs px-1 py-0.5 outline-none w-28 placeholder-[#5C677D]"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleAddCustomGenre}
                                    className="px-2 py-0.5 bg-[#E63845] hover:bg-[#D42B38] text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                                  >
                                    Thêm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsAddingCustomGenre(false);
                                      setNewGenreInput('');
                                    }}
                                    className="px-1.5 py-0.5 text-[#8E9AAF] hover:text-white text-[11px] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsAddingCustomGenre(true)}
                                  className="px-3 py-1.5 rounded-xl font-medium text-xs bg-[#1A2232] hover:bg-[#232D42] text-[#A0AEC0] hover:text-white border border-dashed border-[#34425A] flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#E63845]" />
                                  <span>Khác</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 2: Định Dạng Suất Chiếu */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Layers className="w-4 h-4 text-[#FABF2E]" />
                              <span>Định Dạng Chiếu</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">
                              Đã chọn: <span className="text-white font-bold">{form.formats.length}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {allFormats.map((fmt) => {
                                const isSelected = form.formats.includes(fmt);
                                return (
                                  <button
                                    type="button"
                                    key={fmt}
                                    onClick={() => toggleFormat(fmt)}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#FABF2E] text-black shadow-md shadow-[#FABF2E]/20 font-black'
                                        : 'bg-[#182030] text-[#8E9AAF] hover:text-white border border-[#243147]'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    <span>{fmt}</span>
                                  </button>
                                );
                              })}

                              {/* Định dạng khác: Cho phép tự nhập */}
                              {isAddingCustomFormat ? (
                                <div className="flex items-center gap-1.5 bg-[#182030] px-2 py-1 rounded-xl border border-[#FABF2E] animate-in fade-in">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Tên định dạng..."
                                    value={newFormatInput}
                                    onChange={(e) => setNewFormatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomFormat();
                                      } else if (e.key === 'Escape') {
                                        setIsAddingCustomFormat(false);
                                        setNewFormatInput('');
                                      }
                                    }}
                                    className="bg-transparent text-white text-xs px-1 py-0.5 outline-none w-28 placeholder-[#5C677D]"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleAddCustomFormat}
                                    className="px-2 py-0.5 bg-[#FABF2E] hover:bg-[#E5AC25] text-black rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                                  >
                                    Thêm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsAddingCustomFormat(false);
                                      setNewFormatInput('');
                                    }}
                                    className="px-1.5 py-0.5 text-[#8E9AAF] hover:text-white text-[11px] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsAddingCustomFormat(true)}
                                  className="px-3 py-1.5 rounded-xl font-medium text-xs bg-[#1A2232] hover:bg-[#232D42] text-[#A0AEC0] hover:text-white border border-dashed border-[#34425A] flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#FABF2E]" />
                                  <span>Khác</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 3: Ngôn Ngữ & Bản Phụ Đề */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Globe className="w-4 h-4 text-[#38BDF8]" />
                              <span>Ngôn Ngữ & Phụ Đề</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">
                              Bản chiếu tại rạp
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <select
                                value={isPresetLang ? form.language : 'Khác'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'Khác') {
                                    setIsCustomLang(true);
                                    if (isPresetLang) {
                                      setForm((prev) => ({ ...prev, language: '' }));
                                    }
                                  } else {
                                    setIsCustomLang(false);
                                    setForm((prev) => ({ ...prev, language: val }));
                                  }
                                }}
                                className="bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845] min-w-[240px]"
                              >
                                {PRESET_LANGUAGES.map((lang, idx) => (
                                  <option key={idx} value={lang}>
                                    {lang}
                                  </option>
                                ))}
                                <option value="Khác">Khác</option>
                              </select>

                              {(!isPresetLang || isCustomLang) && (
                                <input
                                  type="text"
                                  autoFocus
                                  value={form.language}
                                  onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                                  placeholder="Nhập ngôn ngữ / phụ đề tùy chỉnh..."
                                  className="flex-1 bg-[#161C28] border border-[#38BDF8] rounded-xl px-3 py-2 text-white text-xs placeholder-[#5C677D] focus:outline-none animate-in fade-in"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: ĐA PHƯƠNG TIỆN (Dạng Bảng Hỗ Trợ Gán Link & Tải File Lên) */}
              {activeTab === 'MEDIA' && (
                <div className="animate-in fade-in">
                  <div className="border border-[#222B3D] rounded-2xl overflow-hidden bg-[#121622] shadow-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#151B27] border-b border-[#222B3D] text-[#8E9AAF] text-xs">
                          <th className="py-2.5 px-4 w-44 sm:w-52 font-bold uppercase tracking-wider text-[11px]">Hạng mục</th>
                          <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-[11px]">Tùy chọn tải lên & liên kết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1D2536] text-xs">
                        {/* Hàng 1: Poster Dọc (2:3) */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <ImageIcon className="w-4 h-4 text-[#E63845]" />
                              <span>Poster Dọc (2:3)</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5 mb-2">Thẻ phim & app</div>
                            {/* Thumbnail Preview */}
                            <div className="w-16 h-22 rounded-xl overflow-hidden bg-[#0D111A] border border-[#232D3F] flex items-center justify-center">
                              {form.poster_url ? (
                                <img
                                  src={form.poster_url}
                                  alt="Poster"
                                  className="w-full h-full object-cover"
                                  onError={(e) => ((e.target as any).src = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800')}
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-[#5C677D]" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={form.poster_url}
                                  onChange={(e) => setForm({ ...form, poster_url: e.target.value })}
                                  placeholder="Dán URL poster ảnh dọc https://..."
                                  className="flex-1 bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-[#E63845]"
                                />
                                <label className="px-3.5 py-2 rounded-xl bg-[#212A3D] hover:bg-[#2C3852] text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-colors">
                                  <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
                                  <span>Tải ảnh lên</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, 'poster_url')}
                                  />
                                </label>
                              </div>
                              <p className="text-[10px] text-[#5C677D]">Hỗ trợ ảnh định dạng JPG, PNG, WEBP từ URL hoặc tải trực tiếp từ máy tính.</p>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 2: Banner Ngang (16:9) */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <ImageIcon className="w-4 h-4 text-[#FABF2E]" />
                              <span>Banner Ngang (16:9)</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5 mb-2">Hero Slider & Cover</div>
                            {/* Thumbnail Preview */}
                            <div className="w-24 h-14 rounded-xl overflow-hidden bg-[#0D111A] border border-[#232D3F] flex items-center justify-center">
                              {form.banner_url ? (
                                <img
                                  src={form.banner_url}
                                  alt="Banner"
                                  className="w-full h-full object-cover"
                                  onError={(e) => ((e.target as any).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600')}
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-[#5C677D]" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={form.banner_url}
                                  onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                                  placeholder="Dán URL banner ảnh ngang 16:9 https://..."
                                  className="flex-1 bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-[#E63845]"
                                />
                                <label className="px-3.5 py-2 rounded-xl bg-[#212A3D] hover:bg-[#2C3852] text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-colors">
                                  <Upload className="w-3.5 h-3.5 text-[#FABF2E]" />
                                  <span>Tải banner lên</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, 'banner_url')}
                                  />
                                </label>
                              </div>
                              <p className="text-[10px] text-[#5C677D]">Ảnh nền tỉ lệ 16:9 sẽ hiển thị nổi bật trên banner trang chủ và đầu trang chi tiết.</p>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 3: URL Trailer & Video Upload */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Video className="w-4 h-4 text-[#EF4444]" />
                              <span>Trailer Video</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Video giới thiệu</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-2.5">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={form.trailer_url}
                                  onChange={(e) => setForm({ ...form, trailer_url: e.target.value })}
                                  placeholder="Dán link YouTube (https://www.youtube.com/watch?v=...) hoặc link MP4..."
                                  className="flex-1 bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-[#E63845]"
                                />
                                <label className="px-3.5 py-2 rounded-xl bg-[#212A3D] hover:bg-[#2C3852] text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-colors">
                                  <Upload className="w-3.5 h-3.5 text-[#EF4444]" />
                                  <span>Tải video lên</span>
                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, 'trailer_url')}
                                  />
                                </label>
                              </div>

                              {/* Trailer Preview */}
                              {form.trailer_url && (
                                <div className="rounded-xl overflow-hidden border border-[#232D3F] aspect-video max-h-36 w-full max-w-sm bg-black">
                                  {extractYoutubeEmbedId(form.trailer_url) ? (
                                    <iframe
                                      src={`https://www.youtube-nocookie.com/embed/${extractYoutubeEmbedId(form.trailer_url)}`}
                                      title="YouTube trailer"
                                      className="w-full h-full border-0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : (
                                    <video
                                      src={form.trailer_url}
                                      controls
                                      className="w-full h-full object-contain"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: THÔNG TIN CHI TIẾT & SEO (Dạng Bảng Gọn Gàng, Không Bị Đè Lấn) */}
              {activeTab === 'SEO_DETAILS' && (
                <div className="animate-in fade-in">
                  <div className="border border-[#222B3D] rounded-2xl overflow-hidden bg-[#121622] shadow-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#151B27] border-b border-[#222B3D] text-[#8E9AAF] text-xs">
                          <th className="py-2.5 px-4 w-44 sm:w-52 font-bold uppercase tracking-wider text-[11px]">Hạng mục</th>
                          <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-[11px]">Thông tin chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1D2536] text-xs">
                        {/* Hàng 1: Đạo Diễn & Diễn Viên */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Users className="w-4 h-4 text-[#38BDF8]" />
                              <span>Ekip Làm Phim</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Đạo diễn & dàn cast</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Đạo diễn</label>
                                <input
                                  type="text"
                                  value={form.director}
                                  onChange={(e) => setForm({ ...form, director: e.target.value })}
                                  placeholder="Vd: Denis Villeneuve"
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-[#8E9AAF] mb-1 block">Diễn viên chính (ngăn cách bằng dấu phẩy)</label>
                                <input
                                  type="text"
                                  value={form.cast_list}
                                  onChange={(e) => setForm({ ...form, cast_list: e.target.value })}
                                  placeholder="Vd: Timothée Chalamet, Zendaya..."
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E63845]"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 2: Xuất Xứ, Hãng Phim & Điểm IMDb (Cột riêng biệt, không bị đè) */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Building2 className="w-4 h-4 text-[#FABF2E]" />
                              <span>Xuất Xứ & Đánh Giá</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Quốc gia, Studio & IMDb</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Cột 1: Quốc gia sản xuất */}
                              <div className="space-y-1.5 min-w-0">
                                <label className="text-[11px] text-[#8E9AAF] block">Quốc gia sản xuất</label>
                                <select
                                  value={isPresetCountry ? form.country : 'Khác'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'Khác') {
                                      setIsCustomCountry(true);
                                      if (isPresetCountry) setForm((prev) => ({ ...prev, country: '' }));
                                    } else {
                                      setIsCustomCountry(false);
                                      setForm((prev) => ({ ...prev, country: val }));
                                    }
                                  }}
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                                >
                                  {PRESET_COUNTRIES.map((c, i) => (
                                    <option key={i} value={c}>{c}</option>
                                  ))}
                                </select>

                                {(!isPresetCountry || isCustomCountry) && (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={form.country}
                                    onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                                    placeholder="Nhập tên quốc gia..."
                                    className="w-full bg-[#161C28] border border-[#38BDF8] rounded-xl px-3 py-1.5 text-white text-xs placeholder-[#5C677D] focus:outline-none animate-in fade-in"
                                  />
                                )}
                              </div>

                              {/* Cột 2: Nhà phát hành / Hãng Studio */}
                              <div className="space-y-1.5 min-w-0">
                                <label className="text-[11px] text-[#8E9AAF] block">Nhà phát hành / Studio</label>
                                <select
                                  value={isPresetStudio ? form.studio : 'Khác'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'Khác') {
                                      setIsCustomStudio(true);
                                      if (isPresetStudio) setForm((prev) => ({ ...prev, studio: '' }));
                                    } else {
                                      setIsCustomStudio(false);
                                      setForm((prev) => ({ ...prev, studio: val }));
                                    }
                                  }}
                                  className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                                >
                                  {PRESET_STUDIOS.map((s, i) => (
                                    <option key={i} value={s}>{s}</option>
                                  ))}
                                </select>

                                {(!isPresetStudio || isCustomStudio) && (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={form.studio}
                                    onChange={(e) => setForm((prev) => ({ ...prev, studio: e.target.value }))}
                                    placeholder="Nhập tên hãng phim..."
                                    className="w-full bg-[#161C28] border border-[#38BDF8] rounded-xl px-3 py-1.5 text-white text-xs placeholder-[#5C677D] focus:outline-none animate-in fade-in"
                                  />
                                )}
                              </div>

                              {/* Cột 3: Điểm đánh giá IMDb */}
                              <div className="space-y-1.5 min-w-0">
                                <label className="text-[11px] text-[#8E9AAF] block">Điểm đánh giá (IMDb)</label>
                                <div className="relative">
                                  <Star className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#FABF2E] fill-[#FABF2E]" />
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="1.0"
                                    max="10.0"
                                    value={form.imdb_score}
                                    onChange={(e) => setForm({ ...form, imdb_score: Number(e.target.value) })}
                                    className="w-full bg-[#161C28] border border-[#263246] rounded-xl pl-8 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E63845]"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Hàng 3: Tối Ưu SEO & Thẻ Meta */}
                        <tr className="hover:bg-[#141924]/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2 text-white font-bold">
                              <Sparkles className="w-4 h-4 text-[#A855F7]" />
                              <span>Tối Ưu SEO</span>
                            </div>
                            <div className="text-[11px] text-[#8E9AAF] mt-0.5">Title & Description</div>
                            <button
                              type="button"
                              onClick={autoGenerateSEO}
                              disabled={isGeneratingSEO}
                              className={`mt-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                                isGeneratingSEO
                                  ? 'bg-[#A855F7]/10 text-[#C084FC]/60 cursor-not-allowed'
                                  : 'bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#C084FC] cursor-pointer'
                              }`}
                            >
                              {isGeneratingSEO ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-[#C084FC]" />
                                  <span>Gemini đang viết...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3" />
                                  <span>Gemini AI Chuẩn Sale</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-[#8E9AAF]">Thẻ Meta Title</label>
                                <span className="text-[10px] text-[#5C677D]">{form.meta_title.length} / 60 ký tự</span>
                              </div>
                              <input
                                type="text"
                                value={form.meta_title}
                                onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                                placeholder="Vd: Dune 2 | Lịch Chiếu & Đặt Vé Xem Phim Rạp CINEMAX"
                                className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845]"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-[#8E9AAF]">Thẻ Meta Description</label>
                                <span className="text-[10px] text-[#5C677D]">{form.meta_description.length} / 160 ký tự</span>
                              </div>
                              <textarea
                                rows={2}
                                value={form.meta_description}
                                onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                                placeholder="Mô tả chuẩn SEO xuất hiện trên kết quả tìm kiếm..."
                                className="w-full bg-[#161C28] border border-[#263246] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E63845] resize-none"
                              />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1E2638]">
                {editingMovie ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmMovie({ id: editingMovie.id, title: editingMovie.title });
                      setModalOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#3B191C] hover:bg-[#EF4444] text-[#EF4444] hover:text-white font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa Phim</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
                  {/* Step navigation */}
                  {activeTab !== 'BASIC' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'SCREENING') setActiveTab('BASIC');
                        else if (activeTab === 'MEDIA') setActiveTab('SCREENING');
                        else if (activeTab === 'SEO_DETAILS') setActiveTab('MEDIA');
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Bước trước</span>
                    </button>
                  )}

                  {activeTab !== 'SEO_DETAILS' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'BASIC') setActiveTab('SCREENING');
                        else if (activeTab === 'SCREENING') setActiveTab('MEDIA');
                        else if (activeTab === 'MEDIA') setActiveTab('SEO_DETAILS');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#212A3D] hover:bg-[#2C3852] text-white font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Tiếp theo</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white font-bold transition-all shadow-lg shadow-[#E63845]/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmitting ? 'Đang Lưu...' : editingMovie ? 'Lưu Thay Đổi' : 'Thêm Phim Mới'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirmMovie && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2E1F24] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center font-bold">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Xác Nhận Xóa Phim</h4>
                <p className="text-xs text-[#8E9AAF]">Thao tác này sẽ gỡ bỏ phim khỏi danh mục</p>
              </div>
            </div>

            <p className="text-xs text-[#CBD5E1] bg-[#1A202E] p-3.5 rounded-xl border border-[#263147]">
              Bạn có chắc chắn muốn xóa phim <strong className="text-white">"{deleteConfirmMovie.title}"</strong> không? Toàn bộ suất chiếu liên quan cũng sẽ được cập nhật.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmMovie(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all cursor-pointer text-xs"
              >
                Hủy Bỏ
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDeleteMovie(deleteConfirmMovie.id);
                    setDeleteConfirmMovie(null);
                  } catch (err: any) {
                    showToast('Lỗi khi xóa phim: ' + err.message);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold transition-all shadow-lg shadow-[#EF4444]/30 cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
