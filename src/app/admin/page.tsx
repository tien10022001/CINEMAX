'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { Movie, Cinema, Showtime, Promotion, FoodItem, NewsArticle, SiteSettings, AgeRating, MovieStatus, FoodCategory } from '@/lib/types';
import {
  ShieldCheck,
  Film,
  Calendar,
  Ticket,
  DollarSign,
  Users,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  Clock,
  Sparkles,
  Lock,
  MapPin,
  Coffee,
  Newspaper,
  Settings,
  ArrowRight,
  X,
  Search,
  RefreshCw,
  Eye,
  Check,
  AlertTriangle,
  Zap,
  Receipt,
  QrCode,
  Building2,
} from 'lucide-react';
import { BankTransferService, BankTransaction } from '@/services/bank-transfer.service';
import { VietQRService, BankAccountInfo, POPULAR_VIETQR_BANKS } from '@/services/vietqr.service';
import { TicketScannerService, TicketValidationResult } from '@/services/ticket-scanner.service';

export default function AdminDashboardPage() {
  const { currentUser, login, logout } = useAuth();
  const {
    movies,
    cinemas,
    showtimes,
    promotions,
    foods,
    news,
    siteSettings,
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
  } = useData();

  // Admin login credentials state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active navigation tab in Admin
  const [activeTab, setActiveTab] = useState<
    'MOVIES' | 'CINEMAS' | 'SHOWTIMES' | 'BOOKINGS' | 'PROMOTIONS' | 'FOODS' | 'NEWS' | 'SETTINGS'
  >('MOVIES');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Notification toast
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Modals state
  const [movieModalOpen, setMovieModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);

  const [cinemaModalOpen, setCinemaModalOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState<Cinema | null>(null);

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);

  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsArticle | null>(null);

  const [showtimeModalOpen, setShowtimeModalOpen] = useState(false);

  // Form states for Movie
  const [movieForm, setMovieForm] = useState({
    title: '',
    original_title: '',
    duration_min: 120,
    age_rating: 'T13' as AgeRating,
    status: 'NOW_SHOWING' as MovieStatus,
    release_date: '01/10/2026',
    country: 'Mỹ',
    director: '',
    cast_list: '',
    poster_url: '',
    banner_url: '',
    trailer_url: '',
    imdb_score: 8.0,
    synopsis: '',
  });

  // Form states for Cinema
  const [cinemaForm, setCinemaForm] = useState({
    name: '',
    address: '',
    city: 'Hà Nội',
    phone: '1900 1234',
  });

  // Form states for Promotion
  const [promoForm, setPromoForm] = useState({
    code: '',
    description: '',
    discount_type: 'FIXED' as 'FIXED' | 'PERCENT',
    discount_value: 20000,
    min_order: 100000,
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    is_active: true,
  });

  // Form states for Food
  const [foodForm, setFoodForm] = useState({
    name: '',
    category: 'COMBO' as FoodCategory,
    description: '',
    price: 69000,
    image_url: '',
  });

  // Form states for News
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Điện ảnh',
    author: 'Ban biên tập Cinemax',
    date: '29/09/2026',
    summary: '',
    content: '',
    img: '',
  });

  // Form state for Showtime
  const [showtimeForm, setShowtimeForm] = useState({
    movie_id: 1,
    room_id: 1,
    time: '18:30',
    date: '2026-09-30',
  });

  // Form state for Settings
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(siteSettings);

  useEffect(() => {
    setSettingsForm(siteSettings);
  }, [siteSettings]);

  // System tickets
  const [systemTickets, setSystemTickets] = useState<any[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      if (stored) {
        setSystemTickets(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Quản lý biến động số dư ngân hàng & đối soát chuyển khoản
  const [isBankStatementsOpen, setIsBankStatementsOpen] = useState(false);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [manualTxOrderCode, setManualTxOrderCode] = useState('');
  const [manualTxAmount, setManualTxAmount] = useState<number>(100000);
  const [manualTxSenderBank, setManualTxSenderBank] = useState('Vietcombank');

  const refreshBankTransactions = () => {
    setBankTransactions(BankTransferService.getAllTransactions());
  };

  useEffect(() => {
    refreshBankTransactions();
    window.addEventListener('cinemax_bank_transaction_received', refreshBankTransactions);
    return () => {
      window.removeEventListener('cinemax_bank_transaction_received', refreshBankTransactions);
    };
  }, []);

  // Cấu hình tài khoản ngân hàng nhận tiền VietQR (Phương thức 1: QR Động)
  const [bankConfig, setBankConfig] = useState<BankAccountInfo>(() => VietQRService.getBankInfo());
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');

  useEffect(() => {
    setPreviewQrUrl(VietQRService.generatePreviewQrUrl(bankConfig, 100000));
  }, [bankConfig]);

  const handleSaveBankConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankConfig.accountNumber.trim() || !bankConfig.accountName.trim()) {
      showToast('Vui lòng nhập đầy đủ Số tài khoản và Tên chủ tài khoản');
      return;
    }
    VietQRService.saveBankInfo(bankConfig);
    showToast(`Đã lưu cấu hình tài khoản ${bankConfig.bankShortName} - ${bankConfig.accountNumber} thành công!`);
  };

  // Quản lý Soát vé và In vé Kiosk bằng máy quét barcode 2D
  const [isTicketScannerOpen, setIsTicketScannerOpen] = useState(false);
  const [scanInputCode, setScanInputCode] = useState('');
  const [scanResult, setScanResult] = useState<TicketValidationResult | null>(null);

  const handleScanTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInputCode.trim()) return;
    const res = TicketScannerService.checkInTicket(scanInputCode.trim());
    setScanResult(res);
    if (res.valid) {
      showToast('Đã soát vé thành công!');
    }
  };

  const handlePrintTicketAtKiosk = (code: string) => {
    TicketScannerService.markAsPrinted(code);
    showToast(`Đã in vé Kiosk cho mã ${code}!`);
    window.print();
  };

  const handleManualApproveTicket = (ticket: any, idx: number) => {
    const updated = [...systemTickets];
    const currentBank = VietQRService.getBankInfo();
    const tx = BankTransferService.recordIncomingTransaction({
      transactionId: `FT-ADMIN-${Date.now().toString().slice(-6)}`,
      orderCode: ticket.bookingCode,
      amount: ticket.totalAmount || 0,
      senderBank: 'Thu ngân duyệt tại quầy',
      receiverBank: currentBank.bankShortName,
      accountNumber: currentBank.accountNumber,
      accountName: currentBank.accountName,
      description: `Thu ngan duyet don ${ticket.bookingCode}`,
      status: 'SUCCESS',
    });
    updated[idx] = {
      ...ticket,
      status: 'ĐÃ THANH TOÁN',
      paymentMethod: `VIETQR (${currentBank.bankShortName}) • ${tx.transactionId}`,
      bankTxnId: tx.transactionId,
    };
    setSystemTickets(updated);
    localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
    window.dispatchEvent(new Event('cinemax_data_updated'));
    window.dispatchEvent(new Event('storage'));
    showToast(`Đã duyệt thanh toán chuyển khoản thành công cho đơn ${ticket.bookingCode}!`);
  };

  const handleAddManualBankTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTxOrderCode.trim() || manualTxAmount <= 0) {
      showToast('Vui lòng nhập đầy đủ mã đơn và số tiền');
      return;
    }
    const newTx = BankTransferService.recordIncomingTransaction({
      transactionId: `FT-POS-${Date.now().toString().slice(-6)}`,
      orderCode: manualTxOrderCode.trim().toUpperCase(),
      amount: manualTxAmount,
      senderBank: manualTxSenderBank,
      receiverBank: 'TPBank',
      accountNumber: '08341902000',
      accountName: 'TRUONG CONG TIEN',
      description: `CINEMAX ${manualTxOrderCode.trim().toUpperCase()} chuyen khoan doi soat`,
      status: 'SUCCESS',
    });
    refreshBankTransactions();
    showToast(`Đã ghi nhận giao dịch ${newTx.transactionId} thành công!`);
    setManualTxOrderCode('');
  };

  const totalRevenue = systemTickets.reduce((sum, t) => sum + (t.totalAmount || 0), 24500000);
  const totalTicketsSold = systemTickets.length + 154;

  // Handle Admin Portal Login
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    setIsLoggingIn(true);

    const res = await login(adminEmail, adminPassword);
    setIsLoggingIn(false);

    if (!res.success) {
      setAdminLoginError(res.error || 'Tài khoản hoặc mật khẩu không chính xác.');
      return;
    }

    // Verify role
    const currentSessionStr = localStorage.getItem('cinemax_session_user');
    if (currentSessionStr) {
      const user = JSON.parse(currentSessionStr);
      if (user.role_code !== 'ADMIN') {
        logout();
        setAdminLoginError('Tài khoản này không có quyền Quản trị viên (ADMIN). Vui lòng đăng nhập đúng tài khoản quản trị.');
      } else {
        showToast('Đăng nhập cổng quản trị thành công!');
      }
    }
  };

  // Movie Handlers
  const openAddMovieModal = () => {
    setEditingMovie(null);
    setMovieForm({
      title: '',
      original_title: '',
      duration_min: 120,
      age_rating: 'T13',
      status: 'NOW_SHOWING',
      release_date: '01/10/2026',
      country: 'Mỹ',
      director: '',
      cast_list: '',
      poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
      banner_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1440&q=80',
      trailer_url: 'https://www.youtube.com/watch?v=Way9Dexny3w',
      imdb_score: 8.0,
      synopsis: '',
    });
    setMovieModalOpen(true);
  };

  const openEditMovieModal = (m: Movie) => {
    setEditingMovie(m);
    setMovieForm({
      title: m.title,
      original_title: m.original_title || '',
      duration_min: m.duration_min,
      age_rating: m.age_rating,
      status: m.status,
      release_date: m.release_date || '01/10/2026',
      country: m.country || 'Mỹ',
      director: m.director || '',
      cast_list: m.cast_list || '',
      poster_url: m.poster_url || '',
      banner_url: m.banner_url || '',
      trailer_url: m.trailer_url || '',
      imdb_score: m.imdb_score || 8.0,
      synopsis: m.synopsis || '',
    });
    setMovieModalOpen(true);
  };

  const handleSaveMovie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieForm.title.trim()) return;

    if (editingMovie) {
      updateMovie(editingMovie.id, movieForm);
      showToast(`Đã cập nhật phim "${movieForm.title}" thành công!`);
    } else {
      addMovie(movieForm);
      showToast(`Đã thêm phim mới "${movieForm.title}" thành công!`);
    }
    setMovieModalOpen(false);
  };

  // Cinema Handlers
  const openAddCinemaModal = () => {
    setEditingCinema(null);
    setCinemaForm({
      name: '',
      address: '',
      city: 'Hà Nội',
      phone: '1900 1234',
    });
    setCinemaModalOpen(true);
  };

  const openEditCinemaModal = (c: Cinema) => {
    setEditingCinema(c);
    setCinemaForm({
      name: c.name,
      address: c.address,
      city: c.city,
      phone: c.phone || '1900 1234',
    });
    setCinemaModalOpen(true);
  };

  const handleSaveCinema = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cinemaForm.name.trim()) return;

    if (editingCinema) {
      updateCinema(editingCinema.id, cinemaForm);
      showToast(`Đã cập nhật rạp "${cinemaForm.name}" thành công!`);
    } else {
      addCinema(cinemaForm);
      showToast(`Đã thêm rạp mới "${cinemaForm.name}" thành công!`);
    }
    setCinemaModalOpen(false);
  };

  // Promotion Handlers
  const openAddPromoModal = () => {
    setEditingPromo(null);
    setPromoForm({
      code: '',
      description: '',
      discount_type: 'FIXED',
      discount_value: 20000,
      min_order: 100000,
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      is_active: true,
    });
    setPromoModalOpen(true);
  };

  const openEditPromoModal = (p: Promotion) => {
    setEditingPromo(p);
    setPromoForm({
      code: p.code,
      description: p.description || '',
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_order: p.min_order,
      valid_from: p.valid_from,
      valid_to: p.valid_to,
      is_active: p.is_active,
    });
    setPromoModalOpen(true);
  };

  const handleSavePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.code.trim()) return;

    if (editingPromo) {
      updatePromotion(editingPromo.id, promoForm);
      showToast(`Đã cập nhật mã giảm giá "${promoForm.code}"!`);
    } else {
      addPromotion(promoForm);
      showToast(`Đã thêm mã giảm giá mới "${promoForm.code}"!`);
    }
    setPromoModalOpen(false);
  };

  // Food Handlers
  const openAddFoodModal = () => {
    setEditingFood(null);
    setFoodForm({
      name: '',
      category: 'COMBO',
      description: '',
      price: 69000,
      image_url: 'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=400&q=80',
    });
    setFoodModalOpen(true);
  };

  const openEditFoodModal = (f: FoodItem) => {
    setEditingFood(f);
    setFoodForm({
      name: f.name,
      category: f.category || 'COMBO',
      description: f.description || '',
      price: f.price,
      image_url: f.image_url || '',
    });
    setFoodModalOpen(true);
  };

  const handleSaveFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodForm.name.trim()) return;

    if (editingFood) {
      updateFoodItem(editingFood.id, foodForm);
      showToast(`Đã cập nhật món "${foodForm.name}"!`);
    } else {
      addFoodItem(foodForm);
      showToast(`Đã thêm món "${foodForm.name}"!`);
    }
    setFoodModalOpen(false);
  };

  // News Handlers
  const openAddNewsModal = () => {
    setEditingNews(null);
    setNewsForm({
      title: '',
      category: 'Điện ảnh',
      author: 'Ban biên tập Cinemax',
      date: new Date().toLocaleDateString('vi-VN'),
      summary: '',
      content: '',
      img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    });
    setNewsModalOpen(true);
  };

  const openEditNewsModal = (n: NewsArticle) => {
    setEditingNews(n);
    setNewsForm({
      title: n.title,
      category: n.category || 'Điện ảnh',
      author: n.author || 'Ban biên tập Cinemax',
      date: n.date,
      summary: n.summary,
      content: n.content || '',
      img: n.img,
    });
    setNewsModalOpen(true);
  };

  const handleSaveNews = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsForm.title.trim()) return;

    if (editingNews) {
      updateNewsArticle(editingNews.id, newsForm);
      showToast(`Đã cập nhật bài viết "${newsForm.title}"!`);
    } else {
      addNewsArticle(newsForm);
      showToast(`Đã đăng bài viết mới "${newsForm.title}"!`);
    }
    setNewsModalOpen(false);
  };

  // Showtime Handlers
  const handleSaveShowtime = (e: React.FormEvent) => {
    e.preventDefault();
    const movie = movies.find((m) => m.id === Number(showtimeForm.movie_id));
    addShowtime({
      movie_id: Number(showtimeForm.movie_id),
      room_id: Number(showtimeForm.room_id),
      start_time: `${showtimeForm.date}T${showtimeForm.time}:00+07:00`,
      end_time: `${showtimeForm.date}T22:00:00+07:00`,
      language_type: 'SUBTITLED',
      status: 'OPEN',
      movie,
    });
    showToast('Đã thêm suất chiếu mới thành công!');
    setShowtimeModalOpen(false);
  };

  // Site Settings Handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(settingsForm);
    showToast('Đã lưu cấu hình website thành công!');
  };

  // =========================================================================
  // VIEW 1: DEDICATED PRIVATE ADMIN LOGIN PORTAL (Khi chưa đăng nhập Admin)
  // =========================================================================
  if (!currentUser || currentUser.role_code !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex flex-col justify-between">
        <Header />

        <main className="flex-1 max-w-md mx-auto w-full px-4 py-16 flex flex-col justify-center">
          <div className="bg-[#141720] border border-[#303645] rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl relative">
            <div className="w-16 h-16 rounded-2xl bg-[#E63845]/15 border border-[#E63845]/40 text-[#E63845] flex items-center justify-center mx-auto shadow-lg shadow-[#E63845]/20">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="text-center space-y-1.5">
              <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-[#E63845]/20 text-[#E63845] border border-[#E63845]/30">
                ADMIN CONSOLE
              </span>
              <h1 className="text-2xl font-black text-white pt-1">
                Cổng Quản Trị Hệ Thống
              </h1>
              <p className="text-xs text-[#9EA6B8] leading-relaxed">
                Đăng nhập tài khoản quản trị viên để quản lý toàn bộ nội dung, phim, rạp chiếu và doanh thu website CINEMAX.
              </p>
            </div>

            {adminLoginError && (
              <div className="p-3.5 rounded-xl bg-[#E63845]/15 border border-[#E63845] text-xs text-[#E63845] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{adminLoginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                  Tài khoản Quản trị (Email) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@cinemax.vn"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-[#0A0C10] border border-[#303645] rounded-xl px-4 py-3 text-xs text-white placeholder-[#5D6475] focus:outline-none focus:border-[#E63845] transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                  Mật khẩu bảo mật *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-[#0A0C10] border border-[#303645] rounded-xl px-4 py-3 text-xs text-white placeholder-[#5D6475] focus:outline-none focus:border-[#E63845] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-[#E63845] hover:bg-[#CC2B37] disabled:opacity-50 text-white font-bold text-xs py-3.5 rounded-full transition-all shadow-lg shadow-[#E63845]/30 cursor-pointer mt-2"
              >
                {isLoggingIn ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP CỔNG QUẢN TRỊ'}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link href="/" className="text-xs text-[#9EA6B8] hover:text-white transition-colors">
                ← Quay lại trang chủ CINEMAX
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED ADMIN CONTROL CENTER (Sửa toàn bộ thông tin ở web)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col">
      <Header />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A1C26] border border-[#33C773] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle className="w-5 h-5 text-[#33C773]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-8 lg:px-20 py-10 space-y-8">
        {/* Top Bar: Admin Info & Quick Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#303645] pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#E63845]/15 border border-[#E63845]/40 text-[#E63845] flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">Trung Tâm Quản Trị Toàn Diện</h1>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-[#FABF2E] text-black uppercase">
                  MASTER ADMIN
                </span>
              </div>
              <p className="text-xs text-[#9EA6B8]">
                Xin chào, <strong className="text-white">{currentUser.full_name}</strong> • Bạn có quyền thêm, sửa, xóa toàn bộ thông tin trên website CINEMAX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm('Khôi phục toàn bộ phim, rạp, voucher, combo, tin tức về dữ liệu gốc mặc định?')) {
                  resetAllDataToDefault();
                  showToast('Đã khôi phục dữ liệu mặc định thành công!');
                }
              }}
              className="px-4 py-2 rounded-full bg-[#1A1C26] border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white flex items-center gap-1.5 cursor-pointer hover:border-[#FABF2E]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Khôi phục gốc</span>
            </button>

            <Link
              href="/"
              className="px-4 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Xem Website
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-5 space-y-2">
            <div className="flex items-center justify-between text-[#9EA6B8]">
              <span className="text-xs">Tổng doanh thu</span>
              <DollarSign className="w-4 h-4 text-[#33C773]" />
            </div>
            <div className="text-2xl font-black text-white">
              {totalRevenue.toLocaleString('vi-VN')} đ
            </div>
            <div className="text-[11px] text-[#33C773] font-semibold">Tăng trưởng 18% so với tuần trước</div>
          </div>

          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-5 space-y-2">
            <div className="flex items-center justify-between text-[#9EA6B8]">
              <span className="text-xs">Tổng vé bán ra</span>
              <Ticket className="w-4 h-4 text-[#FABF2E]" />
            </div>
            <div className="text-2xl font-black text-white">{totalTicketsSold} vé</div>
            <div className="text-[11px] text-[#FABF2E] font-semibold">Tỷ lệ lấp đầy phòng chiếu: 84%</div>
          </div>

          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-5 space-y-2">
            <div className="flex items-center justify-between text-[#9EA6B8]">
              <span className="text-xs">Phim trên hệ thống</span>
              <Film className="w-4 h-4 text-[#E63845]" />
            </div>
            <div className="text-2xl font-black text-white">{movies.length} phim</div>
            <div className="text-[11px] text-[#9EA6B8]">
              {movies.filter((m) => m.status === 'NOW_SHOWING').length} đang chiếu • {movies.filter((m) => m.status === 'COMING_SOON').length} sắp chiếu
            </div>
          </div>

          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-5 space-y-2">
            <div className="flex items-center justify-between text-[#9EA6B8]">
              <span className="text-xs">Cụm rạp hoạt động</span>
              <MapPin className="w-4 h-4 text-[#4A90E2]" />
            </div>
            <div className="text-2xl font-black text-white">{cinemas.length} cụm rạp</div>
            <div className="text-[11px] text-[#4A90E2] font-semibold">Hà Nội & TP. Hồ Chí Minh</div>
          </div>
        </div>

        {/* Main Admin Navigation Tabs (Cho phép quản lý TOÀN BỘ thông tin trên web) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#303645]">
          {[
            { id: 'MOVIES', label: 'Quản Lý Phim', icon: Film, count: movies.length },
            { id: 'CINEMAS', label: 'Quản Lý Cụm Rạp', icon: MapPin, count: cinemas.length },
            { id: 'SHOWTIMES', label: 'Lịch Suất Chiếu', icon: Calendar, count: showtimes.length },
            { id: 'BOOKINGS', label: 'Đơn Vé & Khách Hàng', icon: Ticket, count: systemTickets.length },
            { id: 'PROMOTIONS', label: 'Mã Khuyến Mãi', icon: Sparkles, count: promotions.length },
            { id: 'FOODS', label: 'Bắp Nước & Combo', icon: Coffee, count: foods.length },
            { id: 'NEWS', label: 'Tin Tức Điện Ảnh', icon: Newspaper, count: news.length },
            { id: 'SETTINGS', label: 'Cấu Hình Website', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchTerm('');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E63845] text-white shadow-lg shadow-[#E63845]/30'
                    : 'bg-[#1A1C26] text-[#9EA6B8] hover:text-white border border-[#303645]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white text-black' : 'bg-[#0F1217] text-[#9EA6B8]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar for items */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#9EA6B8]" />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1A1C26] border border-[#303645] rounded-full pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: QUẢN LÝ PHIM (Movies CRUD) */}
        {/* ================================================================= */}
        {activeTab === 'MOVIES' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Danh Sách Phim Chiếu Rạp</h2>
                <p className="text-xs text-[#9EA6B8]">Thêm mới, chỉnh sửa thông tin, poster, trailer hoặc thay đổi trạng thái phim</p>
              </div>

              <button
                onClick={openAddMovieModal}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Phim Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {movies
                .filter((m) => m.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((movie) => (
                  <div
                    key={movie.id}
                    className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 flex gap-4 hover:border-[#E63845]/50 transition-all group"
                  >
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="w-20 h-28 object-cover rounded-xl border border-[#303645] flex-shrink-0"
                    />

                    <div className="flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            onClick={() => {
                              const newStatus = movie.status === 'NOW_SHOWING' ? 'COMING_SOON' : 'NOW_SHOWING';
                              updateMovie(movie.id, { status: newStatus });
                              showToast(`Đã chuyển phim sang ${newStatus === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : 'SẮP CHIẾU'}`);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase cursor-pointer hover:opacity-80 transition-opacity ${
                              movie.status === 'NOW_SHOWING'
                                ? 'bg-[#E63845] text-white'
                                : 'bg-[#FABF2E] text-black'
                            }`}
                            title="Bấm để đổi nhanh trạng thái"
                          >
                            {movie.status === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : 'SẮP CHIẾU'}
                          </span>

                          <span className="text-[10px] text-[#FABF2E] font-bold">★ {movie.imdb_score || 8.0}</span>
                        </div>

                        <h3 className="font-bold text-white text-sm line-clamp-1 mt-1 group-hover:text-[#E63845] transition-colors">
                          {movie.title}
                        </h3>

                        <p className="text-[11px] text-[#9EA6B8]">
                          {movie.age_rating} • {movie.duration_min} phút • {movie.country || 'Mỹ'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[#303645]/60">
                        <button
                          onClick={() => openEditMovieModal(movie)}
                          className="flex-1 bg-[#0F1217] hover:bg-[#E63845] text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303645]"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn xóa phim "${movie.title}"?`)) {
                              deleteMovie(movie.id);
                              showToast(`Đã xóa phim "${movie.title}"`);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                          title="Xóa phim"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: QUẢN LÝ CỤM RẠP (Cinemas CRUD) */}
        {/* ================================================================= */}
        {activeTab === 'CINEMAS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Danh Sách Cụm Rạp Chiếu</h2>
                <p className="text-xs text-[#9EA6B8]">Thêm mới cụm rạp, cập nhật địa chỉ, số hotline và phòng chiếu</p>
              </div>

              <button
                onClick={openAddCinemaModal}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Cụm Rạp</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cinemas
                .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((cinema) => (
                  <div
                    key={cinema.id}
                    className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-5 space-y-4 hover:border-[#E63845]/50 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#FABF2E]">{cinema.city}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#33C773]/20 text-[#33C773]">
                          Hoạt động
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">{cinema.name}</h3>
                      <p className="text-xs text-[#9EA6B8] leading-relaxed">{cinema.address}</p>
                      <div className="text-xs text-[#9EA6B8]">
                        Hotline: <strong className="text-white">{cinema.phone || '1900 1234'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-[#303645]/60">
                      <button
                        onClick={() => openEditCinemaModal(cinema)}
                        className="flex-1 bg-[#0F1217] hover:bg-[#E63845] text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303645]"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Chỉnh Sửa</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa cụm rạp "${cinema.name}"?`)) {
                            deleteCinema(cinema.id);
                            showToast(`Đã xóa cụm rạp "${cinema.name}"`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                        title="Xóa rạp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: QUẢN LÝ SUẤT CHIẾU (Showtimes CRUD) */}
        {/* ================================================================= */}
        {activeTab === 'SHOWTIMES' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Lịch Suất Chiếu Tại Các Rạp</h2>
                <p className="text-xs text-[#9EA6B8]">Tạo suất chiếu mới, liên kết phim và phòng chiếu</p>
              </div>

              <button
                onClick={() => setShowtimeModalOpen(true)}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Suất Chiếu</span>
              </button>
            </div>

            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden shadow-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#141720] text-[#9EA6B8] border-b border-[#303645]">
                  <tr>
                    <th className="p-4">Mã Suất</th>
                    <th className="p-4">Tên Phim</th>
                    <th className="p-4">Phòng Chiếu</th>
                    <th className="p-4">Thời Gian</th>
                    <th className="p-4">Ghế Trống</th>
                    <th className="p-4">Trạng Thái</th>
                    <th className="p-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303645]/60">
                  {showtimes.map((st) => (
                    <tr key={st.id} className="hover:bg-[#0F1217]/50 text-white">
                      <td className="p-4 font-mono font-bold text-[#FABF2E]">#{st.id}</td>
                      <td className="p-4 font-bold">{st.movie?.title || 'Dune 2'}</td>
                      <td className="p-4 text-[#9EA6B8]">{st.room?.name || 'Phòng 1 - IMAX Laser'}</td>
                      <td className="p-4 text-[#9EA6B8]">
                        {new Date(st.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(st.start_time).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="p-4 font-semibold text-[#33C773]">{st.available_seats || 80} ghế</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#33C773]/20 text-[#33C773]">
                          {st.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm('Xóa suất chiếu này khỏi hệ thống?')) {
                              deleteShowtime(st.id);
                              showToast('Đã xóa suất chiếu!');
                            }
                          }}
                          className="p-1.5 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: QUẢN LÝ ĐƠN VÉ & ĐỐI SOÁT CHUYỂN KHOẢN (Bookings) */}
        {/* ================================================================= */}
        {activeTab === 'BOOKINGS' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Danh Sách Đơn Đặt Vé Toàn Hệ Thống</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#FABF2E]/20 text-[#FABF2E] font-semibold font-mono">
                    {systemTickets.length} đơn
                  </span>
                </h2>
                <p className="text-xs text-[#9EA6B8]">
                  Tra cứu mã vé, thông tin khách hàng, kiểm tra giao dịch chuyển khoản VietQR và duyệt vé
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScanInputCode('');
                    setScanResult(null);
                    setIsTicketScannerOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Quét Soát Vé / In Kiosk</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    refreshBankTransactions();
                    setIsBankStatementsOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#8E24AA]/20 border border-[#8E24AA]/50 text-[#CE93D8] hover:bg-[#8E24AA] hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Sao Kê Biến Động Số Dư ({bankTransactions.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (systemTickets.length === 0) {
                      showToast('Chưa có đơn vé nào để mô phỏng');
                      return;
                    }
                    const target = systemTickets[0];
                    const tx = BankTransferService.simulateCustomerTransfer(
                      target.bookingCode,
                      target.totalAmount || 100000,
                      'Vietcombank (Mô phỏng)'
                    );
                    refreshBankTransactions();
                    showToast(`Đã nhận tiền chuyển khoản ${tx.amount.toLocaleString()}đ từ ${tx.senderBank}!`);
                  }}
                  className="px-3 py-2 rounded-xl bg-[#33C773]/15 border border-[#33C773]/40 text-[#33C773] hover:bg-[#33C773] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Mô phỏng khách chuyển tiền ngân hàng cho đơn vé đầu tiên"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Test Bắn Tiền</span>
                </button>
              </div>
            </div>

            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#141720] text-[#9EA6B8] border-b border-[#303645]">
                    <tr>
                      <th className="p-4">Mã Vé</th>
                      <th className="p-4">Khách Hàng</th>
                      <th className="p-4">Tên Phim</th>
                      <th className="p-4">Rạp & Ghế</th>
                      <th className="p-4">Tổng Tiền</th>
                      <th className="p-4">Kênh TT & Mã GD</th>
                      <th className="p-4">Trạng Thái</th>
                      <th className="p-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303645]/60">
                    {systemTickets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-[#9EA6B8] italic">
                          Chưa có đơn đặt vé nào phát sinh trong phiên làm việc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      systemTickets.map((ticket, idx) => {
                        const isPaid = ticket.status === 'ĐÃ THANH TOÁN';
                        return (
                          <tr key={idx} className="hover:bg-[#0F1217]/50 text-white transition-colors">
                            <td className="p-4 font-mono font-bold text-[#FABF2E]">{ticket.bookingCode}</td>
                            <td className="p-4">
                              <div className="font-bold">{ticket.customerName || 'Khách vãng lai'}</div>
                              <div className="text-[10px] text-[#9EA6B8]">
                                {ticket.customerPhone || 'N/A'} • {ticket.customerEmail || 'N/A'}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold">{ticket.movieTitle || 'Phim'}</div>
                              <div className="text-[10px] text-[#9EA6B8]">{ticket.showtime || ticket.showtimeDate}</div>
                            </td>
                            <td className="p-4 text-[#9EA6B8]">
                              <div>{ticket.cinemaName}</div>
                              <div className="text-[10px] text-white font-semibold">
                                Ghế: {ticket.seatsStr || (Array.isArray(ticket.seats) ? ticket.seats.join(', ') : ticket.seats)}
                              </div>
                            </td>
                            <td className="p-4 font-bold text-[#FABF2E]">
                              {(ticket.totalAmount || 0).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-4">
                              <div className="text-[11px] font-semibold text-white">
                                {ticket.paymentMethod || 'VIETQR (TPBank)'}
                              </div>
                              {ticket.bankTxnId && (
                                <div className="text-[10px] font-mono text-[#33C773]">
                                  Mã GD: {ticket.bankTxnId}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#33C773]/20 text-[#33C773] border border-[#33C773]/40">
                                  <Check className="w-3 h-3" />
                                  <span>ĐÃ THANH TOÁN</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/40">
                                  <Clock className="w-3 h-3" />
                                  <span>CHỜ CHUYỂN KHOẢN</span>
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isPaid && (
                                  <button
                                    type="button"
                                    onClick={() => handleManualApproveTicket(ticket, idx)}
                                    title="Duyệt thanh toán chuyển khoản thủ công"
                                    className="p-1.5 rounded-lg bg-[#33C773]/15 text-[#33C773] hover:bg-[#33C773] hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = systemTickets.filter((_, i) => i !== idx);
                                    setSystemTickets(updated);
                                    localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
                                    window.dispatchEvent(new Event('cinemax_data_updated'));
                                    window.dispatchEvent(new Event('storage'));
                                    showToast('Đã xóa đơn vé!');
                                  }}
                                  title="Xóa đơn vé"
                                  className="p-1.5 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: QUẢN LÝ MÃ KHUYẾN MÃI (Promotions CRUD) */}
        {/* ================================================================= */}
        {activeTab === 'PROMOTIONS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Danh Sách Mã Khuyến Mãi</h2>
                <p className="text-xs text-[#9EA6B8]">Tạo voucher giảm giá, mức giảm % hoặc tiền mặt, ngày hết hạn</p>
              </div>

              <button
                onClick={openAddPromoModal}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Mã Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {promotions
                .filter((p) => p.code.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((promo) => (
                  <div
                    key={promo.id}
                    className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-5 space-y-4 hover:border-[#FABF2E]/50 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded text-xs font-mono font-black bg-[#E63845]/20 text-[#E63845] border border-[#E63845]/40">
                          {promo.code}
                        </span>
                        <span className="text-xs font-bold text-[#33C773]">
                          {promo.discount_type === 'PERCENT' ? `Giảm ${promo.discount_value}%` : `Giảm ${(promo.discount_value / 1000)}k`}
                        </span>
                      </div>

                      <p className="text-xs text-white font-medium">{promo.description}</p>
                      <div className="text-[11px] text-[#9EA6B8] space-y-0.5">
                        <div>Đơn tối thiểu: <strong className="text-white">{promo.min_order.toLocaleString('vi-VN')} đ</strong></div>
                        <div>Hạn dùng: <strong className="text-white">{promo.valid_to}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-[#303645]/60">
                      <button
                        onClick={() => openEditPromoModal(promo)}
                        className="flex-1 bg-[#0F1217] hover:bg-[#FABF2E] hover:text-black text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303645]"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Xóa mã khuyến mãi "${promo.code}"?`)) {
                            deletePromotion(promo.id);
                            showToast(`Đã xóa mã "${promo.code}"`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: QUẢN LÝ BẮP NƯỚC (Food CRUD) */}
        {/* ================================================================= */}
        {activeTab === 'FOODS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Danh Mục Bắp Nước & Combo</h2>
                <p className="text-xs text-[#9EA6B8]">Quản lý giá, hình ảnh và danh sách combo bán kèm tại quầy</p>
              </div>

              <button
                onClick={openAddFoodModal}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Combo Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {foods
                .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((food) => (
                  <div
                    key={food.id}
                    className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 flex gap-4 hover:border-[#E63845]/50 transition-all group"
                  >
                    <img
                      src={food.image_url}
                      alt={food.name}
                      className="w-16 h-16 object-cover rounded-xl border border-[#303645] flex-shrink-0"
                    />

                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#FABF2E]">{food.category}</span>
                          <span className="text-xs font-bold text-white">{food.price.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <h3 className="font-bold text-white text-sm line-clamp-1 mt-0.5">{food.name}</h3>
                        <p className="text-[11px] text-[#9EA6B8] line-clamp-1">{food.description}</p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[#303645]/60 mt-2">
                        <button
                          onClick={() => openEditFoodModal(food)}
                          className="flex-1 bg-[#0F1217] hover:bg-[#E63845] text-white py-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303645]"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Xóa món "${food.name}"?`)) {
                              deleteFoodItem(food.id);
                              showToast(`Đã xóa món "${food.name}"`);
                            }
                          }}
                          className="p-1 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: QUẢN LÝ TIN TỨC (News CRUD) */}
        {/* ================================================================= */}
        {activeTab === 'NEWS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Tin Tức & Bài Viết Điện Ảnh</h2>
                <p className="text-xs text-[#9EA6B8]">Đăng bài viết mới, cập nhật tin tức phòng vé và sự kiện rạp</p>
              </div>

              <button
                onClick={openAddNewsModal}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Đăng Bài Viết Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {news
                .filter((n) => n.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden hover:border-[#E63845]/50 transition-all shadow-xl group flex flex-col justify-between"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-black">
                      <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>

                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-[#FABF2E] font-medium">{item.date}</span>
                          <span className="text-[#9EA6B8] bg-[#0F1217] px-2 py-0.5 rounded border border-[#303645]">{item.category}</span>
                        </div>
                        <h3 className="font-bold text-white text-sm group-hover:text-[#E63845] transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#9EA6B8] mt-1.5 line-clamp-2 leading-relaxed">
                          {item.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-[#303645]/60">
                        <button
                          onClick={() => openEditNewsModal(item)}
                          className="flex-1 bg-[#0F1217] hover:bg-[#E63845] text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#303645]"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Chỉnh Sửa</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Xóa bài viết "${item.title}"?`)) {
                              deleteNewsArticle(item.id);
                              showToast(`Đã xóa bài viết!`);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-[#E63845]/15 text-[#E63845] hover:bg-[#E63845] hover:text-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: CẤU HÌNH WEBSITE & THANH TOÁN (Site & Payment Settings) */}
        {/* ================================================================= */}
        {activeTab === 'SETTINGS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Cấu hình Website & Hotline */}
            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#E63845]" />
                  <span>Cấu Hình Banner & Hệ Thống Website</span>
                </h2>
                <p className="text-xs text-[#9EA6B8]">Thay đổi thông tin hotline, email hỗ trợ, tiêu đề banner nổi bật trên trang chủ</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                    Tiêu đề Banner Hero Trang chủ
                  </label>
                  <input
                    type="text"
                    value={settingsForm.hero_title || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hero_title: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                    Phụ đề / Thông điệp Banner Hero
                  </label>
                  <input
                    type="text"
                    value={settingsForm.hero_subtitle || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hero_subtitle: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                      Số Hotline CSKH
                    </label>
                    <input
                      type="text"
                      value={settingsForm.hotline || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, hotline: e.target.value })}
                      className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                      Email Hỗ Trợ Khách Hàng
                    </label>
                    <input
                      type="email"
                      value={settingsForm.support_email || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, support_email: e.target.value })}
                      className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-6 py-2.5 rounded-full font-bold text-xs transition-all shadow-md cursor-pointer"
                >
                  Lưu Cấu Hình Website
                </button>
              </form>
            </div>

            {/* Card 2: Cấu hình Tài khoản Ngân hàng VietQR (Phương thức 1: QR Động Napas 247) */}
            <div className="bg-[#1A1C26] border border-[#8E24AA]/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#8E24AA] text-white text-[10px] font-black px-3 py-1 rounded-bl-xl tracking-wider uppercase">
                Phương thức 1: QR Động
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#8E24AA]/20 text-[#CE93D8] mb-2 border border-[#8E24AA]/40">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>VIETQR NAPAS 247 • TÀI KHOẢN THỤ HƯỞNG</span>
                </div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#FABF2E]" />
                  <span>Cấu Hình QR Nhận Thanh Toán (Admin)</span>
                </h2>
                <p className="text-xs text-[#9EA6B8]">
                  Khách đặt vé sẽ quét mã VietQR tự động nhúng số tiền và mã đơn vé chuyển trực tiếp về tài khoản dưới đây:
                </p>
              </div>

              <form onSubmit={handleSaveBankConfig} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                    Ngân hàng thụ hưởng *
                  </label>
                  <select
                    value={bankConfig.bankShortName}
                    onChange={(e) => {
                      const selectedBank = POPULAR_VIETQR_BANKS.find((b) => b.shortName === e.target.value);
                      if (selectedBank) {
                        setBankConfig({
                          ...bankConfig,
                          bankId: selectedBank.bin,
                          bankName: selectedBank.name,
                          bankShortName: selectedBank.shortName,
                          bankCode: selectedBank.code,
                        });
                      }
                    }}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FABF2E]"
                  >
                    {POPULAR_VIETQR_BANKS.map((b) => (
                      <option key={b.bin} value={b.shortName}>
                        {b.shortName} — {b.name} ({b.bin})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                    Số tài khoản ngân hàng *
                  </label>
                  <input
                    type="text"
                    value={bankConfig.accountNumber}
                    onChange={(e) => setBankConfig({ ...bankConfig, accountNumber: e.target.value.trim() })}
                    placeholder="VD: 08341902000"
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FABF2E] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#9EA6B8] block mb-1.5">
                    Tên chủ tài khoản thụ hưởng (In hoa không dấu) *
                  </label>
                  <input
                    type="text"
                    value={bankConfig.accountName}
                    onChange={(e) => setBankConfig({ ...bankConfig, accountName: e.target.value.toUpperCase() })}
                    placeholder="VD: TRUONG CONG TIEN"
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FABF2E] font-bold uppercase"
                  />
                </div>

                {/* Khối Xem Trước (Live Preview) */}
                <div className="p-3.5 bg-[#0F1217] border border-[#303645] rounded-2xl flex items-center gap-4">
                  <div className="w-20 h-20 bg-white p-1 rounded-xl shrink-0 flex items-center justify-center shadow-md">
                    <img
                      src={previewQrUrl}
                      alt="VietQR Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="text-[10px] text-[#FABF2E] font-bold uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Xem trước mã VietQR tự động:</span>
                    </div>
                    <div className="font-bold text-white text-sm">{bankConfig.accountName || 'CHỦ TÀI KHOẢN'}</div>
                    <div className="text-[#9EA6B8] font-mono text-xs">
                      STK: <strong className="text-white">{bankConfig.accountNumber || '...'}</strong> ({bankConfig.bankShortName})
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Chuẩn Napas 247 • Nhúng tự động số tiền & mã đơn
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#8E24AA] hover:bg-[#7B1FA2] text-white py-3 rounded-full font-bold text-xs transition-all shadow-lg shadow-[#8E24AA]/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu Cấu Hình Tài Khoản VietQR</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ================================================================= */}
      {/* MODAL 1: THÊM / SỬA PHIM */}
      {/* ================================================================= */}
      {movieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl relative">
            <button
              onClick={() => setMovieModalOpen(false)}
              className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-[#E63845]" />
              <span>{editingMovie ? 'Chỉnh Sửa Thông Tin Phim' : 'Thêm Phim Chiếu Rạp Mới'}</span>
            </h3>

            <form onSubmit={handleSaveMovie} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Tên phim *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Avatar 3"
                    value={movieForm.title}
                    onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Tên gốc tiếng Anh</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Avatar: Fire and Ash"
                    value={movieForm.original_title}
                    onChange={(e) => setMovieForm({ ...movieForm, original_title: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Thời lượng (phút)</label>
                  <input
                    type="number"
                    value={movieForm.duration_min}
                    onChange={(e) => setMovieForm({ ...movieForm, duration_min: parseInt(e.target.value) || 120 })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Độ tuổi</label>
                  <select
                    value={movieForm.age_rating}
                    onChange={(e) => setMovieForm({ ...movieForm, age_rating: e.target.value as AgeRating })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  >
                    <option value="P">P (Mọi lứa tuổi)</option>
                    <option value="K">K (Dưới 13 tuổi có bảo hộ)</option>
                    <option value="T13">T13 (Từ 13 tuổi)</option>
                    <option value="T16">T16 (Từ 16 tuổi)</option>
                    <option value="T18">T18 (Từ 18 tuổi)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Trạng thái</label>
                  <select
                    value={movieForm.status}
                    onChange={(e) => setMovieForm({ ...movieForm, status: e.target.value as MovieStatus })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  >
                    <option value="NOW_SHOWING">Đang chiếu</option>
                    <option value="COMING_SOON">Sắp chiếu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">URL Poster (Ảnh dọc)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={movieForm.poster_url}
                  onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">URL Trailer Youtube</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={movieForm.trailer_url}
                  onChange={(e) => setMovieForm({ ...movieForm, trailer_url: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Nội dung tóm tắt</label>
                <textarea
                  rows={3}
                  value={movieForm.synopsis}
                  onChange={(e) => setMovieForm({ ...movieForm, synopsis: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMovieModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingMovie ? 'Cập Nhật' : 'Thêm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: THÊM / SỬA RẠP CHIẾU */}
      {/* ================================================================= */}
      {cinemaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative">
            <button onClick={() => setCinemaModalOpen(false)} className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#E63845]" />
              <span>{editingCinema ? 'Chỉnh Sửa Cụm Rạp' : 'Thêm Cụm Rạp Mới'}</span>
            </h3>

            <form onSubmit={handleSaveCinema} className="space-y-4">
              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Tên cụm rạp *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cinemax Times City"
                  value={cinemaForm.name}
                  onChange={(e) => setCinemaForm({ ...cinemaForm, name: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Địa chỉ chi tiết *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tầng B1, Vincom Times City, Hai Bà Trưng, Hà Nội"
                  value={cinemaForm.address}
                  onChange={(e) => setCinemaForm({ ...cinemaForm, address: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Thành phố</label>
                  <input
                    type="text"
                    value={cinemaForm.city}
                    onChange={(e) => setCinemaForm({ ...cinemaForm, city: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Hotline</label>
                  <input
                    type="text"
                    value={cinemaForm.phone}
                    onChange={(e) => setCinemaForm({ ...cinemaForm, phone: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCinemaModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingCinema ? 'Cập Nhật' : 'Thêm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: THÊM / SỬA KHUYẾN MÃI */}
      {/* ================================================================= */}
      {promoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative">
            <button onClick={() => setPromoModalOpen(false)} className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FABF2E]" />
              <span>{editingPromo ? 'Chỉnh Sửa Mã Khuyến Mãi' : 'Thêm Mã Khuyến Mãi Mới'}</span>
            </h3>

            <form onSubmit={handleSavePromo} className="space-y-4">
              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Mã code giảm giá *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: SALE50K"
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Mô tả chương trình</label>
                <input
                  type="text"
                  placeholder="Giảm ngay 20.000đ khi đặt vé online"
                  value={promoForm.description}
                  onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Giá trị giảm (VNĐ)</label>
                  <input
                    type="number"
                    value={promoForm.discount_value}
                    onChange={(e) => setPromoForm({ ...promoForm, discount_value: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Đơn tối thiểu (VNĐ)</label>
                  <input
                    type="number"
                    value={promoForm.min_order}
                    onChange={(e) => setPromoForm({ ...promoForm, min_order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPromoModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingPromo ? 'Cập Nhật' : 'Thêm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: THÊM / SỬA BẮP NƯỚC */}
      {/* ================================================================= */}
      {foodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative">
            <button onClick={() => setFoodModalOpen(false)} className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Coffee className="w-5 h-5 text-[#FABF2E]" />
              <span>{editingFood ? 'Chỉnh Sửa Món Bắp Nước' : 'Thêm Combo Bắp Nước Mới'}</span>
            </h3>

            <form onSubmit={handleSaveFood} className="space-y-4">
              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Tên món / combo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Combo 2 Bắp + 2 Nước"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Giá bán (VNĐ)</label>
                  <input
                    type="number"
                    value={foodForm.price}
                    onChange={(e) => setFoodForm({ ...foodForm, price: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Phân loại</label>
                  <select
                    value={foodForm.category}
                    onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value as any })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  >
                    <option value="COMBO">Combo</option>
                    <option value="POPCORN">Bắp rang</option>
                    <option value="DRINK">Nước ngọt</option>
                    <option value="SNACK">Snack</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">URL Hình ảnh</label>
                <input
                  type="text"
                  value={foodForm.image_url}
                  onChange={(e) => setFoodForm({ ...foodForm, image_url: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Mô tả món</label>
                <input
                  type="text"
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFoodModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingFood ? 'Cập Nhật' : 'Thêm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 5: THÊM / SỬA TIN TỨC */}
      {/* ================================================================= */}
      {newsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button onClick={() => setNewsModalOpen(false)} className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[#E63845]" />
              <span>{editingNews ? 'Chỉnh Sửa Bài Viết' : 'Đăng Bài Viết Mới'}</span>
            </h3>

            <form onSubmit={handleSaveNews} className="space-y-4">
              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Tiêu đề bài viết *</label>
                <input
                  type="text"
                  required
                  placeholder="Tiêu đề bài viết tin tức điện ảnh"
                  value={newsForm.title}
                  onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Chuyên mục</label>
                  <input
                    type="text"
                    value={newsForm.category}
                    onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Tác giả</label>
                  <input
                    type="text"
                    value={newsForm.author}
                    onChange={(e) => setNewsForm({ ...newsForm, author: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">URL Ảnh bìa</label>
                <input
                  type="text"
                  value={newsForm.img}
                  onChange={(e) => setNewsForm({ ...newsForm, img: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Tóm tắt ngắn</label>
                <textarea
                  rows={2}
                  value={newsForm.summary}
                  onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingNews ? 'Cập Nhật' : 'Đăng Bài'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 6: THÊM SUẤT CHIẾU */}
      {/* ================================================================= */}
      {showtimeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative">
            <button onClick={() => setShowtimeModalOpen(false)} className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#E63845]" />
              <span>Thêm Suất Chiếu Mới</span>
            </h3>

            <form onSubmit={handleSaveShowtime} className="space-y-4">
              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Chọn phim chiếu *</label>
                <select
                  value={showtimeForm.movie_id}
                  onChange={(e) => setShowtimeForm({ ...showtimeForm, movie_id: Number(e.target.value) })}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                >
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.age_rating})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Ngày chiếu</label>
                  <input
                    type="date"
                    value={showtimeForm.date}
                    onChange={(e) => setShowtimeForm({ ...showtimeForm, date: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9EA6B8] block mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={showtimeForm.time}
                    onChange={(e) => setShowtimeForm({ ...showtimeForm, time: e.target.value })}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowtimeModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#303645] text-xs font-semibold text-[#9EA6B8] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#E63845] hover:bg-[#CC2B37] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Tạo Suất Chiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 7: SAO KÊ BIẾN ĐỘNG SỐ DƯ & ĐỐI SOÁT NGÂN HÀNG (VietQR TPBank) */}
      {/* ================================================================= */}
      {isBankStatementsOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-5 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsBankStatementsOpen(false)}
              className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#8E24AA]/20 border border-[#8E24AA]/50 text-[#CE93D8]">
                <Receipt className="w-3.5 h-3.5" />
                <span>VIETQR • TPBANK OPEN BANKING API</span>
              </div>
              <h3 className="text-xl font-bold text-white">Sao Kê Biến Động Số Dư & Đối Soát Vé</h3>
              <p className="text-xs text-[#9EA6B8]">
                Tài khoản nhận tiền: <strong className="text-white">{bankConfig.bankShortName} - {bankConfig.accountNumber} ({bankConfig.accountName})</strong>
              </p>
            </div>

            {/* Form ghi nhận giao dịch chuyển khoản tại quầy */}
            <div className="p-4 bg-[#0F1217] border border-[#303645] rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-[#FABF2E] flex items-center gap-1.5 uppercase">
                <Plus className="w-3.5 h-3.5" />
                <span>Ghi Nhận Giao Dịch Chuyển Khoản Thủ Công (Tại Quầy / Khách Gửi Biên Lai)</span>
              </h4>
              <form onSubmit={handleAddManualBankTransaction} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] text-[#9EA6B8] block mb-1">Mã đơn vé (CNM...)</label>
                  <input
                    type="text"
                    value={manualTxOrderCode}
                    onChange={(e) => setManualTxOrderCode(e.target.value)}
                    placeholder="VD: CNM261016-A8F2K"
                    className="w-full bg-[#1A1C26] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-[#FABF2E] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9EA6B8] block mb-1">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    value={manualTxAmount}
                    onChange={(e) => setManualTxAmount(Number(e.target.value))}
                    className="w-full bg-[#1A1C26] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FABF2E] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9EA6B8] block mb-1">Ngân hàng gửi</label>
                  <select
                    value={manualTxSenderBank}
                    onChange={(e) => setManualTxSenderBank(e.target.value)}
                    className="w-full bg-[#1A1C26] border border-[#303645] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FABF2E]"
                  >
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="MBBank">MBBank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="BIDV">BIDV</option>
                    <option value="VietinBank">VietinBank</option>
                    <option value="ACB">ACB</option>
                    <option value="TPBank">TPBank</option>
                    <option value="VPBank">VPBank</option>
                    <option value="Thu ngân duyệt tại quầy">Thu ngân tại quầy</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-[#33C773] hover:bg-[#2EB867] text-white py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Ghi Nhận & Khớp Vé</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Bảng danh sách sao kê ngân hàng */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Lịch Sử Biến Động Số Dư Gần Nhất</h4>
                <button
                  type="button"
                  onClick={refreshBankTransactions}
                  className="text-xs text-[#FABF2E] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Làm mới</span>
                </button>
              </div>

              <div className="border border-[#303645] rounded-2xl overflow-hidden bg-[#0F1217]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#141720] text-[#9EA6B8] border-b border-[#303645]">
                    <tr>
                      <th className="p-3">Mã GD (FT)</th>
                      <th className="p-3">Mã Đơn Khớp</th>
                      <th className="p-3">Số Tiền</th>
                      <th className="p-3">Ngân Hàng Gửi</th>
                      <th className="p-3">Nội Dung</th>
                      <th className="p-3">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303645]/50">
                    {bankTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-[#9EA6B8] italic">
                          Chưa có biến động số dư nào được ghi nhận. Bấm &quot;Test Bắn Tiền&quot; hoặc &quot;Ghi Nhận Giao Dịch&quot; để mô phỏng.
                        </td>
                      </tr>
                    ) : (
                      bankTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-[#1A1C26]/60 text-white">
                          <td className="p-3 font-mono font-bold text-[#FABF2E]">{tx.transactionId}</td>
                          <td className="p-3 font-mono font-bold text-white">{tx.orderCode}</td>
                          <td className="p-3 font-bold text-[#33C773]">
                            +{tx.amount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-3 text-[#9EA6B8]">{tx.senderBank}</td>
                          <td className="p-3 text-[11px] text-[#9EA6B8] max-w-[180px] truncate">
                            {tx.description}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#33C773]/20 text-[#33C773] border border-[#33C773]/30">
                              ✓ THÀNH CÔNG
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsBankStatementsOpen(false)}
                className="px-5 py-2 rounded-full bg-[#303645] hover:bg-[#3E4557] text-white text-xs font-semibold cursor-pointer"
              >
                Đóng Cửa Sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 8: MÁY QUÉT SOÁT VÉ VÀO CỬA & IN VÉ KIOSK (Ticket Scanner) */}
      {/* ================================================================= */}
      {isTicketScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-5 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsTicketScannerOpen(false)}
              className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#E63845]/15 border border-[#E63845]/40 text-[#E63845]">
                <QrCode className="w-3.5 h-3.5" />
                <span>HỆ THỐNG SOÁT VÉ TỰ ĐỘNG & KIOSK IN VÉ CINEMAX</span>
              </div>
              <h3 className="text-xl font-bold text-white">Đầu Đọc Quét Mã Vé Điện Tử</h3>
              <p className="text-xs text-[#9EA6B8]">
                Bắn mã QR trên điện thoại khách hàng bằng máy quét barcode 2D hoặc camera Kiosk
              </p>
            </div>

            {/* Form máy quét */}
            <form onSubmit={handleScanTicket} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={scanInputCode}
                  onChange={(e) => setScanInputCode(e.target.value)}
                  placeholder="Quét mã QR hoặc nhập mã vé (VD: CNM261016-A8F2K)"
                  className="flex-1 bg-[#0F1217] border border-[#303645] focus:border-[#E63845] rounded-2xl px-4 py-3 text-sm text-white font-mono focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>Quét Mã</span>
                </button>
              </div>

              {/* Nút test nhanh từ danh sách vé */}
              {systemTickets.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-[#9EA6B8] flex-wrap">
                  <span>Mã vé mẫu sẵn có:</span>
                  {systemTickets.slice(0, 3).map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setScanInputCode(t.bookingCode);
                        const res = TicketScannerService.checkInTicket(t.bookingCode);
                        setScanResult(res);
                      }}
                      className="text-[#FABF2E] hover:underline font-mono font-bold bg-[#0F1217] px-2 py-0.5 rounded border border-[#303645] cursor-pointer"
                    >
                      {t.bookingCode}
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Kết quả quét vé */}
            {scanResult && (
              <div
                className={`p-5 rounded-2xl border space-y-3 animate-in zoom-in-95 ${
                  scanResult.action === 'ALLOW_ENTRY'
                    ? 'bg-[#33C773]/10 border-[#33C773]/50 text-white'
                    : scanResult.action === 'ALREADY_CHECKED_IN'
                    ? 'bg-[#E63845]/15 border-[#E63845] text-white'
                    : 'bg-[#FABF2E]/10 border-[#FABF2E]/50 text-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {scanResult.action === 'ALLOW_ENTRY' ? (
                    <div className="w-10 h-10 rounded-xl bg-[#33C773] text-white flex items-center justify-center shrink-0">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                  ) : scanResult.action === 'ALREADY_CHECKED_IN' ? (
                    <div className="w-10 h-10 rounded-xl bg-[#E63845] text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#FABF2E] text-black flex items-center justify-center shrink-0 font-bold">
                      !
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <h4 className="text-base font-bold">
                      {scanResult.action === 'ALLOW_ENTRY' && '✓ VÉ HỢP LỆ — MỜI KHÁCH VÀO PHÒNG CHIẾU'}
                      {scanResult.action === 'ALREADY_CHECKED_IN' && '⚠️ CẢNH BÁO: VÉ NÀY ĐÃ ĐƯỢC SOÁT VÀO CỬA RỒI!'}
                      {scanResult.action === 'NOT_PAID' && '❌ VÉ CHƯA HOÀN TẤT THANH TOÁN'}
                      {scanResult.action === 'NOT_FOUND' && '❌ KHÔNG TÌM THẤY VÉ TRÊN HỆ THỐNG'}
                    </h4>
                    <p className="text-xs text-white/90">{scanResult.message}</p>
                  </div>
                </div>

                {/* Chi tiết vé nếu tìm thấy */}
                {scanResult.ticket && (
                  <div className="bg-[#0F1217] p-3.5 rounded-xl border border-[#303645] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#9EA6B8] block text-[11px]">Tên phim:</span>
                      <strong className="text-white">{scanResult.ticket.movieTitle}</strong>
                    </div>
                    <div>
                      <span className="text-[#9EA6B8] block text-[11px]">Phòng & Suất:</span>
                      <strong className="text-[#FABF2E]">{scanResult.ticket.roomName} • {scanResult.ticket.showtime || scanResult.ticket.showtimeDate}</strong>
                    </div>
                    <div>
                      <span className="text-[#9EA6B8] block text-[11px]">Số ghế:</span>
                      <strong className="text-white">{scanResult.ticket.seatsStr || scanResult.ticket.seats}</strong>
                    </div>
                    <div>
                      <span className="text-[#9EA6B8] block text-[11px]">Khách hàng:</span>
                      <strong className="text-white">{scanResult.ticket.customerName || 'Khách vãng lai'}</strong>
                    </div>
                  </div>
                )}

                {/* Nút in vé Kiosk */}
                {scanResult.ticket && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handlePrintTicketAtKiosk(scanResult.ticket.bookingCode)}
                      className="bg-[#FABF2E] hover:bg-[#E5AC26] text-black px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>In Vé Giấy Tại Kiosk (Print Ticket)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsTicketScannerOpen(false)}
                className="px-5 py-2 rounded-full bg-[#303645] hover:bg-[#3E4557] text-white text-xs font-semibold cursor-pointer"
              >
                Đóng Máy Quét
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
