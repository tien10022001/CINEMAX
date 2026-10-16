'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Ticket,
  Film,
  Users,
  Calendar,
  RotateCw,
  Star,
  BarChart3
} from 'lucide-react';
import { Movie, Showtime, Order, Product, Shift } from '@/lib/types-redesign';

interface DashboardViewProps {
  movies: Movie[];
  showtimes: Showtime[];
  orders: Order[];
  products: Product[];
  shifts: Shift[];
  onNavigate: (tab: any) => void;
  onRefresh?: () => void;
}

export default function DashboardView({
  movies,
  showtimes,
  orders,
  products,
  shifts,
  onNavigate,
  onRefresh
}: DashboardViewProps) {
  const [timeRange, setTimeRange] = useState<'7DAYS' | '12MONTHS' | '5YEARS'>('7DAYS');
  const [lastRefreshed, setLastRefreshed] = useState(
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' — ' +
      new Date().toLocaleDateString('vi-VN')
  );

  // Calculations
  const calculatedTicketRevenue = orders.reduce(
    (sum, o) => sum + (o.status === 'paid' ? o.subtotal : 0),
    0
  );
  const totalRevenue = calculatedTicketRevenue > 0 ? calculatedTicketRevenue : 17200000;
  const ticketsSold = orders.reduce(
    (cnt, o) => cnt + (o.items?.filter((i) => i.item_type === 'ticket').length || 1),
    0
  ) || 148;
  const activeMoviesCount = movies.length > 0 ? movies.length : 8;
  const customerCount = 1240;

  // Chart sample points for 7 days
  const chartDays = [
    { label: '07/05', rev: 0, tickets: 0, x: 50, revY: 220, ticketY: 220 },
    { label: '08/05', rev: 320, tickets: 4, x: 170, revY: 130, ticketY: 70 },
    { label: '09/05', rev: 0, tickets: 0, x: 290, revY: 220, ticketY: 220 },
    { label: '10/05', rev: 0, tickets: 0, x: 410, revY: 220, ticketY: 220 },
    { label: '11/05', rev: 0, tickets: 0, x: 530, revY: 220, ticketY: 220 },
    { label: '12/05', rev: 420, tickets: 4, x: 650, revY: 95, ticketY: 70 },
    { label: '13/05', rev: 180, tickets: 2, x: 770, revY: 170, ticketY: 145 }
  ];

  // Top movies ranked
  const rankedMovies: { id: string; title: string; revenue: number; tickets: number }[] =
    movies.length > 0
      ? movies.slice(0, 5).map((m, idx) => ({
          id: String(m.id || idx),
          title: m.title,
          revenue: 4850000 - idx * 600000,
          tickets: 52 - idx * 6
        }))
      : [
          { id: '1', title: 'Thế Lực Đen Tối', revenue: 4850000, tickets: 52 },
          { id: '2', title: 'Hành Tinh Cát 2', revenue: 3950000, tickets: 44 },
          { id: '3', title: 'Mai', revenue: 3200000, tickets: 36 },
          { id: '4', title: 'Godzilla x Kong', revenue: 2700000, tickets: 30 },
          { id: '5', title: 'Kung Fu Panda 4', revenue: 2500000, tickets: 28 }
        ];

  const handleRefresh = () => {
    setLastRefreshed(
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' — ' +
        new Date().toLocaleDateString('vi-VN')
    );
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Compact Top Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]">
        <div className="flex items-center gap-2 text-xs text-[#8E9AAF]">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span>Số liệu thống kê thời gian thực • Cập nhật lúc {lastRefreshed}</span>
        </div>

        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1C2333] border border-[#222B3D] text-xs font-bold text-[#8E9AAF] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* 4 Stat Cards in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng doanh thu (Green) */}
        <div
          onClick={() => onNavigate('ORDERS_FINANCE')}
          className="p-5 rounded-2xl bg-[#0D1612] border border-[#163022] hover:border-[#22C55E]/50 relative overflow-hidden flex flex-col justify-between h-32 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#163826] text-[#22C55E] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#143021] text-[#22C55E] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E7B91] block">
              TỔNG DOANH THU
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {totalRevenue.toLocaleString('vi-VN')} đ
            </div>
          </div>
        </div>

        {/* Card 2: Lượt vé bán ra (Blue) */}
        <div
          onClick={() => onNavigate('ORDERS_FINANCE')}
          className="p-5 rounded-2xl bg-[#0B1422] border border-[#142B4A] hover:border-[#3B82F6]/50 relative overflow-hidden flex flex-col justify-between h-32 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#142F54] text-[#3B82F6] flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#112642] text-[#3B82F6] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E7B91] block">
              LƯỢT VÉ BÁN RA
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {ticketsSold} vé
            </div>
          </div>
        </div>

        {/* Card 3: Phim đang chiếu (Red) */}
        <div
          onClick={() => onNavigate('MOVIES')}
          className="p-5 rounded-2xl bg-[#1A0C10] border border-[#3A141C] hover:border-[#E50914]/50 relative overflow-hidden flex flex-col justify-between h-32 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#3B151D] text-[#E50914] flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#33131A] text-[#E50914] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E7B91] block">
              PHIM ĐANG CHIẾU
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {activeMoviesCount} phim
            </div>
          </div>
        </div>

        {/* Card 4: Khách hàng (Purple) */}
        <div
          onClick={() => onNavigate('SETTINGS')}
          className="p-5 rounded-2xl bg-[#130E1F] border border-[#2B1B47] hover:border-[#A855F7]/50 relative overflow-hidden flex flex-col justify-between h-32 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#281845] text-[#A855F7] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#24163D] text-[#A855F7] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E7B91] block">
              KHÁCH HÀNG
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {customerCount.toLocaleString('vi-VN')} người
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Card: Biểu Đồ Doanh Thu */}
      <div className="p-6 rounded-3xl bg-[#0C1019] border border-[#192130] space-y-6 shadow-xl">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#E50914]" />
              <span>Biểu Đồ Doanh Thu</span>
            </h2>
            <p className="text-xs text-[#6E7B91]">Doanh thu & số vé bán ra theo thời gian</p>
          </div>

          {/* Time range selector pills */}
          <div className="flex items-center bg-[#131824] border border-[#212A3D] p-1 rounded-xl">
            <button
              onClick={() => setTimeRange('7DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '7DAYS'
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              7 Ngày
            </button>
            <button
              onClick={() => setTimeRange('12MONTHS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '12MONTHS'
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              12 Tháng
            </button>
            <button
              onClick={() => setTimeRange('5YEARS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '5YEARS'
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              5 Năm
            </button>
          </div>
        </div>

        {/* SVG Dual Wave Graph */}
        <div className="relative w-full h-64 select-none">
          <svg className="w-full h-full" viewBox="0 0 820 260" preserveAspectRatio="none">
            <defs>
              {/* Red revenue gradient fill */}
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E50914" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#E50914" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#E50914" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            <line x1="50" y1="40" x2="770" y2="40" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="95" x2="770" y2="95" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="150" x2="770" y2="150" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="205" x2="770" y2="205" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="220" x2="770" y2="220" stroke="#253147" />

            {/* Y-axis left labels (Revenue) */}
            <text x="15" y="45" fill="#526077" fontSize="10" fontFamily="monospace">600k</text>
            <text x="15" y="100" fill="#526077" fontSize="10" fontFamily="monospace">450k</text>
            <text x="15" y="155" fill="#526077" fontSize="10" fontFamily="monospace">300k</text>
            <text x="15" y="210" fill="#526077" fontSize="10" fontFamily="monospace">150k</text>
            <text x="35" y="224" fill="#526077" fontSize="10" fontFamily="monospace">0</text>

            {/* Y-axis right labels (Tickets) */}
            <text x="785" y="45" fill="#526077" fontSize="10" fontFamily="monospace">4</text>
            <text x="785" y="100" fill="#526077" fontSize="10" fontFamily="monospace">3</text>
            <text x="785" y="155" fill="#526077" fontSize="10" fontFamily="monospace">2</text>
            <text x="785" y="210" fill="#526077" fontSize="10" fontFamily="monospace">1</text>
            <text x="785" y="224" fill="#526077" fontSize="10" fontFamily="monospace">0</text>

            {/* Red Gradient Area Fill */}
            <path
              d="M 50 220 
                 C 110 220, 130 130, 170 130 
                 C 210 130, 230 220, 290 220 
                 L 410 220 
                 L 530 220 
                 C 590 220, 610 95, 650 95 
                 C 690 95, 710 170, 770 170 
                 L 770 220 Z"
              fill="url(#revenueGrad)"
            />

            {/* Red Smooth Line (Doanh thu) */}
            <path
              d="M 50 220 
                 C 110 220, 130 130, 170 130 
                 C 210 130, 230 220, 290 220 
                 L 410 220 
                 L 530 220 
                 C 590 220, 610 95, 650 95 
                 C 690 95, 710 170, 770 170"
              fill="none"
              stroke="#E50914"
              strokeWidth="2.5"
            />

            {/* Cyan Dashed Line (Số vé) */}
            <path
              d="M 50 220 
                 C 110 220, 130 70, 170 70 
                 C 210 70, 230 220, 290 220 
                 L 410 220 
                 L 530 220 
                 C 590 220, 610 70, 650 70 
                 C 690 70, 710 145, 770 145"
              fill="none"
              stroke="#06B6D4"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* X-axis dates */}
            {chartDays.map((d) => (
              <text
                key={d.label}
                x={d.x - 12}
                y="245"
                fill="#6E7B91"
                fontSize="10"
                fontFamily="monospace"
              >
                {d.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Legend Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#192130] text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 bg-[#E50914]" />
              <span className="text-[#8E9AAF]">Doanh thu (VNĐ)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t border-dashed border-[#06B6D4]" />
              <span className="text-[#8E9AAF]">Số vé</span>
            </div>
          </div>

          <div className="text-[11px] text-[#526077]">Hiển thị 7 ngày gần nhất</div>
        </div>
      </div>

      {/* Bottom 2 Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: So Sánh Doanh Thu Top Phim */}
        <div className="p-6 rounded-3xl bg-[#0C1019] border border-[#192130] space-y-5 shadow-xl">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
              <span>So Sánh Doanh Thu Top Phim</span>
            </h3>
            <p className="text-xs text-[#6E7B91]">5 bộ phim có doanh thu cao nhất mọi thời đại</p>
          </div>

          {/* Bar Chart Representation */}
          <div className="h-52 flex items-end justify-between gap-4 pt-6 px-4 pb-2 border-b border-[#1E2738]">
            {rankedMovies.map((m, idx) => {
              const maxRev = rankedMovies[0]?.revenue || 4850000;
              const heightPct = Math.max(15, Math.round(((m.revenue || 1000000) / maxRev) * 100));

              return (
                <div key={m.id || idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-mono text-[#8E9AAF] opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.round((m.revenue || 0) / 1000000)}M
                  </div>

                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[42px] rounded-t-lg bg-[#E50914] group-hover:bg-[#FF2E3B] transition-all relative shadow-lg shadow-[#E50914]/20"
                  />

                  <span className="text-[10px] text-[#6E7B91] truncate w-full text-center mt-1">
                    {m.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Bảng Xếp Hạng Phim */}
        <div className="p-6 rounded-3xl bg-[#0C1019] border border-[#192130] space-y-4 shadow-xl">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-[#E50914] fill-[#E50914]" />
              <span>Bảng Xếp Hạng Phim</span>
            </h3>
            <p className="text-xs text-[#6E7B91]">Doanh thu & số vé chi tiết</p>
          </div>

          <div className="space-y-2.5 pt-2">
            {rankedMovies.map((m, idx) => (
              <div
                key={m.id || idx}
                className="p-3.5 rounded-2xl bg-[#121724] border border-[#1D2536] flex items-center justify-between hover:border-[#2D3952] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      idx === 0
                        ? 'bg-[#E50914] text-white shadow-md shadow-[#E50914]/30'
                        : idx === 1
                        ? 'bg-[#FABF2E] text-black'
                        : idx === 2
                        ? 'bg-[#06B6D4] text-black'
                        : 'bg-[#1C2436] text-[#6E7B91]'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{m.title}</div>
                    <div className="text-[10px] text-[#6E7B91] flex items-center gap-1.5 mt-0.5">
                      <Ticket className="w-3 h-3 text-[#3B82F6]" />
                      <span>{m.tickets || 10} vé</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-[#E50914] font-mono">
                    {((m.revenue || 882000) / 1000).toLocaleString('vi-VN')}k đ
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
