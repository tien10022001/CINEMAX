'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Film,
  Building2,
  Calendar,
  Coffee,
  Ticket,
  Gift,
  CreditCard,
  ScanLine,
  Receipt,
  Settings,
  LogOut,
  Eye,
  Bell,
  QrCode,
  ExternalLink
} from 'lucide-react';

export type AdminTab =
  | 'DASHBOARD'
  | 'MOVIES'
  | 'SHOWTIMES'
  | 'AUDITORIUMS'
  | 'CONCESSION'
  | 'COUPONS'
  | 'ORDERS_FINANCE'
  | 'POS_SHIFTS'
  | 'FOOD_CHECKIN'
  | 'CHECKIN'
  | 'SETTINGS'
  | 'AUDIT_LOGS';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  operatorName: string;
  activeShiftStatus: string;
  posTerminal: string;
  onLogout: () => void;
  userRole?: string;
  staffPermissions?: string[];
  counts: {
    movies: number;
    showtimes: number;
    auditoriums: number;
    products: number;
    orders: number;
    refunds: number;
    coupons?: number;
  };
}

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  operatorName,
  activeShiftStatus,
  posTerminal,
  onLogout,
  userRole = 'ADMIN',
  staffPermissions = [],
  counts
}: AdminSidebarProps) {
  const isStaff = userRole === 'STAFF';
  const navItems: NavItem[] = [
    {
      id: 'DASHBOARD',
      label: 'Thống kê',
      icon: LayoutDashboard
    },
    {
      id: 'MOVIES',
      label: 'Quản lý phim',
      icon: Film,
      badge: counts.movies
    },
    {
      id: 'AUDITORIUMS',
      label: 'Quản lý rạp',
      icon: Building2,
      badge: counts.auditoriums
    },
    {
      id: 'SHOWTIMES',
      label: 'Quản lý suất chiếu',
      icon: Calendar,
      badge: counts.showtimes
    },
    {
      id: 'CONCESSION',
      label: 'Food',
      icon: Coffee,
      badge: counts.products
    },
    {
      id: 'COUPONS',
      label: 'Mã Giảm Giá',
      icon: Gift,
      badge: counts.coupons
    },
    {
      id: 'ORDERS_FINANCE',
      label: 'Quản lý Vé',
      icon: Ticket,
      badge: counts.orders
    },
    {
      id: 'SETTINGS',
      label: 'Cài đặt hệ thống',
      icon: Settings
    }
  ];

  // Staff allowed tabs
  const allowedNavItems = navItems.filter((item) => {
    if (!isStaff) return true;
    return ['ORDERS_FINANCE', 'CONCESSION'].includes(item.id);
  });

  return (
    <aside className="w-64 bg-[#0A0D14] border-r border-[#171D29] flex flex-col h-full select-none z-30 shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-[#171D29] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#E50914] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#E50914]/40">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white tracking-wider text-base">
            CINEMAX<span className="text-[#E50914] text-xs ml-1 font-bold">{isStaff ? 'STAFF' : 'ADMIN'}</span>
          </span>
        </div>

        <Link
          href="/"
          target="_blank"
          title="Xem Website Khách Hàng"
          className="w-7 h-7 rounded-lg text-[#6E7B91] hover:text-white flex items-center justify-center transition-colors"
        >
          <Eye className="w-4 h-4" />
        </Link>
      </div>

      {/* Navigation List - Clean Single-Line Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
        {allowedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#220B10] text-[#FF3B56] font-bold shadow-sm border border-[#FF3B56]/20'
                  : 'text-[#8E9AAF] hover:text-white hover:bg-white/5 font-medium'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#FF3B56]' : 'text-[#8E9AAF]'
                  }`}
                />
                <span className="text-xs truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-black shrink-0 ${
                    isActive
                      ? 'bg-[#FF3B56] text-white'
                      : 'bg-[#151B27] text-[#6E7B91]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Access to Front-desk Staff Portal */}
      <div className="p-3 border-t border-[#171D29]">
        <Link
          href="/staff"
          target="_blank"
          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-[#22C55E]/15 to-[#06B6D4]/15 hover:from-[#22C55E]/25 hover:to-[#06B6D4]/25 border border-[#22C55E]/30 text-white transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>Cổng Nhân Viên (POS)</span>
              <ExternalLink className="w-3 h-3 text-[#22C55E]" />
            </div>
            <div className="text-[10px] text-[#8E9AAF] truncate">Bán vé, soát vé & quầy bắp</div>
          </div>
        </Link>
      </div>

      {/* Operator Footer Profile Bar */}
      <div className="p-3.5 border-t border-[#171D29] bg-[#080B10] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1A2233] border border-[#2B374D] flex items-center justify-center text-xs font-bold text-white shrink-0">
            {operatorName ? operatorName.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{operatorName || 'Admin'}</div>
            <div className="text-[10px] text-[#6E7B91] truncate">{isStaff ? 'Nhân viên rạp (STAFF)' : 'Quản trị viên (ADMIN)'}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Đăng xuất"
          className="p-1.5 rounded-lg text-[#6E7B91] hover:text-[#FF3B56] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
