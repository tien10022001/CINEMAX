'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import {
  MOCK_MOVIES,
  MOCK_CINEMAS,
  MOCK_SHOWTIMES,
  MOCK_FOODS,
  MOCK_PROMOTIONS,
  generateMockSeats,
} from '@/lib/mock-data';
import { Movie, Cinema, Showtime, Seat, Promotion } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import {
  Clock,
  CheckCircle,
  Plus,
  Minus,
  ArrowLeft,
  QrCode,
  Download,
  Ticket as TicketIcon,
  User as UserIcon,
  Phone,
  Mail,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import VietQRModal from '@/components/booking/VietQRModal';
import ShowtimeModal from '@/components/common/ShowtimeModal';
import { BookingService } from '@/services/booking.service';
import { checkAllSelectedSeatsForOrphans, OrphanSeatCheckResult } from '@/lib/seat-rules';

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser, openAuthModal } = useAuth();
  const { movies, cinemas, showtimes, foods, promotions } = useData();

  // Query Params
  const queryMovieId = searchParams.get('movie') || '1';
  const queryCinemaId = searchParams.get('cinema') || '1';
  const queryShowtimeId = searchParams.get('showtime') || '101';
  const queryPromoCode = searchParams.get('promo') || '';
  const queryTime = searchParams.get('time') || '15:30';
  const queryDate = searchParams.get('date') || '15/10/2026';
  const [isShowtimeChangeOpen, setIsShowtimeChangeOpen] = useState<boolean>(false);

  // Steps: 1 = Chọn ghế (Screen 3), 2 = Bắp nước & Thanh toán (Screen 4), 3 = Vé điện tử (Screen 5)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Dynamic Entities
  const selectedMovie = movies.find((m) => m.id.toString() === queryMovieId) || movies[0];
  const selectedCinema = cinemas.find((c) => c.id.toString() === queryCinemaId) || cinemas[0];
  const selectedShowtime = showtimes.find((s) => s.id.toString() === queryShowtimeId) || showtimes[0];

  // Seats State
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);

  // Guest Information (For unauthenticated visitors)
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestError, setGuestError] = useState<string>('');

  // Food Items State: { [foodId]: quantity }
  const [foodQuantities, setFoodQuantities] = useState<{ [id: string | number]: number }>({
    1: 0,
    2: 0,
    3: 0,
  });

  // Promo Code State
  const [promoInput, setPromoInput] = useState<string>(queryPromoCode);
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState<string>('');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'VIETQR' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD'>('VIETQR');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [isVietQRModalOpen, setIsVietQRModalOpen] = useState<boolean>(false);
  const [pendingVietQROrder, setPendingVietQROrder] = useState<{
    orderId: string;
    orderCode: string;
    amount: number;
    payerName: string;
    payerEmail: string;
    payerPhone: string;
    seatsStr: string;
  } | null>(null);
  const [completedBooking, setCompletedBooking] = useState<{
    bookingCode: string;
    paidAt: string;
    totalAmount: number;
    seatsStr: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  } | null>(null);

  // Mã phiên giữ ghế độc lập cho tab trình duyệt này (Session ID)
  const [sessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      let s = sessionStorage.getItem('cinemax_booking_session');
      if (!s) {
        s = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        sessionStorage.setItem('cinemax_booking_session', s);
      }
      return s;
    }
    return 'sess_' + Date.now();
  });

  // Trạng thái cảnh báo ghế trống đơn lẻ (Orphan Seat Warning)
  const [orphanWarning, setOrphanWarning] = useState<OrphanSeatCheckResult | null>(null);
  const [acknowledgedOrphan, setAcknowledgedOrphan] = useState<boolean>(false);

  // 10-minute hold timer (Figma Screen 3: "⏱ Giữ ghế còn 09:42")
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10:00 initial

// Helper: Sinh sơ đồ ghế chuẩn xác cho từng rạp, từng suất chiếu tuân thủ 4 trạng thái: AVAILABLE, HELD, BOOKED (SOLD), BLOCKED
function getDynamicShowtimeSeats(
  roomId: number = 1,
  cinemaId: string | number,
  showtimeId: string | number,
  date: string,
  time: string,
  locallyBookedSeats: Set<string>,
  locallyHeldSeats: Set<string>,
  locallyBlockedSeats: Set<string>
): Seat[] {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const seats: Seat[] = [];
  let seatId = 1;

  rows.forEach((row, rowIdx) => {
    const isCouple = row === 'H';
    const isVip = row === 'E' || row === 'F' || row === 'G';
    const typeId = isCouple ? 3 : isVip ? 2 : 1;
    const typeCode = isCouple ? 'COUPLE' : isVip ? 'VIP' : 'STANDARD';

    if (isCouple) {
      for (let c = 1; c <= 5; c++) {
        const label = `ĐÔI ${c}`;
        let status: 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED' = 'AVAILABLE';
        if (locallyBookedSeats.has(label)) status = 'SOLD';
        else if (locallyHeldSeats.has(label)) status = 'HELD';
        else if (locallyBlockedSeats.has(label)) status = 'BLOCKED';

        seats.push({
          id: seatId++,
          room_id: roomId,
          seat_type_id: typeId,
          row_label: row,
          seat_number: c,
          grid_row: rowIdx + 1,
          grid_col: c,
          is_active: true,
          seat_type: {
            id: typeId,
            code: typeCode,
            name: 'Ghế đôi',
            capacity: 2,
            color_code: '#F472B6',
          },
          status,
        });
      }
    } else {
      for (let c = 1; c <= 10; c++) {
        const label = `${row}${c}`;
        let status: 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED' = 'AVAILABLE';
        if (locallyBookedSeats.has(label)) status = 'SOLD';
        else if (locallyHeldSeats.has(label)) status = 'HELD';
        else if (locallyBlockedSeats.has(label)) status = 'BLOCKED';

        seats.push({
          id: seatId++,
          room_id: roomId,
          seat_type_id: typeId,
          row_label: row,
          seat_number: c,
          grid_row: rowIdx + 1,
          grid_col: c,
          is_active: true,
          seat_type: {
            id: typeId,
            code: typeCode,
            name: isVip ? 'Ghế VIP' : 'Ghế thường',
            capacity: 1,
            color_code: isVip ? '#FABF2E' : '#9CA3AF',
          },
          status,
        });
      }
    }
  });

  return seats;
}

  useEffect(() => {
    let isMounted = true;
    async function loadSeats() {
      // Tự động giải phóng các ghế giữ tạm đã hết hạn
      await BookingService.releaseExpiredHolds();

      // 1. Đọc danh sách vé đã đặt từ localStorage CHỈ cho đúng rạp, phim và suất chiếu này
      const stored = typeof window !== 'undefined' ? localStorage.getItem('cinemax_user_tickets') : null;
      const localTickets = stored ? JSON.parse(stored) : [];
      const bookedSeatLabels = new Set<string>();

      localTickets.forEach((t: any) => {
        // Chỉ khớp vé của chính suất chiếu này, rạp này, phim này và ngày này
        const matchShowtimeId =
          t.showtimeId &&
          selectedShowtime?.id &&
          t.showtimeId.toString() === selectedShowtime.id.toString();

        const matchCinema =
          t.cinemaName === selectedCinema?.name ||
          (t.cinemaId && t.cinemaId.toString() === queryCinemaId.toString());

        const matchMovie =
          (t.movieId && selectedMovie?.id && t.movieId.toString() === selectedMovie.id.toString()) ||
          t.movieTitle === selectedMovie?.title;

        const matchDate =
          t.showtimeDate === queryDate ||
          t.date === queryDate ||
          (t.showtime && t.showtime.includes(queryDate));

        const matchTime =
          t.showtimeTime === queryTime ||
          (t.showtime && t.showtime.includes(queryTime));

        if (matchShowtimeId || (matchCinema && matchMovie && matchDate && matchTime)) {
          if (Array.isArray(t.seats)) {
            t.seats.forEach((s: string) => bookedSeatLabels.add(s.trim()));
          } else if (typeof t.seats === 'string') {
            t.seats.split(',').forEach((s: string) => bookedSeatLabels.add(s.trim()));
          }
        }
      });

      // 2. Đọc danh sách ghế đang bị giữ tạm (HELD) bởi phiên khác còn hạn
      const currentShowtimeKey = selectedShowtime?.id || queryShowtimeId;
      const heldMap = BookingService.getLocalHeldSeats(currentShowtimeKey);
      const heldSeatLabels = new Set<string>();
      heldMap.forEach((info, label) => {
        if (info.sessionId !== sessionId) {
          heldSeatLabels.add(label);
        }
      });

      const blockedSeatLabels = new Set<string>();

      // 3. Nếu là suất chiếu thật của rạp Hà Nội Centre trong DB Supabase
      const stId = selectedShowtime?.id?.toString();
      const isRealDbShowtime =
        stId &&
        stId === '85608755-35ca-4157-87bd-96b50577e0e5' &&
        (selectedCinema?.id === 1 || selectedCinema?.name?.includes('Hà Nội'));

      if (isRealDbShowtime) {
        try {
          const dbSeats = await BookingService.getShowtimeSeats(stId);
          if (dbSeats && dbSeats.length > 0) {
            const mapped: Seat[] = dbSeats.map((s) => {
              const seatLabel = `${s.row_label}${s.seat_number}`;
              const isBookedLocally = bookedSeatLabels.has(seatLabel);
              const isHeldLocally = heldSeatLabels.has(seatLabel);

              let seatStatus: any = s.status;
              if (isBookedLocally) seatStatus = 'sold';
              else if (isHeldLocally) seatStatus = 'held';

              return {
                id: s.id,
                row_label: s.row_label,
                seat_number: s.seat_number,
                grid_row: s.grid_row,
                grid_col: s.grid_col,
                seat_type: {
                  id: s.seat_type || 'standard',
                  code: (s.seat_type || 'STANDARD').toUpperCase() as any,
                  name: (s.seat_type || 'STANDARD').toUpperCase(),
                },
                seat_group: s.seat_group,
                status: seatStatus,
              };
            });
            if (isMounted) setSeats(mapped);
            return;
          }
        } catch (err) {
          console.warn('Lỗi tải ghế Supabase, dùng sơ đồ riêng cho rạp:', err);
        }
      }

      // 4. Với các rạp khác (Landmark 81, Cầu Giấy...) hoặc các suất chiếu khác:
      const dynamicSeats = getDynamicShowtimeSeats(
        Number(selectedShowtime?.room_id) || 1,
        selectedCinema?.id || queryCinemaId,
        selectedShowtime?.id || queryShowtimeId,
        queryDate,
        queryTime,
        bookedSeatLabels,
        heldSeatLabels,
        blockedSeatLabels
      );

      if (isMounted) setSeats(dynamicSeats);
    }

    loadSeats();
    const handleUpdate = () => loadSeats();
    window.addEventListener('cinemax_data_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('cinemax_data_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedShowtime, queryCinemaId, queryDate, queryTime, selectedCinema, sessionId]);

  useEffect(() => {
    if (currentStep === 1 || currentStep === 2) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            BookingService.releaseSessionHold(sessionId);
            alert('Đã hết thời gian giữ ghế! Hệ thống đã giải phóng ghế của bạn.');
            setSelectedSeats([]);
            setOrphanWarning(null);
            setCurrentStep(1);
            return 600;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStep, sessionId]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeatClick = (seat: Seat) => {
    const isUnavailable =
      seat.status === 'SOLD' ||
      seat.status === 'sold' ||
      seat.status === 'BOOKED' ||
      seat.status === 'booked' ||
      seat.status === 'HELD' ||
      seat.status === 'held' ||
      seat.status === 'BLOCKED' ||
      seat.status === 'blocked';
    if (isUnavailable) return;

    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    let nextSelected: Seat[];
    if (isSelected) {
      nextSelected = selectedSeats.filter((s) => s.id !== seat.id);
    } else {
      if (selectedSeats.length >= 8) {
        alert('Bạn chỉ có thể chọn tối đa 8 ghế trong một đơn đặt');
        return;
      }
      nextSelected = [...selectedSeats, seat];
    }

    setSelectedSeats(nextSelected);

    // Kiểm tra quy tắc ghế trống đơn lẻ (Orphan / Single Seat Rule)
    const bookedSet = new Set<string>();
    const heldSet = new Set<string>();
    const blockedSet = new Set<string>();

    seats.forEach((s) => {
      const label = s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`;
      const statusUpper = (s.status || '').toUpperCase();
      if (statusUpper === 'SOLD' || statusUpper === 'BOOKED') bookedSet.add(label);
      else if (statusUpper === 'HELD') heldSet.add(label);
      else if (statusUpper === 'BLOCKED') blockedSet.add(label);
    });

    const orphanCheck = checkAllSelectedSeatsForOrphans(
      seats,
      nextSelected,
      bookedSet,
      heldSet,
      blockedSet
    );

    if (orphanCheck.hasOrphanSeats) {
      setOrphanWarning(orphanCheck);
      setAcknowledgedOrphan(false);
    } else {
      setOrphanWarning(null);
    }
  };

  const handleAddOrphanSeats = (orphanLabels: string[]) => {
    const seatsToAdd = seats.filter((s) => {
      const label = s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`;
      return orphanLabels.includes(label) && !selectedSeats.some((sel) => sel.id === s.id);
    });

    if (seatsToAdd.length > 0) {
      if (selectedSeats.length + seatsToAdd.length > 8) {
        alert('Tổng số ghế vượt quá 8 ghế tối đa. Vui lòng điều chỉnh lại.');
        return;
      }
      const updated = [...selectedSeats, ...seatsToAdd];
      setSelectedSeats(updated);
      setOrphanWarning(null);
      setAcknowledgedOrphan(true);
    }
  };

  const handleProceedToStep2 = () => {
    if (selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất một ghế');
      return;
    }

    // Nếu phát hiện ghế trống đơn lẻ mà khách chưa xác nhận bỏ qua, hiển thị nhắc nhở (Phương án A)
    if (orphanWarning && orphanWarning.hasOrphanSeats && !acknowledgedOrphan) {
      const userConfirm = confirm(
        `${orphanWarning.suggestionMessage}\n\nBạn có chắc chắn muốn tiếp tục giữ các ghế này không?`
      );
      if (!userConfirm) return;
    }

    // Cơ chế chống trùng vé (Concurrency Control): Giữ ghế 10 phút
    const seatLabels = selectedSeats.map((s) =>
      s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`
    );

    const holdRes = BookingService.holdSeatsLocal({
      showtimeId: selectedShowtime?.id || queryShowtimeId,
      sessionId,
      seatLabels,
      holdMinutes: 10,
    });

    if (!holdRes.success) {
      alert(holdRes.error || 'Ghế vừa được người khác giữ chỗ. Vui lòng chọn ghế khác!');
      return;
    }

    setTimeLeft(600);
    setCurrentStep(2);
  };

  const getSeatPrice = (seat: Seat) => {
    if (seat.seat_type?.code === 'COUPLE') return 210000;
    if (seat.seat_type?.code === 'VIP') return 110000;
    return 90000;
  };

  // Thống kê đếm số ghế và số ghế trống thời gian thực
  const totalSeatsCount = seats.length || 75;
  const soldSeatsCount = seats.filter(
    (s) => s.status === 'SOLD' || s.status === 'sold' || s.status === 'HELD' || s.status === 'held'
  ).length;
  const selectedSeatsCount = selectedSeats.length;
  const availableSeatsCount = Math.max(0, totalSeatsCount - soldSeatsCount - selectedSeatsCount);

  const ticketSubtotal = selectedSeats.reduce((sum, seat) => sum + getSeatPrice(seat), 0);

  const foodSubtotal = Object.entries(foodQuantities).reduce((sum, [id, qty]) => {
    const food = foods.find((f) => f.id === parseInt(id));
    return sum + (food ? food.price * qty : 0);
  }, 0);

  const subtotalBeforeDiscount = ticketSubtotal + foodSubtotal;

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.discount_type === 'PERCENT') {
      discountAmount = Math.floor((subtotalBeforeDiscount * appliedPromo.discount_value) / 100);
      if (appliedPromo.max_discount && discountAmount > appliedPromo.max_discount) {
        discountAmount = appliedPromo.max_discount;
      }
    } else {
      discountAmount = appliedPromo.discount_value;
    }
  }

  const finalTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);

  const handleApplyPromo = () => {
    setPromoError('');
    if (!promoInput.trim()) return;

    const promo = promotions.find(
      (p) => p.code.toUpperCase() === promoInput.trim().toUpperCase()
    );

    if (!promo) {
      setPromoError('Mã giảm giá không hợp lệ');
      return;
    }

    if (subtotalBeforeDiscount < promo.min_order) {
      setPromoError(`Đơn hàng tối thiểu ${promo.min_order.toLocaleString('vi-VN')}đ`);
      return;
    }

    setAppliedPromo(promo);
  };

  // P0.2: Xử lý Đổi Suất Chiếu chuẩn logic nghiệp vụ
  const handleSelectShowtimeInBooking = async (
    slot: any,
    newCinemaId: string | number,
    newDate: string
  ) => {
    setIsShowtimeChangeOpen(false);

    // 1. Xóa sạch danh sách ghế cũ của suất trước (P0.2)
    BookingService.releaseSessionHold(sessionId);
    setSelectedSeats([]);
    setOrphanWarning(null);

    // 2. Reset combo bắp nước và chiết khấu (tính lại giá)
    setFoodQuantities({ 1: 0, 2: 0, 3: 0 });
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');

    // 3. Cập nhật URL router.replace mà không reload trang để đồng bộ query
    router.replace(
      `/booking?movie=${selectedMovie?.id}&cinema=${newCinemaId}&date=${newDate}&showtime=${slot.id}&time=${slot.time}`
    );

    // 4. Reset timer giữ chỗ 10 phút
    setTimeLeft(10 * 60);

    // 5. Tải lại sơ đồ ghế của suất chiếu mới
    const isRealDb =
      slot.id === '85608755-35ca-4157-87bd-96b50577e0e5' &&
      (newCinemaId === 1 || newCinemaId === '1');

    if (isRealDb) {
      try {
        const { BookingService } = await import('@/services/booking.service');
        const dbSeats = await BookingService.getShowtimeSeats(slot.id);
        if (dbSeats && dbSeats.length > 0) {
          setSeats(
            dbSeats.map((s) => ({
              id: s.id,
              row_label: s.row_label,
              seat_number: s.seat_number,
              grid_row: s.grid_row,
              grid_col: s.grid_col,
              seat_type: {
                id: s.seat_type || 'standard',
                code: (s.seat_type || 'STANDARD').toUpperCase() as any,
                name: (s.seat_type || 'STANDARD').toUpperCase(),
              },
              seat_group: s.seat_group,
              status: s.status as any,
            }))
          );
          return;
        }
      } catch (err) {
        console.error('Lỗi tải lại ghế khi đổi suất:', err);
      }
    }

    // Tải sơ đồ ghế riêng biệt theo rạp và suất mới (không trùng lặp với rạp/suất khác)
    const newSeats = getDynamicShowtimeSeats(
      1,
      newCinemaId,
      slot.id,
      newDate,
      slot.time,
      new Set(),
      new Set(),
      new Set()
    );
    setSeats(newSeats);
  };

  const handleCheckout = async () => {
    if (selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất một ghế');
      return;
    }

    // Guest validation: Require name, phone, and email if not logged in
    setGuestError('');
    let payerName = currentUser?.full_name || guestName.trim();
    let payerEmail = currentUser?.email || guestEmail.trim();
    let payerPhone = currentUser?.phone || guestPhone.trim();

    if (!currentUser) {
      if (!guestName.trim() || !guestPhone.trim() || !guestEmail.trim()) {
        setGuestError('Vui lòng điền đầy đủ họ tên, số điện thoại và email nhận vé.');
        const el = document.getElementById('guest-info-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    setIsProcessingPayment(true);
    setGuestError('');

    try {
      const { BookingService } = await import('@/services/booking.service');
      const { PaymentService } = await import('@/services/payment.service');

      const seatIds = selectedSeats.map((s) => s.id.toString());
      const showtimeId = selectedShowtime?.id?.toString() || '85608755-35ca-4157-87bd-96b50577e0e5';
      const validShowtimeId = showtimeId.length === 36 ? showtimeId : '85608755-35ca-4157-87bd-96b50577e0e5';

      // P0.3: Kiểm tra xung đột ghế thời gian thực (Atomic seat availability verification)
      const freshSeats = await BookingService.getShowtimeSeats(validShowtimeId);
      if (freshSeats && freshSeats.length > 0) {
        const conflictedSeat = freshSeats.find((fs) => {
          const isSelected = seatIds.includes(fs.id.toString());
          if (!isSelected) return false;
          // Nếu ghế đã bị bán hoặc đang giữ bởi người khác còn hạn
          const isSold = (fs.status as string) === 'booked' || fs.status === 'sold';
          const isHeldValid = fs.status === 'held' && fs.held_until && new Date(fs.held_until) > new Date();
          return isSold || isHeldValid;
        });

        if (conflictedSeat) {
          setIsProcessingPayment(false);
          const label = `${conflictedSeat.row_label}${conflictedSeat.seat_number}`;
          alert(`Ghế ${label} vừa được khách hàng khác giữ hoặc mua. Vui lòng chọn ghế khác!`);
          // Làm mới lại sơ đồ ghế
          setSeats((prev) =>
            prev.map((s) => (s.id.toString() === conflictedSeat.id.toString() ? { ...s, status: 'sold' as any } : s))
          );
          setSelectedSeats((prev) => prev.filter((s) => s.id.toString() !== conflictedSeat.id.toString()));
          return;
        }
      }

      // 1. Tạo đơn hàng và giữ ghế trên Supabase (RPC hold_seats)

      let orderRes;
      try {
        orderRes = await BookingService.holdSeats({
          showtimeId: showtimeId,
          seatIds: seatIds,
          userId: currentUser?.id || null,
          channel: 'online',
          contactName: payerName,
          contactEmail: payerEmail,
          contactPhone: payerPhone,
        });
      } catch (err: any) {
        console.warn('hold_seats RPC fallback to direct flow:', err);
        // Nếu mock showtime ID không tồn tại trong DB, tạo mock order_id an toàn
        orderRes = {
          order_id: 'mock-' + Date.now(),
          order_code: 'CNM' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        };
      }

      const orderId = orderRes.order_id;
      const generatedCode = orderRes.order_code;
      const seatsStr = selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', ');

      // Nếu phương thức thanh toán là VIETQR -> Mở Modal VietQR để khách quét mã chuyển tiền
      if (paymentMethod === 'VIETQR') {
        setPendingVietQROrder({
          orderId,
          orderCode: generatedCode,
          amount: finalTotal,
          payerName,
          payerEmail,
          payerPhone,
          seatsStr,
        });
        setIsVietQRModalOpen(true);
        setIsProcessingPayment(false);
        return;
      }

      // 2. Xác nhận thanh toán qua Supabase (RPC confirm_order_payment)
      if (!orderId.startsWith('mock-')) {
        try {
          await PaymentService.confirmPayment(orderId, paymentMethod as any);
        } catch (payErr) {
          console.error('Lỗi xác nhận thanh toán Supabase:', payErr);
        }
      }

      const paidTime =
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        new Date().toLocaleDateString('vi-VN');

      const newBooking = {
        bookingCode: generatedCode,
        paidAt: paidTime,
        totalAmount: finalTotal,
        seatsStr: seatsStr,
        customerName: payerName,
        customerEmail: payerEmail,
        customerPhone: payerPhone,
      };

      setCompletedBooking(newBooking);

      // 3. Lưu vào localStorage dự phòng cho client
      try {
        const stored = localStorage.getItem('cinemax_user_tickets');
        const list = stored ? JSON.parse(stored) : [];
        const ticketRecord = {
          id: orderId,
          userId: currentUser ? currentUser.id : 'guest',
          customerName: payerName,
          customerEmail: payerEmail,
          customerPhone: payerPhone,
          bookingCode: generatedCode,
          movieTitle: selectedMovie.title,
          movieId: selectedMovie.id,
          posterUrl: selectedMovie.poster_url,
          cinemaName: selectedCinema.name,
          cinemaId: selectedCinema.id,
          roomName: selectedShowtime.room?.name || 'Phòng 01 (IMAX)',
          showtimeId: selectedShowtime?.id || queryShowtimeId,
          showtimeDate: queryDate,
          showtimeTime: queryTime,
          showtime: `${queryTime} • ${queryDate}`,
          seats: seatsStr,
          totalAmount: finalTotal,
          createdAt: paidTime,
          status: 'ĐÃ THANH TOÁN',
        };

        list.unshift(ticketRecord);
        localStorage.setItem('cinemax_user_tickets', JSON.stringify(list));
        localStorage.setItem('cinemax_last_booking', JSON.stringify(ticketRecord));

        // Cập nhật số ghế trống khả dụng của suất chiếu trong cinemax_showtimes_v2
        const showtimesStored = localStorage.getItem('cinemax_showtimes_v2');
        if (showtimesStored) {
          const showtimesList = JSON.parse(showtimesStored);
          const targetShowtimeId = selectedShowtime?.id || queryShowtimeId;
          const updatedShowtimes = showtimesList.map((st: any) => {
            if (st.id?.toString() === targetShowtimeId?.toString()) {
              const curSeats = st.available_seats ?? 75;
              return {
                ...st,
                available_seats: Math.max(0, curSeats - selectedSeats.length),
              };
            }
            return st;
          });
          localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(updatedShowtimes));
        }

        BookingService.releaseSessionHold(sessionId);
        window.dispatchEvent(new Event('cinemax_data_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error('Error storing local ticket', e);
      }

      // Đánh dấu các ghế vừa mua thành đã bán ngay lập tức
      setSeats((prev) =>
        prev.map((s) =>
          selectedSeats.some((sel) => sel.id === s.id) ? { ...s, status: 'sold' as any } : s
        )
      );

      setCurrentStep(3);
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Có lỗi xảy ra trong quá trình đặt vé: ' + (error?.message || 'Vui lòng thử lại!'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmVietQR = async (txDetails?: any) => {
    if (!pendingVietQROrder) return;
    const { PaymentService } = await import('@/services/payment.service');

    const bankTxnId = txDetails?.transactionId || `FT-${Date.now()}`;
    const senderBank = txDetails?.senderBank || 'TPBank';

    if (!pendingVietQROrder.orderId.startsWith('mock-')) {
      try {
        await PaymentService.confirmPayment(pendingVietQROrder.orderId, 'CARD', bankTxnId);
      } catch (payErr) {
        console.error('Lỗi xác nhận thanh toán Supabase:', payErr);
      }
    }

    const paidTime =
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' • ' +
      new Date().toLocaleDateString('vi-VN');

    const newBooking = {
      bookingCode: pendingVietQROrder.orderCode,
      paidAt: paidTime,
      totalAmount: pendingVietQROrder.amount,
      seatsStr: pendingVietQROrder.seatsStr,
      customerName: pendingVietQROrder.payerName,
      customerEmail: pendingVietQROrder.payerEmail,
      customerPhone: pendingVietQROrder.payerPhone,
    };

    setCompletedBooking(newBooking);

    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      const list = stored ? JSON.parse(stored) : [];
      const ticketRecord = {
        id: pendingVietQROrder.orderId,
        userId: currentUser ? currentUser.id : 'guest',
        customerName: pendingVietQROrder.payerName,
        customerPhone: pendingVietQROrder.payerPhone,
        customerEmail: pendingVietQROrder.payerEmail,
        bookingCode: pendingVietQROrder.orderCode,
        movieTitle: selectedMovie.title,
        movieId: selectedMovie.id,
        moviePoster: selectedMovie.poster_url,
        cinemaName: selectedCinema.name,
        cinemaId: selectedCinema.id,
        roomName: selectedShowtime.room?.name || 'Phòng 01 (IMAX)',
        showtimeId: selectedShowtime?.id || queryShowtimeId,
        showtimeDate: queryDate,
        showtimeTime: queryTime,
        showtime: `${queryTime} • ${queryDate}`,
        seats: selectedSeats.map((s) => `${s.row_label}${s.seat_number}`),
        seatsStr: pendingVietQROrder.seatsStr,
        totalAmount: pendingVietQROrder.amount,
        status: 'ĐÃ THANH TOÁN',
        paymentMethod: `VIETQR (TPBank) • ${bankTxnId}`,
        bankTxnId,
        senderBank,
        paidAt: paidTime,
      };

      list.unshift(ticketRecord);
      localStorage.setItem('cinemax_user_tickets', JSON.stringify(list));
      localStorage.setItem('cinemax_last_booking', JSON.stringify(ticketRecord));

      // Cập nhật số ghế trống khả dụng của suất chiếu trong cinemax_showtimes_v2
      const showtimesStored = localStorage.getItem('cinemax_showtimes_v2');
      if (showtimesStored) {
        const showtimesList = JSON.parse(showtimesStored);
        const targetShowtimeId = selectedShowtime?.id || queryShowtimeId;
        const updatedShowtimes = showtimesList.map((st: any) => {
          if (st.id?.toString() === targetShowtimeId?.toString()) {
            const curSeats = st.available_seats ?? 75;
            return {
              ...st,
              available_seats: Math.max(0, curSeats - selectedSeats.length),
            };
          }
          return st;
        });
        localStorage.setItem('cinemax_showtimes_v2', JSON.stringify(updatedShowtimes));
      }

      BookingService.releaseSessionHold(sessionId);
      window.dispatchEvent(new Event('cinemax_data_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Lỗi lưu ticket localStorage:', e);
    }

    // Đánh dấu các ghế vừa mua thành đã bán ngay lập tức
    setSeats((prev) =>
      prev.map((s) =>
        selectedSeats.some((sel) => sel.id === s.id) ? { ...s, status: 'sold' as any } : s
      )
    );

    setIsVietQRModalOpen(false);
    setCurrentStep(3);
  };

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-8 lg:px-20 py-8 space-y-8">
        {/* STEPPER & COUNTDOWN (Figma Screen 3 & 4) */}
        {currentStep < 3 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#303645] pb-6">
            {/* Stepper matching Figma: 1 Chọn ghế > 2 Bắp nước > 3 Thanh toán */}
            <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
              <span className={currentStep === 1 ? 'text-[#E63845]' : 'text-white'}>
                1. Chọn ghế
              </span>
              <span className="text-[#9EA6B8]">&gt;</span>
              <span className={currentStep === 2 ? 'text-[#E63845]' : 'text-[#9EA6B8]'}>
                2. Bắp nước
              </span>
              <span className="text-[#9EA6B8]">&gt;</span>
              <span className={currentStep === 2 ? 'text-white' : 'text-[#9EA6B8]'}>
                3. Thanh toán
              </span>
            </div>

            {/* Countdown Timer (Figma Screen 3: "⏱ Giữ ghế còn 09:42") */}
            <div className="flex items-center gap-2 text-[#FABF2E] font-bold text-xs sm:text-sm bg-[#1A1C26] px-4 py-2 rounded-full border border-[#FABF2E]/30">
              <Clock className="w-4 h-4 animate-pulse text-[#FABF2E]" />
              <span>Giữ ghế còn:</span>
              <span className="font-mono text-sm sm:text-base font-black">{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FIGMA SCREEN 3: CHỌN GHẾ */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Seat Map (Left 2 cols) */}
            <div className="lg:col-span-2 bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 flex flex-col items-center">
              {/* Thống kê đếm đúng số ghế và số ghế trống thời gian thực */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0F1217] p-3 rounded-2xl border border-[#303645] mb-8 text-xs select-none shadow-inner">
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#1A1C26] px-3 py-2 rounded-xl border border-[#303645]/70">
                  <span className="text-[#9EA6B8]">Tổng số ghế:</span>
                  <span className="font-bold text-white font-mono">{totalSeatsCount} ghế</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#33C773]/10 px-3 py-2 rounded-xl border border-[#33C773]/30">
                  <span className="text-[#9EA6B8]">Ghế trống:</span>
                  <span className="font-bold text-[#33C773] font-mono">{availableSeatsCount} ghế</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#383D4D]/40 px-3 py-2 rounded-xl border border-[#383D4D]">
                  <span className="text-[#9EA6B8]">Đã khóa/bán:</span>
                  <span className="font-bold text-gray-300 font-mono">{soldSeatsCount} ghế</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#E63845]/10 px-3 py-2 rounded-xl border border-[#E63845]/30">
                  <span className="text-[#9EA6B8]">Đang chọn:</span>
                  <span className="font-bold text-[#E63845] font-mono">{selectedSeatsCount} ghế</span>
                </div>
              </div>

              {/* Banner cảnh báo ghế trống đơn lẻ (Orphan Seat Warning - Phương án A) */}
              {orphanWarning && orphanWarning.hasOrphanSeats && (
                <div className="w-full bg-[#FABF2E]/10 border border-[#FABF2E]/40 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 shadow-lg">
                  <div className="flex items-start gap-2.5 text-[#FABF2E]">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white text-sm">
                        Cảnh báo: Phát hiện ghế trống đơn lẻ bị kẹp
                      </div>
                      <p className="text-gray-300 mt-1 leading-relaxed">
                        {orphanWarning.suggestionMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleAddOrphanSeats(orphanWarning.orphanSeats)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#FABF2E] hover:bg-yellow-400 text-black font-bold text-xs cursor-pointer transition-colors shadow-md"
                    >
                      + Chọn luôn ghế {orphanWarning.orphanSeats.join(', ')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAcknowledgedOrphan(true);
                        setOrphanWarning(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#303645] hover:bg-[#383D4D] text-gray-300 hover:text-white font-medium text-xs cursor-pointer transition-colors"
                    >
                      Bỏ qua & Tiếp tục
                    </button>
                  </div>
                </div>
              )}

              {/* Red Screen Curve (Figma Screen 3) */}
              <div className="w-full max-w-xl mx-auto flex flex-col items-center mb-10">
                <div className="w-full h-3 rounded-t-[100%] border-t-2 border-[#E63845] shadow-[0_-10px_20px_rgba(230,56,69,0.35)] mb-3" />
                <span className="text-xs tracking-[0.3em] text-[#9EA6B8] font-bold uppercase">
                  MÀN HÌNH
                </span>
              </div>

              {/* Seat Matrix with Center Aisle */}
              <div className="w-full overflow-x-auto pb-6 flex justify-center">
                <div className="inline-grid gap-2 text-center select-none">
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((row) => {
                    const rowSeats = seats.filter((s) => s.row_label === row);
                    const isCoupleRow = row === 'H';

                    // Center aisle: 5 seats on left, 5 on right (for couple: 3 and 3)
                    const leftSeats = isCoupleRow ? rowSeats.slice(0, 3) : rowSeats.slice(0, 5);
                    const rightSeats = isCoupleRow ? rowSeats.slice(3, 6) : rowSeats.slice(5, 10);

                    const renderSeatButton = (seat: Seat) => {
                      const isSelected = selectedSeats.some((s) => s.id === seat.id);
                      const isSold =
                        seat.status === 'SOLD' ||
                        seat.status === 'sold' ||
                        seat.status === 'BOOKED' ||
                        seat.status === 'booked';
                      const isHeld = seat.status === 'HELD' || seat.status === 'held';
                      const isBlocked = seat.status === 'BLOCKED' || seat.status === 'blocked';
                      const isVip = seat.seat_type?.code === 'VIP';
                      const isCouple = seat.seat_type?.code === 'COUPLE';

                      let bgClass = 'bg-[#303645]/80 text-[#9CA3AF] border border-[#9CA3AF]/40 hover:border-white';
                      if (isVip) {
                        bgClass = 'bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/70 hover:bg-[#FABF2E]/30';
                      }
                      if (isCouple) {
                        bgClass = 'bg-[#F472B6]/20 text-[#F472B6] border border-[#F472B6]/70 hover:bg-[#F472B6]/30';
                      }
                      if (isSelected) {
                        bgClass = 'bg-[#E63845] text-white border-transparent font-bold glow-primary scale-105';
                      }
                      if (isHeld) {
                        bgClass = 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/60 cursor-not-allowed opacity-85';
                      }
                      if (isBlocked) {
                        bgClass = 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed line-through opacity-40';
                      }
                      if (isSold) {
                        bgClass = 'bg-[#383D4D] text-transparent border-transparent cursor-not-allowed opacity-35';
                      }

                      return (
                        <button
                          key={seat.id}
                          disabled={isSold || isHeld || isBlocked}
                          onClick={() => handleSeatClick(seat)}
                          className={`h-8 sm:h-9 rounded-lg text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${bgClass} ${
                            isCouple ? 'w-16 sm:w-20' : 'w-7 sm:w-8'
                          }`}
                          title={`${row}${seat.seat_number} - ${seat.seat_type?.name}${
                            isHeld ? ' (Đang được giữ chỗ tạm thời)' : isBlocked ? ' (Đang bảo trì/khóa)' : isSold ? ' (Đã bán)' : ''
                          }`}
                        >
                          {isHeld ? (
                            <Clock className="w-3.5 h-3.5 animate-pulse text-[#F59E0B]" />
                          ) : isBlocked ? (
                            '✕'
                          ) : isCouple ? (
                            `ĐÔI ${seat.seat_number}`
                          ) : (
                            seat.seat_number
                          )}
                        </button>
                      );
                    };

                    return (
                      <div key={row} className="flex items-center justify-center gap-2">
                        <span className="w-5 text-xs font-bold text-[#9EA6B8]">{row}</span>

                        {/* Left seat block */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {leftSeats.map(renderSeatButton)}
                        </div>

                        {/* Center Aisle */}
                        <div className="w-8 sm:w-12 text-[10px] text-[#9EA6B8]/40 flex items-center justify-center font-mono">
                          •
                        </div>

                        {/* Right seat block */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {rightSeats.map(renderSeatButton)}
                        </div>

                        <span className="w-5 text-xs font-bold text-[#9EA6B8]">{row}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seat Legend - Phân biệt rõ cả 4 trạng thái: AVAILABLE, HELD, BOOKED, BLOCKED */}
              <div className="w-full border-t border-[#303645] pt-6 mt-6 flex flex-wrap items-center justify-center gap-3.5 sm:gap-5 text-xs text-[#9EA6B8]">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#303645] border border-[#9CA3AF]" />
                  <span>Thường (90k)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#FABF2E]/20 border border-[#FABF2E]" />
                  <span>VIP (110k)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-4 rounded bg-[#F472B6]/20 border border-[#F472B6]" />
                  <span>Đôi (210k)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#E63845]" />
                  <span className="text-white font-semibold">Đang chọn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#F59E0B]/20 border border-[#F59E0B] flex items-center justify-center">
                    <Clock className="w-2.5 h-2.5 text-[#F59E0B]" />
                  </div>
                  <span className="text-[#F59E0B] font-medium">Đang giữ chỗ (HELD)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#383D4D] opacity-40" />
                  <span>Đã bán (BOOKED)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] text-zinc-500 font-bold">
                    ✕
                  </div>
                  <span>Bị khóa (BLOCKED)</span>
                </div>
              </div>
            </div>

            {/* Right: Thông Tin Vé Card (Figma Screen 3) */}
            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <h3 className="font-bold text-white text-lg border-b border-[#303645] pb-3">
                  Thông tin vé
                </h3>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-[#9EA6B8] block text-xs">Phim:</span>
                    <span className="font-bold text-white text-base">{selectedMovie.title}</span>
                  </div>
                  <div>
                    <span className="text-[#9EA6B8] block text-xs">Rạp chiếu:</span>
                    <span className="font-semibold text-white">{selectedCinema.name}</span>
                  </div>
                  <div>
                    <span className="text-[#9EA6B8] block text-xs">Phòng chiếu:</span>
                    <span className="font-semibold text-white">
                      {selectedShowtime.room?.name || 'Phòng 01 (IMAX)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[#9EA6B8] block text-xs">Suất chiếu:</span>
                      <span className="font-bold text-[#FABF2E]">{queryTime} • {queryDate}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsShowtimeChangeOpen(true)}
                      className="text-[11px] text-[#E63845] hover:underline font-semibold bg-[#E63845]/10 px-2.5 py-1 rounded-lg border border-[#E63845]/30 cursor-pointer transition-colors"
                    >
                      Đổi suất
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#0F1217] rounded-xl border border-[#303645] text-xs">
                    <div>
                      <span className="text-[#9EA6B8] block text-[10px]">Tổng số ghế:</span>
                      <span className="font-bold text-white font-mono">{totalSeatsCount} ghế</span>
                    </div>
                    <div>
                      <span className="text-[#9EA6B8] block text-[10px]">Ghế trống còn lại:</span>
                      <span className="font-bold text-[#33C773] font-mono">{availableSeatsCount} ghế</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#303645]">
                    <span className="text-[#9EA6B8] block text-xs mb-1.5">Ghế đã chọn:</span>
                    {selectedSeats.length === 0 ? (
                      <span className="text-xs text-[#9EA6B8] italic">Chưa chọn ghế nào</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedSeats.map((s) => (
                          <span
                            key={s.id}
                            className="bg-[#E63845] text-white text-xs px-2.5 py-1 rounded-md font-bold"
                          >
                            {s.row_label}{s.seat_number}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Total & Red Tiếp Tục Button (Figma Screen 3) */}
              <div className="pt-4 border-t border-[#303645] space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-[#9EA6B8]">Tổng tiền:</span>
                  <span className="text-2xl font-black text-[#E63845]">
                    {ticketSubtotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <button
                  disabled={selectedSeats.length === 0}
                  onClick={handleProceedToStep2}
                  className="w-full bg-[#E63845] hover:bg-[#CC2B37] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer"
                >
                  Tiếp tục
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FIGMA SCREEN 4: BẮP NƯỚC & THANH TOÁN */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Food, Guest Info, Voucher & Payment (Figma Screen 4) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Bắp nước & combo */}
              <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-4">
                <h3 className="text-lg font-bold text-white">Bắp nước & combo</h3>

                <div className="space-y-4">
                  {foods.map((food) => {
                    const qty = foodQuantities[food.id] || 0;
                    return (
                      <div
                        key={food.id}
                        className="bg-[#0F1217] border border-[#303645] rounded-2xl p-4 flex gap-4 items-center justify-between"
                      >
                        <img
                          src={food.image_url}
                          alt={food.name}
                          className="w-16 h-16 object-cover rounded-xl border border-[#303645]"
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white line-clamp-1">{food.name}</h4>
                          <p className="text-xs text-[#9EA6B8] line-clamp-1 mt-0.5">{food.description}</p>
                          <div className="text-sm font-bold text-[#FABF2E] mt-1">
                            {food.price.toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        {/* Stepper - 0 + */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFoodQuantities({
                                ...foodQuantities,
                                [food.id]: Math.max(0, qty - 1),
                              })
                            }
                            className="w-8 h-8 rounded-full bg-[#1A1C26] border border-[#303645] flex items-center justify-center text-white hover:border-[#E63845] cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-white">{qty}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFoodQuantities({
                                ...foodQuantities,
                                [food.id]: qty + 1,
                              })
                            }
                            className="w-8 h-8 rounded-full bg-[#E63845] flex items-center justify-center text-white hover:bg-[#CC2B37] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Thông tin người nhận vé (Khách vs Thành viên) */}
              <div id="guest-info-section" className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-[#E63845]" />
                    Thông tin người nhận vé
                  </h3>
                  {!currentUser && (
                    <button
                      type="button"
                      onClick={() => openAuthModal('LOGIN')}
                      className="text-xs text-[#FABF2E] hover:underline font-semibold"
                    >
                      Đã có tài khoản? Đăng nhập ngay
                    </button>
                  )}
                </div>

                {currentUser ? (
                  /* Đã đăng nhập */
                  <div className="bg-[#0F1217] border border-[#303645] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white text-sm">{currentUser.full_name}</div>
                      <div className="text-[#9EA6B8]">{currentUser.email} • {currentUser.phone || 'Chưa cập nhật SĐT'}</div>
                      <div className="text-[#FABF2E] font-semibold">Tích lũy điểm thành viên cho đơn đặt này</div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#33C773]/20 text-[#33C773] self-start sm:self-auto">
                      ✓ Đã xác thực thành viên
                    </span>
                  </div>
                ) : (
                  /* Khách chưa đăng nhập: Nhập thông tin để nhận vé */
                  <div className="space-y-3">
                    <p className="text-xs text-[#9EA6B8]">
                      Bạn đang đặt vé dưới tư cách <strong className="text-white">Khách</strong>. Vé điện tử và mã QR sẽ được gửi tới email và số điện thoại dưới đây:
                    </p>

                    {guestError && (
                      <div className="p-3 rounded-xl bg-[#E63845]/15 border border-[#E63845] text-xs text-[#E63845]">
                        {guestError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-[#9EA6B8] block mb-1">Họ và tên *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ví dụ: Trần Văn B"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#9EA6B8] block mb-1">Số điện thoại *</label>
                        <input
                          type="tel"
                          required
                          placeholder="0912 345 678"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#9EA6B8] block mb-1">Email nhận vé *</label>
                        <input
                          type="email"
                          required
                          placeholder="email@example.com"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mã giảm giá */}
              <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-3">
                <h3 className="text-lg font-bold text-white">Mã giảm giá</h3>
                <div className="flex gap-3 max-w-md">
                  <input
                    type="text"
                    placeholder="Nhập mã khuyến mãi (VD: GIAM20K)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-[#0F1217] border border-[#303645] text-white px-4 py-2.5 rounded-full text-xs font-mono uppercase focus:outline-none focus:border-[#E63845]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                  >
                    Áp dụng
                  </button>
                </div>
                {promoError && <p className="text-xs text-[#E63845]">{promoError}</p>}
                {appliedPromo && (
                  <p className="text-xs text-[#33C773] font-semibold">
                    ✓ Áp dụng thành công: giảm {discountAmount.toLocaleString('vi-VN')}đ
                  </p>
                )}
              </div>

              {/* Phương thức thanh toán (Figma Screen 4) */}
              <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Phương thức thanh toán</h3>
                  <span className="text-xs text-[#FABF2E] font-medium hidden sm:inline">
                    Khuyên dùng VietQR (Không mất phí)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {/* VIETQR TPBank (Khuyên dùng) */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('VIETQR')}
                    className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all relative overflow-hidden ${
                      paymentMethod === 'VIETQR'
                        ? 'border-[#8E24AA] bg-[#8E24AA]/15 ring-2 ring-[#8E24AA]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-[#E63845] text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg">
                      HOT
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6A1B9A] to-[#AB47BC] flex items-center justify-center text-white font-black text-xs shadow-md">
                      TPB
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-white block">VietQR</span>
                      <span className="text-[10px] text-[#FABF2E] font-medium">TPBank 24/7</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MOMO')}
                    className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'MOMO'
                        ? 'border-[#D82D8B] bg-[#D82D8B]/10 ring-2 ring-[#D82D8B]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#D82D8B] flex items-center justify-center text-white font-black text-sm">
                      M
                    </div>
                    <span className="text-xs font-bold text-white">Ví MoMo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('VNPAY')}
                    className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'VNPAY'
                        ? 'border-[#0066FF] bg-[#0066FF]/10 ring-2 ring-[#0066FF]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0066FF] flex items-center justify-center text-white font-black text-sm">
                      V
                    </div>
                    <span className="text-xs font-bold text-white">VNPAY</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ZALOPAY')}
                    className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'ZALOPAY'
                        ? 'border-[#0088FF] bg-[#0088FF]/10 ring-2 ring-[#0088FF]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0088FF] flex items-center justify-center text-white font-black text-sm">
                      Z
                    </div>
                    <span className="text-xs font-bold text-white">ZaloPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'CARD'
                        ? 'border-[#FABF2E] bg-[#FABF2E]/10 ring-2 ring-[#FABF2E]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FABF2E] flex items-center justify-center text-black font-black text-xs">
                      CARD
                    </div>
                    <span className="text-xs font-bold text-white">Thẻ ATM/Visa</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Tóm tắt đơn hàng (Figma Screen 4) */}
            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="font-bold text-white text-lg border-b border-[#303645] pb-3">
                  Tóm tắt đơn hàng
                </h3>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Phim:</span>
                    <span className="font-bold text-white">{selectedMovie.title}</span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Rạp:</span>
                    <span className="text-white">{selectedCinema.name}</span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Suất chiếu:</span>
                    <span className="text-[#FABF2E] font-medium">{queryTime} • {queryDate}</span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Ghế ({selectedSeats.length}):</span>
                    <span className="font-bold text-white">
                      {selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8] pt-2 border-t border-[#303645]">
                    <span>Tiền vé:</span>
                    <span className="text-white">{ticketSubtotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                  {foodSubtotal > 0 && (
                    <div className="flex justify-between text-[#9EA6B8]">
                      <span>Tiền bắp nước:</span>
                      <span className="text-white">{foodSubtotal.toLocaleString('vi-VN')} đ</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#33C773]">
                      <span>Giảm giá:</span>
                      <span>-{discountAmount.toLocaleString('vi-VN')} đ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total & Red Nút Thanh Toán (Figma Screen 4) */}
              <div className="pt-4 border-t border-[#303645] space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-[#9EA6B8]">Tổng cộng:</span>
                  <span className="text-2xl font-black text-[#E63845]">
                    {finalTotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="border border-[#303645] text-white p-3.5 rounded-full hover:bg-[#0F1217] cursor-pointer"
                    title="Quay lại chọn ghế"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <button
                    disabled={isProcessingPayment}
                    onClick={handleCheckout}
                    className="flex-1 bg-[#E63845] hover:bg-[#CC2B37] text-white py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer"
                  >
                    {isProcessingPayment ? 'Đang xử lý...' : `Thanh toán ${finalTotal.toLocaleString('vi-VN')}đ`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FIGMA SCREEN 5: VÉ ĐIỆN TỬ */}
        {/* ======================================================== */}
        {currentStep === 3 && completedBooking && (
          <div className="max-w-2xl mx-auto space-y-6 pt-4">
            {/* Green Header: ✓ THANH TOÁN THÀNH CÔNG */}
            <div className="flex items-center justify-center gap-2 text-[#33C773] text-center font-black text-xl">
              <CheckCircle className="w-7 h-7" />
              <span>THANH TOÁN THÀNH CÔNG</span>
            </div>

            {/* Perforated Cinema Ticket Card (Figma Screen 5) */}
            <div className="relative bg-[#1A1C26] border border-[#303645] rounded-3xl overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row">
                {/* Left Ticket Details */}
                <div className="flex-1 p-6 sm:p-8 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-[#E63845] text-white">
                      {selectedMovie.age_rating}
                    </span>
                    <span className="text-xs text-[#9EA6B8] font-bold">CINEMAX TICKET</span>
                  </div>

                  <h2 className="text-2xl font-black text-white">{selectedMovie.title}</h2>

                  <div className="space-y-2 text-xs sm:text-sm text-[#9EA6B8] pt-1">
                    <div>
                      <span className="text-white/60 block text-[11px]">Người nhận vé:</span>
                      <span className="font-semibold text-white">
                        {completedBooking.customerName} ({completedBooking.customerPhone || completedBooking.customerEmail})
                      </span>
                    </div>
                    <div>
                      <span className="text-white/60 block text-[11px]">Rạp chiếu:</span>
                      <span className="font-semibold text-white">{selectedCinema.name}</span>
                    </div>
                    <div>
                      <span className="text-white/60 block text-[11px]">Phòng & Suất chiếu:</span>
                      <span className="text-[#FABF2E] font-bold">
                        {selectedShowtime.room?.name || 'Phòng 01 (IMAX)'} • 10:00 - 29/09/2026
                      </span>
                    </div>
                    <div>
                      <span className="text-white/60 block text-[11px]">Ghế:</span>
                      <span className="text-white font-bold">{completedBooking.seatsStr}</span>
                    </div>
                    <div>
                      <span className="text-white/60 block text-[11px]">Mã đặt vé:</span>
                      <span className="font-mono font-black text-[#FABF2E] text-base tracking-wider">
                        {completedBooking.bookingCode}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/60 block text-[11px]">Tổng tiền đã thanh toán:</span>
                      <span className="font-bold text-[#E63845] text-base">
                        {completedBooking.totalAmount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Perforated Cutout Separator */}
                <div className="relative hidden md:flex flex-col items-center justify-between py-4">
                  <div className="w-6 h-6 rounded-full bg-[#0F1217] -mt-7 border-b border-[#303645]" />
                  <div className="w-0.5 h-full border-r-2 border-dashed border-[#303645]" />
                  <div className="w-6 h-6 rounded-full bg-[#0F1217] -mb-7 border-t border-[#303645]" />
                </div>

                {/* Right QR Section */}
                <div className="w-full md:w-56 bg-[#14161F] p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 border-t md:border-t-0 md:border-l border-[#303645]/50">
                  <div className="bg-white p-3 rounded-2xl shadow-xl">
                    <QrCode className="w-32 h-32 text-black" />
                  </div>
                  <div className="text-[11px] text-[#9EA6B8]">Quét tại quầy soát vé</div>
                  <div className="font-mono text-xs font-bold text-white tracking-widest">
                    {completedBooking.bookingCode}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Tải vé PDF (Red) & Xem vé của tôi (Outline) (Figma Screen 5) */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-[#E63845] hover:bg-[#CC2B37] text-white py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4" />
                Tải vé PDF
              </button>

              <button
                type="button"
                onClick={() => router.push('/my-tickets')}
                className="flex-1 border border-[#303645] bg-[#1A1C26] hover:bg-[#242836] text-white py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <TicketIcon className="w-4 h-4 text-[#FABF2E]" />
                Xem vé của tôi
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Thanh toán VietQR An toàn (TPBank) */}
      {pendingVietQROrder && (
        <VietQRModal
          isOpen={isVietQRModalOpen}
          onClose={() => setIsVietQRModalOpen(false)}
          onConfirm={handleConfirmVietQR}
          amount={pendingVietQROrder.amount}
          orderCode={pendingVietQROrder.orderCode}
          timeLeftSeconds={timeLeft}
        />
      )}

      {/* Modal Đổi Suất Chiếu Form Mẫu (P0.2: Xóa ghế cũ, tải ghế mới, tính lại giá) */}
      <ShowtimeModal
        isOpen={isShowtimeChangeOpen}
        onClose={() => setIsShowtimeChangeOpen(false)}
        movie={selectedMovie}
        cinemas={cinemas}
        onSelectShowtime={handleSelectShowtimeInBooking}
      />

      <Footer />
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F1217] flex items-center justify-center text-white">
          Đang tải dữ liệu đặt vé...
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
