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
import { syncOrderToSupabase } from '@/lib/supabase/queries';
import {
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Minus,
  ArrowLeft,
  QrCode,
  Download,
  Ticket as TicketIcon,
  User as UserIcon,
  Phone,
  Mail,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Tag,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import VietQRModal from '@/components/booking/VietQRModal';
import ShowtimeModal from '@/components/common/ShowtimeModal';
import UnifiedTicketModal from '@/components/common/UnifiedTicketModal';
import { BookingService } from '@/services/booking.service';
import { TicketScannerService } from '@/services/ticket-scanner.service';
import { checkAllSelectedSeatsForOrphans, OrphanSeatCheckResult } from '@/lib/seat-rules';
import { ContactValidator, PhoneValidationResult, EmailValidationResult } from '@/lib/contact-validator';

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser, openAuthModal, register } = useAuth();
  const {
    movies,
    cinemas,
    showtimes,
    foods,
    promotions,
    soldSeatsByShowtime,
    seatUuidLookup,
    refreshFromSupabase,
  } = useData();

  // Query Params
  const queryMovieId = searchParams.get('movie') || '1';
  const queryCinemaId = searchParams.get('cinema') || '1';
  const queryShowtimeId = searchParams.get('showtime') || '1001';
  const queryPromoCode = searchParams.get('promo') || '';
  const queryTime = searchParams.get('time') || '15:30';
  const queryFormat = searchParams.get('format') || '';
  const queryRoom = searchParams.get('room') || '';
  const rawQueryDate = searchParams.get('date') || '';
  const queryDate = rawQueryDate.includes('/')
    ? (() => {
        const parts = rawQueryDate.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : rawQueryDate;
      })()
    : (rawQueryDate || new Date().toISOString().slice(0, 10));
  const [isShowtimeChangeOpen, setIsShowtimeChangeOpen] = useState<boolean>(false);

  // If no movie is selected in the URL, redirect user to the movie selection page (/ ?tab=movies)
  useEffect(() => {
    if (!searchParams.get('movie')) {
      const promo = searchParams.get('promo') || (typeof window !== 'undefined' ? sessionStorage.getItem('cinemax_applied_promo') || '' : '');
      router.replace(`/?tab=movies${promo ? `&promo=${encodeURIComponent(promo)}` : ''}`);
    }
  }, [searchParams, router]);

  // Steps: 1 = Chọn ghế (Screen 3), 2 = Bắp nước & Thanh toán (Screen 4), 3 = Vé điện tử (Screen 5)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Dynamic Entities (safe lookup with supabase_id fallback)
  const selectedMovie =
    (queryMovieId && queryMovieId !== 'undefined'
      ? movies.find((m) => m && m.id != null && (String(m.id) === String(queryMovieId) || m.supabase_id === queryMovieId))
      : null) || movies[0];
  const selectedCinema =
    (queryCinemaId && queryCinemaId !== 'undefined'
      ? cinemas.find((c) => c && c.id != null && (String(c.id) === String(queryCinemaId) || c.supabase_id === queryCinemaId))
      : null) || cinemas[0];
  const foundShowtime =
    (queryShowtimeId && queryShowtimeId !== 'undefined'
      ? showtimes.find((s) => s && s.id != null && (String(s.id) === String(queryShowtimeId) || s.supabase_id === queryShowtimeId))
      : null) ||
    (selectedMovie
      ? showtimes.find((s) => {
          const matchMovie =
            String(s.movie_id) === String(selectedMovie.id) ||
            (selectedMovie.supabase_id && String(s.movie_id) === selectedMovie.supabase_id);
          if (!matchMovie) return false;
          const sDate = s.start_time.slice(0, 10);
          if (queryDate && sDate !== queryDate) return false;
          if (queryTime) {
            const dt = new Date(s.start_time);
            const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            if (timeStr !== queryTime && !s.start_time.includes(queryTime)) return false;
          }
          return true;
        })
      : null);
  const selectedShowtime: Showtime = foundShowtime || showtimes[0] || {
    id: queryShowtimeId || 'st-default',
    movie_id: selectedMovie?.id ?? 1,
    room_id: 1,
    start_time: `${queryDate}T${queryTime}:00`,
    end_time: `${queryDate}T${queryTime}:00`,
    format: queryFormat || '2D',
    status: 'OPEN',
    available_seats: 80,
    room: {
      id: 1,
      cinema_id: Number(selectedCinema?.id) || 1,
      name: queryRoom || 'Phòng 1 (2D Tiêu Chuẩn)',
      screen_type: (queryFormat || '2D') as any,
      total_seats: 80,
      status: 'ACTIVE',
    },
  };

  // Seats State
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);

  // Guest Information (For unauthenticated visitors)
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestError, setGuestError] = useState<string>('');
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidationResult | null>(null);
  const [emailValidation, setEmailValidation] = useState<EmailValidationResult | null>(null);
  const [emailDnsResult, setEmailDnsResult] = useState<{ isValid: boolean; error?: string } | null>(null);
  const [isCheckingEmailDns, setIsCheckingEmailDns] = useState<boolean>(false);

  // Kiểm tra tính hợp lệ của số điện thoại thời gian thực
  useEffect(() => {
    if (!guestPhone.trim()) {
      setPhoneValidation(null);
      return;
    }
    const res = ContactValidator.validateVietnamesePhone(guestPhone);
    setPhoneValidation(res);
  }, [guestPhone]);

  // Kiểm tra tính hợp lệ của Email và ping server DNS MX ngầm
  useEffect(() => {
    if (!guestEmail.trim()) {
      setEmailValidation(null);
      setEmailDnsResult(null);
      return;
    }
    const res = ContactValidator.validateEmail(guestEmail);
    setEmailValidation(res);
    setEmailDnsResult(null);

    if (res.isValid) {
      const timer = setTimeout(async () => {
        try {
          setIsCheckingEmailDns(true);
          const apiRes = await fetch('/api/validate/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: guestEmail }),
          });
          const data = await apiRes.json();
          setEmailDnsResult({
            isValid: data.isValid,
            error: data.error,
          });
        } catch {
          // Bỏ qua nếu lỗi mạng DNS
        } finally {
          setIsCheckingEmailDns(false);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [guestEmail]);

  // Food Items State: { [foodId]: quantity }
  const [foodQuantities, setFoodQuantities] = useState<{ [id: string | number]: number }>({
    1: 0,
    2: 0,
    3: 0,
  });

  // Promo Code State
  const [promoInput, setPromoInput] = useState<string>(() => {
    if (queryPromoCode) return queryPromoCode;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('cinemax_applied_promo') || '';
    }
    return '';
  });
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState<string>('');
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

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
    foodsStr?: string;
    foods?: any[];
  } | null>(null);
  const [completedBooking, setCompletedBooking] = useState<{
    bookingCode: string;
    paidAt: string;
    totalAmount: number;
    seatsStr: string;
    foodsStr?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    isOverduePaid?: boolean;
    overdueWarningMessage?: string;
  } | null>(null);
  const [showUnifiedModal, setShowUnifiedModal] = useState<boolean>(false);

  // Chuyển đổi Guest thành Member (Post-payment conversion)
  const [memberPassword, setMemberPassword] = useState<string>('');
  const [memberCreated, setMemberCreated] = useState<boolean>(false);
  const [memberError, setMemberError] = useState<string>('');
  const [isRegisteringMember, setIsRegisteringMember] = useState<boolean>(false);
  const [dismissMemberBanner, setDismissMemberBanner] = useState<boolean>(false);

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
  const [isPaymentGraceApplied, setIsPaymentGraceApplied] = useState<boolean>(false);

  // Helper: Sinh sơ đồ ghế chuẩn xác 10 cột khớp 100% với Nhân viên quầy vé Staff POS
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
    const dynamicSeats: Seat[] = [];
    let seatId = 1;

    rows.forEach((row, rowIdx) => {
      const isCouple = row === 'H';
      const isVip = row === 'F' || row === 'G';
      const typeId = isCouple ? 3 : isVip ? 2 : 1;
      const typeCode = isCouple ? 'COUPLE' : isVip ? 'VIP' : 'STANDARD';

      for (let c = 1; c <= 10; c++) {
        const label = `${row}${c}`;
        let status: 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED' = 'AVAILABLE';
        if (locallyBookedSeats.has(label)) status = 'SOLD';
        else if (locallyHeldSeats.has(label)) status = 'HELD';
        else if (locallyBlockedSeats.has(label)) status = 'BLOCKED';

        dynamicSeats.push({
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
            code: typeCode as any,
            name: isCouple ? 'Ghế đôi' : isVip ? 'Ghế VIP' : 'Ghế thường',
            capacity: isCouple ? 2 : 1,
            color_code: isCouple ? '#F472B6' : isVip ? '#FBBF24' : '#9CA3AF',
          },
          status,
        });
      }
    });

    return dynamicSeats;
  }

  const loadSeats = React.useCallback(async () => {
    // Tự động giải phóng các ghế giữ tạm đã hết hạn
    await BookingService.releaseExpiredHolds();

    // 1. Đọc danh sách vé đã đặt từ localStorage CHỈ cho đúng rạp, phim và suất chiếu này
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cinemax_user_tickets') : null;
    const localTickets = stored ? JSON.parse(stored) : [];
    const bookedSeatLabels = new Set<string>();

    // Đọc từ soldSeatsByShowtime trong DataContext chỉ khi đúng suất chiếu trong DB
    if (foundShowtime) {
      const ctxSold = (soldSeatsByShowtime as Record<string | number, string[]>)?.[foundShowtime.id];
      if (Array.isArray(ctxSold)) {
        ctxSold.forEach((s: string) => bookedSeatLabels.add(String(s).trim().toUpperCase()));
      }
    }

    localTickets.forEach((t: any) => {
      const matchExactShowtime =
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

      if (matchExactShowtime || (matchCinema && matchMovie && matchDate && matchTime)) {
        if (Array.isArray(t.seats)) {
          t.seats.forEach((s: string) => bookedSeatLabels.add(String(s).trim().toUpperCase()));
        } else if (typeof t.seats === 'string') {
          t.seats.split(',').forEach((s: string) => bookedSeatLabels.add(String(s).trim().toUpperCase()));
        }
      }
    });

    // Also sync seats sold from Staff POS (cinemax_booked_seats_v2)
    try {
      const posSeatsRaw = localStorage.getItem('cinemax_booked_seats_v2');
      if (posSeatsRaw) {
        const posSeatsMap = JSON.parse(posSeatsRaw);
        const stSeats = posSeatsMap?.[queryShowtimeId] || (selectedShowtime?.id ? posSeatsMap?.[selectedShowtime.id] : null);
        if (Array.isArray(stSeats)) {
          stSeats.forEach((s: string) => bookedSeatLabels.add(String(s).trim().toUpperCase()));
        }
      }
    } catch (e) {
      // POS seats sync fallback
    }

    // Also sync maintenance/broken seats locked from Admin & Staff Room Management
    const blockedSeatLabels = new Set<string>();
    try {
      const currentAudId = selectedShowtime?.auditorium_id || selectedShowtime?.room?.supabase_id;
      const currentRoomName = selectedShowtime?.room?.name || 'Phòng 1';

      // 1. From cinemax_seats_v2 (Admin seat status: BLOCKED)
      const adminSeatsRaw = localStorage.getItem('cinemax_seats_v2');
      if (adminSeatsRaw) {
        const adminSeats = JSON.parse(adminSeatsRaw);
        if (Array.isArray(adminSeats)) {
          adminSeats.forEach((s: any) => {
            if (s.status === 'BLOCKED' && (!currentAudId || s.auditorium_id === currentAudId)) {
              blockedSeatLabels.add(`${s.row_label}${s.seat_number}`);
            }
          });
        }
      }

      // 2. From cinemax_maintenance_seats_v2 (Staff & Admin Room Management)
      const maintRaw = localStorage.getItem('cinemax_maintenance_seats_v2');
      if (maintRaw) {
        const maintMap = JSON.parse(maintRaw);
        const roomBroken =
          (currentAudId && maintMap[currentAudId]) ||
          maintMap[currentRoomName] ||
          (currentRoomName.includes('2')
            ? maintMap['room-q1-2']
            : currentRoomName.includes('3')
            ? maintMap['room-q1-3']
            : maintMap['room-q1-1']);
        if (Array.isArray(roomBroken)) {
          roomBroken.forEach((s: string) => blockedSeatLabels.add(String(s).trim().toUpperCase()));
        }
      }
    } catch (e) {
      console.warn('Maintenance seats sync error:', e);
    }

    // 2. Đọc danh sách ghế đang bị giữ tạm (HELD) bởi phiên khác còn hạn
    const currentShowtimeKey = selectedShowtime?.id || queryShowtimeId;
    const heldMap = BookingService.getLocalHeldSeats(currentShowtimeKey);

    try {
      const serverHeldMap = await BookingService.syncServerHeldSeats(currentShowtimeKey);
      serverHeldMap.forEach((info, label) => {
        heldMap.set(label, info);
      });
    } catch {}

    const heldSeatLabels = new Set<string>();
    heldMap.forEach((info, label) => {
      if (info.sessionId !== sessionId) {
        heldSeatLabels.add(label);
      }
    });

    // Nếu ghế người này đang chọn bị phiên khác giữ trước -> Tự động loại bỏ khỏi giỏ hàng
    setSelectedSeats((prev) => {
      const conflicted = prev.filter((s) => {
        const label = s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`;
        return heldSeatLabels.has(label) || bookedSeatLabels.has(label);
      });
      if (conflicted.length > 0) {
        if (currentStep === 2) {
          const names = conflicted.map((c) => `${c.row_label}${c.seat_number}`).join(', ');
          alert(`Ghế (${names}) đã bị hết hạn giữ chỗ hoặc có người khác đặt. Hệ thống đưa bạn quay lại bước chọn ghế.`);
          setCurrentStep(1);
        }
        return prev.filter((s) => !conflicted.some((c) => c.id === s.id));
      }
      return prev;
    });

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
          setSeats(mapped);
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

    setSeats(dynamicSeats);
  }, [selectedShowtime, queryCinemaId, queryShowtimeId, queryDate, queryTime, selectedCinema, sessionId]);

  useEffect(() => {
    loadSeats();
    const handleUpdate = () => loadSeats();
    window.addEventListener('cinemax_data_updated', handleUpdate);
    window.addEventListener('cinemax_db_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('cinemax_seat_sync');
        bc.onmessage = () => {
          loadSeats();
        };
      }
    } catch {}

    // Polling tự động mỗi 2.5s để cập nhật tức thời ghế khi có khách khác vào từ trình duyệt/thiết bị khác
    const pollInterval = setInterval(() => {
      loadSeats();
    }, 2500);

    const handleBeforeUnload = () => {
      if (currentStep !== 3) {
        BookingService.releaseSessionHold(sessionId);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('cinemax_data_updated', handleUpdate);
      window.removeEventListener('cinemax_db_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(pollInterval);
      bc?.close();
    };
  }, [loadSeats, sessionId, currentStep]);

  useEffect(() => {
    if (currentStep === 1 || currentStep === 2) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Nếu khách đang mở VietQR Modal và thực hiện thanh toán, không giải phóng đột ngột để modal hỗ trợ cứu vé
            if (isVietQRModalOpen) {
              return 0;
            }
            clearInterval(timer);
            BookingService.releaseSessionHold(sessionId);
            alert('Đã hết thời gian giữ ghế! Hệ thống đã giải phóng ghế của bạn.');
            setSelectedSeats([]);
            setOrphanWarning(null);
            setCurrentStep(1);
            setIsPaymentGraceApplied(false);
            return 600;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStep, sessionId, isVietQRModalOpen]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeatClick = async (seat: Seat) => {
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

    // Logic Quách Khánh: Ghế đôi (COUPLE / hàng H) phải tự động chọn theo cặp
    const isCouple = seat.row_label === 'H' || seat.seat_type?.code === 'COUPLE';
    let partnerSeat: Seat | undefined;
    if (isCouple) {
      const partnerNum = seat.seat_number % 2 === 1 ? seat.seat_number + 1 : seat.seat_number - 1;
      partnerSeat = seats.find(
        (s) => s.row_label === seat.row_label && s.seat_number === partnerNum
      );
      if (partnerSeat) {
        const partnerUnavailable =
          partnerSeat.status === 'SOLD' ||
          partnerSeat.status === 'sold' ||
          partnerSeat.status === 'BOOKED' ||
          partnerSeat.status === 'booked' ||
          partnerSeat.status === 'HELD' ||
          partnerSeat.status === 'held' ||
          partnerSeat.status === 'BLOCKED' ||
          partnerSeat.status === 'blocked';
        if (partnerUnavailable && !selectedSeats.some((s) => s.id === seat.id)) {
          alert(`Ghế đôi ${seat.row_label}${partnerNum} đã không còn trống để chọn theo cặp.`);
          return;
        }
      }
    }

    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    let nextSelected: Seat[];
    if (isSelected) {
      // Hủy chọn cả ghế chính và ghế cặp
      nextSelected = selectedSeats.filter(
        (s) => s.id !== seat.id && (!partnerSeat || s.id !== partnerSeat.id)
      );
    } else {
      const seatsToAdd = partnerSeat ? [seat, partnerSeat] : [seat];
      if (selectedSeats.length + seatsToAdd.length > 8) {
        alert('Bạn chỉ có thể chọn tối đa 8 ghế trong một đơn đặt');
        return;
      }
      nextSelected = [...selectedSeats, ...seatsToAdd.filter((s) => !selectedSeats.some((sel) => sel.id === s.id))];
    }

    // Đồng bộ lập tức việc giữ ghế tạm (HELD) giữa các tab để chống chọn trùng đồng thời
    const nextSeatLabels = nextSelected.map((s) =>
      s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`
    );

    if (nextSeatLabels.length > 0) {
      const holdRes = await BookingService.holdSeatsLocal({
        showtimeId: selectedShowtime?.id || queryShowtimeId,
        sessionId,
        seatLabels: nextSeatLabels,
        holdMinutes: 10,
      });

      if (!holdRes.success) {
        alert(holdRes.error || 'Ghế vừa được người khác giữ chỗ. Vui lòng chọn ghế khác!');
        loadSeats();
        return;
      }
    } else {
      BookingService.releaseSessionHold(sessionId);
    }

    setSelectedSeats(nextSelected);

    // Kiểm tra quy tắc ghế trống đơn lẻ (Orphan / Single Seat Rule)
    const bookedSet = new Set<string>();
    const heldSet = new Set<string>();
    const blockedSet = new Set<string>();

    seats.forEach((s) => {
      const label = `${s.row_label}${s.seat_number}`;
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

  const handleAddOrphanSeats = async (orphanLabels: string[]) => {
    const seatsToAdd = seats.filter((s) => {
      const label = `${s.row_label}${s.seat_number}`;
      return orphanLabels.includes(label) && !selectedSeats.some((sel) => sel.id === s.id);
    });

    if (seatsToAdd.length > 0) {
      if (selectedSeats.length + seatsToAdd.length > 8) {
        alert('Tổng số ghế vượt quá 8 ghế tối đa. Vui lòng điều chỉnh lại.');
        return;
      }
      const updated = [...selectedSeats, ...seatsToAdd];
      const updatedLabels = updated.map((s) =>
        s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`
      );
      const holdRes = await BookingService.holdSeatsLocal({
        showtimeId: selectedShowtime?.id || queryShowtimeId,
        sessionId,
        seatLabels: updatedLabels,
        holdMinutes: 10,
      });
      if (!holdRes.success) {
        alert(holdRes.error || 'Không thể chọn thêm ghế gợi ý do ghế vừa được giữ.');
        loadSeats();
        return;
      }
      setSelectedSeats(updated);
      setOrphanWarning(null);
      setAcknowledgedOrphan(true);
    }
  };

  const handleProceedToStep2 = async () => {
    if (selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất một ghế');
      return;
    }

    // Nếu phát hiện ghế trống đơn lẻ mà khách chưa xác nhận bỏ qua, hiển thị nhắc nhở
    if (orphanWarning && orphanWarning.hasOrphanSeats && !acknowledgedOrphan) {
      const userConfirm = confirm(
        `${orphanWarning.suggestionMessage}\n\nBạn có chắc chắn muốn tiếp tục giữ các ghế này không?`
      );
      if (!userConfirm) return;
    }

    // Cơ chế chống trùng vé (Concurrency Control): Giữ ghế 10 phút
    const seatLabels = selectedSeats.map((s) => `${s.row_label}${s.seat_number}`);

    const holdRes = await BookingService.holdSeatsLocal({
      showtimeId: selectedShowtime?.id || queryShowtimeId,
      sessionId,
      seatLabels,
      holdMinutes: 10,
      userId: currentUser?.id,
    });

    if (!holdRes.success) {
      alert(holdRes.error || 'Ghế vừa được người khác giữ chỗ. Vui lòng chọn ghế khác!');
      return;
    }

    // Khi sang bước thanh toán: tự động cộng thêm 1 phút (tối đa 11 phút) và giữ timer đếm tiếp
    if (!isPaymentGraceApplied) {
      await BookingService.extendPaymentGracePeriod(selectedShowtime?.id || queryShowtimeId, sessionId);
      setTimeLeft((prev) => Math.min(prev + 60, 660));
      setIsPaymentGraceApplied(true);
    }
    setCurrentStep(2);
  };

  const getSeatPrice = (seat: Seat) => {
    const code =
      seat.seat_type?.code ||
      (seat.row_label === 'H' ? 'COUPLE' : ['F', 'G'].includes(seat.row_label) ? 'VIP' : 'STANDARD');
    const dynamicPrice = selectedShowtime?.prices?.find((p) => p.seat_type?.code === code)?.price;
    if (dynamicPrice && dynamicPrice > 0) return dynamicPrice;
    if (code === 'COUPLE') return 210000;
    if (code === 'VIP') return 110000;
    return 90000;
  };

  const ticketSubtotal = selectedSeats.reduce((sum, seat) => sum + getSeatPrice(seat), 0);
  const totalSeatsCount = seats.length;
  const soldSeatsCount = seats.filter((s) => s.status === 'sold' || s.status === 'blocked').length;
  const selectedSeatsCount = selectedSeats.length;
  const availableSeatsCount = Math.max(0, totalSeatsCount - soldSeatsCount - selectedSeatsCount);

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

  // Danh sách voucher hợp lệ từ Admin và Database
  const validVouchers = React.useMemo(() => {
    let list: Promotion[] = promotions || [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_promotions_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const map = new Map<string, Promotion>();
            list.forEach((p) => map.set(p.code.toUpperCase(), p));
            parsed.forEach((p: any) => {
              map.set(p.code.toUpperCase(), {
                id: p.id || Math.random(),
                code: p.code,
                description: p.description,
                discount_type: p.discount_type,
                discount_value: p.discount_value,
                max_discount: p.max_discount,
                min_order: p.min_order || p.min_order_amount || 0,
                per_user_limit: p.per_user_limit || 1,
                used_count: p.used_count || 0,
                valid_from: p.valid_from || '2026-01-01',
                valid_to: p.valid_to || '2026-12-31',
                is_active: p.is_active !== false,
              });
            });
            list = Array.from(map.values());
          }
        }
      } catch (e) {
        console.error('Error parsing cinemax_promotions_v2:', e);
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    return list.filter((v) => {
      if (v.is_active === false) return false;
      if (v.valid_to && v.valid_to < todayStr) return false;
      return true;
    });
  }, [promotions]);

  const handleApplyPromo = () => {
    setPromoError('');
    if (!promoInput.trim()) return;

    const promo = validVouchers.find(
      (p) => p.code.toUpperCase() === promoInput.trim().toUpperCase()
    );

    if (!promo) {
      setPromoError('Mã giảm giá không tồn tại hoặc đã hết hạn');
      return;
    }

    if (subtotalBeforeDiscount < promo.min_order) {
      setPromoError(`Đơn hàng tối thiểu ${promo.min_order.toLocaleString('vi-VN')}đ để áp dụng mã ${promo.code}`);
      return;
    }

    setAppliedPromo(promo);
    setIsVoucherModalOpen(false);
  };

  const handleSelectVoucher = (v: Promotion) => {
    setPromoInput(v.code);
    setPromoError('');
    if (subtotalBeforeDiscount < v.min_order) {
      setPromoError(`Đơn tối thiểu ${v.min_order.toLocaleString('vi-VN')}đ (cần thêm ${(v.min_order - subtotalBeforeDiscount).toLocaleString('vi-VN')}đ)`);
      return;
    }
    setAppliedPromo(v);
    setIsVoucherModalOpen(false);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('cinemax_applied_promo');
    }
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
    const targetSlotUuid =
      slot.supabase_id ||
      (slot.id && String(slot.id).length === 36 ? String(slot.id) : null);

    if (targetSlotUuid) {
      try {
        const { BookingService } = await import('@/services/booking.service');
        const dbSeats = await BookingService.getShowtimeSeats(targetSlotUuid);
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

    // Đọc các vé đã bán từ localStorage để khóa ghế đã có người mua
    const storedTickets = localStorage.getItem('cinemax_user_tickets');
    const bookedSeatLabels = new Set<string>();
    if (storedTickets) {
      try {
        const tickets = JSON.parse(storedTickets);
        tickets.forEach((t: any) => {
          if (
            (t.showtimeId && t.showtimeId?.toString() === slot.id?.toString()) ||
            (t.cinemaId?.toString() === newCinemaId?.toString() &&
              t.movieId?.toString() === selectedMovie?.id?.toString() &&
              (t.showtimeDate === newDate || t.date === newDate) &&
              (t.showtimeTime === slot.time || t.showtime?.includes(slot.time)))
          ) {
            if (Array.isArray(t.seats)) t.seats.forEach((s: string) => bookedSeatLabels.add(s.trim()));
            else if (typeof t.seats === 'string') t.seats.split(',').forEach((s: string) => bookedSeatLabels.add(s.trim()));
          }
        });
      } catch {}
    }

    // Tải sơ đồ ghế riêng biệt theo rạp và suất mới (khóa các ghế đã bán)
    const newSeats = getDynamicShowtimeSeats(
      1,
      newCinemaId,
      slot.id,
      newDate,
      slot.time,
      bookedSeatLabels,
      new Set(),
      new Set()
    );
    setSeats(newSeats);
  };

  const handleCheckout = async () => {
    if (selectedSeats.length === 0) {
      alert('Đơn hàng chưa có ghế nào. Vui lòng quay lại bước 1 để chọn ghế!');
      setCurrentStep(1);
      return;
    }

    // Guest validation: Require name, phone, and email if not logged in
    setGuestError('');
    let payerName = currentUser?.full_name || guestName.trim();
    let payerEmail = currentUser?.email || guestEmail.trim();
    let payerPhone = currentUser?.phone || guestPhone.trim();

    if (!currentUser) {
      if (!guestName.trim()) {
        setGuestError('Vui lòng nhập họ và tên người nhận vé.');
        const el = document.getElementById('guest-info-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const phoneRes = ContactValidator.validateVietnamesePhone(guestPhone);
      if (!phoneRes.isValid) {
        setGuestError(phoneRes.error || 'Số điện thoại không hợp lệ (cần 10 chữ số đúng nhà mạng VN).');
        const el = document.getElementById('guest-info-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      payerPhone = phoneRes.normalizedPhone || guestPhone.trim();

      const emailRes = ContactValidator.validateEmail(guestEmail);
      if (!emailRes.isValid) {
        setGuestError(emailRes.error || 'Địa chỉ email không hợp lệ.');
        const el = document.getElementById('guest-info-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      if (emailDnsResult && !emailDnsResult.isValid) {
        setGuestError(emailDnsResult.error || 'Email không có máy chủ nhận thư (Mail Server) hợp lệ.');
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
      const targetShowtimeUuid =
        selectedShowtime?.supabase_id ||
        (queryShowtimeId && queryShowtimeId.length === 36 ? queryShowtimeId : null);

      // P0.3: Kiểm tra xung đột ghế thời gian thực nếu suất chiếu đã được lưu trong DB Supabase
      if (targetShowtimeUuid) {
        const freshSeats = await BookingService.getShowtimeSeats(targetShowtimeUuid);
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
      }

      // 1. Tạo đơn hàng và giữ ghế trên Supabase (RPC hold_seats)
      let orderRes: any = null;
      if (targetShowtimeUuid) {
        try {
          orderRes = await BookingService.holdSeats({
            showtimeId: targetShowtimeUuid,
            seatIds: seatIds,
            userId: currentUser?.id || null,
            channel: 'online',
            contactName: payerName,
            contactEmail: payerEmail,
            contactPhone: payerPhone,
          });
        } catch (err: any) {
          console.warn('hold_seats RPC fallback to direct flow:', err);
        }
      }

      if (!orderRes || !orderRes.order_id) {
        orderRes = {
          order_id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          order_code: 'CNM' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        };
      }

      const orderId = orderRes.order_id;
      const generatedCode = orderRes.order_code;
      const seatsStr = selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', ');

      // Lưu chi tiết các món Bắp Nước & Combo khách đã mua
      const purchasedFoods = Object.entries(foodQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => {
          const food = foods.find((f) => f.id === parseInt(id));
          return {
            id: parseInt(id),
            name: food?.name || `Món #${id}`,
            price: food?.price || 0,
            quantity: qty,
            total: (food?.price || 0) * qty,
          };
        });
      const foodsStr = purchasedFoods.map((f) => `${f.quantity}x ${f.name}`).join(', ');

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
          foodsStr: foodsStr || undefined,
          foods: purchasedFoods,
        });
        setIsVietQRModalOpen(true);
        setIsProcessingPayment(false);
        return;
      }

      // 2. Xác nhận thanh toán qua Supabase (RPC confirm_order_payment)
      if (orderId && orderId.length === 36) {
        try {
          await PaymentService.confirmPayment(orderId, paymentMethod as any);
        } catch (payErr) {
          console.warn('Xác nhận thanh toán Supabase RPC fallback:', payErr);
        }
      }

      const paidTime =
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        new Date().toLocaleDateString('vi-VN');

      const chosenFoodsStr = Object.entries(foodQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const item = foods.find((f) => f.id === parseInt(id));
          return item ? `${qty}x ${item.name}` : '';
        })
        .filter(Boolean)
        .join(', ');

      const newBooking = {
        bookingCode: generatedCode,
        paidAt: paidTime,
        totalAmount: finalTotal,
        seatsStr: seatsStr,
        foodsStr: foodsStr || undefined,
        customerName: payerName,
        customerEmail: payerEmail,
        customerPhone: payerPhone,
      };

      setCompletedBooking(newBooking);

      // 3. Đồng bộ vào Supabase database qua syncOrderToSupabase
      const foodItemsList = Object.entries(foodQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const item = foods.find((f) => f.id === parseInt(id));
          return item
            ? {
                productUuid: item.supabase_id,
                name: item.name,
                quantity: qty,
                unitPrice: item.price,
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      try {
        await syncOrderToSupabase({
          orderCode: generatedCode,
          channel: 'online',
          contactName: payerName,
          contactEmail: payerEmail,
          contactPhone: payerPhone,
          subtotal: subtotalBeforeDiscount,
          discountAmount,
          totalAmount: finalTotal,
          paymentProvider: paymentMethod,
          showtimeUuid: selectedShowtime?.supabase_id || (typeof selectedShowtime?.id === 'string' && selectedShowtime.id.length === 36 ? selectedShowtime.id : undefined),
          auditoriumUuid: selectedShowtime?.auditorium_id || selectedShowtime?.room?.supabase_id || (typeof selectedShowtime?.room_id === 'string' && selectedShowtime.room_id.length === 36 ? selectedShowtime.room_id : undefined),
          seatCodes: selectedSeats.map((s) => `${s.row_label}${s.seat_number}`),
          seatUuidLookup,
          audienceType: 'ADULT',
          unitTicketPrice: Math.round(ticketSubtotal / Math.max(1, selectedSeats.length)),
          movieSnapshot: {
            movieTitle: selectedMovie.title,
            cinemaName: selectedCinema.name,
            roomName: selectedShowtime?.room?.name || 'Phòng 1 (2D Tiêu Chuẩn)',
            showTime: selectedShowtime?.start_time
              ? new Date(selectedShowtime.start_time).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : queryTime,
            showDate: queryDate || '14/10/2026',
            format: selectedShowtime?.room?.screen_type || '2D',
            ageRating: selectedMovie.age_rating,
          },
          foodItems: foodItemsList,
        });
        refreshFromSupabase();
      } catch (syncErr) {
        console.warn('Sync to Supabase error:', syncErr);
      }

      // 4. Lưu vào localStorage dự phòng cho client
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
          showtimeId: selectedShowtime?.id || queryShowtimeId,
          movieTitle: selectedMovie.title,
          posterUrl: selectedMovie.poster_url,
          ageRating: selectedMovie.age_rating,
          format: selectedShowtime?.format || '2D Digital',
          cinemaName: selectedCinema.name,
          cinemaId: selectedCinema.id,
          roomName: selectedShowtime?.room?.name || 'Phòng 01 (IMAX)',
          auditoriumName: selectedShowtime?.room?.name || 'Phòng 01 (IMAX)',
          showtimeDate: queryDate,
          showtimeTime: queryTime,
          showtime: `${queryTime} • ${queryDate || '14/10/2026'}`,
          seats: seatsStr,
          audienceLabel: 'Người lớn (Đặt Online)',
          foods: purchasedFoods,
          foodsStr: foodsStr || undefined,
          foodSummary: chosenFoodsStr || 'Không kèm bắp nước',
          foodFulfilled: !chosenFoodsStr,
          paymentMethod: paymentMethod,
          channel: 'ONLINE',
          totalAmount: finalTotal,
          createdAt: paidTime,
          status: 'ĐÃ THANH TOÁN',
        };

        const dedupedList = list.filter(
          (t: any) =>
            t.bookingCode !== generatedCode &&
            t.id !== orderId &&
            !(t.showtimeId === (selectedShowtime?.id || queryShowtimeId) && t.seats === seatsStr)
        );
        dedupedList.unshift(ticketRecord);
        localStorage.setItem('cinemax_user_tickets', JSON.stringify(dedupedList));
        localStorage.setItem('cinemax_last_booking', JSON.stringify(ticketRecord));
        BookingService.resetHoldCooldown(sessionId, currentUser?.id);

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
        try {
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_order', data: ticketRecord })
          }).catch(() => {});
        } catch {}
        window.dispatchEvent(new CustomEvent('cinemax_ticket_purchased', { detail: ticketRecord }));
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

    // Chỉ kích hoạt cảnh báo quá hạn khi và chỉ khi có lỗi thực sự:
    // 1. Khách để quá hạn giữ chỗ (timeLeft <= 0) VÀ ghế thực sự bị một phiên (sessionId) khác chiếm
    // 2. Hoặc Supabase Backend báo lỗi tranh chấp ghế khi gọi confirmPayment
    let isOverduePaid = false;
    let overdueWarningMessage: string | undefined = undefined;

    const targetSeats = selectedSeats.map((s) =>
      s.seat_type?.code === 'COUPLE' ? `ĐÔI ${s.seat_number}` : `${s.row_label}${s.seat_number}`
    );

    const currentShowtimeKey = selectedShowtime?.id || queryShowtimeId;
    const heldMap = BookingService.getLocalHeldSeats(currentShowtimeKey);

    // Ghế chỉ bị coi là cướp mất nếu: Thời gian giữ chỗ đã hết (timeLeft <= 0) VÀ một sessionId KHÁC đang giữ ghế đó
    const stolenSeats = targetSeats.filter((seatLabel) => {
      const holdInfo = heldMap.get(seatLabel);
      return holdInfo && holdInfo.sessionId !== sessionId && holdInfo.expiresAt > Date.now();
    });

    if (timeLeft <= 0 && stolenSeats.length > 0) {
      isOverduePaid = true;
      overdueWarningMessage = `Ghế (${stolenSeats.join(', ')}) đã được khách hàng khác đặt trong lúc giao dịch bị chậm trễ do mạng. Khoản tiền ${pendingVietQROrder.amount.toLocaleString('vi-VN')} đ đã được ghi nhận thành công trên hệ thống. Vui lòng liên hệ Quầy vé hoặc Hotline 1900 6868 với Mã đơn ${pendingVietQROrder.orderCode} để được xếp ghế tương đương miễn phí hoặc hoàn tiền 100%!`;
    }

    if (pendingVietQROrder.orderId && !pendingVietQROrder.orderId.startsWith('mock-')) {
      try {
        await PaymentService.confirmPayment(pendingVietQROrder.orderId, 'CARD', bankTxnId);
      } catch (payErr: any) {
        console.error('Lỗi xác nhận thanh toán Supabase:', payErr);
        const errMsg = payErr?.message || '';
        if (
          errMsg.includes('expired') ||
          errMsg.includes('đã có người') ||
          errMsg.includes('không còn khả dụng') ||
          errMsg.includes('conflict')
        ) {
          isOverduePaid = true;
          overdueWarningMessage = `Ghế (${targetSeats.join(', ')}) đã được khách hàng khác hoàn tất trước trên hệ thống. Khoản tiền ${pendingVietQROrder.amount.toLocaleString('vi-VN')} đ đã được ghi nhận thành công. Vui lòng liên hệ Quầy vé hoặc Hotline 1900 6868 với Mã đơn ${pendingVietQROrder.orderCode} để được đổi ghế hoặc hoàn tiền!`;
        }
      }
    }

    const paidTime =
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' • ' +
      new Date().toLocaleDateString('vi-VN');

    const chosenFoodsStr = Object.entries(foodQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = foods.find((f) => f.id === parseInt(id));
        return item ? `${qty}x ${item.name}` : '';
      })
      .filter(Boolean)
      .join(', ');

    const newBooking = {
      bookingCode: pendingVietQROrder.orderCode,
      paidAt: paidTime,
      totalAmount: pendingVietQROrder.amount,
      seatsStr: pendingVietQROrder.seatsStr,
      foodsStr: pendingVietQROrder.foodsStr,
      customerName: pendingVietQROrder.payerName,
      customerEmail: pendingVietQROrder.payerEmail,
      customerPhone: pendingVietQROrder.payerPhone,
      isOverduePaid,
      overdueWarningMessage,
    };

    setCompletedBooking(newBooking);

    // Đồng bộ vào Supabase database
    const foodItemsList = Object.entries(foodQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = foods.find((f) => f.id === parseInt(id));
        return item
          ? {
              productUuid: item.supabase_id,
              name: item.name,
              quantity: qty,
              unitPrice: item.price,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    try {
      await syncOrderToSupabase({
        orderCode: pendingVietQROrder.orderCode,
        channel: 'online',
        contactName: pendingVietQROrder.payerName,
        contactEmail: pendingVietQROrder.payerEmail,
        contactPhone: pendingVietQROrder.payerPhone,
        subtotal: subtotalBeforeDiscount,
        discountAmount,
        totalAmount: pendingVietQROrder.amount,
        paymentProvider: `VIETQR (${senderBank})`,
        showtimeUuid: selectedShowtime?.supabase_id || (typeof selectedShowtime?.id === 'string' && selectedShowtime.id.length === 36 ? selectedShowtime.id : undefined),
        auditoriumUuid: selectedShowtime?.auditorium_id || selectedShowtime?.room?.supabase_id || (typeof selectedShowtime?.room_id === 'string' && selectedShowtime.room_id.length === 36 ? selectedShowtime.room_id : undefined),
        seatCodes: selectedSeats.map((s) => `${s.row_label}${s.seat_number}`),
        seatUuidLookup,
        audienceType: 'ADULT',
        unitTicketPrice: Math.round(ticketSubtotal / Math.max(1, selectedSeats.length)),
        movieSnapshot: {
          movieTitle: selectedMovie.title,
          cinemaName: selectedCinema.name,
          roomName: selectedShowtime?.room?.name || 'Phòng 1 (2D Tiêu Chuẩn)',
          showTime: selectedShowtime?.start_time
            ? new Date(selectedShowtime.start_time).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : queryTime,
          showDate: queryDate || '14/10/2026',
          format: selectedShowtime?.room?.screen_type || '2D',
          ageRating: selectedMovie.age_rating,
        },
        foodItems: foodItemsList,
      });
      refreshFromSupabase();
    } catch (syncErr) {
      console.warn('Sync VietQR order to Supabase error:', syncErr);
    }

    try {
      const storedTickets = localStorage.getItem('cinemax_user_tickets');
      const list = storedTickets ? JSON.parse(storedTickets) : [];
      const ticketRecord = {
        id: pendingVietQROrder.orderId,
        userId: currentUser ? currentUser.id : 'guest',
        customerName: pendingVietQROrder.payerName,
        customerPhone: pendingVietQROrder.payerPhone,
        customerEmail: pendingVietQROrder.payerEmail,
        bookingCode: pendingVietQROrder.orderCode,
        movieTitle: selectedMovie.title,
        movieId: selectedMovie.id,
        posterUrl: selectedMovie.poster_url,
        moviePoster: selectedMovie.poster_url,
        ageRating: selectedMovie.age_rating,
        format: selectedShowtime?.format || '2D Digital',
        cinemaName: selectedCinema.name,
        cinemaId: selectedCinema.id,
        roomName: selectedShowtime?.room?.name || 'Phòng 01 (IMAX)',
        auditoriumName: selectedShowtime?.room?.name || 'Phòng 01 (IMAX)',
        showtimeId: selectedShowtime?.id || queryShowtimeId,
        showtimeDate: queryDate,
        showtimeTime: queryTime,
        showtime: `${queryTime} • ${queryDate || '14/10/2026'}`,
        seats: pendingVietQROrder.seatsStr || selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', '),
        seatsStr: pendingVietQROrder.seatsStr,
        audienceLabel: 'Người lớn (Đặt Online)',
        foods: pendingVietQROrder.foods || [],
        foodsStr: pendingVietQROrder.foodsStr,
        foodSummary: chosenFoodsStr || 'Không kèm bắp nước',
        foodFulfilled: !chosenFoodsStr,
        channel: 'ONLINE',
        totalAmount: pendingVietQROrder.amount,
        status: isOverduePaid ? 'THANH TOÁN QUÁ HẠN (CHỜ XẾP GHẾ)' : 'ĐÃ THANH TOÁN',
        isOverduePaid,
        overdueWarningMessage,
        paymentMethod: `VIETQR (${senderBank || 'TPBank'}) • ${bankTxnId}`,
        bankTxnId,
        senderBank,
        paidAt: paidTime,
      };

      const dedupedList = list.filter(
        (t: any) =>
          t.bookingCode !== pendingVietQROrder.orderCode &&
          t.id !== pendingVietQROrder.orderId &&
          !(t.showtimeId === (selectedShowtime?.id || queryShowtimeId) && t.seats === pendingVietQROrder.seatsStr)
      );
      dedupedList.unshift(ticketRecord);
      localStorage.setItem('cinemax_user_tickets', JSON.stringify(dedupedList));
      localStorage.setItem('cinemax_last_booking', JSON.stringify(ticketRecord));
      BookingService.resetHoldCooldown(sessionId, currentUser?.id);

      // Cập nhật số ghế trống khả dụng nếu không bị tranh chấp
      if (!isOverduePaid) {
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
      }

      BookingService.releaseSessionHold(sessionId);
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_order', data: ticketRecord })
        }).catch(() => {});
      } catch {}
      window.dispatchEvent(new CustomEvent('cinemax_ticket_purchased', { detail: ticketRecord }));
      window.dispatchEvent(new Event('cinemax_data_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Lỗi lưu ticket localStorage:', e);
    }

    // Đánh dấu các ghế vừa mua thành đã bán nếu không bị tranh chấp
    if (!isOverduePaid) {
      setSeats((prev) =>
        prev.map((s) =>
          selectedSeats.some((sel) => sel.id === s.id) ? { ...s, status: 'sold' as any } : s
        )
      );
    }

    setIsVietQRModalOpen(false);
    setCurrentStep(3);
  };

  const handleForwardToRegister = () => {
    if (!completedBooking) return;
    try {
      sessionStorage.setItem(
        'cinemax_prefill_register',
        JSON.stringify({
          name: completedBooking.customerName || guestName || '',
          email: completedBooking.customerEmail || guestEmail || '',
          phone: completedBooking.customerPhone || guestPhone || '',
        })
      );
    } catch {}
    openAuthModal('REGISTER');
  };

  const handleQuickRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedBooking || !completedBooking.customerEmail) return;
    if (!memberPassword || memberPassword.length < 6) {
      setMemberError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    setIsRegisteringMember(true);
    setMemberError('');
    try {
      const res = await register(
        completedBooking.customerName || 'Khách hàng',
        completedBooking.customerEmail,
        completedBooking.customerPhone || '0900000000',
        memberPassword
      );
      if (res.success) {
        setMemberCreated(true);
        // Cập nhật các vé trong localStorage sang user_id mới
        try {
          const stored = localStorage.getItem('cinemax_user_tickets');
          if (stored) {
            const list = JSON.parse(stored);
            const userStr = localStorage.getItem('cinemax_session_user');
            const newUid = userStr ? JSON.parse(userStr).id : 'member';
            const updated = list.map((t: any) =>
              t.bookingCode === completedBooking.bookingCode ? { ...t, userId: newUid } : t
            );
            localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
            window.dispatchEvent(new Event('cinemax_data_updated'));
            window.dispatchEvent(new Event('storage'));
          }
        } catch (e) {
          // ignore
        }
      } else {
        setMemberError(res.error || 'Đăng ký thất bại');
      }
    } finally {
      setIsRegisteringMember(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-3 sm:px-6 lg:px-10 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {/* STEPPER & COUNTDOWN (Figma Screen 3 & 4) */}
        {currentStep < 3 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#303645] pb-2.5 sm:pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Nút Quay Lại Bước Trước Nổi Bật */}
              {currentStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#303645] bg-[#1A1C26] hover:bg-[#242836] text-[#9EA6B8] hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                  title="Quay lại bước chọn ghế"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#FABF2E]" />
                  <span>Quay lại chọn ghế</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#303645] bg-[#1A1C26] hover:bg-[#242836] text-[#9EA6B8] hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                  title="Quay lại trang trước"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#FABF2E]" />
                  <span>Quay lại</span>
                </button>
              )}

              {/* Stepper: Cho phép click vào các bước trước đó */}
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 2) setCurrentStep(1);
                  }}
                  className={`flex items-center gap-1 transition-colors ${
                    currentStep === 1
                      ? 'text-[#E63845] font-black cursor-default'
                      : 'text-[#33C773] hover:text-white cursor-pointer underline decoration-dotted'
                  }`}
                  title={currentStep === 2 ? 'Nhấn để quay lại bước chọn ghế' : undefined}
                >
                  {currentStep > 1 && <CheckCircle className="w-3.5 h-3.5 text-[#33C773]" />}
                  <span>1. Chọn ghế</span>
                </button>
                <span className="text-[#9EA6B8]">&gt;</span>
                <span className={currentStep === 2 ? 'text-[#E63845]' : 'text-[#9EA6B8]'}>
                  2. Bắp nước
                </span>
                <span className="text-[#9EA6B8]">&gt;</span>
                <span className={currentStep === 2 ? 'text-white' : 'text-[#9EA6B8]'}>
                  3. Thanh toán
                </span>
              </div>
            </div>

            {/* Countdown Timer (Figma Screen 3: "⏱ Giữ ghế còn 09:42") */}
            <div className="flex items-center gap-2 text-[#FABF2E] font-bold text-xs sm:text-sm bg-[#1A1C26] px-3.5 py-1.5 rounded-full border border-[#FABF2E]/30 shrink-0">
              <Clock className="w-3.5 h-3.5 animate-pulse text-[#FABF2E]" />
              <span>Giữ ghế còn:</span>
              <span className="font-mono text-sm sm:text-base font-black">{formatTime(timeLeft)}</span>
              {currentStep === 2 && isPaymentGraceApplied && (
                <span className="bg-[#FABF2E]/20 text-[#FABF2E] text-[10px] px-2 py-0.5 rounded-full border border-[#FABF2E]/40 font-semibold">
                  +1p thanh toán
                </span>
              )}
            </div>
          </div>
        )}


        {/* ======================================================== */}
        {/* FIGMA SCREEN 3: CHỌN GHẾ */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch">
            {/* Seat Map (Left 2 cols) */}
            <div className="lg:col-span-2 bg-[#1A1C26] border border-[#303645] rounded-2xl p-3 sm:p-5 flex flex-col justify-between items-center">
              {/* Thống kê đếm đúng số ghế và số ghế trống thời gian thực */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0F1217] p-2 rounded-xl border border-[#303645] mb-2.5 sm:mb-3 text-[11px] sm:text-xs select-none shadow-inner">
                <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#1A1C26] px-2.5 py-1.5 rounded-lg border border-[#303645]/70">
                  <span className="text-[#9EA6B8]">Tổng số ghế:</span>
                  <span className="font-bold text-white font-mono">{totalSeatsCount} ghế</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#33C773]/10 px-2.5 py-1.5 rounded-lg border border-[#33C773]/30">
                  <span className="text-[#9EA6B8]">Ghế trống:</span>
                  <span className="font-bold text-[#33C773] font-mono">{availableSeatsCount} ghế</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#383D4D]/40 px-2.5 py-1.5 rounded-lg border border-[#383D4D]">
                  <span className="text-[#9EA6B8]">Đã bán:</span>
                  <span className="font-bold text-gray-300 font-mono">{soldSeatsCount} ghế</span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#E63845]/10 px-2.5 py-1.5 rounded-lg border border-[#E63845]/30">
                  <span className="text-[#9EA6B8]">Đang chọn:</span>
                  <span className="font-bold text-[#E63845] font-mono">{selectedSeatsCount} ghế</span>
                </div>
              </div>

              {/* Banner cảnh báo ghế trống đơn lẻ (Orphan Seat Warning - Phương án A) */}
              {orphanWarning && orphanWarning.hasOrphanSeats && (
                <div className="w-full bg-[#FABF2E]/10 border border-[#FABF2E]/40 rounded-2xl p-3 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs animate-in fade-in slide-in-from-top-2 shadow-lg">
                  <div className="flex items-start gap-2.5 text-[#FABF2E]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white text-xs sm:text-sm">
                        Cảnh báo: Phát hiện ghế trống đơn lẻ bị kẹp
                      </div>
                      <p className="text-gray-300 mt-0.5 text-xs leading-relaxed">
                        {orphanWarning.suggestionMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleAddOrphanSeats(orphanWarning.orphanSeats)}
                      className="px-3 py-1.5 rounded-lg bg-[#FABF2E] hover:bg-yellow-400 text-black font-bold text-xs cursor-pointer transition-colors shadow-md"
                    >
                      + Chọn luôn ghế {orphanWarning.orphanSeats.join(', ')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAcknowledgedOrphan(true);
                        setOrphanWarning(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#303645] hover:bg-[#383D4D] text-gray-300 hover:text-white font-medium text-xs cursor-pointer transition-colors"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              )}

              {/* Red Screen Curve (Figma Screen 3) */}
              <div className="w-full max-w-md mx-auto flex flex-col items-center mb-2 sm:mb-3">
                <div className="w-full h-2 rounded-t-[100%] border-t-2 border-[#E63845] shadow-[0_-6px_14px_rgba(230,56,69,0.35)] mb-1" />
                <span className="text-[10px] sm:text-[11px] tracking-[0.25em] text-[#9EA6B8] font-bold uppercase">
                  MÀN HÌNH
                </span>
              </div>

              {/* Seat Matrix: 10 columns continuous grid matching Staff POS */}
              <div className="w-full overflow-x-auto pb-1 flex justify-center">
                <div className="space-y-1 sm:space-y-1.5 select-none min-w-[300px]">
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((row) => {
                    const isVipRow = row === 'F' || row === 'G';
                    const isCoupleRow = row === 'H';
                    return (
                      <div key={row} className="flex items-center justify-center gap-1 sm:gap-1.5">
                        <span className="w-4 sm:w-5 text-[11px] font-bold text-slate-400 text-center">
                          {row}
                        </span>
                        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => {
                            const code = `${row}${col}`;
                            const seat =
                              seats.find((s) => s.row_label === row && s.seat_number === col) || {
                                id: `${row}-${col}`,
                                row_label: row,
                                seat_number: col,
                                seat_type: {
                                  code: isCoupleRow ? 'COUPLE' : isVipRow ? 'VIP' : 'STANDARD',
                                  name: isCoupleRow ? 'Ghế đôi' : isVipRow ? 'Ghế VIP' : 'Ghế thường',
                                },
                                status: 'AVAILABLE',
                              };
                            const isSelected = selectedSeats.some(
                              (s) => s.id === seat.id || `${s.row_label}${s.seat_number}` === code
                            );
                            const isSold =
                              seat.status === 'SOLD' ||
                              seat.status === 'sold' ||
                              seat.status === 'BOOKED' ||
                              seat.status === 'booked';
                            const isHeld = seat.status === 'HELD' || seat.status === 'held';
                            const isBlocked = seat.status === 'BLOCKED' || seat.status === 'blocked';

                            let seatClass =
                              'bg-[#283044] text-slate-200 border-[#36415C] hover:border-white';
                            if (isVipRow) {
                              seatClass =
                                'bg-[#3B2610] text-[#FBBF24] border-[#92400E] hover:border-[#FBBF24]';
                            }
                            if (isCoupleRow) {
                              seatClass =
                                'bg-[#3B1530] text-[#F472B6] border-[#9D174D] hover:border-[#F472B6]';
                            }
                            if (isSelected) {
                              seatClass =
                                'bg-[#E63845] text-white border-[#E63845] font-bold shadow-lg shadow-[#E63845]/40 scale-105';
                            }
                            if (isSold) {
                              seatClass =
                                'bg-[#181C26] text-slate-600 border-[#1E2433] cursor-not-allowed';
                            }
                            if (isHeld) {
                              seatClass =
                                'bg-[#2D2A1C] text-[#FDE047] border-[#854D0E] cursor-not-allowed';
                            }
                            if (isBlocked) {
                              seatClass =
                                'bg-[#3A1217] text-[#F87171] border-[#7F1D1D] cursor-not-allowed line-through';
                            }

                            return (
                              <button
                                key={code}
                                type="button"
                                disabled={isSold || isHeld || isBlocked}
                                onClick={() => handleSeatClick(seat as Seat)}
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold border transition-all flex items-center justify-center cursor-pointer ${seatClass}`}
                                title={`${code} - ${
                                  isCoupleRow
                                    ? 'Ghế đôi (210.000đ)'
                                    : isVipRow
                                    ? 'Ghế VIP (110.000đ)'
                                    : 'Ghế thường (90.000đ)'
                                }`}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>
                        <span className="w-4 sm:w-5 text-[11px] font-bold text-slate-400 text-center">
                          {row}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seat Legend (Khớp 100% Staff POS) */}
              <div className="w-full border-t border-[#303645] pt-2.5 mt-2.5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-[11px] text-[#9EA6B8]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-[#283044] border border-[#36415C]" />
                  <span>Ghế thường (90k)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-[#3B2610] border border-[#92400E] text-[#FBBF24]" />
                  <span>Ghế VIP (110k)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-[#3B1530] border border-[#9D174D] text-[#F472B6]" />
                  <span>Ghế đôi (210k)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-[#E63845] border border-[#E63845]" />
                  <span className="text-white font-semibold">Đang chọn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-[#181C26] border border-[#1E2433]" />
                  <span>Đã bán</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-[#2D2A1C] border border-[#854D0E]" />
                  <span>Đang giữ chỗ</span>
                </div>
              </div>
            </div>

            {/* Right: Thông Tin Vé Card (Figma Screen 3) */}
            <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <h3 className="font-bold text-white text-base border-b border-[#303645] pb-2">
                  Thông tin vé
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#9EA6B8] block text-[11px]">Phim:</span>
                    <span className="font-bold text-white text-sm sm:text-base line-clamp-1">{selectedMovie.title}</span>
                  </div>
                  <div>
                    <span className="text-[#9EA6B8] block text-[11px]">Rạp chiếu:</span>
                    <span className="font-semibold text-white">{selectedCinema.name}</span>
                  </div>
                  <div>
                    <span className="text-[#9EA6B8] block text-[11px]">Phòng chiếu:</span>
                    <span className="font-semibold text-white">
                      {selectedShowtime.room?.name || 'Phòng 01 (IMAX)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9EA6B8] block text-[11px]">Suất chiếu:</span>
                    <span className="font-bold text-[#FABF2E]">{queryTime} • {queryDate}</span>
                  </div>

                  <div className="pt-2 border-t border-[#303645]">
                    <span className="text-[#9EA6B8] block text-[11px] mb-1">Ghế đã chọn:</span>
                    {selectedSeats.length === 0 ? (
                      <span className="text-xs text-[#9EA6B8] italic">Chưa chọn ghế nào</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {selectedSeats.map((s) => (
                          <span
                            key={s.id}
                            className="bg-[#E63845] text-white text-[11px] px-2 py-0.5 rounded font-bold"
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
              <div className="pt-3 border-t border-[#303645] space-y-2.5">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-[#9EA6B8]">Tổng tiền:</span>
                  <span className="text-xl sm:text-2xl font-black text-[#E63845]">
                    {ticketSubtotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    disabled={selectedSeats.length === 0}
                    onClick={handleProceedToStep2}
                    className="w-full bg-[#E63845] hover:bg-[#CC2B37] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm shadow-md shadow-[#E63845]/30 transition-all cursor-pointer"
                  >
                    Tiếp tục chọn bắp nước & thanh toán
                  </button>

                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-full border border-[#303645] hover:border-white/40 bg-[#0F1217] hover:bg-[#1A1C26] text-[#9EA6B8] hover:text-white py-2 rounded-full font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại trang trước</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FIGMA SCREEN 4: BẮP NƯỚC & THANH TOÁN (1 TRANG GỌN GÀNG, KHÔNG CUỘN) */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 items-start">
            {/* Left Column: Bắp nước (2 cột), Thông tin nhận vé & Phương thức thanh toán */}
            <div className="lg:col-span-2 space-y-3">
              {/* Bắp nước & combo */}
              <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    🍿 <span>Bắp nước & Combo</span>
                  </h3>
                  <span className="text-[11px] text-[#9EA6B8]">Chọn combo để nhận ưu đãi</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[195px] overflow-y-auto custom-scrollbar pr-1">
                  {foods.map((food) => {
                    const qty = foodQuantities[food.id] || 0;
                    return (
                      <div
                        key={food.id}
                        className={`bg-[#0F1217] border rounded-xl p-2 flex gap-2.5 items-center justify-between transition-all ${
                          qty > 0 ? 'border-[#FABF2E]/60 bg-[#FABF2E]/5 shadow-sm' : 'border-[#303645] hover:border-white/20'
                        }`}
                      >
                        <img
                          src={food.image_url}
                          alt={food.name}
                          className="w-11 h-11 object-cover rounded-lg border border-[#303645] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{food.name}</h4>
                          <p className="text-[10px] text-[#9EA6B8] truncate">{food.description}</p>
                          <div className="text-xs font-bold text-[#FABF2E] mt-0.5">
                            {food.price.toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        {/* Stepper - 0 + */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setFoodQuantities({
                                ...foodQuantities,
                                [food.id]: Math.max(0, qty - 1),
                              })
                            }
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              qty > 0
                                ? 'bg-[#1A1C26] border border-[#303645] text-white hover:border-[#E63845]'
                                : 'bg-[#1A1C26]/50 text-[#555] border border-transparent cursor-not-allowed'
                            }`}
                            disabled={qty === 0}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`w-5 text-center text-xs font-bold ${qty > 0 ? 'text-[#FABF2E]' : 'text-white'}`}>{qty}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFoodQuantities({
                                ...foodQuantities,
                                [food.id]: qty + 1,
                              })
                            }
                            className="w-6 h-6 rounded-full bg-[#E63845] flex items-center justify-center text-white hover:bg-[#CC2B37] cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Thông tin người nhận vé (Khách vs Thành viên) */}
              <div id="guest-info-section" className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4 text-[#E63845]" />
                    <span>Thông tin nhận vé điện tử (Email & SĐT)</span>
                  </h3>
                  {!currentUser && (
                    <button
                      type="button"
                      onClick={() => openAuthModal('LOGIN')}
                      className="text-[11px] text-[#FABF2E] hover:underline font-semibold"
                    >
                      Đăng nhập để tích điểm
                    </button>
                  )}
                </div>

                {currentUser ? (
                  /* Đã đăng nhập */
                  <div className="bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{currentUser.full_name}</span>
                      <span className="text-[#9EA6B8]">• {currentUser.email} • {currentUser.phone || 'Chưa cập nhật SĐT'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#33C773]/20 text-[#33C773]">
                      ✓ Đã xác thực thành viên
                    </span>
                  </div>
                ) : (
                  /* Khách chưa đăng nhập: Nhập thông tin để nhận vé */
                  <div className="space-y-1.5">
                    {guestError && (
                      <div className="p-2 rounded-lg bg-[#E63845]/15 border border-[#E63845] text-[11px] text-[#E63845]">
                        {guestError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Họ và tên *"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
                        />
                      </div>
                      <div>
                        <input
                          type="tel"
                          required
                          placeholder="Số điện thoại *"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className={`w-full bg-[#0F1217] border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none transition-colors ${
                            phoneValidation && !phoneValidation.isValid
                              ? 'border-[#E63845]'
                              : phoneValidation && phoneValidation.isValid
                              ? 'border-[#33C773]'
                              : 'border-[#303645] focus:border-[#E63845]'
                          }`}
                        />
                        {phoneValidation && !phoneValidation.isValid && (
                          <p className="mt-0.5 text-[10px] text-[#FFA4A4] truncate">{phoneValidation.error}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="email"
                          required
                          placeholder="Email nhận vé *"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className={`w-full bg-[#0F1217] border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none transition-colors ${
                            (emailValidation && !emailValidation.isValid) || (emailDnsResult && !emailDnsResult.isValid)
                              ? 'border-[#E63845]'
                              : emailValidation && emailValidation.isValid
                              ? 'border-[#33C773]'
                              : 'border-[#303645] focus:border-[#E63845]'
                          }`}
                        />
                        {emailValidation && !emailValidation.isValid && (
                          <p className="mt-0.5 text-[10px] text-[#FFA4A4] truncate">{emailValidation.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Phương thức thanh toán */}
              <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    💳 <span>Phương thức thanh toán</span>
                  </h3>
                  <span className="text-[11px] text-[#33C773] font-semibold">Tự động 24/7</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('VIETQR')}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'VIETQR'
                        ? 'border-[#0052CC] bg-[#0052CC]/15 ring-2 ring-[#0052CC]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0052CC] flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                      QR
                    </div>
                    <span className="text-[11px] font-bold text-white text-center leading-tight">VietQR Pro</span>
                    <span className="text-[9px] text-[#33C773] font-semibold">Tự động</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MOMO')}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'MOMO'
                        ? 'border-[#D82D8B] bg-[#D82D8B]/10 ring-2 ring-[#D82D8B]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#D82D8B] flex items-center justify-center text-white font-black text-xs">
                      M
                    </div>
                    <span className="text-[11px] font-bold text-white">Ví MoMo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('VNPAY')}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'VNPAY'
                        ? 'border-[#0066FF] bg-[#0066FF]/10 ring-2 ring-[#0066FF]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0066FF] flex items-center justify-center text-white font-black text-xs">
                      V
                    </div>
                    <span className="text-[11px] font-bold text-white">VNPAY</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ZALOPAY')}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'ZALOPAY'
                        ? 'border-[#0088FF] bg-[#0088FF]/10 ring-2 ring-[#0088FF]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0088FF] flex items-center justify-center text-white font-black text-xs">
                      Z
                    </div>
                    <span className="text-[11px] font-bold text-white">ZaloPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === 'CARD'
                        ? 'border-[#FABF2E] bg-[#FABF2E]/10 ring-2 ring-[#FABF2E]'
                        : 'border-[#303645] bg-[#0F1217] hover:border-white/40'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#FABF2E] flex items-center justify-center text-black font-black text-[9px]">
                      CARD
                    </div>
                    <span className="text-[11px] font-bold text-white">Thẻ ATM/Visa</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Tóm tắt đơn hàng (Tích hợp gọn gàng mã giảm giá & tổng tiền) */}
            <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between space-y-2.5 lg:sticky lg:top-20 self-start">
              <div className="space-y-2">
                <h3 className="font-bold text-white text-xs sm:text-sm border-b border-[#303645] pb-1.5 flex items-center justify-between">
                  <span>Tóm tắt đơn hàng</span>
                  <span className="text-[11px] text-[#FABF2E] font-medium">{queryTime} • {queryDate}</span>
                </h3>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Phim:</span>
                    <span className="font-bold text-white line-clamp-1 text-right max-w-[170px]">{selectedMovie.title}</span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Rạp:</span>
                    <span className="text-white text-right">{selectedCinema.name}</span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8]">
                    <span>Ghế ({selectedSeats.length}):</span>
                    <span className="font-bold text-white">
                      {selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#9EA6B8] pt-1 border-t border-[#303645]">
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
                  {currentUser ? (
                    <div className="flex justify-between text-[#FABF2E] text-[10px] pt-0.5">
                      <span>Điểm tích lũy (+5%):</span>
                      <span className="font-bold">+{Math.floor(finalTotal * 0.05).toLocaleString('vi-VN')} điểm</span>
                    </div>
                  ) : null}
                </div>

                {/* Mã giảm giá tích hợp gọn gàng trong tóm tắt đơn hàng */}
                <div className="pt-2 border-t border-[#303645] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#9EA6B8] flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-[#FABF2E]" />
                      Mã giảm giá
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsVoucherModalOpen(true)}
                      className="text-[10px] text-[#FABF2E] hover:underline font-bold cursor-pointer"
                    >
                      {appliedPromo ? 'Đổi voucher khác >' : `Chọn voucher (${validVouchers.length}) >`}
                    </button>
                  </div>

                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-[#33C773]/10 border border-[#33C773]/40 px-2.5 py-1.5 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Check className="w-3.5 h-3.5 text-[#33C773] shrink-0" />
                        <span className="font-mono font-bold text-white truncate">{appliedPromo.code}</span>
                        <span className="text-[#33C773] font-semibold text-[11px] truncate">
                          (-{discountAmount.toLocaleString('vi-VN')}đ)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-[11px] font-bold text-[#E63845] hover:text-[#CC2B37] ml-2 shrink-0 cursor-pointer"
                        title="Bỏ áp dụng mã giảm giá này"
                      >
                        ✕ Gỡ
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Mã KM (VD: GIAM20K)"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleApplyPromo();
                        }}
                        className="flex-1 min-w-0 bg-[#0F1217] border border-[#303645] text-white px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-[#E63845] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        Áp dụng
                      </button>
                    </div>
                  )}

                  {promoError && <p className="text-[10px] text-[#FFA4A4]">{promoError}</p>}
                </div>
              </div>

              {/* Total & Nút Thanh Toán */}
              <div className="pt-2 border-t border-[#303645] space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-[#9EA6B8]">Tổng cộng:</span>
                  <span className="text-xl sm:text-2xl font-black text-[#E63845]">
                    {finalTotal.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <button
                  disabled={isProcessingPayment || selectedSeats.length === 0}
                  onClick={handleCheckout}
                  className={`w-full py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 ${
                    selectedSeats.length === 0
                      ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed shadow-none'
                      : 'bg-[#E63845] hover:bg-[#CC2B37] text-white shadow-[#E63845]/30 cursor-pointer'
                  }`}
                >
                  {isProcessingPayment
                    ? 'Đang xử lý...'
                    : selectedSeats.length === 0
                    ? 'Chưa chọn ghế (Vui lòng chọn ghế)'
                    : `Thanh toán ${finalTotal.toLocaleString('vi-VN')}đ`}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full border border-[#303645] hover:border-[#FABF2E]/50 bg-[#0F1217] hover:bg-[#1A1C26] text-[#9EA6B8] hover:text-white py-1.5 rounded-full font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3 text-[#FABF2E]" />
                  <span>Quay lại bước chọn ghế</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FIGMA SCREEN 5: VÉ ĐIỆN TỬ */}
        {/* ======================================================== */}
        {currentStep === 3 && completedBooking && (
          <div className="max-w-3xl mx-auto space-y-2.5 pt-1 sm:pt-2">
            {/* Header: ✓ THANH TOÁN THÀNH CÔNG hoặc ⚠️ CHỜ XẾP GHẾ DO QUÁ HẠN GIỮ CHỖ */}
            {completedBooking.isOverduePaid ? (
              <div className="bg-[#FABF2E]/15 border border-[#FABF2E]/40 rounded-xl p-3 text-center space-y-1 animate-in fade-in">
                <div className="flex items-center justify-center gap-2 text-[#FABF2E] font-black text-sm sm:text-base">
                  <AlertTriangle className="w-5 h-5 text-[#FABF2E]" />
                  <span>TIỀN ĐÃ NHẬN THÀNH CÔNG • CẦN CHỌN LẠI GHẾ TẠI QUẦY</span>
                </div>
                <p className="text-xs text-[#D1D5DB] leading-relaxed max-w-xl mx-auto">
                  {completedBooking.overdueWarningMessage}
                </p>
                <div className="inline-block bg-[#1A1C26] px-3 py-0.5 rounded-full text-[10px] font-bold text-[#FABF2E] border border-[#FABF2E]/30">
                  Hotline Hỗ Trợ 24/7: 1900 6868
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-[#33C773] text-center font-black text-base sm:text-lg">
                <CheckCircle className="w-5 h-5" />
                <span>THANH TOÁN THÀNH CÔNG</span>
              </div>
            )}

            {/* Perforated Cinema Ticket Card (Synchronized with Staff Gate Check-in View) */}
            <div className="relative bg-[#1A1C26] border border-[#303645] rounded-2xl overflow-hidden shadow-2xl space-y-0">
              {/* Top Header Bar Matching Staff Verification Screen */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#2B3448] bg-[#141924]/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#22C55E] text-black shadow-md flex items-center justify-center font-black text-xs">
                    ✓
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black tracking-widest text-[#E63845] uppercase">
                        CINEMAX THEATER
                      </span>
                      <span className="text-[9px] text-[#5C677D]">•</span>
                      <span className="text-[10px] font-mono text-[#8E9AAF]">{completedBooking.bookingCode}</span>
                    </div>
                    <h2 className="text-xs sm:text-sm font-black text-white">
                      VÉ HỢP LỆ — SẴN SÀNG VÀO RẠP
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40">
                    HỢP LỆ (ACTIVE)
                  </span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row">
                {/* Left Ticket Details */}
                <div className="flex-1 p-3.5 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-[#2B3448] pb-2">
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-black text-[#E63845] tracking-widest uppercase">
                        CINEMAX THEATER
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-white">HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC</h3>
                      <p className="text-[10px] font-mono text-[#8E9AAF]">Mã: {completedBooking.bookingCode}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#E63845] text-white">
                        {selectedMovie.age_rating}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] font-bold text-[9px]">
                        {selectedShowtime?.format || '2D Digital'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[#8E9AAF] block text-[10px]">Phim:</span>
                      <span className="text-sm sm:text-base font-black text-white block line-clamp-1">{selectedMovie.title}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-[#8E9AAF]">
                      <div>Rạp: <strong className="text-white">{selectedCinema.name}</strong></div>
                      <div>Phòng: <strong className="text-white">{selectedShowtime.room?.name || 'Phòng 01'}</strong></div>
                      <div>Suất: <strong className="text-[#FABF2E]">{queryTime} • {queryDate}</strong></div>
                      <div>Trạng thái: <strong className="text-[#22C55E] uppercase">ĐÃ THANH TOÁN</strong></div>
                    </div>

                    {/* Seats & Foods compact row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                      <div className="p-1.5 px-2.5 rounded-lg bg-[#171E2D] border border-[#253045] flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-[#FABF2E]">Ghế:</span>
                        <span className="text-white font-mono font-bold text-xs text-[#06B6D4]">{completedBooking.seatsStr}</span>
                      </div>
                      {completedBooking.foodsStr ? (
                        <div className="p-1.5 px-2.5 rounded-lg bg-[#171E2D] border border-[#253045] flex items-center justify-between text-xs">
                          <span className="text-[10px] font-bold text-[#FABF2E]">Bắp nước:</span>
                          <span className="text-white font-semibold text-[11px] truncate max-w-[140px]">{completedBooking.foodsStr}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Financial breakdown */}
                    <div className="pt-1.5 border-t border-[#242E40] flex justify-between items-center text-xs">
                      <span className="text-[#8E9AAF] text-[11px]">
                        Người nhận: <strong className="text-white">{completedBooking.customerName}</strong>
                      </span>
                      <div className="flex items-center gap-1 font-bold">
                        <span className="text-xs text-[#8E9AAF]">Tổng:</span>
                        <span className="font-mono text-[#22C55E] text-sm sm:text-base font-black">
                          {completedBooking.totalAmount.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Perforated Cutout Separator */}
                <div className="relative hidden md:flex flex-col items-center justify-between py-3">
                  <div className="w-5 h-5 rounded-full bg-[#0F1217] -mt-5 border-b border-[#303645]" />
                  <div className="w-0.5 h-full border-r-2 border-dashed border-[#303645]" />
                  <div className="w-5 h-5 rounded-full bg-[#0F1217] -mb-5 border-t border-[#303645]" />
                </div>

                {/* Right QR Section */}
                <div className="w-full md:w-52 bg-[#14161F] p-3 sm:p-4 flex flex-col items-center justify-center text-center space-y-1.5 border-t md:border-t-0 md:border-l border-[#303645]/50">
                  <div className="bg-white p-1.5 rounded-xl shadow-md flex flex-col items-center justify-center">
                    <img
                      src={TicketScannerService.generateTicketQrUrl(completedBooking.bookingCode, 200)}
                      alt={`Mã QR vé ${completedBooking.bookingCode}`}
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[9px] text-[#FABF2E] font-bold uppercase tracking-wider">
                      MÃ QUÉT SOÁT VÉ VÀO RẠP
                    </div>
                    <div className="font-mono text-xs font-black text-white tracking-widest bg-[#0F1217] py-0.5 px-2 rounded border border-[#303645]">
                      {completedBooking.bookingCode}
                    </div>
                  </div>
                  {/* Cảnh báo bảo mật mini trong khung QR */}
                  <div className="text-[8px] font-semibold text-[#FFA4A4] bg-[#E63845]/15 border border-[#E63845]/40 rounded-lg p-1.5 text-left leading-tight w-full">
                    <span className="text-[#E63845] font-black uppercase text-[8px] mr-1">Bảo mật:</span>
                    Không chia sẻ mã QR để tránh quét trước.
                  </div>
                </div>
              </div>

              {/* CRITICAL AGE RATING ALERT BOX */}
              {(selectedMovie.age_rating === 'T16' || selectedMovie.age_rating === 'T18' || selectedMovie.age_rating === 'T13') && (
                <div className="mx-3.5 mb-3 p-2 rounded-xl bg-gradient-to-r from-[#2B1518] to-[#1C1215] border border-[#EF4444]/40 flex items-center gap-2.5 text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#EF4444] text-white font-black text-[10px] shrink-0">
                    {selectedMovie.age_rating}
                  </span>
                  <p className="text-[#D1D5DB] text-[10px] sm:text-[11px] leading-tight">
                    <strong>Lưu ý độ tuổi ({selectedMovie.age_rating}):</strong> Khán giả cần đủ {selectedMovie.age_rating === 'T18' ? '18' : selectedMovie.age_rating === 'T16' ? '16' : '13'} tuổi. Vui lòng mang CCCD/VNeID để đối chiếu tại cửa soát vé.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons: 4 nút dàn thành 1 hàng ngang gọn gàng */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowUnifiedModal(true)}
                className="bg-[#FABF2E] hover:bg-[#E5AC24] text-black py-2.5 px-2 rounded-full font-bold text-xs shadow-md shadow-[#FABF2E]/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all truncate"
                title="Xem thẻ vé điện tử và mã QR"
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Thẻ Vé Điện Tử</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  TicketScannerService.downloadTicketPdf({
                    bookingCode: completedBooking.bookingCode,
                    movieTitle: selectedMovie.title,
                    cinemaName: selectedCinema.name,
                    roomName: selectedShowtime?.room?.name || 'Phòng chiếu tiêu chuẩn',
                    showtime: `${queryTime} • ${queryDate}`,
                    seats: completedBooking.seatsStr,
                    totalAmount: completedBooking.totalAmount,
                    foodsStr: completedBooking.foodsStr,
                    customerName: completedBooking.customerName,
                    customerPhone: completedBooking.customerPhone,
                    ageRating: selectedMovie.age_rating,
                    format: selectedShowtime?.format || '2D Digital',
                    status: 'ĐÃ THANH TOÁN',
                  });
                }}
                className="bg-[#E63845] hover:bg-[#CC2B37] text-white py-2.5 px-2 rounded-full font-bold text-xs shadow-md shadow-[#E63845]/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all truncate"
                title="Tải vé xem phim dạng PDF về máy"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Tải vé (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/my-tickets')}
                className="border border-[#303645] bg-[#1A1C26] hover:bg-[#242836] text-white py-2.5 px-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all truncate"
              >
                <TicketIcon className="w-3.5 h-3.5 text-[#FABF2E] shrink-0" />
                <span className="truncate">Vé của tôi</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="border border-[#303645] bg-[#0F1217] hover:bg-[#1A1C26] text-[#9EA6B8] hover:text-white py-2.5 px-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all truncate"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#FABF2E] shrink-0" />
                <span className="truncate">Về trang chủ</span>
              </button>
            </div>

            {/* Unified Ticket Modal for Completed Booking */}
            {showUnifiedModal && (
              <UnifiedTicketModal
                ticket={{
                  bookingCode: completedBooking.bookingCode,
                  movieTitle: selectedMovie.title,
                  posterUrl: selectedMovie.poster_url,
                  ageRating: selectedMovie.age_rating,
                  format: selectedShowtime?.format || '2D Digital',
                  cinemaName: selectedCinema.name,
                  roomName: selectedShowtime.room?.name || 'Phòng 01 (IMAX)',
                  showtime: `${queryTime} • ${queryDate}`,
                  seats: completedBooking.seatsStr,
                  seatsStr: completedBooking.seatsStr,
                  totalAmount: completedBooking.totalAmount,
                  foodsStr: completedBooking.foodsStr,
                  customerName: completedBooking.customerName,
                  customerPhone: completedBooking.customerPhone,
                  customerEmail: completedBooking.customerEmail,
                  status: 'ĐÃ THANH TOÁN',
                }}
                onClose={() => setShowUnifiedModal(false)}
              />
            )}
          </div>
        )}
      </main>

      {pendingVietQROrder && (
        <VietQRModal
          isOpen={isVietQRModalOpen}
          onClose={() => setIsVietQRModalOpen(false)}
          onConfirm={handleConfirmVietQR}
          amount={pendingVietQROrder.amount}
          orderCode={pendingVietQROrder.orderCode}
          timeLeftSeconds={timeLeft}
          onGracePeriodRequested={async () => {
            const res = await BookingService.requestReconciliationGracePeriod(
              selectedShowtime?.id || queryShowtimeId,
              sessionId
            );
            if (res.success && res.expiresAt) {
              const remainingSec = Math.max(0, Math.floor((res.expiresAt - Date.now()) / 1000));
              setTimeLeft(remainingSec);
            } else {
              setTimeLeft((prev) => prev + 180);
            }
          }}
        />
      )}

      {/* MODAL KHO VOUCHER ƯU ĐÃI CHUYÊN NGHIỆP */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#1A1C26] border border-[#303645] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#303645] bg-[#14161F]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E63845]/15 border border-[#E63845]/30 flex items-center justify-center text-[#E63845] shrink-0">
                  <TicketIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Kho Voucher Ưu Đãi CINEMAX</h3>
                  <p className="text-[11px] text-[#9EA6B8]">Chọn mã ưu đãi có sẵn hoặc nhập mã khuyến mãi của bạn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#0F1217] hover:bg-[#242836] border border-[#303645] flex items-center justify-center text-[#9EA6B8] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Nhập mã trực tiếp */}
              <div className="bg-[#0F1217] border border-[#303645] rounded-xl p-3 space-y-2">
                <label className="text-[11px] font-semibold text-[#9EA6B8] block">Nhập mã khuyến mãi</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập mã voucher (VD: CINEMAX50K, CINEMAX20)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyPromo();
                    }}
                    className="flex-1 bg-[#1A1C26] border border-[#303645] text-white px-3 py-2 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#E63845] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="bg-[#E63845] hover:bg-[#CC2B37] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
                  >
                    Áp dụng
                  </button>
                </div>
                {promoError && <p className="text-[11px] text-[#FFA4A4]">{promoError}</p>}
              </div>

              {/* Danh sách Voucher dạng Vé Rạp Phim sang trọng */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs px-0.5">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#FABF2E]" />
                    Mã ưu đãi khả dụng ({validVouchers.length})
                  </span>
                  <span className="text-[11px] text-[#9EA6B8]">
                    Tạm tính đơn: <strong className="text-white font-mono">{subtotalBeforeDiscount.toLocaleString('vi-VN')}đ</strong>
                  </span>
                </div>

                {validVouchers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9EA6B8] bg-[#0F1217] rounded-xl border border-[#303645]">
                    Hiện chưa có mã ưu đãi nào khả dụng
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {validVouchers.map((v) => {
                      const isSelected = appliedPromo?.code?.toUpperCase() === v.code.toUpperCase();
                      const isEligible = subtotalBeforeDiscount >= (v.min_order || 0);

                      return (
                        <div
                          key={v.id || v.code}
                          className={`flex rounded-xl border transition-all overflow-hidden relative group ${
                            isSelected
                              ? 'border-[#33C773] bg-[#33C773]/10 ring-1 ring-[#33C773]'
                              : isEligible
                              ? 'border-[#303645] bg-[#0F1217] hover:border-[#FABF2E]/80 shadow-md'
                              : 'border-[#232733] bg-[#0F1217]/50 opacity-60'
                          }`}
                        >
                          {/* Cuống vé trái (Ticket Stub) */}
                          <div
                            className={`w-28 shrink-0 p-3 flex flex-col items-center justify-center text-center border-r border-dashed relative ${
                              isSelected
                                ? 'bg-[#33C773]/20 border-[#33C773]/40 text-[#33C773]'
                                : isEligible
                                ? 'bg-[#E63845]/15 border-[#E63845]/30 text-[#E63845]'
                                : 'bg-[#232733]/40 border-[#303645]/40 text-[#6B7280]'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-bold tracking-wider">Ưu đãi</span>
                            <span className="text-sm font-black mt-0.5">
                              {v.discount_type === 'PERCENT'
                                ? `-${v.discount_value}%`
                                : `-${Math.round(v.discount_value / 1000)}K`}
                            </span>
                            <span className="text-[9px] opacity-75 mt-0.5">CINEMAX</span>
                          </div>

                          {/* Chi tiết bên phải */}
                          <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-mono font-bold text-xs text-white bg-[#1A1C26] px-2 py-0.5 rounded border border-[#303645]">
                                  {v.code}
                                </span>
                                {isSelected ? (
                                  <span className="text-[10px] text-[#33C773] font-bold bg-[#33C773]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Đang dùng
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-[#FABF2E]">
                                    {v.discount_type === 'PERCENT'
                                      ? `Giảm ${v.discount_value}%`
                                      : `Giảm ${v.discount_value.toLocaleString('vi-VN')}đ`}
                                    {v.max_discount ? ` (Tối đa ${v.max_discount.toLocaleString('vi-VN')}đ)` : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#CBD5E1] line-clamp-1 mb-1">
                                {v.description || `Áp dụng đơn từ ${(v.min_order || 0).toLocaleString('vi-VN')}đ`}
                              </p>
                              <div className="text-[10px] text-[#9EA6B8] flex items-center gap-3">
                                <span>Đơn tối thiểu: <strong>{(v.min_order || 0).toLocaleString('vi-VN')}đ</strong></span>
                                <span>HSD: {v.valid_to ? (v.valid_to.includes('T') ? v.valid_to.slice(0, 10) : v.valid_to) : '31/12/2026'}</span>
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between">
                              {!isEligible ? (
                                <span className="text-[10px] text-[#FFA4A4]">
                                  Cần thêm {((v.min_order || 0) - subtotalBeforeDiscount).toLocaleString('vi-VN')}đ
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#33C773] font-semibold">
                                  ✓ Đủ điều kiện sử dụng
                                </span>
                              )}

                              <button
                                type="button"
                                disabled={!isEligible}
                                onClick={() => {
                                  if (isSelected) {
                                    handleRemovePromo();
                                  } else {
                                    handleSelectVoucher(v);
                                  }
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#E63845]/20 text-[#E63845] hover:bg-[#E63845] hover:text-white border border-[#E63845]/40'
                                    : isEligible
                                    ? 'bg-[#E63845] hover:bg-[#CC2B37] text-white shadow-sm'
                                    : 'bg-[#232733] text-[#6B7280] cursor-not-allowed'
                                }`}
                              >
                                {isSelected ? 'Gỡ mã' : 'Dùng mã'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#303645] bg-[#14161F] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#9EA6B8]">Tổng tiền thanh toán: </span>
                <span className="text-white font-bold text-sm font-mono">{finalTotal.toLocaleString('vi-VN')}đ</span>
                {discountAmount > 0 && (
                  <span className="text-[#33C773] text-[11px] ml-1.5">(Đã giảm -{discountAmount.toLocaleString('vi-VN')}đ)</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-[#242836] hover:bg-[#303645] text-white font-semibold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
