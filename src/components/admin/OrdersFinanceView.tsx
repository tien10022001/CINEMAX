'use client';

import React, { useState, useMemo } from 'react';
import {
  Receipt,
  DollarSign,
  Ticket as TicketIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  FileText,
  X,
  CreditCard,
  Building2,
  Trash2,
  QrCode,
  Film,
  Calendar,
  Check,
  Ban,
  User,
  Copy,
  Filter,
  ScanLine,
  ShieldCheck,
  Eye
} from 'lucide-react';
import {
  Order,
  Refund,
  InvoiceRequest,
  Coupon,
  Ticket,
  Showtime,
  Movie
} from '@/lib/types-redesign';

interface OrdersFinanceViewProps {
  orders: Order[];
  refunds: Refund[];
  invoices: InvoiceRequest[];
  coupons?: Coupon[];
  tickets?: Ticket[];
  showtimes?: Showtime[];
  movies?: Movie[];
  operatorName?: string;
  onCheckInTicket?: (qrToken: string, checkedInBy: string, agePassed: boolean) => Promise<void>;
  onApproveRefund: (refundId: string) => Promise<void>;
  onIssueInvoice: (requestId: string, invoiceRef: string) => Promise<void>;
  onSaveCoupon?: (coupon: Partial<Coupon>) => Promise<void>;
  onDeleteCoupon?: (idOrCode: string) => Promise<void>;
  showToast: (msg: string) => void;
  defaultSubTab?: 'ALL' | 'TICKETS' | 'ORDERS' | 'REFUNDS' | 'INVOICES';
}

export interface MergedTicketOrderItem {
  key: string;
  ticketId?: string;
  qrToken: string;
  orderCode: string;
  orderId?: string;
  channel: 'online' | 'pos' | string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  movieTitle: string;
  roomShowtime: string;
  seatLabel: string;
  price: number;
  status: 'used' | 'issued' | 'cancelled';
  createdAt: string;
}

export default function OrdersFinanceView({
  orders = [],
  refunds = [],
  invoices = [],
  coupons = [],
  tickets = [],
  showtimes = [],
  movies = [],
  operatorName = 'Quản trị viên Cinemax',
  onCheckInTicket,
  onApproveRefund,
  onIssueInvoice,
  onSaveCoupon,
  onDeleteCoupon,
  showToast,
  defaultSubTab = 'TICKETS'
}: OrdersFinanceViewProps) {
  const [subTab, setSubTab] = useState<'TICKETS' | 'ORDERS' | 'REFUNDS' | 'INVOICES'>(
    defaultSubTab === 'ORDERS' ? 'ORDERS' : 'TICKETS'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState<'ALL' | 'ONLINE' | 'POS'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ISSUED' | 'USED' | 'CANCELLED'>('ALL');
  const [filterOrderStatus, setFilterOrderStatus] = useState<'ALL' | 'PAID' | 'PENDING' | 'REFUNDED' | 'CANCELLED'>('ALL');
  const [activeOrderDetail, setActiveOrderDetail] = useState<Order | null>(null);

  // Quick ticket check-in state
  const [quickScanCode, setQuickScanCode] = useState('');
  const [activeCheckinItem, setActiveCheckinItem] = useState<MergedTicketOrderItem | null>(null);
  const [ageCheckConfirmed, setAgeCheckConfirmed] = useState(false);
  const [isProcessingCheckin, setIsProcessingCheckin] = useState(false);
  const [localCheckedInKeys, setLocalCheckedInKeys] = useState<Record<string, boolean>>({});

  // Unified list combining all tickets and standalone orders
  const mergedList: MergedTicketOrderItem[] = useMemo(() => {
    const list: MergedTicketOrderItem[] = [];
    const coveredOrderIds = new Set<string>();

    (tickets || []).forEach((t, idx) => {
      const orderRef = (orders || []).find((o) => o.id === t.order_id || o.order_code === t.order_id);
      if (orderRef) {
        coveredOrderIds.add(orderRef.id);
        if (orderRef.order_code) coveredOrderIds.add(orderRef.order_code);
      }
      if (t.order_id) coveredOrderIds.add(t.order_id);

      const isLocallyUsed = localCheckedInKeys[t.id] || localCheckedInKeys[t.qr_token_hash];
      const isUsed = t.status === 'used' || isLocallyUsed;
      const isCancelled = (t.status as string) === 'cancelled';
      const status: 'used' | 'issued' | 'cancelled' = isUsed ? 'used' : isCancelled ? 'cancelled' : 'issued';

      list.push({
        key: t.id || `ticket-${idx}`,
        ticketId: t.id,
        qrToken: t.qr_token_hash || `CMX-${(t.id || '').slice(0, 8)}`,
        orderCode: orderRef?.order_code || t.order_id || 'POS-WALKIN',
        orderId: t.order_id,
        channel: orderRef?.channel || (t.order_id?.startsWith('CNM') ? 'online' : 'pos'),
        customerName: orderRef?.contact_name || 'Khách Đặt Online',
        customerPhone: orderRef?.contact_phone || undefined,
        customerEmail: orderRef?.contact_email || undefined,
        movieTitle: t.movie_title || orderRef?.items?.[0]?.item_snapshot?.movieTitle || 'Dune: Hành Tinh Cát 2',
        roomShowtime:
          t.showtime_str ||
          (orderRef?.items?.[0]?.item_snapshot?.showTime
            ? `${orderRef.items[0].item_snapshot.cinemaName ? orderRef.items[0].item_snapshot.cinemaName + ' • ' : ''}${orderRef.items[0].item_snapshot.showTime}`
            : 'Suất chiếu tiêu chuẩn'),
        seatLabel: t.seat_label || orderRef?.items?.[0]?.item_snapshot?.seatCode || 'VIP',
        price: Number(t.price) || Number(orderRef?.items?.[0]?.unit_price) || 85000,
        status,
        createdAt: t.created_at || orderRef?.created_at || new Date().toISOString()
      });
    });

    // Also include any orders that had no individual tickets (e.g. food only or POS orders)
    (orders || []).forEach((o) => {
      if (!coveredOrderIds.has(o.id) && !coveredOrderIds.has(o.order_code)) {
        const isUsed = o.status === 'used';
        const isCancelled = o.status === 'cancelled';
        const status: 'used' | 'issued' | 'cancelled' = isUsed ? 'used' : isCancelled ? 'cancelled' : 'issued';

        const foodNames = o.items
          ?.filter((i) => i.item_type === 'product')
          .map((i) => i.item_snapshot?.productName || 'Bắp nước')
          .join(', ');
        const ticketItems = o.items?.filter((i) => i.item_type === 'ticket') || [];
        const seatStr = ticketItems.map((i) => i.item_snapshot?.seatCode).filter(Boolean).join(', ');

        list.push({
          key: `order-${o.id}`,
          ticketId: undefined,
          qrToken: o.order_code,
          orderCode: o.order_code || `#${o.id.slice(0, 8)}`,
          orderId: o.id,
          channel: o.channel || 'pos',
          customerName: o.contact_name || 'Khách vãng lai',
          customerPhone: o.contact_phone || undefined,
          customerEmail: o.contact_email || undefined,
          movieTitle: ticketItems[0]?.item_snapshot?.movieTitle || (foodNames ? `Combo: ${foodNames}` : 'Đơn hàng POS'),
          roomShowtime: ticketItems[0]?.item_snapshot?.showTime || 'Tại quầy',
          seatLabel: seatStr || (foodNames ? 'F&B' : 'Quầy'),
          price: Number(o.total_amount) || Number(o.subtotal) || 85000,
          status,
          createdAt: o.created_at || new Date().toISOString()
        });
      }
    });

    return list;
  }, [tickets, orders]);

  // Invoice issue modal
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRequest | null>(null);
  const [invoiceRefInput, setInvoiceRefInput] = useState('');

  const handleIssueInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || !invoiceRefInput.trim()) return;

    try {
      await onIssueInvoice(activeInvoice.id, invoiceRefInput.trim());
      showToast(`Đã xuất hóa đơn VAT thành công với mã ${invoiceRefInput}!`);
      setActiveInvoice(null);
    } catch (err: any) {
      showToast('Lỗi xuất hóa đơn: ' + (err.message || 'Thử lại sau'));
    }
  };

  // Safe search & filters
  const term = searchTerm.trim().toLowerCase();

  const filteredMergedList = useMemo(() => {
    return mergedList.filter((item) => {
      // Search term
      if (term) {
        const matchQR = item.qrToken?.toLowerCase().includes(term);
        const matchTicket = item.ticketId?.toLowerCase().includes(term);
        const matchOrder = item.orderCode?.toLowerCase().includes(term);
        const matchName = item.customerName?.toLowerCase().includes(term);
        const matchPhone = item.customerPhone?.toLowerCase().includes(term);
        const matchMovie = item.movieTitle?.toLowerCase().includes(term);
        const matchSeat = item.seatLabel?.toLowerCase().includes(term);
        if (!matchQR && !matchTicket && !matchOrder && !matchName && !matchPhone && !matchMovie && !matchSeat) {
          return false;
        }
      }

      // Channel filter
      if (filterChannel === 'ONLINE' && item.channel !== 'online') return false;
      if (filterChannel === 'POS' && item.channel === 'online') return false;

      // Status filter
      if (filterStatus === 'ISSUED' && item.status !== 'issued') return false;
      if (filterStatus === 'USED' && item.status !== 'used') return false;
      if (filterStatus === 'CANCELLED' && item.status !== 'cancelled') return false;

      return true;
    });
  }, [mergedList, term, filterChannel, filterStatus]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (term) {
        const matchCode = o.order_code?.toLowerCase().includes(term);
        const matchName = o.contact_name?.toLowerCase().includes(term);
        const matchPhone = o.contact_phone?.toLowerCase().includes(term);
        const matchEmail = o.contact_email?.toLowerCase().includes(term);
        const matchItems = o.items?.some((i) =>
          i.item_snapshot?.movieTitle?.toLowerCase().includes(term) ||
          i.item_snapshot?.productName?.toLowerCase().includes(term)
        );
        if (!matchCode && !matchName && !matchPhone && !matchEmail && !matchItems) return false;
      }

      if (filterChannel === 'ONLINE' && o.channel !== 'online') return false;
      if (filterChannel === 'POS' && o.channel === 'online') return false;

      if (filterOrderStatus === 'PAID' && o.status !== 'paid') return false;
      if (filterOrderStatus === 'PENDING' && o.status !== 'pending') return false;
      if (filterOrderStatus === 'REFUNDED' && o.status !== 'refunded') return false;
      if (filterOrderStatus === 'CANCELLED' && o.status !== 'cancelled' && o.status !== 'expired') return false;

      return true;
    });
  }, [orders, term, filterChannel, filterOrderStatus]);

  const filteredRefunds = (refunds || []).filter((r) => {
    if (!term) return true;
    const matchOrder = r.order_id?.toLowerCase().includes(term);
    const matchReason = r.reason?.toLowerCase().includes(term);
    return matchOrder || matchReason;
  });

  const filteredInvoices = (invoices || []).filter((i) => {
    if (!term) return true;
    const matchCompany = i.company_name?.toLowerCase().includes(term);
    const matchTax = i.tax_code?.toLowerCase().includes(term);
    const matchEmail = i.email?.toLowerCase().includes(term);
    return matchCompany || matchTax || matchEmail;
  });

  // Safe formatting helper
  const formatMoney = (val: number | null | undefined) => {
    return (Number(val) || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const handleCopyQR = (qr: string) => {
    try {
      navigator.clipboard.writeText(qr);
      showToast(`Đã sao chép mã QR: ${qr}`);
    } catch {}
  };

  // Perform ticket check-in (single ticket or whole order)
  const executeCheckIn = async (item: MergedTicketOrderItem, checkAllOrder: boolean = false) => {
    try {
      setIsProcessingCheckin(true);
      const effectiveOperator = operatorName || 'Admin';

      // Find targets to check in
      const targets = checkAllOrder
        ? mergedList.filter((m) => m.orderCode === item.orderCode && m.status === 'issued')
        : [item];

      for (const target of targets) {
        if (onCheckInTicket) {
          await onCheckInTicket(target.qrToken, effectiveOperator, true);
        }
        setLocalCheckedInKeys((prev) => ({
          ...prev,
          [target.key]: true,
          [target.qrToken]: true,
          ...(target.ticketId ? { [target.ticketId]: true } : {})
        }));
      }

      // Also ensure local storage cinemax_user_tickets is updated
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('cinemax_user_tickets');
          if (stored) {
            const list = JSON.parse(stored);
            const updated = list.map((t: any) => {
              const match =
                t.bookingCode === item.orderCode ||
                t.bookingCode === item.qrToken ||
                item.qrToken.startsWith(t.bookingCode);
              if (match) {
                return { ...t, status: 'ĐÃ XEM', checkedInAt: new Date().toISOString() };
              }
              return t;
            });
            localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
            window.dispatchEvent(new Event('cinemax_data_updated'));
            window.dispatchEvent(new Event('storage'));
          }
        } catch {}
      }

      if (checkAllOrder && targets.length > 1) {
        showToast(`HỢP LỆ! Đã soát thành công tất cả ${targets.length} vé trong đơn ${item.orderCode}!`);
      } else {
        showToast(`HỢP LỆ! Đã soát vé thành công (Ghế ${item.seatLabel} - ${item.movieTitle})!`);
      }
      setActiveCheckinItem(null);
      setQuickScanCode('');
    } catch (err: any) {
      showToast('Lỗi soát vé: ' + (err.message || 'Thử lại'));
    } finally {
      setIsProcessingCheckin(false);
    }
  };

  // Quick scanner submit
  const handleQuickScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickScanCode.trim().toLowerCase();
    if (!code) {
      showToast('Vui lòng nhập hoặc quét mã vé / QR token!');
      return;
    }

    const found = mergedList.find(
      (m) =>
        m.qrToken.toLowerCase() === code ||
        m.qrToken.toLowerCase().includes(code) ||
        m.orderCode.toLowerCase() === code ||
        (m.ticketId && m.ticketId.toLowerCase().includes(code))
    );

    if (!found) {
      showToast('Không tìm thấy vé hoặc đơn hàng tương ứng với mã vừa quét!');
      return;
    }

    const isAlreadyUsed =
      Boolean(localCheckedInKeys[found.key]) ||
      Boolean(localCheckedInKeys[found.qrToken]) ||
      found.status === 'used';

    if (isAlreadyUsed) {
      showToast(`CẢNH BÁO: Vé (Ghế ${found.seatLabel} - Mã ${found.qrToken}) đã được soát trước đó!`);
      setActiveCheckinItem(found);
      return;
    }

    // Open verification modal
    setActiveCheckinItem(found);
    setAgeCheckConfirmed(true);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Bar: Sub Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {[
            {
              id: 'TICKETS',
              label: 'Tất Cả Vé',
              icon: TicketIcon,
              count: mergedList.length
            },
            {
              id: 'ORDERS',
              label: 'Tất Cả Đơn',
              icon: Receipt,
              count: (orders || []).length
            },
            {
              id: 'REFUNDS',
              label: 'Xử Lý Hoàn Tiền',
              icon: DollarSign,
              count: (refunds || []).filter((r) => r.status === 'pending').length
            },
            {
              id: 'INVOICES',
              label: 'Hóa Đơn VAT',
              icon: FileText,
              count: (invoices || []).filter((i) => i.status === 'pending').length
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E63845] text-white shadow-md'
                    : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                      isActive ? 'bg-white text-black' : 'bg-[#1F2739] text-[#8E9AAF]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Search inside View */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#8E9AAF]" />
          <input
            type="text"
            placeholder={
              subTab === 'TICKETS'
                ? 'Tìm mã vé, QR, mã đơn, khách hàng, SĐT, phim...'
                : subTab === 'ORDERS'
                ? 'Tìm mã đơn hàng, khách hàng, SĐT, tên phim...'
                : subTab === 'REFUNDS'
                ? 'Tìm mã đơn hoàn, lý do...'
                : 'Tìm MST, công ty, email...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#171D2B] border border-[#253045] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#5C677D] focus:outline-none focus:border-[#E63845]"
          />
        </div>
      </div>

      {/* TAB 1: ALL TICKETS (TẤT CẢ VÉ & CỔNG SOÁT VÉ) */}
      {subTab === 'TICKETS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3.5">
          {/* Top Control Bar: Title, Counts, Quick Filters, Revenue */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#222B3D] pb-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Danh Sách Tất Cả Vé</span>
                <span className="px-2 py-0.5 rounded-full bg-[#E63845]/15 text-[#E63845] font-black text-[10px]">
                  Tổng hợp {filteredMergedList.length} vé
                </span>
              </div>
              <p className="text-[11px] text-[#8E9AAF] mt-0.5">
                Hiển thị chi tiết từng chiếc vé xem phim, mã QR, ghế ngồi và cổng soát vé trực tiếp vào rạp
              </p>
            </div>

            {/* Quick Filters for Status & Channel */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Channel filter */}
              <div className="flex items-center bg-[#171D2B] border border-[#253045] rounded-xl p-0.5 text-[11px]">
                <button
                  onClick={() => setFilterChannel('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterChannel === 'ALL' ? 'bg-[#253045] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Tất cả kênh
                </button>
                <button
                  onClick={() => setFilterChannel('ONLINE')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterChannel === 'ONLINE' ? 'bg-[#06B6D4] text-black shadow-sm font-black' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setFilterChannel('POS')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterChannel === 'POS' ? 'bg-[#FABF2E] text-black shadow-sm font-black' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Tại Quầy POS
                </button>
              </div>

              {/* Status filter */}
              <div className="flex items-center bg-[#171D2B] border border-[#253045] rounded-xl p-0.5 text-[11px]">
                <button
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterStatus === 'ALL' ? 'bg-[#253045] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Tất cả ({mergedList.length})
                </button>
                <button
                  onClick={() => setFilterStatus('ISSUED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterStatus === 'ISSUED' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Chờ soát ({mergedList.filter((i) => i.status === 'issued').length})
                </button>
                <button
                  onClick={() => setFilterStatus('USED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterStatus === 'USED' ? 'bg-[#22C55E] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Đã soát ({mergedList.filter((i) => i.status === 'used').length})
                </button>
              </div>

              {/* Revenue total */}
              <div className="bg-[#171D2B] border border-[#253045] px-3 py-1.5 rounded-xl text-right">
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Tổng tiền</span>
                <span className="font-mono font-bold text-[#22C55E] text-xs">
                  {formatMoney(
                    filteredMergedList.reduce((sum, item) => {
                      if (item.status !== 'cancelled') return sum + (Number(item.price) || 0);
                      return sum;
                    }, 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Ticket Soát Vé / Scan Bar */}
          <div className="bg-[#171D2B] border border-[#253045] rounded-2xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0">
                <ScanLine className="w-5 h-5 text-[#22C55E] animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">Cổng Soát Vé Nhanh (Scanner / Barcode / QR)</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#22C55E]/20 text-[#22C55E]">
                    TRỰC TIẾP TẠI BÀN
                  </span>
                </div>
                <p className="text-[10px] text-[#8E9AAF]">
                  Quét máy quét cầm tay hoặc dán mã QR / Mã đơn để xác thực & đổi trạng thái vé ngay tức thì
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickScanSubmit} className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <QrCode className="w-4 h-4 absolute left-3 top-2.5 text-[#FABF2E]" />
                <input
                  type="text"
                  placeholder="Quét mã QR, mã vé hoặc mã đơn..."
                  value={quickScanCode}
                  onChange={(e) => setQuickScanCode(e.target.value)}
                  className="w-full bg-[#121622] border border-[#2B374E] focus:border-[#22C55E] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-[#5C677D] focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#22C55E]/20 transition-all shrink-0 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Soát Vé</span>
              </button>
            </form>
          </div>

          {/* Unified Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222B3D] text-[#8E9AAF]">
                  <th className="py-2.5 px-3 font-bold">Mã Vé & QR Token</th>
                  <th className="py-2.5 px-3 font-bold">Mã Đơn / Kênh</th>
                  <th className="py-2.5 px-3 font-bold">Khách Hàng</th>
                  <th className="py-2.5 px-3 font-bold">Phim & Suất Chiếu & Ghế</th>
                  <th className="py-2.5 px-3 font-bold text-right">Giá Vé / Tiền</th>
                  <th className="py-2.5 px-3 font-bold text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 font-bold">Thời Gian</th>
                  <th className="py-2.5 px-3 font-bold text-center">Thao Tác Soát Vé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D2536]">
                {filteredMergedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#8E9AAF]">
                      {searchTerm
                        ? 'Không tìm thấy vé hoặc đơn hàng nào phù hợp với từ khóa.'
                        : 'Chưa có dữ liệu vé hoặc đơn hàng nào.'}
                    </td>
                  </tr>
                ) : (
                  filteredMergedList.map((item) => {
                    const isUsed = item.status === 'used';
                    const isIssued = item.status === 'issued';

                    return (
                      <tr key={item.key} className="hover:bg-[#161C2A] transition-colors">
                        {/* 1. Mã Vé & QR Token */}
                        <td className="py-3 px-3">
                          <div
                            onClick={() => handleCopyQR(item.qrToken)}
                            title="Bấm để sao chép mã QR"
                            className="font-mono font-bold text-white flex items-center gap-1.5 cursor-pointer group"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#FABF2E] shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-[150px] group-hover:text-[#FABF2E] transition-colors">
                              {item.qrToken}
                            </span>
                            <Copy className="w-3 h-3 text-[#5C677D] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[10px] text-[#5C677D] font-mono mt-0.5">
                            {item.ticketId ? `Mã vé: ${item.ticketId.slice(0, 18)}` : `Mã đơn: ${item.orderCode}`}
                          </div>
                        </td>

                        {/* 2. Mã Đơn & Kênh */}
                        <td className="py-3 px-3">
                          <div className="font-mono text-white font-medium">
                            {item.orderCode}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase mt-0.5 ${
                              item.channel === 'online'
                                ? 'bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30'
                                : 'bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30'
                            }`}
                          >
                            {item.channel === 'online' ? 'Đặt Online' : 'Tại Quầy POS'}
                          </span>
                        </td>

                        {/* 3. Khách Hàng */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <User className="w-3 h-3 text-[#8E9AAF] shrink-0" />
                            <span className="truncate max-w-[130px]">{item.customerName}</span>
                          </div>
                          <div className="text-[10px] text-[#8E9AAF] mt-0.5">
                            {item.customerPhone || item.customerEmail || 'Khách vãng lai'}
                          </div>
                        </td>

                        {/* 4. Phim & Suất Chiếu & Ghế */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-[#E63845] shrink-0" />
                            <span className="truncate max-w-[180px]">{item.movieTitle}</span>
                          </div>
                          <div className="text-[10px] text-[#8E9AAF] mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate max-w-[150px]">{item.roomShowtime}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 rounded bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30 font-bold font-mono text-[10px]">
                              Ghế {item.seatLabel}
                            </span>
                          </div>
                        </td>

                        {/* 5. Giá Vé / Tiền */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#22C55E]">
                          {formatMoney(item.price)}
                        </td>

                        {/* 6. Trạng Thái */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                              isUsed
                                ? 'bg-[#22C55E]/15 text-[#22C55E]'
                                : isIssued
                                ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                                : 'bg-[#EF4444]/15 text-[#EF4444]'
                            }`}
                          >
                            {isUsed ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>ĐÃ SOÁT VÉ</span>
                              </>
                            ) : isIssued ? (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>CHỜ SOÁT</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3 h-3" />
                                <span>ĐÃ HỦY</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 7. Thời Gian */}
                        <td className="py-3 px-3 text-[#8E9AAF] text-[11px] whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>

                        {/* 8. Thao Tác Soát Vé Trực Tiếp */}
                        <td className="py-3 px-3 text-center">
                          {isUsed ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-[11px] font-bold">
                              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                              <span>Đã vào rạp</span>
                            </div>
                          ) : isIssued ? (
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => executeCheckIn(item, false)}
                                disabled={isProcessingCheckin}
                                className="px-3 py-1.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-black font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-[#22C55E]/20 active:scale-95 disabled:opacity-50"
                                title={`Soát vé trực tiếp (Ghế ${item.seatLabel})`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Soát vé</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveCheckinItem(item);
                                  setAgeCheckConfirmed(true);
                                }}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#8E9AAF] hover:text-white transition-all cursor-pointer"
                                title="Xem chi tiết & soát vé đầy đủ"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#EF4444] font-medium">Đã hủy</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL ORDERS (TẤT CẢ ĐƠN HÀNG) */}
      {subTab === 'ORDERS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3.5">
          {/* Top Control Bar: Title, Counts, Quick Filters, Revenue */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#222B3D] pb-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Danh Sách Tất Cả Đơn Hàng</span>
                <span className="px-2 py-0.5 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] font-black text-[10px]">
                  Tổng cộng {filteredOrders.length} đơn
                </span>
              </div>
              <p className="text-[11px] text-[#8E9AAF] mt-0.5">
                Quản lý chi tiết từng đơn hàng, kênh bán online / quầy POS, trạng thái thanh toán và doanh thu
              </p>
            </div>

            {/* Quick Filters for Channel & Order Status */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Channel filter */}
              <div className="flex items-center bg-[#171D2B] border border-[#253045] rounded-xl p-0.5 text-[11px]">
                <button
                  onClick={() => setFilterChannel('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterChannel === 'ALL' ? 'bg-[#253045] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Tất cả kênh
                </button>
                <button
                  onClick={() => setFilterChannel('ONLINE')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterChannel === 'ONLINE' ? 'bg-[#06B6D4] text-black shadow-sm font-black' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setFilterChannel('POS')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterChannel === 'POS' ? 'bg-[#FABF2E] text-black shadow-sm font-black' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  POS
                </button>
              </div>

              {/* Order Status filter */}
              <div className="flex items-center bg-[#171D2B] border border-[#253045] rounded-xl p-0.5 text-[11px]">
                <button
                  onClick={() => setFilterOrderStatus('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterOrderStatus === 'ALL' ? 'bg-[#253045] text-white shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Tất cả ({orders.length})
                </button>
                <button
                  onClick={() => setFilterOrderStatus('PAID')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterOrderStatus === 'PAID' ? 'bg-[#22C55E] text-black font-black shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Đã thanh toán ({(orders || []).filter((o) => o.status === 'paid').length})
                </button>
                <button
                  onClick={() => setFilterOrderStatus('PENDING')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterOrderStatus === 'PENDING' ? 'bg-[#F59E0B] text-black font-black shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Chờ thanh toán ({(orders || []).filter((o) => o.status === 'pending').length})
                </button>
                <button
                  onClick={() => setFilterOrderStatus('REFUNDED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterOrderStatus === 'REFUNDED' ? 'bg-[#A855F7] text-white font-black shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Hoàn tiền ({(orders || []).filter((o) => o.status === 'refunded').length})
                </button>
                <button
                  onClick={() => setFilterOrderStatus('CANCELLED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterOrderStatus === 'CANCELLED' ? 'bg-[#EF4444] text-white font-black shadow-sm' : 'text-[#8E9AAF] hover:text-white'
                  }`}
                >
                  Đã hủy ({(orders || []).filter((o) => o.status === 'cancelled' || o.status === 'expired').length})
                </button>
              </div>

              {/* Total revenue */}
              <div className="bg-[#171D2B] border border-[#253045] px-3 py-1.5 rounded-xl text-right">
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Tổng doanh thu</span>
                <span className="font-mono font-bold text-[#22C55E] text-xs">
                  {formatMoney(
                    filteredOrders.reduce((sum, o) => {
                      if (o.status === 'paid') return sum + (Number(o.total_amount) || 0);
                      return sum;
                    }, 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222B3D] text-[#8E9AAF]">
                  <th className="py-2.5 px-3 font-bold">Mã Đơn & Kênh</th>
                  <th className="py-2.5 px-3 font-bold">Khách Hàng</th>
                  <th className="py-2.5 px-3 font-bold">Chi Tiết Đơn Hàng</th>
                  <th className="py-2.5 px-3 font-bold text-right">Tổng Tiền Đơn</th>
                  <th className="py-2.5 px-3 font-bold text-center">Phương Thức</th>
                  <th className="py-2.5 px-3 font-bold text-center">Trạng Thái Thanh Toán</th>
                  <th className="py-2.5 px-3 font-bold">Thời Gian Tạo</th>
                  <th className="py-2.5 px-3 font-bold text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D2536]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#8E9AAF]">
                      {searchTerm ? 'Không tìm thấy đơn hàng nào phù hợp với từ khóa.' : 'Chưa có đơn hàng nào.'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const ticketCount = (order.items || []).filter((i) => i.item_type === 'ticket').length;
                    const productCount = (order.items || []).filter((i) => i.item_type === 'product').length;
                    const firstMovie = (order.items || []).find((i) => i.item_type === 'ticket')?.item_snapshot?.movieTitle;
                    const seats = (order.items || [])
                      .filter((i) => i.item_type === 'ticket')
                      .map((i) => i.item_snapshot?.seatCode)
                      .filter(Boolean)
                      .join(', ');

                    const isPaid = order.status === 'paid';
                    const isPending = order.status === 'pending';
                    const isRefunded = order.status === 'refunded';

                    return (
                      <tr key={order.id} className="hover:bg-[#161C2A] transition-colors">
                        {/* 1. Mã đơn & Kênh */}
                        <td className="py-3 px-3">
                          <div
                            onClick={() => {
                              navigator.clipboard.writeText(order.order_code);
                              showToast(`Đã sao chép mã đơn: ${order.order_code}`);
                            }}
                            className="font-mono font-bold text-white flex items-center gap-1.5 cursor-pointer group"
                            title="Bấm để sao chép mã đơn"
                          >
                            <Receipt className="w-3.5 h-3.5 text-[#FABF2E] shrink-0" />
                            <span className="group-hover:text-[#FABF2E] transition-colors">{order.order_code}</span>
                            <Copy className="w-3 h-3 text-[#5C677D] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase mt-1 ${
                              order.channel === 'online'
                                ? 'bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30'
                                : 'bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30'
                            }`}
                          >
                            {order.channel === 'online' ? 'Đặt Online' : 'Tại Quầy POS'}
                          </span>
                        </td>

                        {/* 2. Khách Hàng */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <User className="w-3 h-3 text-[#8E9AAF] shrink-0" />
                            <span className="truncate max-w-[130px]">{order.contact_name || 'Khách vãng lai'}</span>
                          </div>
                          <div className="text-[10px] text-[#8E9AAF] mt-0.5">
                            {order.contact_phone || order.contact_email || '—'}
                          </div>
                        </td>

                        {/* 3. Chi Tiết Đơn */}
                        <td className="py-3 px-3">
                          {firstMovie ? (
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <Film className="w-3.5 h-3.5 text-[#E63845] shrink-0" />
                              <span className="truncate max-w-[180px]">{firstMovie}</span>
                            </div>
                          ) : (
                            <div className="font-medium text-white">Đơn hàng bắp nước / F&B</div>
                          )}
                          <div className="text-[10px] text-[#8E9AAF] mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {ticketCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-white font-mono">
                                {ticketCount} vé {seats ? `(${seats})` : ''}
                              </span>
                            )}
                            {productCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-[#FABF2E]/10 text-[#FABF2E] border border-[#FABF2E]/20">
                                {productCount} món F&B
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Tổng Tiền */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-mono font-bold text-[#22C55E] text-xs">
                            {formatMoney(order.total_amount)}
                          </div>
                          {order.discount_amount > 0 && (
                            <div className="text-[10px] text-[#EF4444] font-mono">
                              - {formatMoney(order.discount_amount)}
                            </div>
                          )}
                        </td>

                        {/* 5. Phương Thức */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-white/5 border border-white/10 text-white">
                            {order.channel === 'online' ? 'VNPAY / QR' : 'Tiền mặt POS'}
                          </span>
                        </td>

                        {/* 6. Trạng Thái Thanh Toán */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                              isPaid
                                ? 'bg-[#22C55E]/15 text-[#22C55E]'
                                : isPending
                                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                : isRefunded
                                ? 'bg-[#A855F7]/15 text-[#A855F7]'
                                : 'bg-[#EF4444]/15 text-[#EF4444]'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>ĐÃ THANH TOÁN</span>
                              </>
                            ) : isPending ? (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>CHỜ THANH TOÁN</span>
                              </>
                            ) : isRefunded ? (
                              <>
                                <DollarSign className="w-3 h-3" />
                                <span>ĐÃ HOÀN TIỀN</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3 h-3" />
                                <span>ĐÃ HỦY</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 7. Thời Gian */}
                        <td className="py-3 px-3 text-[#8E9AAF] text-[11px] whitespace-nowrap">
                          {formatDate(order.created_at)}
                        </td>

                        {/* 8. Thao Tác */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setActiveOrderDetail(order)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#8E9AAF] hover:text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                            title="Xem chi tiết đơn hàng"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REFUNDS CENTER */}
      {subTab === 'REFUNDS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-3 text-xs">
            <div>
              <span className="font-bold text-white text-sm">Xử Lý Yêu Cầu Hoàn Tiền</span>
              <p className="text-[11px] text-[#8E9AAF] mt-0.5">
                {(refunds || []).filter((r) => r.status === 'pending').length} yêu cầu đang chờ phê duyệt
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {filteredRefunds.length === 0 ? (
              <div className="p-8 text-center text-[#8E9AAF] text-xs">Không có yêu cầu hoàn tiền nào cần xử lý.</div>
            ) : (
              filteredRefunds.map((refund) => (
                <div
                  key={refund.id}
                  className="p-4 rounded-2xl bg-[#161D2B] border border-[#253045] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">ĐƠN #{refund.order_id ? refund.order_id.slice(0, 8) : '—'}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#E63845]/20 text-[#E63845] uppercase">
                        {refund.refund_type || 'TICKET'}
                      </span>
                    </div>
                    <div className="text-[#8E9AAF]">Lý do: <strong className="text-white">{refund.reason || 'Khách yêu cầu hủy vé'}</strong></div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-[#8E9AAF] uppercase block">Số tiền hoàn</span>
                      <span className="font-mono font-bold text-[#EF4444] text-sm">
                        {formatMoney(refund.amount)}
                      </span>
                    </div>

                    {refund.status === 'pending' ? (
                      <button
                        onClick={() => onApproveRefund(refund.id)}
                        className="px-3.5 py-2 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-bold text-xs cursor-pointer shadow-md transition-all"
                      >
                        Duyệt Hoàn Tiền
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E]">
                        ĐÃ DUYỆT
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VAT INVOICE REQUESTS */}
      {subTab === 'INVOICES' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-3 text-xs">
            <div>
              <span className="font-bold text-white text-sm">Yêu Cầu Xuất Hóa Đơn VAT Doanh Nghiệp</span>
              <p className="text-[11px] text-[#8E9AAF] mt-0.5">
                {(invoices || []).filter((i) => i.status === 'pending').length} hóa đơn đang chờ xuất
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-[#8E9AAF] text-xs">Chưa có yêu cầu xuất hóa đơn VAT nào.</div>
            ) : (
              filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-2xl bg-[#161D2B] border border-[#253045] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-white text-sm">{inv.company_name || 'Công ty TNHH'}</div>
                    <div className="text-[11px] text-[#8E9AAF]">
                      MST: <strong className="text-[#FABF2E] font-mono">{inv.tax_code || '—'}</strong> • Email: {inv.email || '—'}
                    </div>
                    <div className="text-[10px] text-[#5C677D]">{inv.address || '—'}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {inv.status === 'issued' ? (
                      <span className="text-xs text-[#22C55E] font-bold flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mã HĐ: {inv.invoice_ref}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveInvoice(inv);
                          setInvoiceRefInput('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black text-xs cursor-pointer shadow-md transition-all"
                      >
                        Nhập Mã Hóa Đơn
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Issue Invoice */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base">Xác Nhận Xuất Hóa Đơn VAT</h3>
              <button onClick={() => setActiveInvoice(null)} className="text-[#8E9AAF] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueInvoiceSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#171D2B] space-y-1">
                <div className="font-bold text-white">{activeInvoice.company_name}</div>
                <div className="text-[#FABF2E] font-mono">MST: {activeInvoice.tax_code}</div>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Mã tra cứu hóa đơn điện tử *</label>
                <input
                  type="text"
                  required
                  placeholder="Vd: 1C24TBB-008129"
                  value={invoiceRefInput}
                  onChange={(e) => setInvoiceRefInput(e.target.value)}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#FABF2E]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black cursor-pointer shadow-md"
                >
                  Xác Nhận Đã Xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Check-in Verification (Soát Vé Trực Tiếp) */}
      {activeCheckinItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center">
                  <ScanLine className="w-4 h-4 text-[#22C55E]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Xác Thực & Soát Vé</h3>
                  <span className="text-[10px] text-[#8E9AAF] font-mono">Mã: {activeCheckinItem.qrToken}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveCheckinItem(null)}
                className="text-[#8E9AAF] hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Validation Banner */}
            {activeCheckinItem.status === 'used' ||
            localCheckedInKeys[activeCheckinItem.key] ||
            localCheckedInKeys[activeCheckinItem.qrToken] ? (
              <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center gap-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div className="text-xs">
                  <strong className="block font-black text-sm">CẢNH BÁO: VÉ ĐÃ ĐƯỢC SOÁT VÉ!</strong>
                  <span>Vé (Ghế {activeCheckinItem.seatLabel}) đã được sử dụng vào rạp trước đó. Không cho phép vào lại trừ khi có chỉ đạo quản lý.</span>
                </div>
              </div>
            ) : activeCheckinItem.status === 'cancelled' ? (
              <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center gap-3">
                <Ban className="w-6 h-6 shrink-0" />
                <div className="text-xs">
                  <strong className="block font-black text-sm">VÉ ĐÃ BỊ HỦY / HOÀN TIỀN</strong>
                  <span>Vé này đã bị hủy hoặc hoàn tiền. Khách hàng không đủ điều kiện vào phòng chiếu.</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div className="text-xs">
                  <strong className="block font-black text-sm">VÉ HỢP LỆ — SẴN SÀNG VÀO RẠP</strong>
                  <span>Mã vé và suất chiếu trùng khớp. Vui lòng kiểm tra thông tin khách và ghế ngồi bên dưới.</span>
                </div>
              </div>
            )}

            {/* Ticket & Screening Details */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#171D2B] p-3.5 rounded-2xl border border-[#253045]">
              <div className="col-span-2 space-y-1 border-b border-[#222B3D] pb-2.5">
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Tên Phim</span>
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#E63845] shrink-0" />
                  <span>{activeCheckinItem.movieTitle}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Suất Chiếu & Phòng</span>
                <span className="font-bold text-white">{activeCheckinItem.roomShowtime}</span>
              </div>

              <div>
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Số Ghế Ngồi</span>
                <span className="px-2 py-0.5 rounded bg-[#FABF2E]/20 text-[#FABF2E] font-mono font-black text-sm border border-[#FABF2E]/30 inline-block">
                  Ghế {activeCheckinItem.seatLabel}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Khách Hàng</span>
                <span className="font-bold text-white">{activeCheckinItem.customerName}</span>
                <div className="text-[10px] text-[#8E9AAF]">{activeCheckinItem.customerPhone || 'Không có SĐT'}</div>
              </div>

              <div>
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Mã Đơn / Kênh</span>
                <span className="font-mono text-white font-bold">{activeCheckinItem.orderCode}</span>
                <div className="text-[10px] text-[#06B6D4] font-medium">
                  {activeCheckinItem.channel === 'online' ? 'Đặt Online' : 'Tại quầy POS'}
                </div>
              </div>
            </div>

            {/* Age / Rule verification */}
            {activeCheckinItem.status === 'issued' && (
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#171D2B] border border-[#253045] cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={ageCheckConfirmed}
                  onChange={(e) => setAgeCheckConfirmed(e.target.checked)}
                  className="rounded border-[#253045] text-[#22C55E] focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span className="text-white">
                  Đã kiểm tra CCCD / độ tuổi khách hàng phù hợp quy định phân loại phim
                </span>
              </label>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveCheckinItem(null)}
                className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold text-xs cursor-pointer text-center"
              >
                Đóng
              </button>

              {activeCheckinItem.status === 'issued' &&
                !localCheckedInKeys[activeCheckinItem.key] &&
                !localCheckedInKeys[activeCheckinItem.qrToken] && (
                  <>
                    {/* Batch check-in if order has more than 1 pending ticket */}
                    {mergedList.filter((m) => m.orderCode === activeCheckinItem.orderCode && m.status === 'issued').length > 1 && (
                      <button
                        type="button"
                        disabled={isProcessingCheckin || !ageCheckConfirmed}
                        onClick={() => executeCheckIn(activeCheckinItem, true)}
                        className="px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white font-black text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          Soát Toàn Bộ Đơn ({mergedList.filter((m) => m.orderCode === activeCheckinItem.orderCode && m.status === 'issued').length} vé)
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isProcessingCheckin || !ageCheckConfirmed}
                      onClick={() => executeCheckIn(activeCheckinItem, false)}
                      className="px-5 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-50 text-black font-black text-xs cursor-pointer shadow-md shadow-[#22C55E]/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác Nhận Soát Vé (Ghế {activeCheckinItem.seatLabel})</span>
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Order Detail View (Chi Tiết Đơn Hàng) */}
      {activeOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Đơn Hàng #{activeOrderDetail.order_code}</h3>
                  <span className="text-[10px] text-[#8E9AAF]">
                    {formatDate(activeOrderDetail.created_at)} • Kênh: {activeOrderDetail.channel === 'online' ? 'Đặt Online' : 'Tại quầy POS'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveOrderDetail(null)}
                className="text-[#8E9AAF] hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer & Status Header */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#171D2B] p-3.5 rounded-2xl border border-[#253045]">
              <div>
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Khách Hàng</span>
                <span className="font-bold text-white text-sm">{activeOrderDetail.contact_name || 'Khách vãng lai'}</span>
                <div className="text-[10px] text-[#8E9AAF] mt-0.5">{activeOrderDetail.contact_phone || 'Không có SĐT'}</div>
                <div className="text-[10px] text-[#8E9AAF]">{activeOrderDetail.contact_email || ''}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#8E9AAF] uppercase block font-semibold">Trạng Thái Thanh Toán</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase mt-1 ${
                    activeOrderDetail.status === 'paid'
                      ? 'bg-[#22C55E]/15 text-[#22C55E]'
                      : activeOrderDetail.status === 'pending'
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                      : activeOrderDetail.status === 'refunded'
                      ? 'bg-[#A855F7]/15 text-[#A855F7]'
                      : 'bg-[#EF4444]/15 text-[#EF4444]'
                  }`}
                >
                  {activeOrderDetail.status === 'paid'
                    ? 'ĐÃ THANH TOÁN'
                    : activeOrderDetail.status === 'pending'
                    ? 'CHỜ THANH TOÁN'
                    : activeOrderDetail.status === 'refunded'
                    ? 'ĐÃ HOÀN TIỀN'
                    : 'ĐÃ HỦY'}
                </span>
                <div className="text-[10px] text-[#8E9AAF] font-mono mt-1">
                  Phương thức: {activeOrderDetail.channel === 'online' ? 'VNPAY / QR' : 'Tiền mặt POS'}
                </div>
              </div>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white block">Chi Tiết Các Mục Đã Đặt:</span>
              <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1.5 text-xs">
                {(activeOrderDetail.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#171D2B] border border-[#253045]"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {item.item_type === 'ticket' ? (
                          <Film className="w-3.5 h-3.5 text-[#E63845]" />
                        ) : (
                          <Receipt className="w-3.5 h-3.5 text-[#FABF2E]" />
                        )}
                        <span>{item.item_snapshot?.movieTitle || item.item_snapshot?.productName || 'Mục đơn hàng'}</span>
                      </div>
                      <div className="text-[10px] text-[#8E9AAF] mt-0.5">
                        {item.item_type === 'ticket'
                          ? `Ghế ${item.item_snapshot?.seatCode || '—'} • ${item.item_snapshot?.showTime || ''}`
                          : `Số lượng: ${item.quantity || 1}`}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white text-right">
                      {formatMoney(item.line_total || item.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border-t border-[#222B3D] pt-3 text-xs space-y-1.5">
              <div className="flex justify-between text-[#8E9AAF]">
                <span>Tạm tính</span>
                <span className="font-mono">{formatMoney(activeOrderDetail.subtotal || activeOrderDetail.total_amount)}</span>
              </div>
              {activeOrderDetail.discount_amount > 0 && (
                <div className="flex justify-between text-[#EF4444]">
                  <span>Giảm giá / Khuyến mãi</span>
                  <span className="font-mono">- {formatMoney(activeOrderDetail.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-[#222B3D]">
                <span>Tổng Thanh Toán</span>
                <span className="font-mono text-[#22C55E] text-base">{formatMoney(activeOrderDetail.total_amount)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveOrderDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
