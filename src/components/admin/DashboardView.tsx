'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Ticket as TicketIcon,
  Film,
  Users,
  Calendar,
  RotateCw,
  Star,
} from 'lucide-react';
import { Movie, Showtime, Order, Product, Shift, Ticket } from '@/lib/types-redesign';

interface DashboardViewProps {
  movies: Movie[];
  showtimes: Showtime[];
  orders: Order[];
  products: Product[];
  shifts: Shift[];
  tickets?: Ticket[];
  onNavigate: (tab: any) => void;
  onRefresh?: () => void;
}

// Function to generate a smooth cubic bezier SVG path from points
function getSmoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function DashboardView({
  movies,
  showtimes,
  orders,
  products,
  shifts,
  tickets = [],
  onNavigate,
  onRefresh
}: DashboardViewProps) {
  const [timeRange, setTimeRange] = useState<'7DAYS' | '12MONTHS' | '5YEARS'>('7DAYS');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' — ' +
      new Date().toLocaleDateString('vi-VN')
  );

  // 1. Dynamic Calculations for Stat Cards
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => {
      if (o.status === 'paid') {
        return sum + (Number(o.total_amount) || Number(o.subtotal) || 0);
      }
      return sum;
    }, 0);
  }, [orders]);

  const ticketsSold = useMemo(() => {
    if (tickets && tickets.length > 0) return tickets.length;
    return orders.reduce((cnt, o) => {
      if (o.status === 'cancelled') return cnt;
      const count = o.items?.filter((i) => i.item_type === 'ticket').length;
      return cnt + (count && count > 0 ? count : (o.status === 'paid' ? 1 : 0));
    }, 0);
  }, [tickets, orders]);

  const activeMoviesCount = useMemo(() => {
    return movies.filter((m: any) => !m.is_deleted).length;
  }, [movies]);

  const customerCount = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const key =
        o.user_id ||
        o.contact_phone ||
        o.contact_email ||
        (o.contact_name && o.contact_name !== 'Khách vãng lai (POS)' ? o.contact_name : null);
      if (key && key.trim()) set.add(key.trim());
    });
    return set.size > 0 ? set.size : (orders.length > 0 ? orders.length : 0);
  }, [orders]);

  // 2. Dynamic Chart Data Calculation based on timeRange
  const chartData = useMemo(() => {
    const now = new Date();
    const slots: { key: string; label: string; fullLabel: string; rev: number; tickets: number }[] = [];

    const getVNDate = (dStr: string) => {
      try {
        const d = new Date(dStr);
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      } catch {
        return dStr.slice(0, 10);
      }
    };

    if (timeRange === '7DAYS') {
      // 7 latest days up to today
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        slots.push({
          key,
          label: `${dd}/${mm}`,
          fullLabel: `${dd}/${mm}/${d.getFullYear()}`,
          rev: 0,
          tickets: 0,
        });
      }

      orders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const oDate = getVNDate(o.created_at);
        const slot = slots.find((s) => s.key === oDate);
        if (slot) {
          if (o.status === 'paid') {
            slot.rev += Number(o.total_amount) || Number(o.subtotal) || 0;
          }
          const tCnt = o.items?.filter((i) => i.item_type === 'ticket').length || 1;
          slot.tickets += tCnt;
        }
      });
    } else if (timeRange === '12MONTHS') {
      // 12 months up to current month
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${yyyy}-${mm}`;
        slots.push({
          key,
          label: `T${d.getMonth() + 1}`,
          fullLabel: `Tháng ${d.getMonth() + 1}/${yyyy}`,
          rev: 0,
          tickets: 0,
        });
      }

      orders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const oMonth = o.created_at ? o.created_at.slice(0, 7) : '';
        const slot = slots.find((s) => s.key === oMonth);
        if (slot) {
          if (o.status === 'paid') {
            slot.rev += Number(o.total_amount) || Number(o.subtotal) || 0;
          }
          const tCnt = o.items?.filter((i) => i.item_type === 'ticket').length || 1;
          slot.tickets += tCnt;
        }
      });
    } else {
      // 5 years up to current year
      for (let i = 4; i >= 0; i--) {
        const yyyy = String(now.getFullYear() - i);
        slots.push({
          key: yyyy,
          label: yyyy,
          fullLabel: `Năm ${yyyy}`,
          rev: 0,
          tickets: 0,
        });
      }

      orders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const oYear = o.created_at ? o.created_at.slice(0, 4) : '';
        const slot = slots.find((s) => s.key === oYear);
        if (slot) {
          if (o.status === 'paid') {
            slot.rev += Number(o.total_amount) || Number(o.subtotal) || 0;
          }
          const tCnt = o.items?.filter((i) => i.item_type === 'ticket').length || 1;
          slot.tickets += tCnt;
        }
      });
    }

    // SVG coordinates computation
    const startX = 60;
    const endX = 760;
    const topY = 40;
    const bottomY = 220;
    const chartH = bottomY - topY;

    const rawMaxRev = Math.max(...slots.map((s) => s.rev), 0);
    // Find neat round step for revenue axis
    let maxRev = 600000;
    if (rawMaxRev > 0) {
      if (rawMaxRev <= 500000) maxRev = 500000;
      else if (rawMaxRev <= 1000000) maxRev = 1000000;
      else if (rawMaxRev <= 5000000) maxRev = Math.ceil(rawMaxRev / 500000) * 500000;
      else maxRev = Math.ceil(rawMaxRev / 1000000) * 1000000;
    }

    const rawMaxTickets = Math.max(...slots.map((s) => s.tickets), 0);
    const maxTickets = rawMaxTickets > 0 ? Math.max(4, Math.ceil(rawMaxTickets / 4) * 4) : 4;

    const points = slots.map((s, idx) => {
      const x = slots.length > 1 ? startX + (idx / (slots.length - 1)) * (endX - startX) : (startX + endX) / 2;
      const revRatio = Math.min(1, Math.max(0, s.rev / maxRev));
      const ticketRatio = Math.min(1, Math.max(0, s.tickets / maxTickets));
      const revY = bottomY - revRatio * chartH;
      const ticketY = bottomY - ticketRatio * chartH;
      return {
        ...s,
        x,
        revY,
        ticketY,
      };
    });

    const revPts = points.map((p) => ({ x: p.x, y: p.revY }));
    const ticketPts = points.map((p) => ({ x: p.x, y: p.ticketY }));

    const revPath = getSmoothCurvePath(revPts);
    const ticketPath = getSmoothCurvePath(ticketPts);
    const areaPath =
      revPts.length > 0
        ? `${revPath} L ${revPts[revPts.length - 1].x.toFixed(1)} ${bottomY} L ${revPts[0].x.toFixed(1)} ${bottomY} Z`
        : '';

    return {
      points,
      maxRev,
      maxTickets,
      revPath,
      ticketPath,
      areaPath,
      bottomY,
    };
  }, [timeRange, orders]);

  // 3. Dynamic Movie Revenue Ranking (Bottom Left & Right)
  const [chartLimit, setChartLimit] = useState<number | 'ALL'>(5);

  const rankedMovies = useMemo(() => {
    const statsMap: Record<string, { id: string; title: string; revenue: number; tickets: number }> = {};

    movies.forEach((m: any) => {
      if (!m.is_deleted) {
        statsMap[String(m.id)] = {
          id: String(m.id),
          title: m.title,
          revenue: 0,
          tickets: 0,
        };
      }
    });

    const showtimeMovieMap: Record<string, string> = {};
    showtimes.forEach((st) => {
      showtimeMovieMap[String(st.id)] = String(st.movie_id);
    });

    const countedOrderIds = new Set<string>();

    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const orderAmount = Number(o.total_amount) || Number(o.subtotal) || 0;
      let matchedMovieId: string | null = null;
      let tCount = 0;

      if (o.items && o.items.length > 0) {
        o.items.forEach((item) => {
          if (item.item_type === 'ticket') {
            tCount += Number(item.quantity) || 1;
            const snapTitle = item.item_snapshot?.movieTitle || item.item_snapshot?.movie_title;
            if (snapTitle) {
              const found = movies.find(
                (m) => m.title.trim().toLowerCase() === snapTitle.trim().toLowerCase()
              );
              if (found) matchedMovieId = String(found.id);
            }
          }
        });
      }

      if (!matchedMovieId && (o as any).showtime_id) {
        const stId = String((o as any).showtime_id);
        if (showtimeMovieMap[stId]) matchedMovieId = showtimeMovieMap[stId];
      }

      if (matchedMovieId && statsMap[matchedMovieId]) {
        statsMap[matchedMovieId].revenue += orderAmount;
        statsMap[matchedMovieId].tickets += tCount || 1;
        countedOrderIds.add(String(o.id));
      }
    });

    // Also account for tickets if not already represented in orders
    if (tickets && tickets.length > 0) {
      tickets.forEach((t) => {
        if (t.status === 'cancelled' || (t.status as string) === 'refunded') return;
        if (t.order_id && countedOrderIds.has(String(t.order_id))) return;

        const movieTitle = t.movie_title;
        if (movieTitle) {
          const found = movies.find(
            (m) => m.title.trim().toLowerCase() === movieTitle.trim().toLowerCase()
          );
          if (found && statsMap[String(found.id)]) {
            statsMap[String(found.id)].tickets += 1;
            statsMap[String(found.id)].revenue += Number(t.price) || 0;
          }
        }
      });
    }

    return Object.values(statsMap).sort((a, b) => b.revenue - a.revenue || b.tickets - a.tickets);
  }, [movies, showtimes, orders, tickets]);

  const chartMovies = useMemo(() => {
    if (chartLimit === 'ALL') {
      const active = rankedMovies.filter((m) => m.revenue > 0 || m.tickets > 0);
      return active.length >= 5 ? active : rankedMovies.slice(0, 8);
    }
    return rankedMovies.slice(0, typeof chartLimit === 'number' ? chartLimit : 5);
  }, [rankedMovies, chartLimit]);

  const handleRefresh = () => {
    setLastRefreshed(
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' — ' +
        new Date().toLocaleDateString('vi-VN')
    );
    if (onRefresh) onRefresh();
  };

  const formatRevAxis = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.0', '')}M`;
    return `${Math.round(val / 1000)}k`;
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
              <TicketIcon className="w-5 h-5" />
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
            <p className="text-xs text-[#6E7B91]">Doanh thu & số vé bán ra theo thời gian thực</p>
          </div>

          {/* Time range selector pills */}
          <div className="flex items-center bg-[#131824] border border-[#212A3D] p-1 rounded-xl">
            <button
              onClick={() => {
                setTimeRange('7DAYS');
                setHoveredIndex(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '7DAYS'
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              7 Ngày
            </button>
            <button
              onClick={() => {
                setTimeRange('12MONTHS');
                setHoveredIndex(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '12MONTHS'
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'text-[#8E9AAF] hover:text-white'
              }`}
            >
              12 Tháng
            </button>
            <button
              onClick={() => {
                setTimeRange('5YEARS');
                setHoveredIndex(null);
              }}
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

        {/* Dynamic SVG Dual Wave Graph */}
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
            <line x1="50" y1="85" x2="770" y2="85" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="130" x2="770" y2="130" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="175" x2="770" y2="175" stroke="#1A2333" strokeDasharray="3 3" />
            <line x1="50" y1="220" x2="770" y2="220" stroke="#253147" />

            {/* Y-axis left labels (Revenue) */}
            <text x="12" y="44" fill="#526077" fontSize="10" fontFamily="monospace">
              {formatRevAxis(chartData.maxRev)}
            </text>
            <text x="12" y="89" fill="#526077" fontSize="10" fontFamily="monospace">
              {formatRevAxis(chartData.maxRev * 0.75)}
            </text>
            <text x="12" y="134" fill="#526077" fontSize="10" fontFamily="monospace">
              {formatRevAxis(chartData.maxRev * 0.5)}
            </text>
            <text x="12" y="179" fill="#526077" fontSize="10" fontFamily="monospace">
              {formatRevAxis(chartData.maxRev * 0.25)}
            </text>
            <text x="35" y="224" fill="#526077" fontSize="10" fontFamily="monospace">
              0
            </text>

            {/* Y-axis right labels (Tickets) */}
            <text x="785" y="44" fill="#526077" fontSize="10" fontFamily="monospace">
              {chartData.maxTickets}
            </text>
            <text x="785" y="89" fill="#526077" fontSize="10" fontFamily="monospace">
              {Math.round(chartData.maxTickets * 0.75)}
            </text>
            <text x="785" y="134" fill="#526077" fontSize="10" fontFamily="monospace">
              {Math.round(chartData.maxTickets * 0.5)}
            </text>
            <text x="785" y="179" fill="#526077" fontSize="10" fontFamily="monospace">
              {Math.round(chartData.maxTickets * 0.25)}
            </text>
            <text x="785" y="224" fill="#526077" fontSize="10" fontFamily="monospace">
              0
            </text>

            {/* Red Gradient Area Fill */}
            {chartData.areaPath && <path d={chartData.areaPath} fill="url(#revenueGrad)" />}

            {/* Red Smooth Line (Doanh thu) */}
            {chartData.revPath && (
              <path
                d={chartData.revPath}
                fill="none"
                stroke="#E50914"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Cyan Dashed Line (Số vé) */}
            {chartData.ticketPath && (
              <path
                d={chartData.ticketPath}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Point Circles and Vertical Hover Guides */}
            {chartData.points.map((p, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <g key={p.key}>
                  {isHovered && (
                    <line
                      x1={p.x}
                      y1="35"
                      x2={p.x}
                      y2="220"
                      stroke="#E50914"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.6"
                    />
                  )}

                  {/* Revenue Dot */}
                  <circle
                    cx={p.x}
                    cy={p.revY}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#E50914"
                    stroke="#0C1019"
                    strokeWidth="2"
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />

                  {/* Ticket Dot */}
                  <circle
                    cx={p.x}
                    cy={p.ticketY}
                    r={isHovered ? 4.5 : 2.5}
                    fill="#06B6D4"
                    stroke="#0C1019"
                    strokeWidth="1.5"
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />

                  {/* Invisible Hitbox for easy hover */}
                  <rect
                    x={p.x - 20}
                    y={35}
                    width={40}
                    height={190}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })}

            {/* X-axis dates */}
            {chartData.points.map((d) => (
              <text
                key={d.key}
                x={d.x}
                y="245"
                textAnchor="middle"
                fill="#6E7B91"
                fontSize="10"
                fontFamily="monospace"
              >
                {d.label}
              </text>
            ))}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredIndex !== null && chartData.points[hoveredIndex] && (
            <div
              className="absolute z-30 pointer-events-none bg-[#161B26] border border-[#2B3547] shadow-2xl rounded-xl p-3 -translate-x-1/2 -translate-y-full text-xs text-white space-y-1 backdrop-blur-md"
              style={{
                left: `${(chartData.points[hoveredIndex].x / 820) * 100}%`,
                top: `${(chartData.points[hoveredIndex].revY / 260) * 100 - 6}%`,
              }}
            >
              <div className="font-bold text-[#8E9AAF] border-b border-[#2B3547] pb-1">
                {chartData.points[hoveredIndex].fullLabel}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#E50914] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                  Doanh thu:
                </span>
                <span className="font-mono font-bold">
                  {chartData.points[hoveredIndex].rev.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#06B6D4] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                  Vé bán:
                </span>
                <span className="font-mono font-bold">
                  {chartData.points[hoveredIndex].tickets} vé
                </span>
              </div>
            </div>
          )}
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

          <div className="text-[11px] text-[#526077]">
            {timeRange === '7DAYS' && 'Hiển thị 7 ngày gần nhất'}
            {timeRange === '12MONTHS' && 'Hiển thị 12 tháng gần nhất'}
            {timeRange === '5YEARS' && 'Hiển thị 5 năm gần nhất'}
          </div>
        </div>
      </div>

      {/* Bottom 2 Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: So Sánh Doanh Thu Top Phim */}
        <div className="p-6 rounded-3xl bg-[#0C1019] border border-[#192130] space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
                <span>So Sánh Doanh Thu Phim</span>
              </h3>
              <p className="text-xs text-[#6E7B91]">Dữ liệu thời gian thực đồng bộ từ đơn hàng & vé</p>
            </div>

            {/* Toggle column count: Top 5, Top 8, Tất cả */}
            <div className="flex items-center gap-1 bg-[#121724] p-1 rounded-xl border border-[#1E2738]">
              <button
                type="button"
                onClick={() => setChartLimit(5)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  chartLimit === 5
                    ? 'bg-[#E50914] text-white shadow-md shadow-[#E50914]/30'
                    : 'text-[#8E9AAF] hover:text-white hover:bg-white/5'
                }`}
              >
                Top 5
              </button>
              <button
                type="button"
                onClick={() => setChartLimit(8)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  chartLimit === 8
                    ? 'bg-[#E50914] text-white shadow-md shadow-[#E50914]/30'
                    : 'text-[#8E9AAF] hover:text-white hover:bg-white/5'
                }`}
              >
                Top 8
              </button>
              <button
                type="button"
                onClick={() => setChartLimit('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  chartLimit === 'ALL'
                    ? 'bg-[#E50914] text-white shadow-md shadow-[#E50914]/30'
                    : 'text-[#8E9AAF] hover:text-white hover:bg-white/5'
                }`}
              >
                Tất cả
              </button>
            </div>
          </div>

          {/* Bar Chart Representation - Responsive & Non-overflowing */}
          <div className="h-56 w-full flex items-end justify-between gap-1 sm:gap-2 pt-6 px-1 sm:px-3 pb-2 border-b border-[#1E2738] overflow-hidden">
            {chartMovies.length === 0 ? (
              <div className="w-full text-center text-xs text-[#6E7B91] py-16">
                Chưa có dữ liệu phim nào
              </div>
            ) : (
              chartMovies.map((m, idx) => {
                const maxRev = rankedMovies[0]?.revenue || 1;
                const heightPct =
                  maxRev > 0
                    ? Math.max(12, Math.round(((m.revenue || 0) / maxRev) * 100))
                    : 12;

                // Tự động thu bé kích thước cột khi có thêm cột mới
                const barWidthClass =
                  chartMovies.length <= 4
                    ? 'max-w-[42px]'
                    : chartMovies.length <= 6
                    ? 'max-w-[32px]'
                    : chartMovies.length <= 8
                    ? 'max-w-[24px]'
                    : 'max-w-[18px]';

                const labelSizeClass =
                  chartMovies.length <= 5
                    ? 'text-[10px]'
                    : chartMovies.length <= 8
                    ? 'text-[9px]'
                    : 'text-[8px]';

                return (
                  <div
                    key={m.id || idx}
                    className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end group transition-all duration-300 relative"
                  >
                    {/* Tooltip hiển thị giá trị doanh thu chi tiết khi hover */}
                    <div className="text-[10px] font-mono font-semibold text-emerald-400 opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap mb-1 bg-[#121824]/95 backdrop-blur-sm px-2 py-0.5 rounded-md border border-[#1E2638] shadow-lg pointer-events-none z-20 absolute -top-3">
                      {m.revenue >= 1000000
                        ? `${(m.revenue / 1000000).toFixed(1).replace('.0', '')}M đ`
                        : `${Math.round(m.revenue / 1000)}k đ`}
                      <span className="text-[#8E9AAF] ml-1">({m.tickets} vé)</span>
                    </div>

                    {/* Cột bar với chiều cao tỉ lệ & hiệu ứng gradient */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full ${barWidthClass} mx-auto rounded-t-lg bg-gradient-to-t from-[#B91C1C] via-[#E50914] to-[#FF4D4D] group-hover:brightness-125 transition-all duration-300 relative shadow-lg shadow-[#E50914]/20`}
                    />

                    {/* Tên phim rút gọn sạch sẽ trong min-w-0 container */}
                    <span
                      title={`${m.title} — ${m.revenue.toLocaleString('vi-VN')} đ (${m.tickets} vé)`}
                      className={`${labelSizeClass} text-[#8E9AAF] group-hover:text-white truncate w-full text-center mt-1 font-medium transition-colors cursor-default block px-0.5`}
                    >
                      {m.title}
                    </span>
                  </div>
                );
              })
            )}
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
            {rankedMovies.length === 0 ? (
              <div className="text-center text-xs text-[#6E7B91] py-8">
                Chưa có dữ liệu xếp hạng
              </div>
            ) : (
              rankedMovies.slice(0, 5).map((m, idx) => (
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
                      <div className="text-xs font-bold text-white truncate" title={m.title}>
                        {m.title}
                      </div>
                      <div className="text-[10px] text-[#6E7B91] flex items-center gap-1.5 mt-0.5">
                        <TicketIcon className="w-3 h-3 text-[#3B82F6]" />
                        <span>{m.tickets} vé</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-[#E50914] font-mono">
                      {m.revenue >= 1000
                        ? `${(m.revenue / 1000).toLocaleString('vi-VN')}k đ`
                        : `${m.revenue.toLocaleString('vi-VN')} đ`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
