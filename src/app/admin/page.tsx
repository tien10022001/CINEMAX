'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Menu,
  Bell,
  User,
  CheckCheck,
  Trash2,
  X,
  Info,
  ExternalLink,
  Sparkles,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AdminDataService } from '@/lib/services/admin-data.service';
import AdminSidebar, { AdminTab } from '@/components/admin/AdminSidebar';
import DashboardView from '@/components/admin/DashboardView';
import MoviesView from '@/components/admin/MoviesView';
import ShowtimesView from '@/components/admin/ShowtimesView';
import AuditoriumsView from '@/components/admin/AuditoriumsView';
import ConcessionView from '@/components/admin/ConcessionView';
import CouponsView from '@/components/admin/CouponsView';
import PosShiftsView from '@/components/admin/PosShiftsView';
import CheckinView from '@/components/admin/CheckinView';
import FoodCheckinView from '@/components/admin/FoodCheckinView';
import OrdersFinanceView from '@/components/admin/OrdersFinanceView';
import SystemSettingsView from '@/components/admin/SystemSettingsView';
import { SupportService } from '@/services/support.service';
import {
  Movie,
  Auditorium,
  Seat,
  Showtime,
  ShowtimePrice,
  Product,
  ProductComponent,
  ProductModifier,
  Shift,
  Order,
  OrderItem,
  Ticket,
  Refund,
  InvoiceRequest,
  SupportRequest,
  Coupon,
  CinemaSetting,
  AuditLog,
  Genre,
  InventoryMovement,
  SeatStatus,
  SeatType
} from '@/lib/types-redesign';
import { syncOrderToSupabase } from '@/lib/supabase/queries';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  category: 'ALL' | 'SYSTEM' | 'MOVIES' | 'SALES' | 'AUDIT';
  created_at: string;
  is_read: boolean;
  link_tab?: AdminTab;
}

const DEFAULT_NOTIFICATIONS: AdminNotification[] = [
  {
    id: 'notif-init-1',
    title: 'Hệ thống Cinemax v2.0 sẵn sàng',
    message: 'Đã kích hoạt cơ sở dữ liệu đồng bộ thời gian thực cho rạp với 28 bảng dữ liệu.',
    type: 'SUCCESS',
    category: 'SYSTEM',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    is_read: false
  },
  {
    id: 'notif-init-2',
    title: 'Ca bán vé POS-01 kích hoạt',
    message: 'Nhân viên mở ca tại quầy POS-01 với quỹ tiền mặt đầu ca 2.000.000đ.',
    type: 'INFO',
    category: 'SALES',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    is_read: false,
    link_tab: 'POS_SHIFTS'
  },
  {
    id: 'notif-init-3',
    title: 'Cơ sở vật chất & Sơ đồ ghế',
    message: 'Đã thiết lập phòng chiếu số 1 (2D Digital) và phòng số 2 (IMAX Laser).',
    type: 'INFO',
    category: 'MOVIES',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    is_read: true,
    link_tab: 'AUDITORIUMS'
  },
  {
    id: 'notif-init-4',
    title: 'Đăng nhập phiên làm việc',
    message: 'Tài khoản Quản trị viên (admin@cinemax.vn) đã đăng nhập vào hệ thống.',
    type: 'SUCCESS',
    category: 'AUDIT',
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    is_read: true,
    link_tab: 'AUDIT_LOGS'
  }
];

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return new Date(isoString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export default function AdminPage() {
  const { currentUser, isLoading: isAuthLoading, login, logout } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');

  // Client hydration & admin session persistence
  const [isMounted, setIsMounted] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Login credentials for admin gateway
  const [adminEmail, setAdminEmail] = useState('admin@cinemax.vn');
  const [adminPassword, setAdminPassword] = useState('admin');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState('');
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  }, []);

  // System Loading & Syncing State
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Full 28-table data state loaded with safe defaults
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([
    {
      id: 'aud-01',
      name: 'Phòng 1 (2D Digital)',
      screen_type: '2D',
      sound_system: 'Dolby 7.1',
      total_seats: 80,
      cleaning_buffer_minutes: 15,
      status: 'active',
      seat_map_version: 1
    },
    {
      id: 'aud-02',
      name: 'Phòng 2 (IMAX Laser)',
      screen_type: 'IMAX',
      sound_system: 'Dolby Atmos',
      total_seats: 80,
      cleaning_buffer_minutes: 20,
      status: 'active',
      seat_map_version: 1
    }
  ]);

  // Helper to generate dynamic seat layout for any auditorium based on seatCount
  const generateDefaultSeatsForAud = (audId: string, seatCount: number = 80): Seat[] => {
    const ALL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P'];
    const cols = 10;
    const numRows = Math.min(Math.max(4, Math.ceil(seatCount / cols)), ALL_LETTERS.length);
    const rows = ALL_LETTERS.slice(0, numRows);

    const generated: Seat[] = [];
    let count = 0;

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const isLastRow = rIdx === rows.length - 1;
      const isVipRow = rIdx >= Math.floor(rows.length * 0.4) && rIdx < rows.length - 1;

      for (let col = 1; col <= cols; col++) {
        if (count >= seatCount) break;

        let seatType: SeatType = 'STANDARD';
        let price = 75000;
        if (isVipRow) {
          seatType = 'VIP';
          price = 95000;
        }
        if (isLastRow) {
          seatType = 'COUPLE';
          price = 160000;
        }

        generated.push({
          id: `seat-${audId}-${row}${col}`,
          auditorium_id: audId,
          row_label: row,
          seat_number: col,
          grid_row: rIdx + 1,
          grid_col: col,
          seat_type: seatType,
          status: 'ACTIVE',
          price
        });
        count++;
      }
    }
    return generated;
  };

  const [seats, setSeats] = useState<Seat[]>(() => {
    return [...generateDefaultSeatsForAud('aud-01'), ...generateDefaultSeatsForAud('aud-02')];
  });
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [prices, setPrices] = useState<ShowtimePrice[]>([]);
  const [products, setProducts] = useState<Product[]>([
    { id: 'p-01', name: 'Combo Solo (1 Bắp + 1 Nước)', product_type: 'COMBO', base_price: 85000, inventory_tracking: true, available_stock: 120, active: true },
    { id: 'p-02', name: 'Combo Couple (1 Bắp Lớn + 2 Nước)', product_type: 'COMBO', base_price: 115000, inventory_tracking: true, available_stock: 95, active: true },
    { id: 'p-03', name: 'Bắp Rang Bơ (Ngọt/Phô Mai)', product_type: 'FOOD', base_price: 55000, inventory_tracking: true, available_stock: 200, active: true },
    { id: 'p-04', name: 'Nước Ngọt Có Ga (Coke/Sprite)', product_type: 'BEVERAGE', base_price: 35000, inventory_tracking: true, available_stock: 350, active: true }
  ]);
  const [modifiers, setModifiers] = useState<ProductModifier[]>([]);
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [settings, setSettings] = useState<CinemaSetting[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRequest[]>([]);
  const [support, setSupport] = useState<SupportRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Notification State & Management
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'ALL' | 'SYSTEM' | 'MOVIES' | 'SALES' | 'AUDIT'>('ALL');
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationOpen]);

  // Load notifications from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_admin_notifications');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotifications(parsed);
            return;
          }
        }
        setNotifications(DEFAULT_NOTIFICATIONS);
        localStorage.setItem('cinemax_admin_notifications', JSON.stringify(DEFAULT_NOTIFICATIONS));
      } catch {
        setNotifications(DEFAULT_NOTIFICATIONS);
      }
    }
  }, []);

  const addNotification = useCallback((
    title: string,
    message: string,
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER' = 'INFO',
    category: 'SYSTEM' | 'MOVIES' | 'SALES' | 'AUDIT' = 'SYSTEM',
    link_tab?: AdminTab
  ) => {
    const newNotif: AdminNotification = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title,
      message,
      type,
      category,
      created_at: new Date().toISOString(),
      is_read: false,
      link_tab
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev].slice(0, 50);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('cinemax_admin_notifications', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, []);

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, is_read: true }));
      try {
        localStorage.setItem('cinemax_admin_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Đã đánh dấu tất cả thông báo là đã đọc!');
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    try {
      localStorage.setItem('cinemax_admin_notifications', JSON.stringify([]));
    } catch {}
    showToast('Đã xóa toàn bộ lịch sử thông báo!');
  };

  const handleNotificationClick = (notif: AdminNotification) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n));
      try {
        localStorage.setItem('cinemax_admin_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (notif.link_tab) {
      setActiveTab(notif.link_tab);
      setIsNotificationOpen(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications = notifications.filter((n) => {
    if (notificationFilter === 'ALL') return true;
    return n.category === notificationFilter;
  });

  // 1. Initial Load from Supabase & Local Sync (Safe non-blocking)
  const loadDatabaseBundle = useCallback(async () => {
    try {
      setIsSyncing(true);
      const bundle = await AdminDataService.fetchAllAdminData();

      if (bundle.movies?.length) setMovies(bundle.movies);
      if (bundle.genres?.length) setGenres(bundle.genres);
      const currentAuds = bundle.auditoriums?.length ? bundle.auditoriums : auditoriums;
      if (bundle.auditoriums?.length) setAuditoriums(bundle.auditoriums);

      let effectiveSeats = bundle.seats?.length ? [...bundle.seats] : [...seats];
      // Auto-generate seats for any auditorium that has 0 seats
      currentAuds.forEach((aud: Auditorium) => {
        const hasSeats = effectiveSeats.some((s) => s.auditorium_id === aud.id);
        if (!hasSeats) {
          const generated = generateDefaultSeatsForAud(aud.id);
          effectiveSeats = [...effectiveSeats, ...generated];
        }
      });
      setSeats(effectiveSeats);
      if (bundle.showtimes?.length) setShowtimes(bundle.showtimes);
      if (bundle.prices?.length) setPrices(bundle.prices);
      if (bundle.products?.length) setProducts(bundle.products);
      if (bundle.modifiers?.length) setModifiers(bundle.modifiers);
      if (bundle.components?.length) setComponents(bundle.components);
      if (bundle.coupons?.length) setCoupons(bundle.coupons);
      if (bundle.settings?.length) setSettings(bundle.settings);
      if (bundle.shifts?.length) setShifts(bundle.shifts);
      if (bundle.orders) setOrders(bundle.orders);
      if (bundle.tickets) setTickets(bundle.tickets);
      if (bundle.refunds?.length) setRefunds(bundle.refunds);
      if (bundle.invoices?.length) setInvoices(bundle.invoices);
      if (bundle.support?.length) setSupport(bundle.support);

      // Đồng bộ thêm các yêu cầu hỗ trợ mới nhất qua đường truyền API
      try {
        const supRes = await fetch('/api/support');
        if (supRes.ok) {
          const supJson = await supRes.json();
          if (supJson.success && Array.isArray(supJson.data) && supJson.data.length > 0) {
            setSupport(supJson.data);
          }
        }
      } catch (e) {
        // Fallback
      }

      if (bundle.logs?.length) setAuditLogs(bundle.logs);
    } catch (err: any) {
      console.warn('Sync bundle info:', err);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseBundle();
  }, [loadDatabaseBundle]);

  // Real-time synchronization when customer books tickets or staff makes changes
  useEffect(() => {
    const handleDataUpdated = () => {
      loadDatabaseBundle();
    };

    window.addEventListener('storage', handleDataUpdated);
    window.addEventListener('cinemax_data_updated', handleDataUpdated);
    window.addEventListener('cinemax_ticket_purchased', handleDataUpdated);
    window.addEventListener('focus', handleDataUpdated);

    return () => {
      window.removeEventListener('storage', handleDataUpdated);
      window.removeEventListener('cinemax_data_updated', handleDataUpdated);
      window.removeEventListener('cinemax_ticket_purchased', handleDataUpdated);
      window.removeEventListener('focus', handleDataUpdated);
    };
  }, [loadDatabaseBundle]);

  // Two-way synchronization: Push current modifications to DB & pull newest records
  const handleSyncAll = async () => {
    setIsSyncing(true);
    showToast('Đang đồng bộ dữ liệu...');
    try {
      await Promise.all([
        AdminDataService.saveAllMovies(movies),
        AdminDataService.saveEntity('showtimes', showtimes),
        AdminDataService.saveEntity('products', products),
        AdminDataService.saveEntity('coupons', coupons),
        AdminDataService.saveEntity('settings', settings),
      ]);
      await loadDatabaseBundle();
      addNotification('Đồng bộ hệ thống', 'Đã lưu và đồng bộ 2 chiều dữ liệu rạp với máy chủ.', 'SUCCESS', 'SYSTEM');
      showToast('Đồng bộ hoàn tất: Đã lưu dữ liệu lên DB & làm mới thông tin!');
    } catch (err) {
      console.warn('Sync all error:', err);
      showToast('Đã hoàn tất đồng bộ dữ liệu.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Check admin session persistence on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const isExplicitlyLoggedOut = localStorage.getItem('cinemax_admin_logged_out') === 'true';
      const adminAuthFlag = localStorage.getItem('cinemax_admin_authenticated') === 'true';
      const sessionUserStr = localStorage.getItem('cinemax_session_user');
      const sessionUser = sessionUserStr ? JSON.parse(sessionUserStr) : null;
      const isAdminRole = sessionUser && (sessionUser.role_code === 'ADMIN' || sessionUser.role_code === 'STAFF');

      if (!isExplicitlyLoggedOut && (adminAuthFlag || isAdminRole)) {
        setIsAdminLoggedIn(true);
      } else {
        setIsAdminLoggedIn(false);
      }
    } catch {
      setIsAdminLoggedIn(false);
    }
  }, []);

  // Staff Role Protection: auto-switch to allowed tab if staff lands on admin-only tab
  useEffect(() => {
    if (currentUser?.role_code === 'STAFF') {
      const allowedTabs: AdminTab[] = ['POS_SHIFTS', 'CHECKIN', 'FOOD_CHECKIN', 'CONCESSION', 'ORDERS_FINANCE'];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('POS_SHIFTS');
      }
    }
  }, [currentUser, activeTab]);

  // Handle Admin Gateway Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAdminLoginError('');

    const res = await login(adminEmail, adminPassword);
    setIsLoggingIn(false);

    if (!res.success) {
      setAdminLoginError(res.error || 'Email hoặc mật khẩu không chính xác.');
    } else {
      localStorage.removeItem('cinemax_admin_logged_out');
      localStorage.setItem('cinemax_admin_authenticated', 'true');
      setIsAdminLoggedIn(true);
      addNotification('Đăng nhập quản trị', `Tài khoản ${adminEmail} đã đăng nhập vào hệ thống.`, 'INFO', 'AUDIT');
      showToast('Chào mừng bạn đến với Trung Tâm Quản Trị CINEMAX!');
    }
  };

  const handleAdminLogout = () => {
    try {
      localStorage.setItem('cinemax_admin_logged_out', 'true');
      localStorage.removeItem('cinemax_admin_authenticated');
    } catch {}
    setIsAdminLoggedIn(false);
    logout();
  };

  // Helper to immediately push changes to the customer-facing view
  const syncToCustomerView = async (updatedMovies: Movie[]) => {
    try {
      const customerFormat = updatedMovies.map((m) => ({
        id: m.id,
        title: m.title,
        original_title: m.original_title || m.title,
        slug: m.slug,
        synopsis: m.synopsis || '',
        duration_min: m.duration_minutes || 120,
        release_date: m.release_date || '',
        end_date: m.end_date || '',
        age_rating: m.age_rating || 'T13',
        country: m.country || 'Việt Nam',
        director: m.director || '',
        cast_list: m.cast_list || '',
        poster_url: m.poster_url || '',
        banner_url: m.banner_url || m.poster_url || '',
        trailer_url: m.trailer_url || '',
        imdb_score: m.imdb_score || 8.0,
        studio: m.studio || '',
        meta_title: m.meta_title || m.title,
        meta_description: m.meta_description || m.synopsis || '',
        formats: m.formats || ['2D'],
        status:
          m.status?.toUpperCase() === 'NOW_SHOWING' || m.status === 'now_showing'
            ? 'NOW_SHOWING'
            : 'COMING_SOON',
        is_deleted: false,
        genres: (m.genres && m.genres.length > 0)
          ? m.genres.map((g: any, idx: number) => ({ id: g.id || idx + 1, name: g.name, slug: g.slug }))
          : [{ id: 1, name: 'Hành Động', slug: 'hanh-dong' }]
      }));
      localStorage.setItem('cinemax_movies_v2', JSON.stringify(customerFormat));
      window.dispatchEvent(
        new CustomEvent('cinemax_db_updated', { detail: { movies: customerFormat } })
      );
      await AdminDataService.saveEntity('movies', updatedMovies);
    } catch (e) {
      console.error('Failed to sync to customer view', e);
    }
  };

  const syncCouponsToCustomer = async (updatedCoupons: Coupon[]) => {
    try {
      const promoFormat = updatedCoupons.map((c, idx) => ({
        id: typeof c.id === 'number' ? c.id : (idx + 1),
        code: c.code,
        description: c.apply_scope === 'COMBO_ONLY'
          ? `Giảm ${c.discount_type === 'PERCENT' ? `${c.discount_value}%` : `${(c.discount_value / 1000)}k`} cho combo bắp nước`
          : c.apply_scope === 'TICKET_ONLY'
          ? `Giảm ${c.discount_type === 'PERCENT' ? `${c.discount_value}%` : `${(c.discount_value / 1000)}k`} cho vé xem phim`
          : `Mã ưu đãi áp dụng toàn bộ đơn hàng — Giảm ${c.discount_type === 'PERCENT' ? `${c.discount_value}%` : `${(c.discount_value / 1000)}k`}`,
        discount_type: c.discount_type === 'PERCENT' ? 'PERCENT' : 'FIXED',
        discount_value: c.discount_value,
        max_discount: c.max_discount || undefined,
        min_order: c.min_order_amount || 0,
        usage_limit: c.usage_limit || undefined,
        per_user_limit: c.per_user_limit || 1,
        used_count: 0,
        valid_from: c.starts_at || '2026-01-01',
        valid_to: c.ends_at || '2026-12-31',
        is_active: c.active !== false
      }));
      localStorage.setItem('cinemax_promotions_v2', JSON.stringify(promoFormat));
      window.dispatchEvent(
        new CustomEvent('cinemax_db_updated', { detail: { promotions: promoFormat } })
      );
      await AdminDataService.saveEntity('coupons', updatedCoupons);
      await AdminDataService.saveEntity('promotions', promoFormat);
    } catch (e) {
      console.error('Failed to sync promotions to customer view', e);
    }
  };

  const syncProductsToCustomer = async (updatedProducts: Product[]) => {
    try {
      const foodFormat = updatedProducts.map((p, idx) => ({
        id: typeof p.id === 'number' ? p.id : (idx + 1),
        name: p.name,
        category: p.product_type === 'COMBO' ? 'COMBO' : p.product_type === 'BEVERAGE' ? 'DRINK' : 'POPCORN',
        description: p.inventory_tracking ? `Còn ${p.available_stock} phần khả dụng` : 'Sẵn sàng phục vụ',
        price: p.base_price,
        image_url: p.image_url || 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=600&q=80',
        is_active: p.active !== false
      }));
      localStorage.setItem('cinemax_foods_v2', JSON.stringify(foodFormat));
      window.dispatchEvent(
        new CustomEvent('cinemax_db_updated', { detail: { foods: foodFormat } })
      );
      await AdminDataService.saveEntity('products', updatedProducts);
      await AdminDataService.saveEntity('foods', foodFormat);
    } catch (e) {
      console.error('Failed to sync products to customer view', e);
    }
  };

  const syncShowtimesToCustomer = async (updatedShowtimes: Showtime[]) => {
    try {
      const showtimeFormat = updatedShowtimes.map((st) => ({
        id: st.id,
        movie_id: st.movie_id,
        room_id: st.auditorium_id || 1,
        start_time: st.starts_at,
        end_time: st.ends_at,
        language_type: st.language_version?.includes('Lồng tiếng') ? 'DUBBED' : 'SUBTITLED',
        status: st.status?.toUpperCase() === 'OPEN' || st.status === 'open' ? 'OPEN' : 'CLOSED',
        movie: st.movie as any,
        room: st.auditorium ? {
          id: 1,
          cinema_id: 1,
          name: st.auditorium.name,
          screen_type: (st.auditorium.screen_type as any) || '2D',
          total_rows: 10,
          total_cols: 14,
          status: 'ACTIVE'
        } : undefined
      }));
      localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(showtimeFormat));
      window.dispatchEvent(
        new CustomEvent('cinemax_db_updated', { detail: { showtimes: showtimeFormat } })
      );
      await AdminDataService.saveEntity('showtimes', updatedShowtimes);
    } catch (e) {
      console.error('Failed to sync showtimes to customer view', e);
    }
  };

  const syncSettingsToCustomer = async (updatedSettings: CinemaSetting[]) => {
    try {
      const storedSettingsStr = localStorage.getItem('cinemax_site_settings_v2');
      let siteSettings = storedSettingsStr ? JSON.parse(storedSettingsStr) : {
        hero_title: 'Dune: Hành Tinh Cát - Phần 2',
        hero_subtitle: 'T13 • 148 phút • Hành Động, Phiêu Lưu • Phụ đề Việt',
        hotline: '1900 1234',
        support_email: 'hotro@cinemax.vn',
        announcement_banner: 'Chào mừng bạn đến với Cinemax — Trải nghiệm điện ảnh đỉnh cao!',
        featured_movie_id: 1,
      };

      updatedSettings.forEach((s) => {
        if (s.setting_key === 'system_policy' && s.setting_value) {
          if (s.setting_value.hotline) siteSettings.hotline = s.setting_value.hotline;
          if (s.setting_value.support_email) siteSettings.support_email = s.setting_value.support_email;
          if (s.setting_value.announcement) siteSettings.announcement_banner = s.setting_value.announcement;
        }
      });

      localStorage.setItem('cinemax_site_settings_v2', JSON.stringify(siteSettings));
      window.dispatchEvent(
        new CustomEvent('cinemax_db_updated', { detail: { siteSettings } })
      );
      await AdminDataService.saveEntity('settings', updatedSettings);
    } catch (e) {
      console.error('Failed to sync settings to customer view', e);
    }
  };

  const syncAuditoriumsToCustomer = async (updatedAuds: Auditorium[], updatedSeats: Seat[]) => {
    try {
      localStorage.setItem('cinemax_auditoriums_v2', JSON.stringify(updatedAuds));
      localStorage.setItem('cinemax_seats_v2', JSON.stringify(updatedSeats));

      // Build maintenance map by auditorium id and room name so Staff & User Booking stay 100% in sync
      const maintMap: Record<string, string[]> = {};
      updatedSeats.forEach((s) => {
        if (s.status === 'BLOCKED') {
          const code = `${s.row_label}${s.seat_number}`;
          if (!maintMap[s.auditorium_id]) maintMap[s.auditorium_id] = [];
          maintMap[s.auditorium_id].push(code);

          // Also map to auditorium name (e.g. 'Phòng 1') and standard room keys
          const aud = updatedAuds.find((a) => a.id === s.auditorium_id);
          if (aud?.name) {
            if (!maintMap[aud.name]) maintMap[aud.name] = [];
            maintMap[aud.name].push(code);

            const matchNum = aud.name.match(/\d+/);
            if (matchNum) {
              const k = `room-q1-${matchNum[0]}`;
              if (!maintMap[k]) maintMap[k] = [];
              maintMap[k].push(code);
            }
          }
        }
      });
      localStorage.setItem('cinemax_maintenance_seats_v2', JSON.stringify(maintMap));

      window.dispatchEvent(
        new CustomEvent('cinemax_db_updated', {
          detail: { auditoriums: updatedAuds, seats: updatedSeats, maintenanceSeats: maintMap }
        })
      );
      window.dispatchEvent(
        new CustomEvent('cinemax_data_updated', {
          detail: { auditoriums: updatedAuds, seats: updatedSeats, maintenanceSeats: maintMap }
        })
      );
    } catch (e) {
      console.error('Failed to sync auditoriums to customer view', e);
    }
  };

  // CRUD Handlers connected to Service + Local Sync
  const handleSaveMovie = async (movieData: Partial<Movie>) => {
    let nextList: Movie[] = [];
    try {
      const saved = await AdminDataService.upsertMovie(movieData);
      setMovies((prev) => {
        const idx = prev.findIndex((m) => m.id === saved.id || (movieData.id && m.id === movieData.id));
        if (idx >= 0) {
          nextList = [...prev];
          nextList[idx] = { ...nextList[idx], ...saved, ...movieData };
        } else {
          nextList = [saved, ...prev];
        }
        syncToCustomerView(nextList);
        return nextList;
      });
      await AdminDataService.saveAllMovies(nextList);
      addNotification(
        movieData.id ? 'Cập nhật phim' : 'Thêm phim mới',
        `Đã lưu phim "${movieData.title || ''}" vào hệ thống danh mục.`,
        'SUCCESS',
        'MOVIES',
        'MOVIES'
      );
    } catch {
      // Local fallback sync if RLS denies direct anon write
      setMovies((prev) => {
        if (movieData.id) {
          nextList = prev.map((m) => (m.id === movieData.id ? ({ ...m, ...movieData } as Movie) : m));
        } else {
          const created: Movie = {
            id: crypto.randomUUID(),
            ...movieData,
            title: movieData.title || '',
            slug: movieData.slug || '',
            duration_minutes: movieData.duration_minutes || 120,
            age_rating: movieData.age_rating || 'T13',
            status: movieData.status || 'now_showing',
            created_at: new Date().toISOString()
          } as Movie;
          nextList = [created, ...prev];
        }
        syncToCustomerView(nextList);
        return nextList;
      });
      await AdminDataService.saveAllMovies(nextList);
      addNotification(
        movieData.id ? 'Cập nhật phim' : 'Thêm phim mới',
        `Đã lưu phim "${movieData.title || ''}" vào hệ thống danh mục.`,
        'SUCCESS',
        'MOVIES',
        'MOVIES'
      );
    }
  };

  const handleDeleteMovie = async (id: string) => {
    let nextList: Movie[] = [];
    setMovies((prev) => {
      nextList = prev.filter((m) => m.id !== id);
      return nextList;
    });
    setShowtimes((prev) => {
      const nextShowtimes = prev.filter((s) => s.movie_id !== id);
      syncShowtimesToCustomer(nextShowtimes);
      return nextShowtimes;
    });
    try {
      await AdminDataService.deleteMovie(id);
      await syncToCustomerView(nextList);
    } catch {
      // Local sync fallback
    }
    addNotification('Xóa phim khỏi danh mục', 'Đã xóa phim và gỡ toàn bộ suất chiếu liên quan.', 'DANGER', 'MOVIES', 'MOVIES');
    showToast('Đã xóa phim khỏi danh mục!');
  };

  const handleSaveShowtime = async (
    showtimeData: Partial<Showtime>,
    priceData?: Partial<ShowtimePrice>[]
  ) => {
    let nextList: Showtime[] = [];
    try {
      const saved = await AdminDataService.upsertShowtime(showtimeData, priceData);
      setShowtimes((prev) => {
        const idx = prev.findIndex((s) => s.id === saved.id || (showtimeData.id && s.id === showtimeData.id));
        if (idx >= 0) {
          nextList = [...prev];
          nextList[idx] = { ...nextList[idx], ...saved };
        } else {
          nextList = [saved, ...prev];
        }
        syncShowtimesToCustomer(nextList);
        return nextList;
      });
      addNotification('Xếp lịch suất chiếu', `Đã lên lịch suất chiếu định dạng ${showtimeData.format || '2D'} thành công.`, 'SUCCESS', 'MOVIES', 'SHOWTIMES');
    } catch {
      const movie = movies.find((m) => m.id === showtimeData.movie_id);
      const auditorium = auditoriums.find((a) => a.id === showtimeData.auditorium_id);
      setShowtimes((prev) => {
        const idx = prev.findIndex((s) => showtimeData.id && s.id === showtimeData.id);
        if (idx >= 0) {
          nextList = [...prev];
          nextList[idx] = { ...nextList[idx], ...showtimeData, movie, auditorium } as Showtime;
        } else {
          const created: Showtime = {
            id: crypto.randomUUID(),
            movie_id: showtimeData.movie_id || '',
            auditorium_id: showtimeData.auditorium_id || '',
            format: showtimeData.format || '2D',
            language_version: showtimeData.language_version || 'Phụ đề Tiếng Việt',
            starts_at: showtimeData.starts_at || new Date().toISOString(),
            ends_at: showtimeData.ends_at || new Date().toISOString(),
            status: showtimeData.status || 'open',
            movie,
            auditorium
          };
          nextList = [created, ...prev];
        }
        syncShowtimesToCustomer(nextList);
        return nextList;
      });
      addNotification('Xếp lịch suất chiếu', `Đã lên lịch suất chiếu định dạng ${showtimeData.format || '2D'} thành công.`, 'SUCCESS', 'MOVIES', 'SHOWTIMES');
    }
  };

  const handleBulkSaveShowtimes = async (
    items: { showtime: Partial<Showtime>; prices?: Partial<ShowtimePrice>[] }[]
  ) => {
    if (!items || items.length === 0) return;

    let savedShowtimes: Showtime[] = [];
    try {
      savedShowtimes = await AdminDataService.bulkUpsertShowtimes(items);
    } catch (err) {
      console.warn('Bulk upsert error, proceeding with local fallback:', err);
    }

    // Map each item with movie & auditorium details for UI
    const processedItems: Showtime[] = items.map((it, idx) => {
      const saved = savedShowtimes[idx];
      const movie = movies.find((m) => m.id === it.showtime.movie_id);
      const auditorium = auditoriums.find((a) => a.id === it.showtime.auditorium_id);
      return {
        ...saved,
        id: saved?.id || it.showtime.id || crypto.randomUUID(),
        movie_id: saved?.movie_id || it.showtime.movie_id || '',
        auditorium_id: saved?.auditorium_id || it.showtime.auditorium_id || '',
        format: saved?.format || it.showtime.format || '2D',
        language_version: saved?.language_version || it.showtime.language_version || 'Phụ đề Tiếng Việt',
        starts_at: saved?.starts_at || it.showtime.starts_at || new Date().toISOString(),
        ends_at: saved?.ends_at || it.showtime.ends_at || new Date().toISOString(),
        status: saved?.status || it.showtime.status || 'open',
        movie: saved?.movie || movie,
        auditorium: saved?.auditorium || auditorium
      } as Showtime;
    });

    let nextList: Showtime[] = [];
    setShowtimes((prev) => {
      const existingIds = new Set(processedItems.map((p) => p.id));
      const filteredPrev = prev.filter((p) => !existingIds.has(p.id));
      nextList = [...processedItems, ...filteredPrev];
      return nextList;
    });

    // Single sync to customer view & cinema-store.json (1 disk write instead of N)
    await syncShowtimesToCustomer(nextList);
    addNotification(
      'Tạo nhanh suất chiếu hàng loạt',
      `Đã lên lịch thành công ${items.length} suất chiếu theo Rule quy tắc rạp.`,
      'SUCCESS',
      'MOVIES',
      'SHOWTIMES'
    );
  };

  const handleDeleteShowtime = async (id: string) => {
    let nextList: Showtime[] = [];
    setShowtimes((prev) => {
      nextList = prev.filter((s) => s.id !== id);
      return nextList;
    });
    try {
      await AdminDataService.deleteShowtime(id);
      await syncShowtimesToCustomer(nextList);
    } catch {
      // Local fallback
    }
    addNotification('Xóa suất chiếu', 'Đã xóa suất chiếu khỏi lịch chiếu của rạp.', 'DANGER', 'MOVIES', 'SHOWTIMES');
    showToast('Đã xóa suất chiếu khỏi hệ thống!');
  };

  const handleBulkDeleteShowtimes = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    let nextList: Showtime[] = [];
    setShowtimes((prev) => {
      nextList = prev.filter((s) => !idSet.has(s.id));
      return nextList;
    });
    try {
      await Promise.allSettled(ids.map((id) => AdminDataService.deleteShowtime(id)));
      await AdminDataService.saveEntity('showtimes', nextList);
      await syncShowtimesToCustomer(nextList);
    } catch {
      // Local fallback
    }
    addNotification('Xóa suất chiếu hàng loạt', `Đã xóa ${ids.length} suất chiếu khỏi hệ thống.`, 'DANGER', 'MOVIES', 'SHOWTIMES');
    showToast(`Đã xóa thành công ${ids.length} suất chiếu!`);
  };

  const handleBulkUpdateShowtimes = async (updatedList: Showtime[]) => {
    if (!updatedList || updatedList.length === 0) return;
    const map = new Map(updatedList.map((s) => [s.id, s]));
    let nextList: Showtime[] = [];
    setShowtimes((prev) => {
      nextList = prev.map((s) => (map.has(s.id) ? map.get(s.id)! : s));
      return nextList;
    });
    try {
      await Promise.allSettled(updatedList.map((st) => AdminDataService.upsertShowtime(st)));
      await AdminDataService.saveEntity('showtimes', nextList);
      await syncShowtimesToCustomer(nextList);
    } catch {
      // Local fallback
    }
    addNotification('Cập nhật suất chiếu hàng loạt', `Đã cập nhật ${updatedList.length} suất chiếu.`, 'SUCCESS', 'MOVIES', 'SHOWTIMES');
    showToast(`Đã cập nhật thành công ${updatedList.length} suất chiếu!`);
  };

  const handleUpdateSeatStatus = async (
    seatId: string,
    status: SeatStatus,
    blockReason?: string
  ) => {
    try {
      await AdminDataService.updateSeatStatus(seatId, status, blockReason);
    } catch {
      // Local fallback
    }
    setSeats((prev) => {
      const nextSeats = prev.map((s) => (s.id === seatId ? { ...s, status, block_reason: blockReason || null } : s));
      AdminDataService.saveAllSeats(nextSeats);
      syncAuditoriumsToCustomer(auditoriums, nextSeats);
      return nextSeats;
    });
  };

  const handleBatchUpdateSeats = async (
    seatIds: string[],
    updates: Partial<Seat>
  ) => {
    let nextSeats: Seat[] = [];
    setSeats((prev) => {
      nextSeats = prev.map((s) => (seatIds.includes(s.id) ? { ...s, ...updates } : s));
      AdminDataService.saveAllSeats(nextSeats);
      syncAuditoriumsToCustomer(auditoriums, nextSeats);
      return nextSeats;
    });
  };

  const handleUpdateSeat = async (seatId: string, updates: Partial<Seat>) => {
    let nextSeats: Seat[] = [];
    setSeats((prev) => {
      nextSeats = prev.map((s) => (s.id === seatId ? { ...s, ...updates } : s));
      AdminDataService.saveAllSeats(nextSeats);
      syncAuditoriumsToCustomer(auditoriums, nextSeats);
      return nextSeats;
    });
  };

  const handleDeleteSeat = async (seatId: string) => {
    let nextSeats: Seat[] = [];
    setSeats((prev) => {
      nextSeats = prev.filter((s) => s.id !== seatId);
      AdminDataService.deleteSeat(seatId);
      AdminDataService.saveAllSeats(nextSeats);
      syncAuditoriumsToCustomer(auditoriums, nextSeats);
      return nextSeats;
    });
  };

  const handleAddSeat = async (seatData: Partial<Seat>) => {
    const newSeat: Seat = {
      id: crypto.randomUUID(),
      auditorium_id: seatData.auditorium_id || '',
      row_label: seatData.row_label || 'A',
      seat_number: seatData.seat_number || 1,
      grid_row: seatData.grid_row || 1,
      grid_col: seatData.grid_col || 1,
      seat_type: seatData.seat_type || 'STANDARD',
      status: seatData.status || 'ACTIVE',
      price: seatData.price || 75000,
      ...seatData
    };
    let nextSeats: Seat[] = [];
    setSeats((prev) => {
      nextSeats = [...prev, newSeat];
      AdminDataService.saveAllSeats(nextSeats);
      syncAuditoriumsToCustomer(auditoriums, nextSeats);
      return nextSeats;
    });
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    let nextList: Product[] = [];
    try {
      const saved = await AdminDataService.upsertProduct(productData);
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id || (productData.id && p.id === productData.id));
        if (idx >= 0) {
          nextList = [...prev];
          nextList[idx] = { ...nextList[idx], ...saved, ...productData };
        } else {
          nextList = [{ ...saved, ...productData } as Product, ...prev];
        }
        syncProductsToCustomer(nextList);
        return nextList;
      });
      addNotification(
        productData.id ? 'Cập nhật món F&B' : 'Thêm món F&B mới',
        `Đã lưu món "${productData.name || ''}" vào thực đơn bắp nước.`,
        'SUCCESS',
        'SALES',
        'CONCESSION'
      );
    } catch {
      setProducts((prev) => {
        if (productData.id) {
          nextList = prev.map((p) => (p.id === productData.id ? ({ ...p, ...productData } as Product) : p));
        } else {
          const created: Product = {
            id: crypto.randomUUID(),
            name: productData.name || '',
            product_type: productData.product_type || 'FOOD',
            base_price: productData.base_price || 45000,
            inventory_tracking: true,
            available_stock: productData.available_stock || 100,
            active: true,
            image_url: productData.image_url || ''
          };
          nextList = [created, ...prev];
        }
        syncProductsToCustomer(nextList);
        return nextList;
      });
      addNotification(
        productData.id ? 'Cập nhật món F&B' : 'Thêm món F&B mới',
        `Đã lưu món "${productData.name || ''}" vào thực đơn bắp nước.`,
        'SUCCESS',
        'SALES',
        'CONCESSION'
      );
    }
  };

  const handleDeleteProduct = async (id: string) => {
    let nextList: Product[] = [];
    setProducts((prev) => {
      nextList = prev.filter((p) => String(p.id) !== String(id));
      return nextList;
    });
    try {
      await AdminDataService.deleteEntity('products', id);
      await syncProductsToCustomer(nextList);
    } catch {
      // Local fallback
    }
    addNotification('Xóa món F&B', 'Đã xóa món khỏi thực đơn bắp nước.', 'DANGER', 'SALES', 'CONCESSION');
    showToast('Đã xóa món khỏi danh mục dịch vụ!');
  };

  const handleLogMovement = async (movementData: Partial<InventoryMovement>) => {
    try {
      await AdminDataService.logInventoryMovement(movementData);
    } catch {
      // Local fallback
    }
    // Update local product stock
    if (movementData.product_id && movementData.quantity) {
      setProducts((prev) => {
        const nextList = prev.map((p) =>
          p.id === movementData.product_id
            ? { ...p, available_stock: Math.max(0, p.available_stock + movementData.quantity!) }
            : p
        );
        syncProductsToCustomer(nextList);
        return nextList;
      });
    }
  };

  const handleOpenShift = async (staffId: string, posTerminal: string, openingCash: number) => {
    const newShift: Shift = {
      id: 'shift-' + Date.now(),
      staff_id: staffId,
      pos_terminal: posTerminal,
      shift_type: 'MORNING',
      opened_at: new Date().toISOString(),
      opening_cash: openingCash,
      expected_cash: openingCash,
      status: 'open'
    };

    try {
      const saved = await AdminDataService.openShift(staffId, posTerminal, openingCash);
      setShifts((prev) => [saved, ...prev]);
    } catch {
      setShifts((prev) => [newShift, ...prev]);
    }
    addNotification('Mở ca làm việc POS', `Đã mở ca tại ${posTerminal} với số dư đầu ca ${openingCash.toLocaleString('vi-VN')}đ.`, 'INFO', 'SALES', 'POS_SHIFTS');
  };

  const handleCloseShift = async (
    shiftId: string,
    countedCash: number,
    varianceReason?: string
  ) => {
    try {
      await AdminDataService.closeShift(shiftId, countedCash, varianceReason);
    } catch {
      // Local fallback
    }
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              counted_cash: countedCash,
              variance_reason: varianceReason || null,
              status: 'submitted',
              closed_at: new Date().toISOString()
            }
          : s
      )
    );
    addNotification('Nộp kết ca POS', `Đã chốt ca làm việc và gửi báo cáo với số tiền đếm ${countedCash.toLocaleString('vi-VN')}đ.`, 'INFO', 'SALES', 'POS_SHIFTS');
  };

  const handleApproveShift = async (shiftId: string, supervisorId: string) => {
    try {
      await AdminDataService.approveShift(shiftId, supervisorId);
    } catch {
      // Local fallback
    }
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              supervisor_id: supervisorId,
              approved_at: new Date().toISOString(),
              status: 'closed'
            }
          : s
      )
    );
    addNotification('Phê duyệt ca bán vé', 'Giám sát viên đã phê duyệt báo cáo bàn giao ca POS.', 'SUCCESS', 'AUDIT', 'POS_SHIFTS');
  };

  const handleCheckInTicket = async (
    qrToken: string,
    checkedInBy: string,
    agePassed: boolean
  ) => {
    try {
      await AdminDataService.checkInTicket(qrToken, checkedInBy, agePassed);
    } catch {
      // Local fallback
    }
    setTickets((prev) =>
      prev.map((t) =>
        t.qr_token_hash === qrToken
          ? {
              ...t,
              status: 'used',
              age_check_passed: agePassed,
              checked_in_at: new Date().toISOString(),
              checked_in_by: checkedInBy
            }
          : t
      )
    );
    addNotification('Soát vé QR thành công', `Đã quét vé và xác nhận khán giả vào phòng chiếu (${checkedInBy}).`, 'SUCCESS', 'AUDIT', 'CHECKIN');
  };

  const handleApproveRefund = async (refundId: string) => {
    try {
      await AdminDataService.approveRefund(refundId, currentUser?.full_name || 'Admin');
    } catch {
      // Local fallback
    }
    setRefunds((prev) =>
      prev.map((r) =>
        r.id === refundId
          ? { ...r, status: 'approved', resolved_at: new Date().toISOString() }
          : r
      )
    );
    addNotification('Duyệt hoàn tiền vé', `Yêu cầu hoàn vé #${refundId.slice(0, 8)} đã được phê duyệt.`, 'WARNING', 'SALES', 'ORDERS_FINANCE');
    showToast('Đã duyệt hoàn tiền thành công!');
  };

  const handleIssueInvoice = async (requestId: string, invoiceRef: string) => {
    try {
      await AdminDataService.issueInvoice(requestId, invoiceRef);
    } catch {
      // Local fallback
    }
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === requestId
          ? { ...i, status: 'issued', invoice_ref: invoiceRef, resolved_at: new Date().toISOString() }
          : i
      )
    );
  };

  const handleApproveSupport = async (requestId: string, adminNote = '', isResendTicket = false) => {
    try {
      const res = await SupportService.approveRequest(requestId, adminNote, isResendTicket);
      if (res.success) {
        setSupport((prev) =>
          prev.map((s) => (s.id === requestId ? ({ ...s, status: 'resolved', admin_note: adminNote } as any) : s))
        );
        addNotification(
          isResendTicket ? 'Đã duyệt & gửi lại vé' : 'Đã duyệt yêu cầu hỗ trợ',
          `Yêu cầu #${requestId} đã được phê duyệt thành công.`,
          'SUCCESS',
          'SALES',
          'ORDERS_FINANCE'
        );
        showToast(res.message);
      } else {
        showToast('Lỗi: ' + res.message);
      }
    } catch (err: any) {
      showToast('Lỗi duyệt: ' + err.message);
    }
  };

  const handleRejectSupport = async (requestId: string, adminNote = '') => {
    try {
      const res = await SupportService.rejectRequest(requestId, adminNote);
      if (res.success) {
        setSupport((prev) =>
          prev.map((s) => (s.id === requestId ? ({ ...s, status: 'closed', admin_note: adminNote } as any) : s))
        );
        addNotification(
          'Đã từ chối yêu cầu hỗ trợ',
          `Yêu cầu #${requestId} đã bị từ chối với lý do: ${adminNote || 'Không phù hợp'}.`,
          'WARNING',
          'SALES',
          'ORDERS_FINANCE'
        );
        showToast(res.message);
      } else {
        showToast('Lỗi: ' + res.message);
      }
    } catch (err: any) {
      showToast('Lỗi từ chối: ' + err.message);
    }
  };

  const handleSaveCoupon = async (couponData: Partial<Coupon>) => {
    let nextList: Coupon[] = [];
    try {
      const saved = await AdminDataService.upsertCoupon(couponData);
      setCoupons((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id || c.code === couponData.code);
        if (idx >= 0) {
          nextList = [...prev];
          nextList[idx] = { ...nextList[idx], ...saved, ...couponData };
        } else {
          nextList = [saved, ...prev];
        }
        syncCouponsToCustomer(nextList);
        return nextList;
      });
      addNotification('Lưu mã ưu đãi', `Đã cập nhật mã giảm giá "${couponData.code || ''}".`, 'SUCCESS', 'SALES', 'ORDERS_FINANCE');
    } catch {
      setCoupons((prev) => {
        const existingIdx = prev.findIndex((c) => c.code === couponData.code || (couponData.id && c.id === couponData.id));
        if (existingIdx >= 0) {
          nextList = [...prev];
          nextList[existingIdx] = { ...nextList[existingIdx], ...couponData } as Coupon;
        } else {
          const created: Coupon = {
            id: crypto.randomUUID(),
            code: couponData.code || '',
            discount_type: couponData.discount_type || 'FIXED',
            discount_value: couponData.discount_value || 0,
            min_order_amount: couponData.min_order_amount || 0,
            apply_scope: couponData.apply_scope || 'ALL',
            starts_at: couponData.starts_at || new Date().toISOString(),
            ends_at: couponData.ends_at || new Date().toISOString(),
            usage_limit: couponData.usage_limit || null,
            per_user_limit: 1,
            active: true
          };
          nextList = [created, ...prev];
        }
        syncCouponsToCustomer(nextList);
        return nextList;
      });
      addNotification('Lưu mã ưu đãi', `Đã cập nhật mã giảm giá "${couponData.code || ''}".`, 'SUCCESS', 'SALES', 'ORDERS_FINANCE');
    }
  };

  const handleDeleteCoupon = async (idOrCode: string) => {
    let nextList: Coupon[] = [];
    setCoupons((prev) => {
      nextList = prev.filter((c) => String(c.id) !== String(idOrCode) && c.code !== idOrCode);
      return nextList;
    });
    try {
      await AdminDataService.deleteEntity('coupons', idOrCode);
      await syncCouponsToCustomer(nextList);
    } catch {
      // Local fallback
    }
    addNotification('Xóa mã ưu đãi', `Đã xóa mã giảm giá "${idOrCode}".`, 'DANGER', 'SALES', 'ORDERS_FINANCE');
    showToast('Đã xóa mã ưu đãi thành công!');
  };

  const handleDeleteAuditorium = async (id: string) => {
    let nextAuds: Auditorium[] = [];
    let nextSeats: Seat[] = [];
    setAuditoriums((prev) => {
      nextAuds = prev.filter((a) => a.id !== id);
      return nextAuds;
    });
    setSeats((prev) => {
      nextSeats = prev.filter((s) => s.auditorium_id !== id);
      return nextSeats;
    });
    try {
      await AdminDataService.deleteAuditorium(id);
      await syncAuditoriumsToCustomer(nextAuds, nextSeats);
    } catch (e) {
      console.error('Delete auditorium error:', e);
    }
    addNotification('Xóa phòng chiếu', 'Đã xóa phòng chiếu và toàn bộ sơ đồ ghế.', 'DANGER', 'MOVIES', 'AUDITORIUMS');
    showToast('Đã xóa phòng chiếu thành công!');
  };

  const handleSaveAuditorium = async (auditoriumData: Partial<Auditorium>) => {
    try {
      let nextAuds: Auditorium[] = [];
      let savedAud: Auditorium;
      let nextSeats: Seat[] = [];

      if (auditoriumData.id) {
        savedAud = await AdminDataService.upsertAuditorium(auditoriumData);
        setAuditoriums((prev) => {
          nextAuds = prev.map((a) => (a.id === auditoriumData.id ? ({ ...a, ...savedAud, ...auditoriumData } as Auditorium) : a));
          return nextAuds;
        });
        setSeats((prev) => {
          nextSeats = [...prev];
          return prev;
        });
        await syncAuditoriumsToCustomer(nextAuds, nextSeats);
      } else {
        const created = await AdminDataService.upsertAuditorium(auditoriumData);
        savedAud = created;

        setAuditoriums((prev) => {
          nextAuds = [...prev, created];
          return nextAuds;
        });

        // Auto-generate seats with requested total_seats
        const targetSeats = Number(auditoriumData.total_seats) || 80;
        const newSeats = generateDefaultSeatsForAud(created.id, targetSeats);
        setSeats((prev) => {
          nextSeats = [...prev, ...newSeats];
          return nextSeats;
        });
        await AdminDataService.saveAllSeats(nextSeats);
        await syncAuditoriumsToCustomer(nextAuds, nextSeats);
      }
      addNotification('Lưu phòng chiếu', `Đã lưu cấu hình phòng chiếu "${auditoriumData.name || ''}" và sơ đồ ghế.`, 'SUCCESS', 'MOVIES', 'AUDITORIUMS');
      showToast('Đã lưu thông tin phòng chiếu thành công!');
      return savedAud;
    } catch (e) {
      console.error('Failed to save auditorium', e);
      showToast('Có lỗi xảy ra khi lưu phòng chiếu!');
      return null;
    }
  };

  const handlePosSaleComplete = async (saleData: any) => {
    try {
      const orderId = crypto.randomUUID();
      const orderCode = 'POS-' + Math.floor(100000 + Math.random() * 900000);
      const movieTitle = saleData.showtime?.movie?.title || 'Phim Chiếu Rạp CINEMAX';
      const auditoriumName = saleData.showtime?.auditorium?.name || 'Phòng 1';
      const format = saleData.showtime?.format || '2D';
      const ageRating = saleData.showtime?.movie?.age_rating || 'T13';
      const showtimeStartsAt = saleData.showtime?.starts_at || new Date().toISOString();
      const showTimeStr =
        new Date(showtimeStartsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        new Date(showtimeStartsAt).toLocaleDateString('vi-VN');

      // 1. Create order items (ticket items and product items)
      const ticketOrderItems: OrderItem[] = (saleData.seats || []).map((s: any) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        item_type: 'ticket',
        item_id: s.label,
        quantity: 1,
        unit_price: s.price,
        line_total: s.price,
        item_snapshot: {
          movieTitle,
          seatCode: s.label,
          seatType: s.type,
          showTime: showTimeStr,
          format,
          audienceType: saleData.audienceType || 'ADULT',
        }
      }));

      const productOrderItems: OrderItem[] = (saleData.foods || []).map((f: any) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        item_type: 'product',
        item_id: f.productUuid || f.name,
        quantity: f.qty,
        unit_price: Math.round(f.price / (f.qty || 1)),
        line_total: f.price,
        item_snapshot: {
          productName: f.name,
          flavor: f.flavor,
          drinkSize: f.drinkSize,
          fulfilled: false
        }
      }));

      const newOrder: Order = {
        id: orderId,
        order_code: orderCode,
        user_id: null,
        channel: 'pos',
        status: 'paid',
        contact_name: saleData.customerPhone ? `Khách POS (${saleData.customerPhone})` : 'Khách Vãng Lai (POS)',
        contact_email: 'pos@cinemax.vn',
        contact_phone: saleData.customerPhone || '0900000000',
        subtotal: saleData.total,
        discount_amount: 0,
        loyalty_points_used: 0,
        loyalty_discount_amount: 0,
        total_amount: saleData.total,
        created_at: new Date().toISOString(),
        items: [...ticketOrderItems, ...productOrderItems]
      };

      const newTickets: Ticket[] = (saleData.seats || []).map((seat: any) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        showtime_id: saleData.showtime?.id || '',
        seat_id: crypto.randomUUID(),
        seat_label: seat.label,
        price: seat.price,
        qr_token_hash: orderCode,
        status: 'issued',
        age_check_passed: true,
        created_at: new Date().toISOString(),
        showtime: saleData.showtime
      }));

      setOrders((prev) => {
        const nextOrders = [newOrder, ...prev];
        AdminDataService.saveEntity('orders', nextOrders);
        return nextOrders;
      });

      if (newTickets.length > 0) {
        setTickets((prev) => {
          const nextTickets = [...newTickets, ...prev];
          AdminDataService.saveEntity('tickets', nextTickets);
          return nextTickets;
        });
      }

      // 2. Update active shift expected cash if CASH
      if (saleData.paymentMethod === 'CASH') {
        setShifts((prev) =>
          prev.map((s) =>
            s.status === 'open'
              ? { ...s, expected_cash: s.expected_cash + saleData.total }
              : s
          )
        );
      }

      // 3. Update cinemax_user_tickets in localStorage for immediate sync across views
      try {
        const rawUserTickets = localStorage.getItem('cinemax_user_tickets');
        const userTicketsList = rawUserTickets ? JSON.parse(rawUserTickets) : [];
        const foodSummary =
          (saleData.foods || []).length > 0
            ? (saleData.foods || [])
                .map((f: any) => `${f.qty}x ${f.name} (${f.flavor || 'Vị Phô Mai'})`)
                .join(', ')
            : 'Không kèm bắp nước';

        const newUt = {
          bookingCode: orderCode,
          id: orderCode,
          movieTitle: movieTitle,
          ageRating: ageRating,
          cinemaName: 'Cinemax Xuân Thủy',
          roomName: auditoriumName,
          showtime: showTimeStr,
          showtimeId: saleData.showtime?.id || 1,
          seats: (saleData.seats || []).map((s: any) => s.label).join(', '),
          checked_in_seats: [],
          foodSummary,
          foodFulfilled: false,
          paymentMethod: saleData.paymentMethod || 'CASH',
          channel: 'POS',
          totalAmount: saleData.total,
          customerName: saleData.customerPhone ? `Khách POS (${saleData.customerPhone})` : 'Khách Vãng Lai (POS)',
          customerPhone: saleData.customerPhone || '0900000000',
          customerEmail: 'pos@cinemax.vn',
          createdAt: new Date().toLocaleString('vi-VN'),
          status: 'ĐÃ THANH TOÁN'
        };

        const updatedUtList = [newUt, ...userTicketsList];
        localStorage.setItem('cinemax_user_tickets', JSON.stringify(updatedUtList));

        // Also add to cinemax_my_tickets_v2
        const rawV2 = localStorage.getItem('cinemax_my_tickets_v2');
        const v2List = rawV2 ? JSON.parse(rawV2) : [];
        const newV2Order = {
          id: orderCode,
          movie_title: movieTitle,
          age_rating: ageRating,
          cinema_name: 'Cinemax Xuân Thủy',
          room_name: auditoriumName,
          screen_type: format,
          start_time: showtimeStartsAt,
          seats: (saleData.seats || []).map((s: any) => s.label),
          checked_in_seats: [],
          audience_type: saleData.audienceType || 'ADULT',
          foods: (saleData.foods || []).map((f: any) => ({
            name: f.name,
            qty: f.qty,
            price: f.price,
            flavor: f.flavor || 'Vị Phô Mai',
            drinkSize: f.drinkSize || 'Coca (M)',
            fulfilled: false
          })),
          food_fulfilled: false,
          promo_code: null,
          discount_amount: 0,
          total_amount: saleData.total,
          payment_method: saleData.paymentMethod || 'CASH',
          customer_name: saleData.customerPhone ? `Khách POS (${saleData.customerPhone})` : 'Khách Vãng Lai (POS)',
          customer_phone: saleData.customerPhone || '0900000000',
          customer_email: 'pos@cinemax.vn',
          status: 'PAID',
          created_at: new Date().toLocaleString('vi-VN'),
          channel: 'POS',
          showtime_id: 1
        };
        localStorage.setItem('cinemax_my_tickets_v2', JSON.stringify([newV2Order, ...v2List]));
      } catch (err) {
        console.warn('Failed to save POS tickets to localStorage', err);
      }

      // 4. Sync to Supabase in background
      try {
        await syncOrderToSupabase({
          orderCode,
          channel: 'pos',
          contactName: saleData.customerPhone ? `Khách POS (${saleData.customerPhone})` : 'Khách Vãng Lai (POS)',
          contactEmail: 'pos@cinemax.vn',
          contactPhone: saleData.customerPhone || '0900000000',
          subtotal: saleData.total,
          discountAmount: 0,
          totalAmount: saleData.total,
          paymentProvider: saleData.paymentMethod || 'CASH',
          showtimeUuid: saleData.showtime?.id,
          auditoriumUuid: saleData.showtime?.auditorium_id,
          seatCodes: (saleData.seats || []).map((s: any) => s.label),
          audienceType: saleData.audienceType || 'ADULT',
          unitTicketPrice:
            (saleData.seats || []).length > 0 ? Math.round(saleData.total / saleData.seats.length) : 0,
          movieSnapshot: {
            movieTitle,
            cinemaName: 'Cinemax Xuân Thủy',
            roomName: auditoriumName,
            showTime: showTimeStr,
            showDate: showtimeStartsAt ? showtimeStartsAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
            format,
            ageRating
          },
          foodItems: (saleData.foods || []).map((f: any) => ({
            name: f.name,
            quantity: f.qty,
            unitPrice: Math.round(f.price / (f.qty || 1))
          }))
        });
      } catch (err) {
        console.warn('Could not sync POS order to Supabase:', err);
      }

      addNotification(
        'Giao dịch vé POS',
        `Đã xuất ${newTickets.length} vé cho đơn #${orderCode} (${saleData.total.toLocaleString('vi-VN')}đ).`,
        'SUCCESS',
        'SALES',
        'POS_SHIFTS'
      );
    } catch (e) {
      console.error('Failed to record POS sale', e);
    }
  };

  const handleUpdateSetting = async (key: string, value: Record<string, any>) => {
    try {
      await AdminDataService.updateSetting(key, value);
    } catch {
      // Local fallback
    }
    setSettings((prev) => {
      const idx = prev.findIndex((s) => s.setting_key === key);
      const item: CinemaSetting = {
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      };
      let next: CinemaSetting[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = item;
      } else {
        next = [...prev, item];
      }
      syncSettingsToCustomer(next);
      return next;
    });
    addNotification('Cập nhật cấu hình rạp', `Cấu hình chính sách "${key}" đã được cập nhật thành công.`, 'INFO', 'SYSTEM', 'SETTINGS');
  };

  // Operator and Authentication check
  const effectiveOperatorName = currentUser?.full_name || 'Quản trị viên Cinemax';
  const isAuthenticated = isAdminLoggedIn || (currentUser && (currentUser.role_code === 'ADMIN' || currentUser.role_code === 'STAFF'));

  // =========================================================================
  // VIEW 0: RELOAD / HYDRATING LOADING SPINNER (Only show reload spinner)
  // =========================================================================
  if (!isMounted || isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-9 h-9 text-[#E63845] animate-spin" />
          <span className="text-xs font-semibold text-[#8E9AAF] tracking-wider uppercase">
            Đang tải hệ thống...
          </span>
        </div>
      </div>
    );
  }

  // VIEW 0.5: ACCESS DENIED (403) FOR NORMAL CUSTOMER / USER
  const isCustomer = currentUser && (currentUser.role_code === 'CUSTOMER' || currentUser.role_code === 'user');
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex flex-col justify-center items-center p-4 text-white">
        <div className="max-w-md w-full bg-[#121622] border border-[#EF4444]/40 rounded-3xl p-8 space-y-6 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] mx-auto flex items-center justify-center shadow-lg shadow-[#EF4444]/20">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white">TRUY CẬP BỊ TỪ CHỐI (403)</h1>
            <p className="text-xs text-[#8E9AAF] leading-relaxed">
              Tài khoản hiện tại của bạn là <strong className="text-white">Khách hàng / Thành viên ({currentUser.full_name})</strong>. Khu vực này chỉ dành riêng cho Quản Trị Viên (Admin) và Nhân Viên Vận Hành (Staff) rạp CINEMAX.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/"
              className="w-full py-3 rounded-xl bg-[#E63845] hover:bg-[#D42B38] font-bold text-xs text-center transition-colors"
            >
              Quay về Trang Chủ Khách Hàng
            </Link>
            <button
              onClick={() => {
                logout();
                setIsAdminLoggedIn(false);
              }}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs text-[#8E9AAF] hover:text-white transition-colors cursor-pointer"
            >
              Đăng xuất & Đổi tài khoản Admin / Staff
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: UN-AUTHENTICATED ADMIN GATEWAY (Only when not logged in as Admin/Staff)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex flex-col justify-center items-center p-4">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-50 bg-[#161C2A] border border-[#22C55E] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

        <div className="max-w-md w-full bg-[#121622] border border-[#253045] rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#E63845] text-white mx-auto flex items-center justify-center font-black text-2xl shadow-xl shadow-[#E63845]/30">
              C
            </div>
            <h1 className="text-xl font-black text-white">CINEMAX CONTROL CENTER</h1>
            <p className="text-xs text-[#8E9AAF]">
              Hệ thống quản trị rạp chiếu phim chuẩn hóa • Single Theater TMS/POS
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4 text-xs">
            {adminLoginError && (
              <div className="p-3 rounded-xl bg-[#3B191C] border border-[#EF4444] text-[#EF4444] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adminLoginError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[#8E9AAF] font-semibold">Tài khoản Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#E63845]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[#8E9AAF] font-semibold">Mật khẩu xác thực</label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 pr-10 text-white focus:outline-none focus:border-[#E63845] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E9AAF] hover:text-white transition-colors cursor-pointer p-1"
                  title={showAdminPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-label={showAdminPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showAdminPassword ? (
                    <EyeOff className="w-4 h-4 text-[#FABF2E]" />
                  ) : (
                    <Eye className="w-4 h-4 hover:text-[#FABF2E]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white font-black text-xs transition-all shadow-lg shadow-[#E63845]/30 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Đang Đăng Nhập...' : 'Đăng Nhập Quản Trị Rạp'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#1F2739] text-center">
            <Link href="/" className="text-xs text-[#8E9AAF] hover:text-white flex items-center justify-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>Quay lại trang chủ bán vé khách hàng</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Shift Status
  const currentActiveShift = shifts.find((s) => s.status === 'open');

  // =========================================================================
  // VIEW 2: AUTHENTICATED MASTER CINEMA ADMIN
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0A0D14] flex text-white font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161C2A] border border-[#22C55E] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Modular Sidebar with zero AI icons */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        operatorName={effectiveOperatorName}
        activeShiftStatus={currentActiveShift ? 'open' : 'closed'}
        posTerminal={currentActiveShift?.pos_terminal || 'POS-01'}
        onLogout={handleAdminLogout}
        userRole={currentUser?.role_code || (isAdminLoggedIn ? 'ADMIN' : 'STAFF')}
        staffPermissions={currentUser?.staff_permissions || []}
        counts={{
          movies: movies.length,
          showtimes: showtimes.length,
          auditoriums: auditoriums.length,
          products: products.length,
          orders: orders.length,
          refunds: refunds.filter((r) => r.status === 'pending').length + support.filter((s: any) => s.status === 'pending').length,
          coupons: coupons.length
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b border-[#171D29] bg-[#0A0D14]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Menu className="w-5 h-5 text-[#8E9AAF]" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              {activeTab === 'DASHBOARD'
                ? 'Thống kê'
                : activeTab === 'MOVIES'
                ? 'Quản lý phim'
                : activeTab === 'AUDITORIUMS'
                ? 'Quản lý rạp'
                : activeTab === 'SHOWTIMES'
                ? 'Quản lý suất chiếu'
                : activeTab === 'CONCESSION'
                ? 'Food'
                : activeTab === 'COUPONS'
                ? 'Mã Giảm Giá'
                : activeTab === 'ORDERS_FINANCE'
                ? 'Quản lý Vé'
                : activeTab === 'POS_SHIFTS'
                ? 'Quầy Vé POS'
                : activeTab === 'FOOD_CHECKIN'
                ? 'QR trả món'
                : activeTab === 'CHECKIN'
                ? 'Soát Vé QR'
                : 'Cài đặt hệ thống'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSyncAll}
              title="Đồng bộ 2 chiều (Lưu thay đổi lên DB & Làm mới dữ liệu)"
              className="p-2 rounded-xl text-[#8E9AAF] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#E50914]' : ''}`} />
            </button>

            {/* Notification Bell with History Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                  isNotificationOpen
                    ? 'bg-white/10 text-white'
                    : 'text-[#8E9AAF] hover:text-white hover:bg-white/5'
                }`}
                title="Lịch sử thông báo & Hoạt động rạp"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#E50914] text-white text-[9px] font-black flex items-center justify-center absolute -top-1 -right-1 ring-2 ring-[#0A0D14] animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {isNotificationOpen && (
                <div className="absolute right-0 top-12 z-50 w-[360px] sm:w-[420px] bg-[#0E131F]/98 backdrop-blur-2xl border border-[#1F2739] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Header */}
                  <div className="p-4 border-b border-[#1A2233] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#E50914]/15 text-[#E50914] flex items-center justify-center">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-2">
                          <span>Lịch Sử Thông Báo</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#E50914] text-white">
                              {unreadCount} mới
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#6E7B91]">Hoạt động hệ thống & phân quyền</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Đánh dấu tất cả là đã đọc"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={handleClearNotifications}
                          className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-[#EF4444] hover:bg-white/5 transition-colors cursor-pointer"
                          title="Xóa toàn bộ lịch sử thông báo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setIsNotificationOpen(false)}
                        className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="px-4 py-2 bg-[#121725] border-b border-[#1A2233] flex items-center gap-1.5 overflow-x-auto text-[10px]">
                    {[
                      { id: 'ALL', label: 'Tất Cả', count: notifications.length },
                      { id: 'SYSTEM', label: 'Hệ Thống', count: notifications.filter((n) => n.category === 'SYSTEM').length },
                      { id: 'MOVIES', label: 'Phim & Lịch', count: notifications.filter((n) => n.category === 'MOVIES').length },
                      { id: 'SALES', label: 'Bán Vé & Ca', count: notifications.filter((n) => n.category === 'SALES').length },
                      { id: 'AUDIT', label: 'Kiểm Toán', count: notifications.filter((n) => n.category === 'AUDIT').length }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setNotificationFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                          notificationFilter === tab.id
                            ? 'bg-[#E50914] text-white shadow-sm'
                            : 'bg-[#181F30] text-[#8E9AAF] hover:text-white'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-black ${
                            notificationFilter === tab.id ? 'bg-black/30 text-white' : 'bg-black/20 text-[#6E7B91]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#161D2B] custom-scrollbar">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-12 text-center text-[#6E7B91] space-y-2">
                        <Bell className="w-8 h-8 mx-auto text-[#2D3A52]" />
                        <p className="text-xs">Không có thông báo nào trong mục này</p>
                      </div>
                    ) : (
                      filteredNotifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                            item.is_read ? 'hover:bg-[#131A27]' : 'bg-[#141C2B]/80 hover:bg-[#182236]'
                          }`}
                        >
                          {/* Type Icon Badge */}
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                              item.type === 'SUCCESS'
                                ? 'bg-[#22C55E]/15 text-[#22C55E]'
                                : item.type === 'DANGER'
                                ? 'bg-[#EF4444]/15 text-[#EF4444]'
                                : item.type === 'WARNING'
                                ? 'bg-[#FABF2E]/15 text-[#FABF2E]'
                                : 'bg-[#06B6D4]/15 text-[#06B6D4]'
                            }`}
                          >
                            {item.type === 'SUCCESS' && <CheckCircle2 className="w-4 h-4" />}
                            {item.type === 'DANGER' && <Trash2 className="w-4 h-4" />}
                            {item.type === 'WARNING' && <AlertTriangle className="w-4 h-4" />}
                            {item.type === 'INFO' && <Info className="w-4 h-4" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-white truncate group-hover:text-[#E50914] transition-colors">
                                {item.title}
                              </div>
                              <span className="text-[10px] text-[#6E7B91] whitespace-nowrap font-mono shrink-0">
                                {formatTimeAgo(item.created_at)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8E9AAF] line-clamp-2 mt-0.5 leading-relaxed">
                              {item.message}
                            </p>
                            {item.link_tab && (
                              <div className="text-[10px] text-[#E50914] font-semibold flex items-center gap-1 mt-1">
                                <span>Chuyển tới tab</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>

                          {/* Unread indicator dot */}
                          {!item.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[#E50914] shrink-0 mt-1.5" />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-3 bg-[#0A0D14] border-t border-[#1A2233] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[#22C55E] text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                      <span>Giám sát thời gian thực</span>
                    </div>

                    <button
                      onClick={() => {
                        setActiveTab('AUDIT_LOGS');
                        setIsNotificationOpen(false);
                      }}
                      className="text-[#8E9AAF] hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                    >
                      <span>Xem sổ kiểm toán (Audit)</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/staff"
              target="_blank"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1C2333] border border-[#222B3D] hover:border-[#22C55E]/50 text-xs font-bold text-white transition-all group cursor-pointer"
              title="Mở cổng làm việc của Nhân viên (Quầy POS, Soát Vé, Bắp Nước)"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Cổng Nhân Viên (Staff)</span>
              <ExternalLink className="w-3 h-3 text-[#6E7B91] group-hover:text-white" />
            </Link>

            <div className="flex items-center gap-2.5 pl-2 border-l border-[#1F2739]">
              <div className="w-8 h-8 rounded-full bg-[#1A2233] border border-[#2B374D] flex items-center justify-center text-xs font-bold text-white">
                <User className="w-4 h-4 text-[#8E9AAF]" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">{effectiveOperatorName}</div>
                <div className="text-[10px] text-[#6E7B91] leading-tight">Quản trị viên</div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab View Container (Compact for single screen) */}
        <div className="p-3 sm:p-4 max-w-7xl w-full mx-auto flex-1 flex flex-col">
          <>
              {activeTab === 'DASHBOARD' && (
                <DashboardView
                  movies={movies}
                  showtimes={showtimes}
                  orders={orders}
                  products={products}
                  shifts={shifts}
                  tickets={tickets}
                  onNavigate={setActiveTab}
                  onRefresh={handleSyncAll}
                />
              )}

              {activeTab === 'MOVIES' && (
                <MoviesView
                  movies={movies}
                  genres={genres}
                  onSaveMovie={handleSaveMovie}
                  onDeleteMovie={handleDeleteMovie}
                  showToast={showToast}
                />
              )}

              {activeTab === 'SHOWTIMES' && (
                <ShowtimesView
                  showtimes={showtimes}
                  movies={movies}
                  auditoriums={auditoriums}
                  prices={prices}
                  onSaveShowtime={handleSaveShowtime}
                  onBulkSaveShowtimes={handleBulkSaveShowtimes}
                  onDeleteShowtime={handleDeleteShowtime}
                  onBulkDeleteShowtimes={handleBulkDeleteShowtimes}
                  onBulkUpdateShowtimes={handleBulkUpdateShowtimes}
                  showToast={showToast}
                />
              )}

              {activeTab === 'AUDITORIUMS' && (
                <AuditoriumsView
                  auditoriums={auditoriums}
                  seats={seats}
                  onUpdateSeatStatus={handleUpdateSeatStatus}
                  onBatchUpdateSeats={handleBatchUpdateSeats}
                  onUpdateSeat={handleUpdateSeat}
                  onDeleteSeat={handleDeleteSeat}
                  onAddSeat={handleAddSeat}
                  onSaveAuditorium={handleSaveAuditorium}
                  onDeleteAuditorium={handleDeleteAuditorium}
                  showToast={showToast}
                />
              )}

              {activeTab === 'CONCESSION' && (
                <ConcessionView
                  products={products}
                  modifiers={modifiers}
                  components={components}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onLogMovement={handleLogMovement}
                  showToast={showToast}
                />
              )}

              {activeTab === 'POS_SHIFTS' && (
                <PosShiftsView
                  shifts={shifts}
                  showtimes={showtimes}
                  seats={seats}
                  products={products}
                  currentOperator={{ id: currentUser?.id || 'usr-admin-001', name: effectiveOperatorName }}
                  onOpenShift={handleOpenShift}
                  onCloseShift={handleCloseShift}
                  onApproveShift={handleApproveShift}
                  onSaleComplete={handlePosSaleComplete}
                  showToast={showToast}
                />
              )}

              {activeTab === 'FOOD_CHECKIN' && (
                <FoodCheckinView
                  products={products}
                  orders={orders}
                  operatorName={effectiveOperatorName}
                  showToast={showToast}
                />
              )}

              {activeTab === 'CHECKIN' && (
                <CheckinView
                  tickets={tickets}
                  operatorName={effectiveOperatorName}
                  onCheckInTicket={handleCheckInTicket}
                  showToast={showToast}
                />
              )}

              {activeTab === 'COUPONS' && (
                <CouponsView
                  coupons={coupons}
                  onSaveCoupon={handleSaveCoupon}
                  onDeleteCoupon={handleDeleteCoupon}
                  showToast={showToast}
                />
              )}

              {activeTab === 'ORDERS_FINANCE' && (
                <OrdersFinanceView
                  orders={orders}
                  tickets={tickets}
                  showtimes={showtimes}
                  movies={movies}
                  refunds={refunds}
                  invoices={invoices}
                  coupons={coupons}
                  operatorName={effectiveOperatorName}
                  onCheckInTicket={handleCheckInTicket}
                  supportRequests={support}
                  onApproveRefund={handleApproveRefund}
                  onIssueInvoice={handleIssueInvoice}
                  onSaveCoupon={handleSaveCoupon}
                  onDeleteCoupon={handleDeleteCoupon}
                  onApproveSupport={handleApproveSupport}
                  onRejectSupport={handleRejectSupport}
                  showToast={showToast}
                />
              )}

              {(activeTab === 'SETTINGS' || activeTab === 'AUDIT_LOGS') && (
                <SystemSettingsView
                  settings={settings}
                  auditLogs={auditLogs}
                  onUpdateSetting={handleUpdateSetting}
                  showToast={showToast}
                  initialSubTab={activeTab === 'AUDIT_LOGS' ? 'AUDIT' : 'SETTINGS'}
                />
              )}
            </>
        </div>
      </main>
    </div>
  );
}
