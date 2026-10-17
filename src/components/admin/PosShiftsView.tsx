'use client';

import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Plus,
  Search,
  Armchair,
  Coffee,
  Ticket,
  Building2,
  X,
  FileText,
  Printer,
  QrCode,
  Users,
  Film,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Shift, Showtime, Seat, Product, Order } from '@/lib/types-redesign';

export type AudienceType = 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR';

export const AUDIENCE_CONFIG: Record<AudienceType, { label: string; discountPercent: number }> = {
  ADULT: { label: 'Người lớn', discountPercent: 0 },
  STUDENT_U22: { label: 'HSSV (-20%)', discountPercent: 20 },
  CHILD: { label: 'Trẻ em (-30%)', discountPercent: 30 },
  SENIOR: { label: 'Cao tuổi (-25%)', discountPercent: 25 },
};

export const POPCORN_FLAVORS = ['Vị Ngọt', 'Vị Phô Mai', 'Vị Caramel'];
export const DRINK_OPTIONS = ['Coca (M)', 'Coca (L +10K)', 'Pepsi (L)'];

interface PosShiftsViewProps {
  shifts: Shift[];
  showtimes: Showtime[];
  seats: Seat[];
  products: Product[];
  currentOperator: { id: string; name: string };
  onOpenShift: (staffId: string, posTerminal: string, openingCash: number) => Promise<void>;
  onCloseShift: (shiftId: string, countedCash: number, varianceReason?: string) => Promise<void>;
  onApproveShift: (shiftId: string, supervisorId: string) => Promise<void>;
  onSaleComplete?: (saleData: any) => void;
  showToast: (msg: string) => void;
}

// Couple partner seat pairing logic
function getCouplePartnerSeat(seatCode: string): string | null {
  if (seatCode.charAt(0) !== 'H') return null;
  const col = parseInt(seatCode.slice(1), 10);
  if (isNaN(col)) return null;
  return `H${col % 2 === 1 ? col + 1 : col - 1}`;
}

// Orphan seat detection
function detectOrphanSeats(
  selectedSeatLabels: string[],
  soldSeatLabels: string[],
  blockedSeatLabels: string[]
): string | null {
  const SEAT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const blocked = new Set([...soldSeatLabels, ...blockedSeatLabels]);
  const selectedSet = new Set(selectedSeatLabels);

  for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    if (!SEAT_COLS.some((c) => selectedSet.has(`${row}${c}`))) continue;
    const state = SEAT_COLS.map((c) =>
      blocked.has(`${row}${c}`) || selectedSet.has(`${row}${c}`) ? 'OCCUPIED' : 'EMPTY'
    );
    for (let i = 0; i < SEAT_COLS.length; i++) {
      if (state[i] === 'EMPTY') {
        const leftOccupied = i === 0 || state[i - 1] === 'OCCUPIED';
        const rightOccupied = i === SEAT_COLS.length - 1 || state[i + 1] === 'OCCUPIED';
        const touchesSelection =
          (i > 0 && selectedSet.has(`${row}${SEAT_COLS[i - 1]}`)) ||
          (i < SEAT_COLS.length - 1 && selectedSet.has(`${row}${SEAT_COLS[i + 1]}`));
        if (leftOccupied && rightOccupied && touchesSelection) {
          return `Cảnh báo: Không được để trống 1 ghế đơn độc (${row}${SEAT_COLS[i]}) cạnh ghế đang chọn!`;
        }
      }
    }
  }
  return null;
}

export default function PosShiftsView({
  shifts,
  showtimes,
  seats,
  products,
  currentOperator,
  onOpenShift,
  onCloseShift,
  onApproveShift,
  onSaleComplete,
  showToast
}: PosShiftsViewProps) {
  const [activeTab, setActiveTab] = useState<'SHIFTS' | 'POS_TERMINAL'>('POS_TERMINAL');
  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [closeModalShift, setCloseModalShift] = useState<Shift | null>(null);

  // Open Shift Form
  const [openForm, setOpenForm] = useState({
    pos_terminal: 'POS-01',
    opening_cash: 2000000
  });

  // Close Shift Form
  const [countedCash, setCountedCash] = useState<number>(0);
  const [varianceReason, setVarianceReason] = useState<string>('');

  // POS Quick Terminal State
  const [posDateFilter, setPosDateFilter] = useState<'today' | 'tomorrow' | 'all'>('today');
  const [selectedAudienceType, setSelectedAudienceType] = useState<AudienceType>('ADULT');
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string>(showtimes[0]?.id || '');
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedProductCounts, setSelectedProductCounts] = useState<Record<string, number>>({});
  const [productModifiers, setProductModifiers] = useState<
    Record<string, { flavor: string; drinkSize: string }>
  >({});
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VIETQR' | 'CARD'>('CASH');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Receipt Preview Modal
  const [receiptData, setReceiptData] = useState<{
    invoiceNo: string;
    movieTitle: string;
    auditoriumName: string;
    format: string;
    startsAt: string;
    seats: { label: string; price: number; type: string }[];
    foods: { name: string; qty: number; price: number; flavor?: string; drinkSize?: string }[];
    total: number;
    cashTendered: number;
    change: number;
    paymentMethod: string;
    audienceType: string;
    operatorName: string;
    timestamp: string;
  } | null>(null);

  const [thermalQrDataUrl, setThermalQrDataUrl] = useState('');

  const activeShift = shifts.find((s) => s.status === 'open');

  // Filter showtimes by date
  const filteredShowtimes = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

    return showtimes.filter((st) => {
      const stDate = st.starts_at ? st.starts_at.slice(0, 10) : todayStr;
      if (posDateFilter === 'today') return stDate === todayStr;
      if (posDateFilter === 'tomorrow') return stDate === tomorrowStr;
      return true;
    });
  }, [showtimes, posDateFilter]);

  // Selected showtime and real seats
  const selectedShowtime =
    filteredShowtimes.find((st) => st.id === selectedShowtimeId) ||
    showtimes.find((st) => st.id === selectedShowtimeId) ||
    filteredShowtimes[0] ||
    showtimes[0];

  const roomSeats = useMemo(() => {
    return seats.filter((s) => s.auditorium_id === selectedShowtime?.auditorium_id);
  }, [seats, selectedShowtime]);

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Handle open shift submit
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onOpenShift(currentOperator.id, openForm.pos_terminal, Number(openForm.opening_cash));
      showToast(`Đã mở ca trực thành công tại quầy ${openForm.pos_terminal}!`);
      setOpenModalVisible(false);
    } catch (err: any) {
      showToast('Lỗi mở ca: ' + (err.message || 'Thử lại'));
    }
  };

  // Handle close shift submit
  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeModalShift) return;

    const variance = countedCash - closeModalShift.expected_cash;
    if (variance !== 0 && !varianceReason.trim()) {
      showToast('Có chênh lệch tiền két! Bắt buộc nhập lý do giải trình.');
      return;
    }

    try {
      await onCloseShift(closeModalShift.id, countedCash, varianceReason);
      showToast('Đã nộp biên bản chốt ca thành công! Đang chờ Quản lý duyệt.');
      setCloseModalShift(null);
    } catch (err: any) {
      showToast('Lỗi chốt ca: ' + (err.message || 'Thử lại'));
    }
  };

  // Generate QR code for receipt modal
  useEffect(() => {
    if (!receiptData) {
      setThermalQrDataUrl('');
      return;
    }
    QRCode.toDataURL(receiptData.invoiceNo, {
      width: 180,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then((url) => setThermalQrDataUrl(url))
      .catch(() => setThermalQrDataUrl(''));
  }, [receiptData]);

  // Calculate ticket pricing based on audience discount & real seat types
  const selectedSeatObjects = roomSeats.filter((s) => selectedSeatIds.includes(s.id));

  const getSeatUnitPrice = (s: Seat) => {
    const base = s.seat_type === 'VIP' ? 105000 : s.seat_type === 'COUPLE' ? 210000 : 85000;
    const discount = AUDIENCE_CONFIG[selectedAudienceType].discountPercent;
    return Math.round((base * (100 - discount)) / 100);
  };

  const ticketSubtotal = selectedSeatObjects.reduce((sum, s) => sum + getSeatUnitPrice(s), 0);

  const foodSubtotal = Object.entries(selectedProductCounts).reduce((sum, [pid, qty]) => {
    const prod = products.find((p) => p.id === pid);
    const mod = productModifiers[pid];
    const extra = mod?.drinkSize?.includes('+10K') ? 10000 : 0;
    return sum + (prod ? (prod.base_price + extra) * qty : 0);
  }, 0);

  const totalAmount = ticketSubtotal + foodSubtotal;
  const changeAmount =
    paymentMethod === 'CASH' && cashTendered > 0 ? Math.max(0, cashTendered - totalAmount) : 0;

  // Orphan seat check
  const orphanWarning = useMemo(() => {
    const selectedLabels = selectedSeatObjects.map((s) => `${s.row_label}${s.seat_number}`);
    const blockedLabels = roomSeats
      .filter((s) => s.status === 'BLOCKED')
      .map((s) => `${s.row_label}${s.seat_number}`);
    return detectOrphanSeats(selectedLabels, [], blockedLabels);
  }, [selectedSeatObjects, roomSeats]);

  // Handle seat toggle with couple pair logic
  const handleToggleSeat = (seat: Seat) => {
    if (seat.status === 'BLOCKED') return;

    const seatCode = `${seat.row_label}${seat.seat_number}`;
    const partnerCode = getCouplePartnerSeat(seatCode);

    if (partnerCode) {
      // Find partner seat in roomSeats
      const partnerSeat = roomSeats.find(
        (s) => `${s.row_label}${s.seat_number}` === partnerCode && s.status !== 'BLOCKED'
      );

      if (partnerSeat) {
        setSelectedSeatIds((prev) => {
          const isSelected = prev.includes(seat.id);
          if (isSelected) {
            return prev.filter((id) => id !== seat.id && id !== partnerSeat.id);
          } else {
            return Array.from(new Set([...prev, seat.id, partnerSeat.id]));
          }
        });
        return;
      }
    }

    setSelectedSeatIds((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]
    );
  };

  // Adjust food quantity & default modifiers
  const handleAdjustFood = (productId: string, delta: number) => {
    setSelectedProductCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + delta)
    }));

    if (!productModifiers[productId]) {
      setProductModifiers((prev) => ({
        ...prev,
        [productId]: { flavor: POPCORN_FLAVORS[0], drinkSize: DRINK_OPTIONS[0] }
      }));
    }
  };

  const handleCompleteSale = () => {
    if (selectedSeatIds.length === 0 && foodSubtotal === 0) {
      showToast('Vui lòng chọn ít nhất 1 ghế hoặc 1 món bắp nước!');
      return;
    }
    if (!activeShift && paymentMethod === 'CASH') {
      showToast('Cần mở ca trực tiền mặt trước khi thực hiện bán hàng tại quầy!');
      return;
    }
    if (orphanWarning) {
      showToast(orphanWarning);
      return;
    }

    setIsProcessingSale(true);
    setTimeout(() => {
      // Build invoice details
      const invoiceNo = 'POS-' + Math.floor(100000 + Math.random() * 900000);
      const foodItems = Object.entries(selectedProductCounts)
        .filter(([_, qty]) => qty > 0)
        .map(([pid, qty]) => {
          const prod = products.find((p) => p.id === pid);
          const mod = productModifiers[pid] || {
            flavor: POPCORN_FLAVORS[0],
            drinkSize: DRINK_OPTIONS[0]
          };
          const extra = mod.drinkSize.includes('+10K') ? 10000 : 0;
          return {
            name: prod?.name || 'F&B Concession',
            qty,
            price: ((prod?.base_price || 0) + extra) * qty,
            flavor: mod.flavor,
            drinkSize: mod.drinkSize,
            productUuid: prod?.id
          };
        });

      const seatItems = selectedSeatObjects.map((s) => ({
        label: `${s.row_label}${s.seat_number}`,
        price: getSeatUnitPrice(s),
        type: s.seat_type
      }));

      // Update shift expected cash if CASH
      if (activeShift && paymentMethod === 'CASH') {
        activeShift.expected_cash += totalAmount;
      }

      if (onSaleComplete && selectedShowtime) {
        onSaleComplete({
          total: totalAmount,
          showtime: selectedShowtime,
          seats: seatItems,
          foods: foodItems,
          audienceType: selectedAudienceType,
          paymentMethod,
          operatorName: currentOperator.name,
          customerPhone
        });
      }

      setReceiptData({
        invoiceNo,
        movieTitle: selectedShowtime?.movie?.title || 'Phim Chiếu Rạp CINEMAX',
        auditoriumName: selectedShowtime?.auditorium?.name || 'Phòng 1',
        format: selectedShowtime?.format || '2D',
        startsAt: selectedShowtime?.starts_at || new Date().toISOString(),
        seats: seatItems,
        foods: foodItems,
        total: totalAmount,
        cashTendered: cashTendered > 0 ? cashTendered : totalAmount,
        change: changeAmount,
        paymentMethod,
        audienceType: AUDIENCE_CONFIG[selectedAudienceType].label,
        operatorName: currentOperator.name,
        timestamp: new Date().toLocaleString('vi-VN')
      });

      showToast(`ĐÃ XUẤT VÉ THÀNH CÔNG! Đơn #${invoiceNo} (${totalAmount.toLocaleString('vi-VN')} đ)`);
      setSelectedSeatIds([]);
      setSelectedProductCounts({});
      setCustomerPhone('');
      setCashTendered(0);
      setIsProcessingSale(false);
    }, 400);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Compact Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-3">
        {/* Mode Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveTab('POS_TERMINAL')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'POS_TERMINAL'
                ? 'bg-[#22C55E] text-black shadow-md shadow-[#22C55E]/20'
                : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Màn Hình Bán Vé Tại Quầy (POS Terminal)</span>
          </button>

          <button
            onClick={() => setActiveTab('SHIFTS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'SHIFTS'
                ? 'bg-[#22C55E] text-black shadow-md shadow-[#22C55E]/20'
                : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Lịch Sử Ca & Bàn Giao Két Tiền</span>
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          {activeShift ? (
            <button
              onClick={() => {
                setCloseModalShift(activeShift);
                setCountedCash(activeShift.expected_cash);
                setVarianceReason('');
              }}
              className="px-3.5 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Chốt Ca ({activeShift.pos_terminal})</span>
            </button>
          ) : (
            <button
              onClick={() => setOpenModalVisible(true)}
              className="px-3.5 py-2 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black text-xs font-black shadow-md shadow-[#22C55E]/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Mở Ca Trực Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: POS QUICK TERMINAL */}
      {activeTab === 'POS_TERMINAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (8/12): Showtime, Audience Type, Seat Map & F&B Selection */}
          <div className="lg:col-span-8 space-y-4">
            {/* Active Shift Top Strip */}
            {activeShift ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#17261F] to-[#121B17] border border-[#235C3A] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
                  <span className="text-white font-bold">
                    Quầy đang mở: <strong className="text-[#22C55E] font-mono">{activeShift.pos_terminal}</strong> • Thu ngân: {currentOperator.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#8E9AAF] mr-2">Két sổ sách:</span>
                  <span className="font-mono font-black text-[#22C55E] text-sm">
                    {activeShift.expected_cash.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#1F1718] border border-[#422C1D] flex items-center justify-between text-xs text-[#FABF2E]">
                <span>Chưa mở ca trực trên máy này. Bấm "Mở Ca Trực Mới" trước khi bán vé tiền mặt.</span>
                <button
                  onClick={() => setOpenModalVisible(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#FABF2E] text-black font-bold cursor-pointer"
                >
                  Mở Ca Ngay
                </button>
              </div>
            )}

            {/* Date Tabs & Showtime Selector */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#FABF2E]" />
                  <span>Chọn Suất Chiếu Bán Quầy</span>
                </label>

                <div className="flex items-center gap-1.5 bg-[#171D2B] p-1 rounded-xl border border-[#253045]">
                  <button
                    onClick={() => setPosDateFilter('today')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      posDateFilter === 'today' ? 'bg-[#22C55E] text-black' : 'text-[#8E9AAF] hover:text-white'
                    }`}
                  >
                    Hôm Nay
                  </button>
                  <button
                    onClick={() => setPosDateFilter('tomorrow')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      posDateFilter === 'tomorrow' ? 'bg-[#22C55E] text-black' : 'text-[#8E9AAF] hover:text-white'
                    }`}
                  >
                    Ngày Mai
                  </button>
                  <button
                    onClick={() => setPosDateFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      posDateFilter === 'all' ? 'bg-[#22C55E] text-black' : 'text-[#8E9AAF] hover:text-white'
                    }`}
                  >
                    Tất Cả
                  </button>
                </div>
              </div>

              <select
                value={selectedShowtimeId}
                onChange={(e) => {
                  setSelectedShowtimeId(e.target.value);
                  setSelectedSeatIds([]);
                }}
                className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#22C55E]"
              >
                {filteredShowtimes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.movie?.title} • {st.auditorium?.name} •{' '}
                    {new Date(st.starts_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    ({st.format})
                  </option>
                ))}
              </select>
            </div>

            {/* Audience Type Selector (Staff Logic) */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#06B6D4]" />
                  <span>Đối Tượng Khách Hàng / Giảm Giá Ưu Đãi</span>
                </span>
                <span className="text-[11px] text-[#FABF2E] font-medium">
                  {AUDIENCE_CONFIG[selectedAudienceType].label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(AUDIENCE_CONFIG) as AudienceType[]).map((type) => {
                  const cfg = AUDIENCE_CONFIG[type];
                  const isSelected = selectedAudienceType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedAudienceType(type)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] shadow-md shadow-[#06B6D4]/10'
                          : 'bg-[#171D2B] border-[#222B3D] text-[#8E9AAF] hover:text-white hover:border-[#3B4863]'
                      }`}
                    >
                      <span>{cfg.label}</span>
                      {cfg.discountPercent > 0 && (
                        <span className="text-[10px] text-[#22C55E]">Giảm {cfg.discountPercent}%</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Room Seat Selector */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <Armchair className="w-4 h-4 text-[#22C55E]" />
                  <span>Sơ đồ phòng chiếu: {selectedShowtime?.auditorium?.name || 'Phòng 1'}</span>
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-[#8E9AAF]">
                    <span className="w-2.5 h-2.5 rounded bg-[#2A344A]" /> Thường
                  </span>
                  <span className="flex items-center gap-1 text-[#FABF2E]">
                    <span className="w-2.5 h-2.5 rounded bg-[#FABF2E]" /> VIP
                  </span>
                  <span className="flex items-center gap-1 text-[#E63845]">
                    <span className="w-3.5 h-2.5 rounded bg-[#E63845]" /> Đôi (Couple H)
                  </span>
                </div>
              </div>

              {/* Orphan warning banner */}
              {orphanWarning && (
                <div className="p-3 rounded-xl bg-[#3B191C] border border-[#EF4444] text-[#EF4444] text-xs font-bold flex items-center gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{orphanWarning}</span>
                </div>
              )}

              {/* Screen Indicator */}
              <div className="relative w-full max-w-md mx-auto text-center space-y-1 py-1">
                <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[#22C55E] to-transparent rounded-full shadow" />
                <div className="text-[10px] font-bold text-[#5C677D] tracking-wider uppercase">MÀN HÌNH CHIẾU</div>
              </div>

              {/* Seat Matrix Render */}
              <div className="max-w-xl mx-auto space-y-2 py-2">
                {rows.map((rowLabel) => {
                  const rowSeats = roomSeats
                    .filter((s) => s.row_label === rowLabel)
                    .sort((a, b) => a.seat_number - b.seat_number);

                  if (rowSeats.length === 0) return null;

                  return (
                    <div key={rowLabel} className="flex items-center justify-center gap-2">
                      <span className="w-4 text-center font-bold text-[11px] text-[#5C677D] font-mono">
                        {rowLabel}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {rowSeats.map((seat) => {
                          const isVip = seat.seat_type === 'VIP';
                          const isCouple = seat.seat_type === 'COUPLE' || seat.row_label === 'H';
                          const isBlocked = seat.status === 'BLOCKED';
                          const isSelected = selectedSeatIds.includes(seat.id);

                          return (
                            <button
                              key={seat.id}
                              disabled={isBlocked}
                              onClick={() => handleToggleSeat(seat)}
                              title={`Ghế ${seat.row_label}${seat.seat_number} (${seat.seat_type})`}
                              className={`rounded text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                                isCouple ? 'w-10 h-7' : 'w-7 h-7'
                              } ${
                                isBlocked
                                  ? 'bg-[#3B191C] border border-[#EF4444] text-[#EF4444] opacity-50 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#22C55E] text-black font-black ring-2 ring-white scale-105 shadow-md'
                                  : isCouple
                                  ? 'bg-[#E63845] text-white hover:opacity-90'
                                  : isVip
                                  ? 'bg-[#FABF2E] text-black hover:opacity-90'
                                  : 'bg-[#2A344A] text-white hover:bg-[#3B4863]'
                              }`}
                            >
                              {isBlocked ? '✕' : `${seat.row_label}${seat.seat_number}`}
                            </button>
                          );
                        })}
                      </div>

                      <span className="w-4 text-center font-bold text-[11px] text-[#5C677D] font-mono">
                        {rowLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick F&B Add-ons with Flavors & Drink sizes */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-3">
              <span className="font-bold text-white text-xs flex items-center gap-2">
                <Coffee className="w-4 h-4 text-[#FABF2E]" />
                <span>Thêm Bắp Nước & Tùy Chọn Vị (F&B Concession)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {products.map((p) => {
                  const qty = selectedProductCounts[p.id] || 0;
                  const mod = productModifiers[p.id] || {
                    flavor: POPCORN_FLAVORS[0],
                    drinkSize: DRINK_OPTIONS[0]
                  };

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-2xl bg-[#171D2B] border border-[#242D40] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="truncate mr-2">
                          <div className="font-bold text-white truncate">{p.name}</div>
                          <div className="text-[11px] text-[#FABF2E] font-mono">
                            {p.base_price.toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAdjustFood(p.id, -1)}
                            className="w-6 h-6 rounded bg-[#242D40] text-white flex items-center justify-center font-bold cursor-pointer hover:bg-[#333E56]"
                          >
                            -
                          </button>
                          <span className="w-4 text-center font-bold text-white">{qty}</span>
                          <button
                            onClick={() => handleAdjustFood(p.id, 1)}
                            className="w-6 h-6 rounded bg-[#22C55E] text-black flex items-center justify-center font-bold cursor-pointer hover:bg-[#1CA34D]"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Flavor & Drink modifiers if selected */}
                      {qty > 0 && (
                        <div className="pt-2 border-t border-[#222B3D] space-y-1.5 text-[10px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[#8E9AAF]">Vị bắp:</span>
                            <select
                              value={mod.flavor}
                              onChange={(e) =>
                                setProductModifiers((prev) => ({
                                  ...prev,
                                  [p.id]: { ...mod, flavor: e.target.value }
                                }))
                              }
                              className="bg-[#121622] border border-[#2B3549] rounded px-1.5 py-0.5 text-white"
                            >
                              {POPCORN_FLAVORS.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[#8E9AAF]">Nước:</span>
                            <select
                              value={mod.drinkSize}
                              onChange={(e) =>
                                setProductModifiers((prev) => ({
                                  ...prev,
                                  [p.id]: { ...mod, drinkSize: e.target.value }
                                }))
                              }
                              className="bg-[#121622] border border-[#2B3549] rounded px-1.5 py-0.5 text-white"
                            >
                              {DRINK_OPTIONS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (4/12): Checkout Summary & Invoice Generator */}
          <div className="lg:col-span-4 bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-4 h-fit sticky top-20 shadow-xl">
            <h3 className="font-bold text-white text-sm border-b border-[#222B3D] pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#22C55E]" />
              <span>Hóa Đơn Thu Ngân Tại Quầy</span>
            </h3>

            {/* Movie Info Chip */}
            <div className="p-3 rounded-2xl bg-[#171D2B] border border-[#242E42] text-xs space-y-1">
              <div className="font-bold text-white truncate">{selectedShowtime?.movie?.title}</div>
              <div className="text-[11px] text-[#8E9AAF] flex items-center justify-between">
                <span>
                  {selectedShowtime?.auditorium?.name} • {selectedShowtime?.format}
                </span>
                <span className="font-mono text-[#06B6D4]">
                  {new Date(selectedShowtime?.starts_at).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            {/* Selected Seats summary */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#8E9AAF]">
                <span>
                  Ghế ({selectedSeatObjects.length}):{' '}
                  <strong className="text-white">
                    {selectedSeatObjects.map((s) => `${s.row_label}${s.seat_number}`).join(', ') ||
                      'Chưa chọn'}
                  </strong>
                </span>
                <span className="font-mono text-white">{ticketSubtotal.toLocaleString('vi-VN')} đ</span>
              </div>

              {AUDIENCE_CONFIG[selectedAudienceType].discountPercent > 0 && (
                <div className="flex justify-between text-[#22C55E] text-[11px]">
                  <span>Ưu đãi {AUDIENCE_CONFIG[selectedAudienceType].label}:</span>
                  <span>Đã chiết khấu</span>
                </div>
              )}

              <div className="flex justify-between text-[#8E9AAF]">
                <span>Bắp nước F&B:</span>
                <span className="font-mono text-white">{foodSubtotal.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="pt-2 border-t border-[#1F2739] flex justify-between text-sm font-bold">
                <span className="text-white">Tổng thanh toán:</span>
                <span className="text-base font-black text-[#22C55E] font-mono">
                  {totalAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5 pt-2 border-t border-[#1F2739]">
              <label className="text-[11px] text-[#8E9AAF] font-semibold block">Hình thức thanh toán</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-[#22C55E] text-black border-[#22C55E]'
                      : 'bg-[#171D2B] text-[#8E9AAF] border-[#242D40] hover:text-white'
                  }`}
                >
                  Tiền Mặt
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('VIETQR')}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'VIETQR'
                      ? 'bg-[#06B6D4] text-black border-[#06B6D4]'
                      : 'bg-[#171D2B] text-[#8E9AAF] border-[#242D40] hover:text-white'
                  }`}
                >
                  VietQR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'bg-[#FABF2E] text-black border-[#FABF2E]'
                      : 'bg-[#171D2B] text-[#8E9AAF] border-[#242D40] hover:text-white'
                  }`}
                >
                  Quẹt Thẻ
                </button>
              </div>
            </div>

            {/* Cash Tendered Input & Change Calculation */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#8E9AAF] font-semibold">Tiền khách đưa (VND)</label>
                  <input
                    type="number"
                    step={10000}
                    placeholder="Ví dụ: 200000"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-xs text-white font-mono text-right focus:outline-none focus:border-[#22C55E]"
                  />
                </div>

                {cashTendered > 0 && (
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#16221C] border border-[#245238]">
                    <span className="text-[#8E9AAF]">Tiền thừa thối lại:</span>
                    <span className="font-mono font-black text-[#22C55E]">
                      {changeAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] text-[#8E9AAF]">SĐT Khách hàng (Tích điểm CMX)</label>
              <input
                type="text"
                placeholder="0912345678..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22C55E]"
              />
            </div>

            <button
              onClick={handleCompleteSale}
              disabled={isProcessingSale || totalAmount === 0 || (!activeShift && paymentMethod === 'CASH')}
              className="w-full py-3.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black text-xs transition-all cursor-pointer shadow-lg shadow-[#22C55E]/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{isProcessingSale ? 'Đang Xuất Vé...' : 'Xuất Vé & In Hóa Đơn'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SHIFTS SESSIONS & AUDIT */}
      {activeTab === 'SHIFTS' && (
        <div className="space-y-5">
          <div className="bg-[#121622] border border-[#222B3D] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#222B3D] bg-[#0E121B] flex items-center justify-between">
              <span className="text-xs font-bold text-white">Danh Sách Ca Trực & Đối Soát Tiền Két</span>
              <span className="text-xs text-[#8E9AAF]">Chuẩn Veezi POS Session Audit</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#171D2B] text-[#8E9AAF] border-b border-[#222B3D]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Mã Quầy</th>
                    <th className="py-3 px-4 font-bold">Thu Ngân</th>
                    <th className="py-3 px-4 font-bold">Thời Gian</th>
                    <th className="py-3 px-4 font-bold text-right">Đầu Ca</th>
                    <th className="py-3 px-4 font-bold text-right">Két Sổ Sách</th>
                    <th className="py-3 px-4 font-bold text-right">Thực Đếm</th>
                    <th className="py-3 px-4 font-bold text-center">Trạng Thái</th>
                    <th className="py-3 px-4 font-bold text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D2536]">
                  {shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-[#161C2A]">
                      <td className="py-3 px-4 font-mono font-bold text-white">{s.pos_terminal}</td>
                      <td className="py-3 px-4 text-[#8E9AAF]">
                        {s.staff_name || currentOperator.name || 'Thu ngân'}
                      </td>
                      <td className="py-3 px-4 text-[#8E9AAF]">
                        {new Date(s.opened_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        -{' '}
                        {s.closed_at
                          ? new Date(s.closed_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Đang mở'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white">
                        {s.opening_cash.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#22C55E]">
                        {s.expected_cash.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white">
                        {s.counted_cash != null ? `${s.counted_cash.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === 'open'
                              ? 'bg-[#22C55E]/20 text-[#22C55E]'
                              : s.status === 'closed'
                              ? 'bg-[#FABF2E]/20 text-[#FABF2E]'
                              : 'bg-[#06B6D4]/20 text-[#06B6D4]'
                          }`}
                        >
                          {s.status === 'open'
                            ? 'Đang mở'
                            : s.status === 'closed'
                            ? 'Chờ duyệt'
                            : 'Đã duyệt'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.status === 'open' ? (
                          <button
                            onClick={() => {
                              setCloseModalShift(s);
                              setCountedCash(s.expected_cash);
                            }}
                            className="px-2.5 py-1 rounded bg-[#FABF2E] text-black font-bold text-[10px] hover:bg-[#E5AC24] cursor-pointer"
                          >
                            Chốt Ca
                          </button>
                        ) : s.status === 'closed' ? (
                          <button
                            onClick={() => onApproveShift(s.id, currentOperator.id)}
                            className="px-2.5 py-1 rounded bg-[#06B6D4] text-black font-bold text-[10px] hover:bg-[#0891B2] cursor-pointer"
                          >
                            Duyệt Két
                          </button>
                        ) : (
                          <span className="text-[#5C677D] text-[10px]">Đã đối soát</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Open Shift Modal */}
      {openModalVisible && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenShiftSubmit}
            className="bg-[#121622] border border-[#222B3D] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#22C55E]" />
                <span>Mở Ca Trực Thu Ngân Mới</span>
              </h3>
              <button
                type="button"
                onClick={() => setOpenModalVisible(false)}
                className="text-[#8E9AAF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8E9AAF] block mb-1">Mã quầy POS:</label>
                <select
                  value={openForm.pos_terminal}
                  onChange={(e) => setOpenForm({ ...openForm, pos_terminal: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#242D40] rounded-xl px-3 py-2 text-white"
                >
                  <option value="POS-01">POS-01 (Quầy Chính 1)</option>
                  <option value="POS-02">POS-02 (Quầy Phụ 2)</option>
                  <option value="POS-03">POS-03 (Quầy Bắp Nước Concession)</option>
                </select>
              </div>

              <div>
                <label className="text-[#8E9AAF] block mb-1">Tiền mặt bàn giao đầu ca (VND):</label>
                <input
                  type="number"
                  step={100000}
                  value={openForm.opening_cash}
                  onChange={(e) => setOpenForm({ ...openForm, opening_cash: Number(e.target.value) })}
                  className="w-full bg-[#171D2B] border border-[#242D40] rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpenModalVisible(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#171D2B] hover:bg-[#222B3D] text-white text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black text-xs font-black cursor-pointer shadow-lg shadow-[#22C55E]/20"
              >
                Xác Nhận Mở Ca
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Close Shift Modal */}
      {closeModalShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseShiftSubmit}
            className="bg-[#121622] border border-[#222B3D] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FABF2E]" />
                <span>Chốt Ca & Nộp Biên Bản Đối Soát</span>
              </h3>
              <button
                type="button"
                onClick={() => setCloseModalShift(null)}
                className="text-[#8E9AAF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#171D2B] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8E9AAF]">Quầy:</span>
                  <span className="font-bold text-white">{closeModalShift.pos_terminal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E9AAF]">Két tiền sổ sách hệ thống:</span>
                  <span className="font-mono font-bold text-[#22C55E]">
                    {closeModalShift.expected_cash.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[#8E9AAF] block mb-1">Tiền mặt thực đếm trong két (VND):</label>
                <input
                  type="number"
                  step={10000}
                  value={countedCash}
                  onChange={(e) => setCountedCash(Number(e.target.value))}
                  className="w-full bg-[#171D2B] border border-[#242D40] rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              {countedCash - closeModalShift.expected_cash !== 0 && (
                <div>
                  <label className="text-[#EF4444] font-bold block mb-1">
                    Chênh lệch ({countedCash - closeModalShift.expected_cash > 0 ? '+' : ''}
                    {(countedCash - closeModalShift.expected_cash).toLocaleString('vi-VN')} đ) — Lý do giải trình:
                  </label>
                  <textarea
                    rows={2}
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    placeholder="Nhập lý do thừa/thiếu tiền két..."
                    className="w-full bg-[#171D2B] border border-[#EF4444] rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCloseModalShift(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#171D2B] hover:bg-[#222B3D] text-white text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black text-xs font-black cursor-pointer shadow-lg"
              >
                Nộp Biên Bản Chốt Ca
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: Realistic Cinema Ticket & Thermal Receipt Preview with QR */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2C384E] rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-1 border-b border-[#242E40] pb-3">
              <div className="text-xs font-black text-[#22C55E] tracking-widest uppercase">CINEMAX CINEMAS</div>
              <h3 className="text-base font-black text-white">HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC</h3>
              <p className="text-[11px] font-mono text-[#8E9AAF]">Mã: {receiptData.invoiceNo}</p>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[#8E9AAF] block">Phim:</span>
                <span className="text-sm font-bold text-white block">{receiptData.movieTitle}</span>
              </div>

              <div className="flex justify-between text-[#8E9AAF]">
                <span>
                  Phòng: <strong className="text-white">{receiptData.auditoriumName}</strong>
                </span>
                <span>
                  Định dạng: <strong className="text-[#06B6D4]">{receiptData.format}</strong>
                </span>
              </div>

              <div className="flex justify-between text-[#8E9AAF]">
                <span>Giờ chiếu:</span>
                <span className="font-mono text-white font-bold">
                  {new Date(receiptData.startsAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}{' '}
                  - {new Date(receiptData.startsAt).toLocaleDateString('vi-VN')}
                </span>
              </div>

              {/* Seats breakdown */}
              {receiptData.seats.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#171E2D] space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-[#FABF2E]">Ghế ngồi:</span>
                    <span className="text-[10px] text-[#22C55E]">{receiptData.audienceType}</span>
                  </div>
                  {receiptData.seats.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="text-white">
                        {s.label} ({s.type})
                      </span>
                      <span className="font-mono text-[#8E9AAF]">{s.price.toLocaleString('vi-VN')} đ</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Foods breakdown */}
              {receiptData.foods.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#171E2D] space-y-1">
                  <span className="text-[11px] font-bold text-[#FABF2E] block">Bắp nước:</span>
                  {receiptData.foods.map((f, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="text-white">
                        {f.name} x{f.qty} {f.flavor ? `(${f.flavor})` : ''}
                      </span>
                      <span className="font-mono text-[#8E9AAF]">{f.price.toLocaleString('vi-VN')} đ</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Financial breakdown */}
              <div className="pt-2 border-t border-[#242E40] space-y-1">
                <div className="flex justify-between font-bold text-sm text-white">
                  <span>Tổng tiền:</span>
                  <span className="font-mono text-[#22C55E] text-base">
                    {receiptData.total.toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="flex justify-between text-[#8E9AAF] text-[11px]">
                  <span>Hình thức:</span>
                  <span className="font-bold text-white">{receiptData.paymentMethod}</span>
                </div>
                {receiptData.paymentMethod === 'CASH' && (
                  <>
                    <div className="flex justify-between text-[#8E9AAF] text-[11px]">
                      <span>Tiền khách đưa:</span>
                      <span className="font-mono text-white">
                        {receiptData.cashTendered.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex justify-between text-[#8E9AAF] text-[11px]">
                      <span>Tiền thối lại:</span>
                      <span className="font-mono text-[#22C55E] font-bold">
                        {receiptData.change.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* QR representation for ticket check-in */}
              {thermalQrDataUrl && (
                <div className="p-3 bg-white rounded-2xl text-center space-y-1 max-w-[150px] mx-auto mt-2 shadow-lg">
                  <img src={thermalQrDataUrl} alt="QR code" className="w-24 h-24 mx-auto" />
                  <span className="text-[10px] font-mono text-black font-black block">
                    {receiptData.invoiceNo}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1F2739] hover:bg-[#2A344A] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Vé / Hóa Đơn</span>
              </button>

              <button
                onClick={() => setReceiptData(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black text-xs font-black transition-all cursor-pointer shadow-lg"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
