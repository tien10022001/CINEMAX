'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X, Ticket, LogOut, Menu, ShieldCheck, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { MOCK_MOVIES, MOCK_CINEMAS } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  id: string;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Trang chủ', href: '/' },
  { id: 'movies', label: 'Phim', href: '/?tab=movies' },
  { id: 'cinemas', label: 'Rạp chiếu', href: '/?tab=cinemas' },
  { id: 'promotions', label: 'Khuyến mãi', href: '/?tab=promotions' },
  { id: 'lookup', label: 'Tra cứu vé', href: '/lookup' },
  { id: 'support', label: 'Hỗ trợ', href: '/support' },
];

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function Header({ activeTab: controlledActiveTab, onTabChange }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentUser,
    login,
    register,
    logout,
    isAuthModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
  } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internalActiveTab, setInternalActiveTab] = useState<string>('home');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Form input states
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTab(authModalTab);
    setAuthError('');

    // Tự động điền thông tin khách hàng nếu chuyển tiếp từ màn hình đặt vé
    if (isAuthModalOpen && authModalTab === 'REGISTER') {
      try {
        const prefillStr = typeof window !== 'undefined' ? sessionStorage.getItem('cinemax_prefill_register') : null;
        if (prefillStr) {
          const prefill = JSON.parse(prefillStr);
          if (prefill.name) setNameInput(prefill.name);
          if (prefill.email) setEmailInput(prefill.email);
          if (prefill.phone) setPhoneInput(prefill.phone);
        }
      } catch {}
    }
  }, [authModalTab, isAuthModalOpen]);

  // Synchronize active tab based on window location tab query or hash
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncActiveTab = () => {
      if (pathname === '/lookup') {
        setActiveTab('lookup');
        return;
      }
      if (pathname === '/support') {
        setActiveTab('support');
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['home', 'movies', 'cinemas', 'promotions', 'lookup', 'support'].includes(tabParam)) {
        setActiveTab(tabParam);
      } else {
        const hash = window.location.hash;
        if (hash === '#movies') setActiveTab('movies');
        else if (hash === '#cinemas') setActiveTab('cinemas');
        else if (hash === '#promotions') setActiveTab('promotions');
        else if (pathname === '/' && !tabParam && !hash) {
          setActiveTab('home');
        }
      }
    };

    syncActiveTab();
    window.addEventListener('popstate', syncActiveTab);
    window.addEventListener('hashchange', syncActiveTab);
    return () => {
      window.removeEventListener('popstate', syncActiveTab);
      window.removeEventListener('hashchange', syncActiveTab);
    };
  }, [pathname]);

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);

    if (id === 'lookup') {
      router.push('/lookup');
      return;
    }
    if (id === 'support') {
      router.push('/support');
      return;
    }

    if (pathname === '/') {
      const newUrl = id === 'home' ? '/' : `/?tab=${id}`;
      window.history.pushState(null, '', newUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const newUrl = id === 'home' ? '/' : `/?tab=${id}`;
      router.push(newUrl);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    if (tab === 'LOGIN') {
      const res = await login(emailInput, passwordInput);
      setIsSubmitting(false);
      if (!res.success) {
        setAuthError(res.error || 'Đăng nhập không thành công');
      } else {
        setEmailInput('');
        setPasswordInput('');
      }
    } else {
      const res = await register(nameInput, emailInput, phoneInput, passwordInput);
      setIsSubmitting(false);
      if (!res.success) {
        setAuthError(res.error || 'Đăng ký không thành công');
      } else {
        setNameInput('');
        setEmailInput('');
        setPhoneInput('');
        setPasswordInput('');
      }
    }
  };

  // Filtered search results
  const searchResults = searchQuery.trim()
    ? {
        movies: MOCK_MOVIES.filter((m) =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        cinemas: MOCK_CINEMAS.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }
    : null;

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0F1217] border-b border-[#303645]/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 h-20 flex items-center justify-between">
          {/* Logo CINEMAX */}
          <Link
            href="/"
            onClick={() => handleNavClick('home')}
            className="flex items-center group cursor-pointer"
          >
            <span className="text-2xl sm:text-3xl font-black tracking-wider text-[#E63845] transition-transform group-hover:scale-105">
              CINEMAX
            </span>
          </Link>

          {/* Desktop Navigation Links with Glowing Active Pill */}
          <nav className="hidden md:flex items-center gap-1.5 bg-[#141720]/80 p-1.5 rounded-full border border-[#303645]/60 text-xs sm:text-sm font-semibold">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#E63845] text-white font-bold shadow-[0_0_16px_rgba(230,56,69,0.55)] scale-105'
                      : 'text-[#9EA6B8] hover:text-white hover:bg-[#1A1C26]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Search Input + Role-based Profile / Login */}
          <div className="hidden md:flex items-center gap-4">
            {/* Search Input */}
            <div className="relative">
              <div className="flex items-center bg-[#1A1C26] border border-[#303645] rounded-full px-4 py-2 text-xs focus-within:border-[#E63845] transition-colors w-48 lg:w-60">
                <Search className="w-3.5 h-3.5 text-[#9EA6B8] mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm phim, rạp..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="bg-transparent text-white placeholder-[#9EA6B8] focus:outline-none w-full text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="text-[#9EA6B8] hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Search Dropdown Popup */}
              {searchOpen && searchResults && (
                <div className="absolute top-12 left-0 right-0 bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 shadow-2xl z-50 space-y-3">
                  <div className="text-[11px] font-bold text-[#9EA6B8] uppercase">Phim</div>
                  {searchResults.movies.length === 0 ? (
                    <div className="text-xs text-[#9EA6B8] italic">Không tìm thấy phim</div>
                  ) : (
                    searchResults.movies.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/movie/${m.slug}`);
                        }}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#0F1217] cursor-pointer text-xs text-white"
                      >
                        <img src={m.poster_url} alt={m.title} className="w-8 h-10 object-cover rounded" />
                        <div>
                          <div className="font-bold line-clamp-1">{m.title}</div>
                          <div className="text-[10px] text-[#9EA6B8]">{m.duration_min} phút • {m.age_rating}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Phân quyền: GUEST vs USER vs ADMIN */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    currentUser.role_code === 'ADMIN'
                      ? 'bg-[#FABF2E]/15 border border-[#FABF2E] text-[#FABF2E] hover:bg-[#FABF2E]/25'
                      : 'bg-[#1A1C26] border border-[#303645] text-white hover:border-[#E63845]'
                  }`}
                >
                  {currentUser.role_code === 'ADMIN' ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#FABF2E]" />
                      <span>Admin: {currentUser.full_name} ▾</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full bg-[#E63845] text-white flex items-center justify-center text-[10px]">
                        {currentUser.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="line-clamp-1 max-w-[120px]">{currentUser.full_name} ▾</span>
                    </>
                  )}
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 top-12 w-52 bg-[#1A1C26] border border-[#303645] rounded-2xl shadow-2xl py-2 z-50 text-xs text-white space-y-1">
                    {/* User header info */}
                    <div className="px-4 py-2 border-b border-[#303645]/70">
                      <div className="font-bold text-white line-clamp-1">{currentUser.full_name}</div>
                      <div className="text-[10px] text-[#9EA6B8] line-clamp-1">{currentUser.email}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          currentUser.role_code === 'ADMIN'
                            ? 'bg-[#FABF2E] text-black'
                            : 'bg-[#E63845] text-white'
                        }`}>
                          {currentUser.role_code === 'ADMIN' ? 'QUẢN TRỊ VIÊN' : 'THÀNH VIÊN'}
                        </span>
                        {currentUser.role_code !== 'ADMIN' && (
                          <span className="text-[10px] text-[#FABF2E] font-semibold">
                            {currentUser.loyalty_points || 0} điểm
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Admin Dashboard Option */}
                    {currentUser.role_code === 'ADMIN' && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#0F1217] text-[#FABF2E] font-semibold transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#FABF2E]" />
                        <span>Trang Quản Trị</span>
                      </Link>
                    )}

                    {/* Regular User Options */}
                    <Link
                      href="/my-tickets"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#0F1217] transition-colors"
                    >
                      <Ticket className="w-4 h-4 text-[#E63845]" />
                      <span>Vé của tôi</span>
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#0F1217] text-[#E63845] transition-colors text-left cursor-pointer border-t border-[#303645]/50"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* GUEST: Khách chưa đăng nhập -> Hiển thị nút Đăng nhập */
              <button
                type="button"
                onClick={() => openAuthModal('LOGIN')}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-6 py-2 rounded-full font-bold text-xs shadow-md shadow-[#E63845]/25 transition-all transform hover:scale-105 cursor-pointer"
              >
                Đăng nhập
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[#9EA6B8] hover:text-white p-2"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#1A1C26] border-b border-[#303645] px-4 py-4 space-y-3">
            <div className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#E63845] text-white shadow-md shadow-[#E63845]/30'
                        : 'text-[#9EA6B8] hover:text-white hover:bg-[#0F1217]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}

              <div className="pt-2 border-t border-[#303645]">
                {currentUser ? (
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left text-xs text-[#E63845] font-bold p-2"
                  >
                    Đăng xuất ({currentUser.full_name})
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      openAuthModal('LOGIN');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-[#E63845] text-white font-bold text-xs py-2 rounded-lg text-center"
                  >
                    Đăng nhập / Đăng ký
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Real Functional Auth Modal with Zero Hardcoding */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={closeAuthModal}
              className="absolute top-5 right-5 text-[#9EA6B8] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#303645] pb-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setTab('LOGIN');
                  setAuthError('');
                }}
                className={`text-sm font-bold pb-2 transition-colors cursor-pointer ${
                  tab === 'LOGIN'
                    ? 'text-[#E63845] border-b-2 border-[#E63845]'
                    : 'text-[#9EA6B8] hover:text-white'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('REGISTER');
                  setAuthError('');
                }}
                className={`text-sm font-bold pb-2 transition-colors cursor-pointer ${
                  tab === 'REGISTER'
                    ? 'text-[#E63845] border-b-2 border-[#E63845]'
                    : 'text-[#9EA6B8] hover:text-white'
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            {/* Error banner */}
            {authError && (
              <div className="bg-[#E63845]/15 border border-[#E63845] text-[#E63845] text-xs p-3 rounded-xl">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {tab === 'REGISTER' && (
                <>
                  <div>
                    <label className="text-xs text-[#9EA6B8] block mb-1">Họ và tên *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#9EA6B8] block mb-1">Số điện thoại *</label>
                    <input
                      type="tel"
                      required
                      placeholder="0912 345 678"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div>
                <label className="text-xs text-[#9EA6B8] block mb-1">Mật khẩu *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-[#E63845] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9EA6B8] hover:text-white transition-colors cursor-pointer p-1"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-[#FABF2E]" />
                    ) : (
                      <Eye className="w-4 h-4 hover:text-[#FABF2E]" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#E63845] hover:bg-[#CC2B37] disabled:opacity-50 text-white py-3 rounded-full font-bold text-xs tracking-wider transition-all shadow-lg shadow-[#E63845]/30 cursor-pointer mt-2"
              >
                {isSubmitting
                  ? 'ĐANG XỬ LÝ...'
                  : tab === 'LOGIN'
                  ? 'ĐĂNG NHẬP'
                  : 'TẠO TÀI KHOẢN THÀNH VIÊN'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
