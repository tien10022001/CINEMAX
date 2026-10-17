'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import {
  ScanLine,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  ShieldCheck,
  Armchair,
  Film,
  Building2,
  Search,
  Camera,
  CameraOff,
  Upload,
  Printer,
  User,
  Phone,
  Sparkles,
  RefreshCw,
  Check,
  Ban
} from 'lucide-react';
import { Ticket } from '@/lib/types-redesign';
import { syncCheckInToSupabase } from '@/lib/supabase/queries';

interface CheckinViewProps {
  tickets: Ticket[];
  operatorName: string;
  onCheckInTicket: (qrToken: string, checkedInBy: string, agePassed: boolean) => Promise<void>;
  showToast: (msg: string) => void;
}

export interface InspectedTicketOrder {
  id: string;
  qr_token_hash: string;
  movie_title: string;
  age_rating: 'P' | 'K' | 'T13' | 'T16' | 'T18';
  auditorium_name: string;
  screen_type: string;
  cinema_name: string;
  starts_at_str: string;
  seats: string[];
  checked_in_seats: string[];
  status: 'issued' | 'used' | 'cancelled' | 'rejected_age';
  customer_name: string;
  customer_phone: string;
  channel: 'POS' | 'ONLINE';
  foods?: string;
  total_amount?: number;
  checked_in_at?: string;
  checked_in_by?: string;
  age_check_passed?: boolean;
}

export default function CheckinView({
  tickets,
  operatorName,
  onCheckInTicket,
  showToast
}: CheckinViewProps) {
  const [scanCode, setScanCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStatusText, setCameraStatusText] = useState('Camera đang tắt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ageCheckConfirmed, setAgeCheckConfirmed] = useState(false);
  const [selectedSeatsToCheckin, setSelectedSeatsToCheckin] = useState<string[]>([]);
  const [inspectedTicket, setInspectedTicket] = useState<InspectedTicketOrder | null>(null);
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [thermalQrDataUrl, setThermalQrDataUrl] = useState('');

  // Video / Canvas refs for real live scanner
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedCodeRef = useRef<string>('');

  // Recent checked-in log
  const [recentCheckedIn, setRecentCheckedIn] = useState<
    { code: string; movie: string; seat: string; time: string; staff: string }[]
  >([
    {
      code: 'CMX-QR-89102',
      movie: 'Dune: Hành Tinh Cát 2',
      seat: 'F12',
      time: '19:15',
      staff: operatorName
    },
    {
      code: 'CMX-QR-7721',
      movie: 'Thám Tử Lừng Danh Conan',
      seat: 'E08, E09',
      time: '19:10',
      staff: operatorName
    }
  ]);

  // Audio beep
  const playBeep = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore audio context restriction
    }
  }, []);

  const extractCode = useCallback((raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.bookingCode) return String(parsed.bookingCode);
        if (parsed.id) return String(parsed.id);
        if (parsed.code) return String(parsed.code);
        if (parsed.qrToken) return String(parsed.qrToken);
      } catch {
        // Fallback
      }
    }
    return trimmed.replace(/^CINEMAX:TKT:/i, '').replace(/^#/, '');
  }, []);

  // 1. Tải danh sách các vé/đơn thực tế từ localStorage + tickets prop
  const allKnownOrders = useMemo(() => {
    const map = new Map<string, InspectedTicketOrder>();

    // 1.1 Từ localStorage cinemax_user_tickets
    try {
      const rawUserTickets = localStorage.getItem('cinemax_user_tickets');
      if (rawUserTickets) {
        const parsed = JSON.parse(rawUserTickets);
        if (Array.isArray(parsed)) {
          parsed.forEach((ut: any) => {
            const id = String(ut.bookingCode || ut.id || '');
            if (!id) return;
            const seatList = String(ut.seats || '')
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
            const rawStatus = String(ut.status || 'ĐÃ THANH TOÁN').toUpperCase();
            const status: InspectedTicketOrder['status'] =
              rawStatus === 'ĐÃ XEM' || rawStatus === 'USED'
                ? 'used'
                : rawStatus === 'REJECTED_AGE'
                ? 'rejected_age'
                : rawStatus.includes('HỦY')
                ? 'cancelled'
                : 'issued';

            const rawAge = String(ut.ageRating || 'T16').toUpperCase();
            const age_rating = (['P', 'K', 'T13', 'T16', 'T18'].includes(rawAge)
              ? rawAge
              : 'T16') as InspectedTicketOrder['age_rating'];

            const checkedSeats =
              Array.isArray(ut.checked_in_seats) && ut.checked_in_seats.length > 0
                ? ut.checked_in_seats
                : status === 'used'
                ? seatList
                : [];

            map.set(id.toLowerCase(), {
              id,
              qr_token_hash: id,
              movie_title: ut.movieTitle || 'Phim Chiếu Rạp Cinemax',
              age_rating,
              auditorium_name: ut.roomName || 'Phòng 1 (IMAX Laser)',
              screen_type: ut.screenType || 'IMAX Laser',
              cinema_name: ut.cinemaName || 'Cinemax Xuân Thủy',
              starts_at_str: ut.showtime || 'Hôm nay, 19:30',
              seats: seatList.length > 0 ? seatList : ['E05'],
              checked_in_seats: checkedSeats,
              status,
              customer_name: ut.customerName || 'Khách Hàng',
              customer_phone: ut.customerPhone || '0901234567',
              channel: ut.channel === 'POS' ? 'POS' : 'ONLINE',
              foods: ut.foodSummary,
              total_amount: ut.totalAmount,
              checked_in_at: ut.checked_in_at,
              checked_in_by: ut.checked_in_by,
              age_check_passed: Boolean(ut.age_check_passed)
            });
          });
        }
      }
    } catch {
      // Ignore
    }

    // 1.2 Từ localStorage cinemax_my_tickets_v2
    try {
      const rawV2 = localStorage.getItem('cinemax_my_tickets_v2');
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (Array.isArray(parsed)) {
          parsed.forEach((o: any) => {
            const id = String(o.id || '');
            if (!id || map.has(id.toLowerCase())) return;
            const seatList = Array.isArray(o.seats) ? o.seats : [String(o.seats || 'E05')];
            const rawStatus = String(o.status || 'PAID').toUpperCase();
            const status: InspectedTicketOrder['status'] =
              rawStatus === 'USED'
                ? 'used'
                : rawStatus === 'REJECTED_AGE'
                ? 'rejected_age'
                : rawStatus === 'CANCELLED'
                ? 'cancelled'
                : 'issued';

            const rawAge = String(o.age_rating || 'T16').toUpperCase();
            const age_rating = (['P', 'K', 'T13', 'T16', 'T18'].includes(rawAge)
              ? rawAge
              : 'T16') as InspectedTicketOrder['age_rating'];

            map.set(id.toLowerCase(), {
              id,
              qr_token_hash: id,
              movie_title: o.movie_title || 'Phim Chiếu Rạp Cinemax',
              age_rating,
              auditorium_name: o.room_name || 'Phòng 1',
              screen_type: o.screen_type || '2D Dolby',
              cinema_name: o.cinema_name || 'Cinemax Xuân Thủy',
              starts_at_str: o.start_time
                ? new Date(o.start_time).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                  })
                : 'Hôm nay, 19:30',
              seats: seatList,
              checked_in_seats: Array.isArray(o.checked_in_seats) ? o.checked_in_seats : [],
              status,
              customer_name: o.customer_name || 'Khách Hàng',
              customer_phone: o.customer_phone || '0901234567',
              channel: o.channel === 'POS' ? 'POS' : 'ONLINE',
              total_amount: o.total_amount,
              checked_in_at: o.checked_in_at,
              checked_in_by: o.checked_in_by,
              age_check_passed: Boolean(o.age_check_passed)
            });
          });
        }
      }
    } catch {
      // Ignore
    }

    // 1.3 Từ tickets prop
    (tickets || []).forEach((t) => {
      const id = t.qr_token_hash || t.id;
      if (!id || map.has(id.toLowerCase())) return;
      map.set(id.toLowerCase(), {
        id,
        qr_token_hash: t.qr_token_hash,
        movie_title: t.showtime?.movie?.title || 'Phim Chiếu Rạp',
        age_rating: (t.showtime?.movie?.age_rating || 'T16') as InspectedTicketOrder['age_rating'],
        auditorium_name: t.showtime?.auditorium?.name || 'Phòng Chiếu 1',
        screen_type: t.showtime?.format || '2D',
        cinema_name: 'Cinemax Xuân Thủy',
        starts_at_str: t.showtime?.starts_at
          ? new Date(t.showtime.starts_at).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit'
            })
          : 'Hôm nay',
        seats: [t.seat_label || 'E05'],
        checked_in_seats: t.status === 'used' ? [t.seat_label || 'E05'] : [],
        status: t.status === 'used' ? 'used' : t.status === 'cancelled' ? 'cancelled' : 'issued',
        customer_name: 'Khách Hàng',
        customer_phone: '0901234567',
        channel: 'ONLINE',
        checked_in_at: t.checked_in_at,
        checked_in_by: t.checked_in_by,
        age_check_passed: t.age_check_passed
      });
    });

    return Array.from(map.values());
  }, [tickets]);

  // Lookup function
  const handleInspectTicket = useCallback(
    (queryCode?: string) => {
      const rawTarget = (queryCode ?? scanCode).trim();
      const cleanTarget = extractCode(rawTarget).toLowerCase();
      if (!cleanTarget) {
        showToast('Vui lòng nhập hoặc quét mã vé QR!');
        return;
      }

      // Find in all known orders
      const found = allKnownOrders.find(
        (o) =>
          o.id.toLowerCase() === cleanTarget ||
          o.qr_token_hash.toLowerCase() === cleanTarget ||
          o.id.toLowerCase().includes(cleanTarget) ||
          cleanTarget.includes(o.id.toLowerCase()) ||
          o.customer_phone.includes(cleanTarget) ||
          o.seats.some((s) => s.toLowerCase() === cleanTarget)
      );

      if (found) {
        setInspectedTicket(found);
        setScanCode(found.id);
        const remaining = found.seats.filter((s) => !(found.checked_in_seats || []).includes(s));
        setSelectedSeatsToCheckin(remaining.length > 0 ? remaining : [...found.seats]);
        setAgeCheckConfirmed(found.age_rating === 'P' || Boolean(found.age_check_passed));
        showToast(`Đã tìm thấy vé: #${found.id.slice(0, 10)} (${found.movie_title})`);
      } else {
        // Fallback for simulation / direct code testing
        const isUsed = cleanTarget.includes('used') || cleanTarget.includes('7721');
        const fallback: InspectedTicketOrder = {
          id: rawTarget,
          qr_token_hash: rawTarget,
          movie_title: cleanTarget.includes('dune')
            ? 'Dune: Hành Tinh Cát - Phần 2'
            : 'Thám Tử Lừng Danh Conan: Ngôi Sao 5 Cánh',
          age_rating: cleanTarget.includes('conan') ? 'T13' : 'T16',
          auditorium_name: 'Phòng 2 (IMAX Laser)',
          screen_type: 'IMAX Laser',
          cinema_name: 'Cinemax Xuân Thủy',
          starts_at_str: 'Hôm nay, 19:30',
          seats: ['E08', 'E09'],
          checked_in_seats: isUsed ? ['E08', 'E09'] : [],
          status: isUsed ? 'used' : 'issued',
          customer_name: 'Khách Hàng Quét Mã',
          customer_phone: '0901234567',
          channel: 'ONLINE',
          checked_in_at: isUsed ? '19:10' : undefined,
          checked_in_by: isUsed ? operatorName : undefined
        };
        setInspectedTicket(fallback);
        setSelectedSeatsToCheckin(isUsed ? [] : ['E08', 'E09']);
        setAgeCheckConfirmed(false);
      }
    },
    [scanCode, extractCode, allKnownOrders, operatorName, showToast]
  );

  const handleInspectTicketRef = useRef(handleInspectTicket);
  useEffect(() => {
    handleInspectTicketRef.current = handleInspectTicket;
  }, [handleInspectTicket]);

  // Live Camera Scanner loop with jsQR
  useEffect(() => {
    if (!cameraActive) return;

    let activeStream: MediaStream | null = null;
    let animId: number | null = null;
    let isCancelled = false;

    const startCamera = async () => {
      try {
        setCameraError(null);
        setCameraStatusText('Đang khởi động Camera...');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Trình duyệt không hỗ trợ truy cập Webcam.');
        }

        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
          });
        } catch {
          activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (isCancelled) {
          activeStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = activeStream;
          videoEl.setAttribute('playsinline', 'true');
          try {
            await videoEl.play();
          } catch {
            // benign
          }
          setCameraStatusText('Đang quét trực tiếp — hướng mã QR vào khung ngắm');
        }

        const scanFrame = () => {
          if (isCancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= 2) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imageData = ctx.getImageData(0, 0, w, h);
                const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'attemptBoth'
                });

                if (qrResult && qrResult.data) {
                  const clean = extractCode(qrResult.data);
                  if (clean && clean !== lastScannedCodeRef.current) {
                    lastScannedCodeRef.current = clean;
                    playBeep();
                    handleInspectTicketRef.current(clean);
                    setTimeout(() => {
                      lastScannedCodeRef.current = '';
                    }, 3000);
                  }
                }
              }
            }
          }
          animId = requestAnimationFrame(scanFrame);
        };

        animId = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        console.warn('Webcam start error:', err);
        setCameraError(err.message || 'Không thể mở Camera');
        setCameraStatusText('Lỗi Camera: ' + (err.message || ''));
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraActive, extractCode, playBeep]);

  // Decode QR from uploaded image file
  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (qrResult && qrResult.data) {
          const clean = extractCode(qrResult.data);
          playBeep();
          handleInspectTicket(clean);
          showToast(`Đã nhận diện QR từ ảnh: ${clean}`);
        } else {
          showToast('Không tìm thấy mã QR hợp lệ trong ảnh!');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Generate QR for thermal modal
  useEffect(() => {
    if (!inspectedTicket || !showThermalModal) {
      setThermalQrDataUrl('');
      return;
    }
    QRCode.toDataURL(inspectedTicket.id, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
      .then((url) => setThermalQrDataUrl(url))
      .catch(() => setThermalQrDataUrl(''));
  }, [inspectedTicket, showThermalModal]);

  // Toggle seat for partial checkin
  const toggleSeatSelection = (seat: string) => {
    setSelectedSeatsToCheckin((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]
    );
  };

  // 2. Action: Xác nhận vào rạp (Check-in)
  const handleConfirmAdmission = async () => {
    if (!inspectedTicket) return;

    if (inspectedTicket.status === 'used') {
      showToast('VÉ ĐÃ SỬ DỤNG TRƯỚC ĐÓ! TỪ CHỐI CHO VÀO RẠP!');
      return;
    }

    const requiresAgeCheck = ['T13', 'T16', 'T18'].includes(inspectedTicket.age_rating);
    if (requiresAgeCheck && !ageCheckConfirmed) {
      showToast(`BẮT BUỘC TICK XÁC NHẬN ĐÃ KIỂM TRA ĐỘ TUỔI / CCCD (${inspectedTicket.age_rating})!`);
      return;
    }

    if (selectedSeatsToCheckin.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 ghế để soát vào rạp!');
      return;
    }

    try {
      setIsProcessing(true);
      playBeep();

      const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const nowDateStr = `${nowTime} - ${new Date().toLocaleDateString('vi-VN')}`;

      const nextCheckedSeats = Array.from(
        new Set([...(inspectedTicket.checked_in_seats || []), ...selectedSeatsToCheckin])
      );
      const allSeatsChecked = inspectedTicket.seats.every((s) => nextCheckedSeats.includes(s));
      const nextStatus: InspectedTicketOrder['status'] = allSeatsChecked ? 'used' : 'issued';

      // 2.1 Cập nhật localStorage cinemax_user_tickets
      try {
        const raw = localStorage.getItem('cinemax_user_tickets');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((ut: any) => {
              if (
                String(ut.bookingCode || ut.id || '').toLowerCase() === inspectedTicket.id.toLowerCase()
              ) {
                return {
                  ...ut,
                  status: allSeatsChecked ? 'ĐÃ XEM' : ut.status,
                  checked_in_seats: nextCheckedSeats,
                  checked_in_at: nowDateStr,
                  checked_in_by: operatorName,
                  age_check_passed: true
                };
              }
              return ut;
            });
            localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
          }
        }
      } catch {
        // Ignore
      }

      // 2.2 Cập nhật localStorage cinemax_my_tickets_v2
      try {
        const rawV2 = localStorage.getItem('cinemax_my_tickets_v2');
        if (rawV2) {
          const list = JSON.parse(rawV2);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (String(o.id || '').toLowerCase() === inspectedTicket.id.toLowerCase()) {
                return {
                  ...o,
                  status: allSeatsChecked ? 'USED' : o.status,
                  checked_in_seats: nextCheckedSeats,
                  checked_in_at: nowDateStr,
                  checked_in_by: operatorName,
                  age_check_passed: true
                };
              }
              return o;
            });
            localStorage.setItem('cinemax_my_tickets_v2', JSON.stringify(updated));
          }
        }
      } catch {
        // Ignore
      }

      // 2.3 Gọi parent callback & Supabase sync
      await onCheckInTicket(inspectedTicket.id, operatorName, true);
      await syncCheckInToSupabase(inspectedTicket.id, true);

      // 2.4 Cập nhật state nội bộ
      const updatedInspected: InspectedTicketOrder = {
        ...inspectedTicket,
        checked_in_seats: nextCheckedSeats,
        status: nextStatus,
        checked_in_at: nowDateStr,
        checked_in_by: operatorName,
        age_check_passed: true
      };
      setInspectedTicket(updatedInspected);

      // Cập nhật recent list
      setRecentCheckedIn((prev) => [
        {
          code: inspectedTicket.id.slice(0, 12),
          movie: inspectedTicket.movie_title,
          seat: selectedSeatsToCheckin.join(', '),
          time: nowTime,
          staff: operatorName
        },
        ...prev
      ]);

      showToast(
        `SOÁT VÉ THÀNH CÔNG! Ghế [${selectedSeatsToCheckin.join(', ')}] đã được duyệt vào phòng ${inspectedTicket.auditorium_name}!`
      );
    } catch (err: any) {
      showToast('Lỗi soát vé: ' + (err.message || 'Thử lại'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Action: Từ chối do chưa đủ tuổi
  const handleRejectUnderage = async () => {
    if (!inspectedTicket) return;

    try {
      setIsProcessing(true);
      await syncCheckInToSupabase(inspectedTicket.id, false);

      // Cập nhật localStorage
      try {
        const raw = localStorage.getItem('cinemax_user_tickets');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((ut: any) =>
              String(ut.bookingCode || ut.id || '').toLowerCase() === inspectedTicket.id.toLowerCase()
                ? { ...ut, status: 'REJECTED_AGE', age_check_passed: false }
                : ut
            );
            localStorage.setItem('cinemax_user_tickets', JSON.stringify(updated));
          }
        }
      } catch {
        // Ignore
      }

      setInspectedTicket((prev) =>
        prev ? { ...prev, status: 'rejected_age', age_check_passed: false } : null
      );
      showToast(`Đã từ chối vé #${inspectedTicket.id.slice(0, 8)} do khách chưa đủ tuổi ${inspectedTicket.age_rating}!`);
    } catch (err: any) {
      showToast('Lỗi cập nhật: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getAgeRatingBadge = (rating: string) => {
    switch (rating) {
      case 'T18':
        return 'bg-[#EF4444] text-white border-[#EF4444]';
      case 'T16':
        return 'bg-[#F97316] text-white border-[#F97316]';
      case 'T13':
        return 'bg-[#EAB308] text-black border-[#EAB308]';
      case 'K':
        return 'bg-[#3B82F6] text-white border-[#3B82F6]';
      case 'P':
      default:
        return 'bg-[#22C55E] text-black border-[#22C55E]';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#22C55E]/20 to-[#06B6D4]/20 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
            <ScanLine className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white">Soát Vé Khán Giả Vào Cửa (Check-in QR)</h1>
              <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-black border border-[#22C55E]/30">
                LIVE SYNC
              </span>
            </div>
            <p className="text-xs text-[#8E9AAF]">
              Quét mã vạch/QR qua webcam, súng quét USB, hoặc tải ảnh vé điện tử
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCameraActive((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              cameraActive
                ? 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 hover:bg-[#EF4444]/30'
                : 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/40 hover:bg-[#22C55E]/30'
            }`}
          >
            {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            <span>{cameraActive ? 'Tắt Webcam' : 'Bật Webcam Quét QR'}</span>
          </button>

          <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1A2232] text-white border border-[#222B3D] text-xs font-bold transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-[#FABF2E]" />
            <span>Tải Ảnh QR</span>
            <input
              type="file"
              ref={qrFileInputRef}
              accept="image/*"
              onChange={handleQrFileUpload}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-2 bg-[#141924] border border-[#222B3D] px-3 py-1.5 rounded-xl text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span className="text-[#8E9AAF]">Soát vé:</span>
            <span className="font-bold text-white">{operatorName}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Scanner / Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (5/12): Camera & Scanner input */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Camera Box (if active) */}
          {cameraActive && (
            <div className="bg-[#121622] border-2 border-[#22C55E]/50 rounded-3xl p-4 space-y-3 overflow-hidden shadow-xl shadow-[#22C55E]/10">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#22C55E] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
                  Ống Kính Webcam Trực Tiếp
                </span>
                <span className="text-[11px] text-[#8E9AAF]">{cameraStatusText}</span>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-[#222B3D]">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Reticle Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-[#22C55E] rounded-2xl relative animate-pulse">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-[#22C55E]" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-[#22C55E]" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-[#22C55E]" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-[#22C55E]" />
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#22C55E] to-transparent absolute top-1/2 -translate-y-1/2 animate-bounce" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barcode / QR Input Box */}
          <div className="bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#FABF2E]" />
              <span>Nhập Mã Vé Hoặc Quét Bằng Súng Mã Vạch</span>
            </h2>

            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#5C677D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Quét QR, mã đơn, số điện thoại, số ghế..."
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInspectTicket()}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl pl-10 pr-3.5 py-3 text-xs text-white font-mono focus:outline-none focus:border-[#22C55E]"
                  />
                  {scanCode && (
                    <button
                      onClick={() => setScanCode('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C677D] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleInspectTicket()}
                  className="px-5 py-3 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black text-xs cursor-pointer shrink-0 transition-all shadow-md shadow-[#22C55E]/20"
                >
                  Kiểm Tra
                </button>
              </div>
              <p className="text-[11px] text-[#5C677D]">
                Hỗ trợ súng quét barcode USB (tự Enter sau khi bắn) hoặc dán mã QR payload.
              </p>
            </div>

            {/* Quick Presets for Demo */}
            <div className="pt-3 border-t border-[#1F2739] space-y-2">
              <span className="text-[10px] text-[#8E9AAF] uppercase font-bold block">
                Mã Thử Nghiệm Nhanh:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleInspectTicket('69b6447c80200b3d4a2df75f')}
                  className="px-2.5 py-1.5 rounded-xl bg-[#171D2B] hover:bg-[#1F2739] border border-[#253045] text-[11px] text-white font-mono cursor-pointer transition-colors"
                >
                  Vé Dune 2 (T16 - Hợp Lệ)
                </button>
                <button
                  onClick={() => handleInspectTicket('69a83a91c1149b2e7f1bc820')}
                  className="px-2.5 py-1.5 rounded-xl bg-[#171D2B] hover:bg-[#1F2739] border border-[#253045] text-[11px] text-[#FABF2E] font-mono cursor-pointer transition-colors"
                >
                  Deadpool (T18 - Cần CCCD)
                </button>
                <button
                  onClick={() => handleInspectTicket('CMX-QR-7721-USED')}
                  className="px-2.5 py-1.5 rounded-xl bg-[#3B191C]/60 hover:bg-[#3B191C] border border-[#EF4444]/40 text-[11px] text-[#EF4444] font-mono cursor-pointer transition-colors"
                >
                  Vé Đã Dùng (Cảnh Báo)
                </button>
              </div>
            </div>
          </div>

          {/* Recent Checked-in Log */}
          <div className="bg-[#121622] border border-[#222B3D] rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#22C55E]" />
                <span>Nhật Ký Khách Vừa Vào Cửa</span>
              </h3>
              <span className="text-[11px] text-[#5C677D]">
                {recentCheckedIn.length} lượt soát gần nhất
              </span>
            </div>

            <div className="space-y-2 text-xs max-h-[300px] overflow-y-auto pr-1">
              {recentCheckedIn.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-[#171D2B] border border-[#222B3D] flex items-center justify-between hover:border-[#22C55E]/40 transition-all"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-white text-xs">{item.movie}</div>
                    <div className="text-[11px] text-[#8E9AAF] flex items-center gap-2">
                      <span>
                        Ghế: <strong className="text-[#06B6D4] font-mono">{item.seat}</strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-[#5C677D]">{item.code}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-[#22C55E] font-black">{item.time}</div>
                    <div className="text-[10px] text-[#5C677D]">{item.staff}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (7/12): Inspected Ticket Card & Admission Verification */}
        <div className="lg:col-span-7">
          {inspectedTicket ? (
            <div
              className={`rounded-3xl p-6 border space-y-5 shadow-2xl transition-all ${
                inspectedTicket.status === 'used'
                  ? 'bg-[#1C1417] border-[#EF4444]'
                  : inspectedTicket.status === 'rejected_age'
                  ? 'bg-[#291717] border-[#EF4444]'
                  : 'bg-[#121622] border-[#253247]'
              }`}
            >
              {/* Ticket Result Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-[#222B3D]">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shrink-0 ${
                      inspectedTicket.status === 'used' || inspectedTicket.status === 'rejected_age'
                        ? 'bg-[#EF4444] text-white shadow-[#EF4444]/30'
                        : 'bg-[#22C55E] text-black shadow-[#22C55E]/30'
                    }`}
                  >
                    {inspectedTicket.status === 'used' || inspectedTicket.status === 'rejected_age'
                      ? '✕'
                      : '✓'}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">
                      {inspectedTicket.status === 'used'
                        ? 'VÉ NÀY ĐÃ ĐƯỢC SỬ DỤNG HẾT CHỖ'
                        : inspectedTicket.status === 'rejected_age'
                        ? 'TỪ CHỐI CHO VÀO (CHƯA ĐỦ ĐỘ TUỔI)'
                        : 'VÉ HỢP LỆ — SẴN SÀNG CHO VÀO RẠP'}
                    </h2>
                    <p className="text-xs font-mono text-[#8E9AAF]">Mã Đơn / QR: #{inspectedTicket.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowThermalModal(true)}
                    className="p-2 rounded-xl bg-[#1F2739] hover:bg-[#28324A] text-[#8E9AAF] hover:text-white transition-colors cursor-pointer"
                    title="In Phiếu Vé Nhiệt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                      inspectedTicket.status === 'used'
                        ? 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40'
                        : inspectedTicket.status === 'rejected_age'
                        ? 'bg-[#EF4444]/30 text-[#EF4444] border-[#EF4444]'
                        : 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/40'
                    }`}
                  >
                    {inspectedTicket.status === 'used'
                      ? 'ĐÃ DÙNG (USED)'
                      : inspectedTicket.status === 'rejected_age'
                      ? 'TỪ CHỐI TUỔI'
                      : 'HỢP LỆ (PAID)'}
                  </span>
                </div>
              </div>

              {/* Movie & Showtime Detail Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-[#171D2B] border border-[#222B3D] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5C677D] text-[10px] font-bold uppercase">Phim Chiếu</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black border ${getAgeRatingBadge(
                        inspectedTicket.age_rating
                      )}`}
                    >
                      {inspectedTicket.age_rating}
                    </span>
                  </div>
                  <div className="text-sm font-black text-white">{inspectedTicket.movie_title}</div>
                  <div className="text-[11px] text-[#FABF2E] font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{inspectedTicket.starts_at_str}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#171D2B] border border-[#222B3D] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5C677D] text-[10px] font-bold uppercase">Phòng Chiếu & Rạp</span>
                    <span className="px-2 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] text-[10px] font-bold">
                      {inspectedTicket.screen_type}
                    </span>
                  </div>
                  <div className="text-sm font-black text-white">{inspectedTicket.auditorium_name}</div>
                  <div className="text-[11px] text-[#8E9AAF]">{inspectedTicket.cinema_name}</div>
                </div>
              </div>

              {/* Customer and Channel Info */}
              <div className="p-3.5 rounded-2xl bg-[#171D2B] border border-[#222B3D] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#222B3D] flex items-center justify-center text-[#8E9AAF]">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white">{inspectedTicket.customer_name}</div>
                    <div className="text-[11px] text-[#8E9AAF] flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      <span>{inspectedTicket.customer_phone}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wide uppercase ${
                      inspectedTicket.channel === 'POS'
                        ? 'bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/30'
                        : 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                    }`}
                  >
                    Kênh {inspectedTicket.channel}
                  </span>
                  {inspectedTicket.foods && (
                    <div className="text-[11px] text-[#FABF2E] mt-1 font-medium">
                      {inspectedTicket.foods}
                    </div>
                  )}
                </div>
              </div>

              {/* SEAT CHECK-IN SELECTOR (Partial or Full) */}
              <div className="p-4 rounded-2xl bg-[#171D2B] border border-[#222B3D] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Armchair className="w-4 h-4 text-[#06B6D4]" />
                    <span>Danh Sách Ghế Ngồi Trong Vé ({inspectedTicket.seats.length} ghế)</span>
                  </span>

                  {inspectedTicket.status !== 'used' && (
                    <button
                      onClick={() => {
                        const remaining = inspectedTicket.seats.filter(
                          (s) => !(inspectedTicket.checked_in_seats || []).includes(s)
                        );
                        setSelectedSeatsToCheckin(
                          selectedSeatsToCheckin.length === remaining.length ? [] : remaining
                        );
                      }}
                      className="text-[11px] font-bold text-[#22C55E] hover:underline cursor-pointer"
                    >
                      {selectedSeatsToCheckin.length > 0 ? 'Bỏ chọn hết' : 'Chọn tất cả ghế chưa vào'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {inspectedTicket.seats.map((seat) => {
                    const isAlreadyIn = (inspectedTicket.checked_in_seats || []).includes(seat);
                    const isSelected = selectedSeatsToCheckin.includes(seat);

                    return (
                      <button
                        key={seat}
                        disabled={isAlreadyIn}
                        onClick={() => toggleSeatSelection(seat)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                          isAlreadyIn
                            ? 'bg-[#1C2433] text-[#5C677D] border-[#222B3D] line-through cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#22C55E] text-black border-[#22C55E] shadow-md shadow-[#22C55E]/30 scale-105'
                            : 'bg-[#141924] text-white border-[#2A374F] hover:border-[#22C55E]'
                        }`}
                      >
                        <Armchair className="w-3.5 h-3.5" />
                        <span>Ghế {seat}</span>
                        {isAlreadyIn ? (
                          <span className="text-[10px] text-[#5C677D] font-sans no-underline">
                            (Đã vào)
                          </span>
                        ) : isSelected ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CRITICAL AGE RATING ALERT BOX */}
              {['T13', 'T16', 'T18'].includes(inspectedTicket.age_rating) && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#3B191C] to-[#2B1518] border-2 border-[#EF4444] space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-xl bg-[#EF4444] text-white font-black text-sm flex items-center justify-center shrink-0">
                      {inspectedTicket.age_rating}
                    </span>
                    <div>
                      <h4 className="font-black text-white text-xs uppercase tracking-wide text-[#EF4444]">
                        QUY ĐỊNH BẮT BUỘC ĐỐI CHIẾU TUỔI: PHIM DÁN NHÃN {inspectedTicket.age_rating}
                      </h4>
                      <p className="text-[11px] text-[#FCA5A5] mt-0.5">
                        Theo Thông tư 05/2023/TT-BVHTTDL: Khán giả phải từ đủ{' '}
                        {inspectedTicket.age_rating === 'T18'
                          ? '18'
                          : inspectedTicket.age_rating === 'T16'
                          ? '16'
                          : '13'}{' '}
                        tuổi trở lên. Bắt buộc kiểm tra CCCD/VNeID hoặc thẻ học sinh/sinh viên.
                      </p>
                    </div>
                  </div>

                  {inspectedTicket.status !== 'used' && inspectedTicket.status !== 'rejected_age' && (
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-[#1C1215] border border-[#EF4444]/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ageCheckConfirmed}
                        onChange={(e) => setAgeCheckConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded text-[#EF4444] focus:ring-[#EF4444] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">
                        Tôi xác nhận đã đối chiếu giấy tờ tùy thân và khách hàng đủ điều kiện độ tuổi ({inspectedTicket.age_rating})
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* FRAUD WARNING (If already used) */}
              {inspectedTicket.status === 'used' && (
                <div className="p-4 rounded-xl bg-[#3B191C] border border-[#EF4444] text-xs text-[#EF4444] font-bold space-y-1">
                  <div>CẢNH BÁO: Vé này đã được soát vào cửa lúc {inspectedTicket.checked_in_at || 'trước đó'}.</div>
                  <div className="text-[11px] text-white font-normal">
                    Tuyệt đối từ chối cho khách vào rạp để tránh chiếm trùng ghế ngồi bên trong phòng chiếu!
                  </div>
                </div>
              )}

              {/* Admission Actions */}
              {inspectedTicket.status !== 'used' && inspectedTicket.status !== 'rejected_age' && (
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleConfirmAdmission}
                    disabled={isProcessing}
                    className="flex-1 py-3.5 rounded-2xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-black text-xs tracking-wide shadow-xl shadow-[#22C55E]/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'ĐANG XỬ LÝ...'
                        : `XÁC NHẬN CHO VÀO RẠP (${selectedSeatsToCheckin.length} GHẾ)`}
                    </span>
                  </button>

                  {['T13', 'T16', 'T18'].includes(inspectedTicket.age_rating) && (
                    <button
                      onClick={handleRejectUnderage}
                      disabled={isProcessing}
                      className="px-5 py-3.5 rounded-2xl bg-[#3B191C] hover:bg-[#4E1E22] text-[#EF4444] border border-[#EF4444]/40 font-bold text-xs tracking-wide transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Từ Chối (Chưa Đủ Tuổi)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[420px] rounded-3xl bg-[#121622] border border-[#222B3D] flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#171D2B] border border-[#222B3D] flex items-center justify-center text-[#5C677D]">
                <ScanLine className="w-8 h-8" />
              </div>
              <div className="text-white font-bold text-sm">Chưa có vé nào được quét</div>
              <p className="text-xs text-[#8E9AAF] max-w-sm">
                Hãy bật Webcam để quét mã QR vé trên điện thoại khách, dùng súng quét mã vạch USB, hoặc nhập mã vé vào ô tìm kiếm bên trái.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* THERMAL PRINT PREVIEW MODAL */}
      {showThermalModal && inspectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white text-black w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="text-center space-y-1 border-b border-dashed border-gray-400 pb-3">
              <h3 className="font-black text-sm uppercase tracking-wider">CINEMAX CINEMAS</h3>
              <p className="text-[10px] text-gray-600">{inspectedTicket.cinema_name}</p>
              <p className="text-[10px] text-gray-500">PHIẾU SOÁT VÉ VÀO CỬA</p>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Phim:</span>
                <span className="font-bold text-right">{inspectedTicket.movie_title}</span>
              </div>
              <div className="flex justify-between">
                <span>Độ tuổi:</span>
                <span className="font-bold text-red-600">{inspectedTicket.age_rating}</span>
              </div>
              <div className="flex justify-between">
                <span>Phòng / Định dạng:</span>
                <span className="font-bold">
                  {inspectedTicket.auditorium_name} ({inspectedTicket.screen_type})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Suất chiếu:</span>
                <span className="font-bold">{inspectedTicket.starts_at_str}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-1 border-t border-dashed border-gray-300">
                <span>Ghế:</span>
                <span>{inspectedTicket.seats.join(', ')}</span>
              </div>
            </div>

            {thermalQrDataUrl && (
              <div className="flex flex-col items-center justify-center py-2 border-y border-dashed border-gray-300">
                <img
                  src={thermalQrDataUrl}
                  alt="QR Ticket"
                  className="w-36 h-36 object-contain"
                />
                <span className="text-[10px] font-bold mt-1 text-gray-600">
                  #{inspectedTicket.id.slice(0, 16)}
                </span>
              </div>
            )}

            <div className="text-[10px] text-gray-500 text-center space-y-0.5">
              <p>Nhân viên soát: {operatorName}</p>
              <p>Thời gian: {new Date().toLocaleString('vi-VN')}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 rounded-xl bg-black text-white font-bold hover:bg-gray-800 cursor-pointer"
              >
                In Vé
              </button>
              <button
                onClick={() => setShowThermalModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-200 text-gray-800 font-bold hover:bg-gray-300 cursor-pointer"
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
