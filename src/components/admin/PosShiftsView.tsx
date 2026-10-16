'use client';

import React, { useState } from 'react';
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
  QrCode
} from 'lucide-react';
import { Shift, Showtime, Seat, Product, Order } from '@/lib/types-redesign';

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
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string>(showtimes[0]?.id || '');
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedProductCounts, setSelectedProductCounts] = useState<Record<string, number>>({});
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
    foods: { name: string; qty: number; price: number }[];
    total: number;
    cashTendered: number;
    change: number;
    operatorName: string;
    timestamp: string;
  } | null>(null);

  const activeShift = shifts.find((s) => s.status === 'open');

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

  const handleApprove = async (shift: Shift) => {
    try {
      await onApproveShift(shift.id, currentOperator.id);
      showToast(`Quản lý đã ký duyệt hoàn tất ca trực ${shift.pos_terminal}!`);
    } catch (err: any) {
      showToast('Lỗi duyệt ca: ' + err.message);
    }
  };

  // Selected showtime and real seats
  const selectedShowtime = showtimes.find((st) => st.id === selectedShowtimeId) || showtimes[0];
  const roomSeats = seats.filter((s) => s.auditorium_id === selectedShowtime?.auditorium_id);
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Calculate ticket pricing based on real seat types
  const selectedSeatObjects = roomSeats.filter((s) => selectedSeatIds.includes(s.id));
  const ticketSubtotal = selectedSeatObjects.reduce((sum, s) => {
    if (s.seat_type === 'VIP') return sum + 105000;
    if (s.seat_type === 'COUPLE') return sum + 210000;
    return sum + 85000;
  }, 0);

  const foodSubtotal = Object.entries(selectedProductCounts).reduce((sum, [pid, qty]) => {
    const prod = products.find((p) => p.id === pid);
    return sum + (prod ? prod.base_price * qty : 0);
  }, 0);

  const totalAmount = ticketSubtotal + foodSubtotal;
  const changeAmount = cashTendered > 0 ? Math.max(0, cashTendered - totalAmount) : 0;

  const handleCompleteSale = () => {
    if (selectedSeatIds.length === 0 && foodSubtotal === 0) {
      showToast('Vui lòng chọn ít nhất 1 ghế hoặc 1 món bắp nước!');
      return;
    }
    if (!activeShift) {
      showToast('Cần mở ca trực tiền mặt trước khi thực hiện bán hàng tại quầy!');
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
          return {
            name: prod?.name || 'F&B',
            qty,
            price: (prod?.base_price || 0) * qty
          };
        });

      const seatItems = selectedSeatObjects.map((s) => ({
        label: `${s.row_label}${s.seat_number}`,
        price: s.seat_type === 'VIP' ? 105000 : s.seat_type === 'COUPLE' ? 210000 : 85000,
        type: s.seat_type
      }));

      // Update shift expected cash
      activeShift.expected_cash += totalAmount;

      if (onSaleComplete && selectedShowtime) {
        onSaleComplete({
          total: totalAmount,
          showtime: selectedShowtime,
          seats: seatItems,
          foods: foodItems,
          operatorName: currentOperator.name,
          customerPhone
        });
      }

      setReceiptData({
        invoiceNo,
        movieTitle: selectedShowtime?.movie?.title || 'Phim',
        auditoriumName: selectedShowtime?.auditorium?.name || 'Phòng 1',
        format: selectedShowtime?.format || '2D',
        startsAt: selectedShowtime?.starts_at || new Date().toISOString(),
        seats: seatItems,
        foods: foodItems,
        total: totalAmount,
        cashTendered: cashTendered > 0 ? cashTendered : totalAmount,
        change: changeAmount,
        operatorName: currentOperator.name,
        timestamp: new Date().toLocaleString('vi-VN')
      });

      showToast(`Đã xuất vé thành công! Tổng thu: ${totalAmount.toLocaleString('vi-VN')} đ`);
      setSelectedSeatIds([]);
      setSelectedProductCounts({});
      setCustomerPhone('');
      setCashTendered(0);
      setIsProcessingSale(false);
    }, 500);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Compact Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-2">
        {/* Mode Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveTab('POS_TERMINAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'POS_TERMINAL'
                ? 'bg-[#22C55E] text-black shadow-md'
                : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Màn Hình Bán Vé Tại Quầy</span>
          </button>

          <button
            onClick={() => setActiveTab('SHIFTS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'SHIFTS'
                ? 'bg-[#22C55E] text-black shadow-md'
                : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lịch Sử Ca & Bàn Giao Két</span>
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
              className="px-3.5 py-1.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Chốt Ca ({activeShift.pos_terminal})</span>
            </button>
          ) : (
            <button
              onClick={() => setOpenModalVisible(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black text-xs font-black shadow-md shadow-[#22C55E]/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Mở Ca Mới</span>
            </button>
          )}
        </div>
      </div>


      {/* TAB 1: POS QUICK TERMINAL */}
      {activeTab === 'POS_TERMINAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2/3): Showtime, Seat Map & F&B Selection */}
          <div className="lg:col-span-2 space-y-5">
            {/* Active Shift Top Strip */}
            {activeShift ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#17261F] to-[#121B17] border border-[#235C3A] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
                  <span className="text-white font-bold">
                    Quầy đang mở: {activeShift.pos_terminal} • Thu ngân: {currentOperator.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#8E9AAF] mr-2">Két hiện tại:</span>
                  <span className="font-mono font-bold text-[#22C55E] text-sm">
                    {activeShift.expected_cash.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#1F1718] border border-[#422C1D] flex items-center justify-between text-xs text-[#FABF2E]">
                <span>Chưa mở ca trực trên máy này. Bấm "Mở Ca Trực Mới" trước khi bán hàng tiền mặt.</span>
                <button
                  onClick={() => setOpenModalVisible(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#FABF2E] text-black font-bold cursor-pointer"
                >
                  Mở ca ngay
                </button>
              </div>
            )}

            {/* Showtime Selection Dropdown */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-[#E63845]" />
                <span>Chọn Suất Chiếu Bán Quầy</span>
              </label>
              <select
                value={selectedShowtimeId}
                onChange={(e) => {
                  setSelectedShowtimeId(e.target.value);
                  setSelectedSeatIds([]);
                }}
                className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
              >
                {showtimes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.movie?.title} • {st.auditorium?.name} •{' '}
                    {new Date(st.starts_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({st.format})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Room Seat Selector */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  Sơ đồ phòng chiếu: {selectedShowtime?.auditorium?.name || 'Phòng 1'}
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-[#2A344A]" /> Thường (85k)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-[#FABF2E]" /> VIP (105k)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-2.5 rounded bg-[#E63845]" /> Đôi (210k)
                  </span>
                </div>
              </div>

              {/* Screen Indicator */}
              <div className="relative w-full max-w-md mx-auto text-center space-y-1 py-1">
                <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[#E63845] to-transparent rounded-full shadow" />
                <div className="text-[10px] font-bold text-[#5C677D] tracking-wider uppercase">MÀN HÌNH</div>
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
                          const isCouple = seat.seat_type === 'COUPLE';
                          const isBlocked = seat.status === 'BLOCKED';
                          const isSelected = selectedSeatIds.includes(seat.id);

                          return (
                            <button
                              key={seat.id}
                              disabled={isBlocked}
                              onClick={() => {
                                setSelectedSeatIds((prev) =>
                                  prev.includes(seat.id)
                                    ? prev.filter((id) => id !== seat.id)
                                    : [...prev, seat.id]
                                );
                              }}
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

            {/* Quick F&B Add-ons */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-5 space-y-3">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-[#FABF2E]" />
                <span>Thêm Bắp Nước Nhanh (F&B Concession)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {products.map((p) => {
                  const qty = selectedProductCounts[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#171D2B] border border-[#242D40] flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-white truncate">{p.name}</div>
                        <div className="text-[11px] text-[#FABF2E] font-mono">
                          {p.base_price.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            setSelectedProductCounts({
                              ...selectedProductCounts,
                              [p.id]: Math.max(0, qty - 1)
                            })
                          }
                          className="w-6 h-6 rounded bg-[#242D40] text-white flex items-center justify-center font-bold cursor-pointer hover:bg-[#333E56]"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-bold text-white">{qty}</span>
                        <button
                          onClick={() =>
                            setSelectedProductCounts({
                              ...selectedProductCounts,
                              [p.id]: qty + 1
                            })
                          }
                          className="w-6 h-6 rounded bg-[#E63845] text-white flex items-center justify-center font-bold cursor-pointer hover:bg-[#D42B38]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (1/3): Checkout Summary & Invoice Generator */}
          <div className="bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-4 h-fit sticky top-20">
            <h3 className="font-bold text-white text-sm border-b border-[#222B3D] pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#22C55E]" />
              <span>Hóa Đơn Thu Ngân Tại Quầy</span>
            </h3>

            {/* Movie Info Chip */}
            <div className="p-3 rounded-xl bg-[#171D2B] border border-[#242E42] text-xs space-y-1">
              <div className="font-bold text-white truncate">{selectedShowtime?.movie?.title}</div>
              <div className="text-[11px] text-[#8E9AAF] flex items-center justify-between">
                <span>{selectedShowtime?.auditorium?.name} • {selectedShowtime?.format}</span>
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
                  Ghế đã chọn ({selectedSeatObjects.length}):{' '}
                  <strong className="text-white">
                    {selectedSeatObjects.map((s) => `${s.row_label}${s.seat_number}`).join(', ') || 'Chưa chọn'}
                  </strong>
                </span>
                <span className="font-mono text-white">{ticketSubtotal.toLocaleString('vi-VN')} đ</span>
              </div>

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

            {/* Cash Tendered Input & Change Calculation */}
            <div className="space-y-2 pt-2 border-t border-[#1F2739]">
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
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#16221C] border border-[#245238]">
                  <span className="text-[#8E9AAF]">Tiền thừa thối lại:</span>
                  <span className="font-mono font-bold text-[#22C55E]">
                    {changeAmount.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] text-[#8E9AAF]">SĐT Khách hàng (Tích điểm)</label>
                <input
                  type="text"
                  placeholder="0912345678..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22C55E]"
                />
              </div>
            </div>

            <button
              onClick={handleCompleteSale}
              disabled={isProcessingSale || totalAmount === 0 || !activeShift}
              className="w-full py-3.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black text-xs transition-all cursor-pointer shadow-lg shadow-[#22C55E]/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{isProcessingSale ? 'Đang In Hóa Đơn...' : 'Thu Tiền Mặt & Xuất Vé'}</span>
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
                      <td className="py-3 px-4 text-[#8E9AAF]">{s.staff_name || currentOperator.name || 'Thu ngân'}</td>
                      <td className="py-3 px-4 text-[#8E9AAF]">
                        {new Date(s.opened_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                        - {s.closed_at ? new Date(s.closed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Đang mở'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white">
                        {s.opening_cash.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#22C55E] font-bold">
                        {s.expected_cash.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white">
                        {s.counted_cash ? `${s.counted_cash.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            s.status === 'open'
                              ? 'bg-[#22C55E]/20 text-[#22C55E]'
                              : s.status === 'submitted'
                              ? 'bg-[#FABF2E]/20 text-[#FABF2E]'
                              : 'bg-[#1C2433] text-[#8E9AAF]'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.status === 'submitted' && (
                          <button
                            onClick={() => handleApprove(s)}
                            className="px-3 py-1 rounded-lg bg-[#22C55E] hover:bg-[#1CA34D] text-black text-[11px] font-black cursor-pointer shadow"
                          >
                            Duyệt Ca
                          </button>
                        )}
                        {s.status === 'open' && (
                          <button
                            onClick={() => {
                              setCloseModalShift(s);
                              setCountedCash(s.expected_cash);
                              setVarianceReason('');
                            }}
                            className="px-3 py-1 rounded-lg bg-[#FABF2E] hover:bg-[#E5AC24] text-black text-[11px] font-black cursor-pointer shadow"
                          >
                            Chốt Ca
                          </button>
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

      {/* Modal 1: Open Shift */}
      {openModalVisible && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#22C55E]" />
                <span>Mở Ca Trực Tiền Mặt Đầu Ca</span>
              </h3>
              <button
                onClick={() => setOpenModalVisible(false)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Chọn quầy máy (POS Terminal) *</label>
                <select
                  value={openForm.pos_terminal}
                  onChange={(e) => setOpenForm({ ...openForm, pos_terminal: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#22C55E]"
                >
                  <option value="POS-01">POS-01 (Quầy vé chính)</option>
                  <option value="POS-02">POS-02 (Quầy vé phụ)</option>
                  <option value="CONCESSION-01">CONCESSION-01 (Quầy bắp nước)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Tiền mặt bàn giao đầu ca (VND) *</label>
                <input
                  type="number"
                  step={50000}
                  required
                  value={openForm.opening_cash}
                  onChange={(e) => setOpenForm({ ...openForm, opening_cash: Number(e.target.value) })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setOpenModalVisible(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black cursor-pointer shadow-lg"
                >
                  Xác Nhận Mở Ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Close Shift Reconciliation */}
      {closeModalShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FABF2E]" />
                <span>Biên Bản Chốt Ca & Đối Soát Tiền Két</span>
              </h3>
              <button
                onClick={() => setCloseModalShift(null)}
                className="w-8 h-8 rounded-lg bg-[#1A202E] text-[#8E9AAF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#171D2B] border border-[#253045]">
                <div>
                  <span className="text-[10px] text-[#8E9AAF] uppercase block">Tiền đầu ca</span>
                  <span className="font-mono text-white font-bold">
                    {closeModalShift.opening_cash.toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#22C55E] uppercase block font-bold">Két dự tính sổ sách</span>
                  <span className="font-mono text-[#22C55E] font-bold">
                    {closeModalShift.expected_cash.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Tiền mặt thực tế đếm được trong két (VND) *</label>
                <input
                  type="number"
                  step={1000}
                  required
                  value={countedCash}
                  onChange={(e) => setCountedCash(Number(e.target.value))}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono text-base focus:outline-none focus:border-[#FABF2E]"
                />
              </div>

              {countedCash - closeModalShift.expected_cash !== 0 && (
                <div className="p-3 rounded-xl bg-[#3B191C] border border-[#EF4444] space-y-2">
                  <div className="flex items-center justify-between font-bold text-xs text-[#EF4444]">
                    <span>Chênh lệch tiền mặt két:</span>
                    <span className="font-mono">
                      {(countedCash - closeModalShift.expected_cash).toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-white font-semibold">Lý do giải trình chênh lệch *</label>
                    <textarea
                      required
                      rows={2}
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      placeholder="Giải trình thừa/thiếu tiền do thối nhầm..."
                      className="w-full bg-[#1F1517] border border-[#EF4444]/40 rounded-lg p-2 text-white text-xs focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setCloseModalShift(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black cursor-pointer shadow-lg"
                >
                  Nộp Biên Bản Chốt Ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Realistic Cinema Ticket & Receipt Preview */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2C384E] rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-1 border-b border-[#242E40] pb-3">
              <div className="text-xs font-black text-[#E63845] tracking-widest uppercase">CINEMAX THEATER</div>
              <h3 className="text-base font-black text-white">HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC</h3>
              <p className="text-[11px] font-mono text-[#8E9AAF]">Mã: {receiptData.invoiceNo}</p>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[#8E9AAF] block">Phim:</span>
                <span className="text-sm font-bold text-white block">{receiptData.movieTitle}</span>
              </div>

              <div className="flex justify-between text-[#8E9AAF]">
                <span>Phòng: <strong className="text-white">{receiptData.auditoriumName}</strong></span>
                <span>Định dạng: <strong className="text-[#06B6D4]">{receiptData.format}</strong></span>
              </div>

              <div className="flex justify-between text-[#8E9AAF]">
                <span>Giờ chiếu:</span>
                <span className="font-mono text-white font-bold">
                  {new Date(receiptData.startsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                  - {new Date(receiptData.startsAt).toLocaleDateString('vi-VN')}
                </span>
              </div>

              {/* Seats breakdown */}
              {receiptData.seats.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#171E2D] space-y-1">
                  <span className="text-[11px] font-bold text-[#FABF2E] block">Ghế ngồi:</span>
                  {receiptData.seats.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="text-white">{s.label} ({s.type})</span>
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
                      <span className="text-white">{f.name} x{f.qty}</span>
                      <span className="font-mono text-[#8E9AAF]">{f.price.toLocaleString('vi-VN')} đ</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Financial breakdown */}
              <div className="pt-2 border-t border-[#242E40] space-y-1">
                <div className="flex justify-between font-bold text-sm text-white">
                  <span>Tổng tiền:</span>
                  <span className="font-mono text-[#22C55E] text-base">{receiptData.total.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-[#8E9AAF] text-[11px]">
                  <span>Tiền khách đưa:</span>
                  <span className="font-mono text-white">{receiptData.cashTendered.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-[#8E9AAF] text-[11px]">
                  <span>Tiền thối lại:</span>
                  <span className="font-mono text-[#22C55E] font-bold">{receiptData.change.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              {/* QR representation for ticket check-in */}
              <div className="p-3 bg-white rounded-xl text-center space-y-1 max-w-[140px] mx-auto mt-2">
                <QrCode className="w-20 h-20 text-black mx-auto" />
                <span className="text-[9px] font-mono text-black font-bold block">{receiptData.invoiceNo}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1F2739] hover:bg-[#2A344A] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Hóa Đơn</span>
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
