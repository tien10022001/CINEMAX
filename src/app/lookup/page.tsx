'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { OtpService } from '@/services/otp.service';
import { TicketScannerService } from '@/services/ticket-scanner.service';
import { ContactValidator, ContactValidationResult } from '@/lib/contact-validator';
import {
  Search,
  ShieldCheck,
  Ticket,
  QrCode,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Phone,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export default function LookupPage() {
  const [step, setStep] = useState<'INPUT' | 'OTP' | 'RESULT'>('INPUT');
  const [orderCode, setOrderCode] = useState('');
  const [contact, setContact] = useState('');
  const [otpInput, setOtpInput] = useState('');

  // Trạng thái kiểm tra Contact tại Bước 1
  const [contactValidation, setContactValidation] = useState<ContactValidationResult | null>(null);
  const [isDnsChecking, setIsDnsChecking] = useState(false);
  const [dnsCheckResult, setDnsCheckResult] = useState<{ isValid: boolean; error?: string } | null>(null);

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [maskedDest, setMaskedDest] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Đếm ngược gửi lại OTP
  const [resendCountdown, setResendCountdown] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);

  const [orderData, setOrderData] = useState<any>(null);
  const [ticketsData, setTicketsData] = useState<any[]>([]);

  // 1. Kiểm tra Email / SĐT thời gian thực ngay khi khách gõ
  useEffect(() => {
    if (!contact.trim()) {
      setContactValidation(null);
      setDnsCheckResult(null);
      return;
    }

    const res = ContactValidator.validateContact(contact);
    setContactValidation(res);
    setDnsCheckResult(null);

    // Nếu là Email hợp lệ sơ bộ, tự động ping server kiểm tra DNS MX ngầm
    if (res.type === 'EMAIL' && res.isValid) {
      const timer = setTimeout(async () => {
        try {
          setIsDnsChecking(true);
          const apiRes = await fetch('/api/validate/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: contact }),
          });
          const data = await apiRes.json();
          setDnsCheckResult({
            isValid: data.isValid,
            error: data.error,
          });
        } catch {
          // Bỏ qua nếu lỗi mạng DNS
        } finally {
          setIsDnsChecking(false);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [contact]);

  // Đếm ngược 60s gửi lại OTP ở Bước 2
  useEffect(() => {
    if (step !== 'OTP') return;
    setResendCountdown(60);
    setCanResend(false);

    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Áp dụng gợi ý sửa lỗi gõ nhầm (ví dụ: @gmai.com -> @gmail.com)
  const handleApplySuggestion = (suggested: string) => {
    setContact(suggested);
  };

  // Bước 1: Yêu cầu gửi mã OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCode.trim() || !contact.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ mã đơn hàng và thông tin liên hệ!');
      return;
    }

    if (contactValidation && !contactValidation.isValid) {
      setErrorMsg(contactValidation.error || 'Thông tin liên hệ không hợp lệ.');
      return;
    }

    if (dnsCheckResult && !dnsCheckResult.isValid) {
      setErrorMsg(dnsCheckResult.error || 'Email không có máy chủ nhận mail hợp lệ.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await OtpService.requestLookupOtp(orderCode, contact);
      if (res.success && res.challengeId) {
        setChallengeId(res.challengeId);
        setDebugOtp(res.debugOtp || null);
        setChannel(res.channel || 'email');
        setMaskedDest(res.maskedDestination || ContactValidator.maskContact(contact));
        setSuccessMsg(res.message);
        setStep('OTP');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Bước 2: Xác minh mã OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim() || !challengeId) {
      setErrorMsg('Vui lòng nhập mã OTP 6 chữ số!');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await OtpService.verifyLookupOtp(challengeId, otpInput);
      if (res.success && res.order) {
        let foodsStr = '';
        try {
          const stored = localStorage.getItem('cinemax_user_tickets');
          if (stored) {
            const list = JSON.parse(stored);
            const matched = list.find(
              (t: any) =>
                t.bookingCode?.toUpperCase() === orderCode.trim().toUpperCase() ||
                t.id === orderCode.trim() ||
                t.bookingCode?.toUpperCase() === res.order.order_code?.toUpperCase()
            );
            if (matched) {
              foodsStr =
                matched.foodsStr ||
                (matched.foods ? matched.foods.map((f: any) => `${f.quantity}x ${f.name}`).join(', ') : '');
            }
          }
        } catch {}

        setOrderData({
          ...res.order,
          foodsStr,
        });
        setTicketsData(res.tickets || []);
        setStep('RESULT');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Xác thực OTP thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col text-white">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-10">
        {/* Banner Tiêu đề */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E63845]/10 border border-[#E63845]/30 text-[#E63845] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Bảo Mật Zero-Leakage OTP • Kiểm Tra Email & SĐT Thực Tế
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">Tra Cứu Đơn Hàng & Vé Điện Tử</h1>
          <p className="text-sm text-[#9EA6B8] max-w-lg mx-auto">
            Dành cho Khách vãng lai (Guest). Nhập mã đơn hàng và số điện thoại hoặc email đã đặt vé để nhận mã xác thực OTP bảo mật.
          </p>
        </div>

        {/* ======================================================== */}
        {/* BƯỚC 1: NHẬP MÃ ĐƠN HÀNG & THÔNG TIN LIÊN HỆ */}
        {/* ======================================================== */}
        {step === 'INPUT' && (
          <div className="max-w-md mx-auto bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                  Mã đơn hàng *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="VD: CNM261016-ABCDE"
                    value={orderCode}
                    onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-[#E63845]"
                  />
                  <Search className="w-4 h-4 text-[#9EA6B8] absolute right-4 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#9EA6B8] uppercase block">
                    Số điện thoại hoặc Email nhận vé *
                  </label>
                  {contactValidation && (
                    <span className="text-[11px] font-semibold text-[#FABF2E] flex items-center gap-1">
                      {contactValidation.type === 'EMAIL' ? (
                        <>
                          <Mail className="w-3.5 h-3.5" /> Kênh Email
                        </>
                      ) : (
                        <>
                          <Phone className="w-3.5 h-3.5" /> Kênh SMS
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="0912 345 678 hoặc email@gmail.com"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className={`w-full bg-[#0F1217] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors ${
                      contactValidation && !contactValidation.isValid
                        ? 'border-[#E63845] focus:border-[#E63845]'
                        : contactValidation && contactValidation.isValid
                        ? 'border-[#33C773] focus:border-[#33C773]'
                        : 'border-[#303645] focus:border-[#E63845]'
                    }`}
                  />
                </div>

                {/* Phản hồi trạng thái kiểm tra thời gian thực */}
                {contactValidation && (
                  <div className="mt-2 space-y-1 text-xs">
                    {/* Báo lỗi SĐT / Email sai định dạng */}
                    {!contactValidation.isValid && (
                      <div className="p-2.5 rounded-xl bg-[#E63845]/15 border border-[#E63845]/40 text-[#FFA4A4] flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E63845]" />
                        <div className="space-y-1">
                          <span>{contactValidation.error}</span>
                          {/* Gợi ý sửa lỗi gõ nhầm */}
                          {contactValidation.suggestion && (
                            <button
                              type="button"
                              onClick={() => handleApplySuggestion(contactValidation.suggestion!)}
                              className="block text-[#FABF2E] hover:underline font-bold text-left cursor-pointer"
                            >
                              👉 Nhấn vào đây để đổi thành: {contactValidation.suggestion}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Báo SĐT hợp lệ kèm nhà mạng */}
                    {contactValidation.isValid && contactValidation.type === 'PHONE' && (
                      <div className="p-2 rounded-xl bg-[#33C773]/10 border border-[#33C773]/30 text-[#33C773] flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Số điện thoại {contactValidation.carrier} hợp lệ</span>
                      </div>
                    )}

                    {/* Báo Email hợp lệ & kết quả DNS */}
                    {contactValidation.isValid && contactValidation.type === 'EMAIL' && (
                      <div className="p-2 rounded-xl bg-[#33C773]/10 border border-[#33C773]/30 text-[#33C773] flex items-center justify-between font-medium">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Cú pháp email hợp lệ</span>
                        </div>
                        {isDnsChecking && (
                          <span className="text-[10px] text-[#FABF2E] animate-pulse">
                            Đang kiểm tra máy chủ mail...
                          </span>
                        )}
                        {dnsCheckResult && dnsCheckResult.isValid && (
                          <span className="text-[10px] text-[#33C773] font-bold">
                            ✓ Máy chủ mail sẵn sàng
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E63845]/15 border border-[#E63845]/40 text-xs text-[#FFA4A4]">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#E63845]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || (contactValidation ? !contactValidation.isValid : false)}
                className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang kiểm tra & gửi mã OTP...</span>
                  </>
                ) : (
                  <span>Tiếp tục nhận mã OTP</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 2: NHẬP MÃ XÁC THỰC OTP */}
        {/* ======================================================== */}
        {step === 'OTP' && (
          <div className="max-w-md mx-auto bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#E63845]/10 border border-[#E63845]/30 text-[#E63845] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">Xác nhận mã OTP</h3>
              <p className="text-xs text-[#9EA6B8]">{successMsg}</p>
              <div className="inline-block bg-[#0F1217] px-3 py-1 rounded-full text-xs font-mono font-bold text-[#FABF2E] border border-[#303645]">
                {channel === 'email' ? '📧 Hòm thư: ' : '📱 SĐT: '} {maskedDest}
              </div>

              {debugOtp && (
                <div className="p-2.5 rounded-xl bg-[#FABF2E]/10 border border-[#FABF2E]/30 text-xs text-[#FABF2E] font-mono">
                  🔑 <strong>Mã OTP thử nghiệm:</strong> {debugOtp}
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5 text-center">
                  Nhập mã OTP 6 chữ số
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="------"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-2xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              {/* Cảnh báo bảo mật mã OTP */}
              <div className="p-3.5 rounded-2xl bg-[#E63845]/10 border border-[#E63845]/30 text-xs text-[#FFA4A4] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#E63845] mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-white block">⚠️ Cảnh báo bảo mật OTP:</span>
                  <p className="text-[11px] text-[#D1D5DB] leading-relaxed">
                    Tuyệt đối <strong className="text-white underline">KHÔNG cung cấp mã OTP</strong> cho bất kỳ ai. Nhân viên CinemaX <strong>không bao giờ</strong> gọi điện hay nhắn tin yêu cầu bạn đọc mã OTP!
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E63845]/10 border border-[#E63845]/30 text-xs text-[#E63845]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Nút gửi lại mã OTP */}
              <div className="text-center text-xs text-[#9EA6B8]">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="text-[#FABF2E] hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Gửi lại mã OTP mới
                  </button>
                ) : (
                  <span>Gửi lại mã OTP sau {resendCountdown}s</span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('INPUT')}
                  className="px-4 py-3 rounded-full border border-[#303645] text-xs font-bold hover:bg-[#0F1217] cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otpInput.length < 6}
                  className="flex-1 bg-[#E63845] hover:bg-[#CC2B37] text-white py-3 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Đang xác minh...' : 'Xem vé điện tử'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 3: HIỂN THỊ KẾT QUẢ VÉ ĐIỆN TỬ */}
        {/* ======================================================== */}
        {step === 'RESULT' && orderData && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-6">
              {/* Header: CINEMAX THEATER • HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC */}
              <div className="flex items-center justify-between border-b border-[#242E40] pb-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-[#E63845] tracking-widest uppercase">CINEMAX THEATER</div>
                  <h2 className="text-base sm:text-lg font-black text-white">HÓA ĐƠN XUẤT VÉ & BẮP NƯỚC</h2>
                  <p className="text-[11px] font-mono text-[#8E9AAF]">Mã: {orderData.order_code}</p>
                </div>
                <button
                  onClick={() => {
                    setStep('INPUT');
                    setOrderCode('');
                    setContact('');
                    setOtpInput('');
                  }}
                  className="text-xs text-[#9EA6B8] hover:text-white flex items-center gap-1 cursor-pointer bg-[#171D2B] px-3 py-1.5 rounded-xl border border-[#253045]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Tra cứu đơn khác
                </button>
              </div>

              {/* Thông tin vé dạng POS Receipt */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#8E9AAF] block text-[11px]">Phim:</span>
                  <span className="text-base font-bold text-white block">{orderData.movie_title || 'CINEMAX MOVIE'}</span>
                </div>

                <div className="flex justify-between text-[#8E9AAF]">
                  <span>Rạp: <strong className="text-white">{orderData.cinema_name || 'Cinemax Hà Nội Centre'}</strong></span>
                  <span>Trạng thái: <strong className="text-[#22C55E] uppercase">{orderData.status}</strong></span>
                </div>

                <div className="flex justify-between text-[#8E9AAF]">
                  <span>Phòng: <strong className="text-white">{orderData.room_name || 'Phòng 1 (2D Tiêu Chuẩn)'}</strong></span>
                  <span>Định dạng: <strong className="text-[#06B6D4]">{orderData.format || (orderData.room_name?.includes('IMAX') ? 'IMAX Laser' : '2D Digital')}</strong></span>
                </div>

                <div className="flex justify-between text-[#8E9AAF]">
                  <span>Giờ chiếu:</span>
                  <span className="font-mono text-white font-bold">{orderData.showtime || '10:45 • 2026-10-16'}</span>
                </div>

                {/* Seats breakdown box */}
                <div className="p-2.5 rounded-xl bg-[#171E2D] border border-[#253045] space-y-1">
                  <span className="text-[11px] font-bold text-[#FABF2E] block">Ghế ngồi:</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-mono font-bold text-sm text-[#06B6D4]">{orderData.seats || 'A1, A2'}</span>
                    <span className="text-[10px] text-[#8E9AAF] bg-[#141924] px-2 py-0.5 rounded border border-[#253045]">
                      Đã giữ chỗ
                    </span>
                  </div>
                </div>

                {/* Foods breakdown box */}
                {orderData.foodsStr && (
                  <div className="p-2.5 rounded-xl bg-[#171E2D] border border-[#253045] space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-[#FABF2E] block">Bắp nước:</span>
                      <span className="text-[9px] bg-[#FABF2E]/20 text-[#FABF2E] px-2 py-0.5 rounded-full border border-[#FABF2E]/40 font-semibold uppercase">
                        Nhận tại quầy
                      </span>
                    </div>
                    <div className="text-white font-semibold text-xs">{orderData.foodsStr}</div>
                  </div>
                )}

                {/* Financial breakdown */}
                <div className="pt-2 border-t border-[#242E40] space-y-1">
                  <div className="flex justify-between text-[#8E9AAF] text-xs">
                    <span>Người nhận vé:</span>
                    <span className="text-white font-semibold">
                      {orderData.customer_name} ({orderData.customer_phone || orderData.customer_email})
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-white">
                    <span>Tổng tiền:</span>
                    <span className="font-mono text-[#22C55E] text-base">
                      {orderData.total_amount ? orderData.total_amount.toLocaleString('vi-VN') : 0} đ
                    </span>
                  </div>
                </div>

                {/* Mã QR quét vé */}
                <div className="pt-6 border-t border-[#303645] flex flex-col sm:flex-row items-center justify-between gap-6 bg-[#0F1217] p-5 rounded-2xl">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                      <QrCode className="w-4 h-4 text-[#FABF2E]" />
                      MÃ QR SOÁT VÉ VÀO RẠP
                    </div>
                    <p className="text-xs text-[#9EA6B8]">
                      Xuất trình mã QR này trực tiếp tại quầy soát vé để vào phòng chiếu.
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl shrink-0 shadow-lg">
                    <img
                      src={TicketScannerService.generateTicketQrUrl(orderData.order_code, 200)}
                      alt={`QR Code ${orderData.order_code}`}
                      className="w-28 h-28 object-contain"
                    />
                  </div>
                </div>

                {/* CẢNH BÁO BẢO MẬT VÉ VÀ MÃ QR */}
                <div className="bg-[#E63845]/10 border border-[#E63845]/40 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#E63845]/20 text-[#E63845] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-white flex items-center gap-1.5 uppercase">
                      <span className="text-[#FFA4A4]">⚠️ Cảnh báo bảo mật vé:</span>
                      <span className="text-[10px] bg-[#E63845] text-white px-1.5 py-0.2 rounded font-black">QUAN TRỌNG</span>
                    </div>
                    <p className="text-[#D1D5DB] leading-relaxed">
                      Tuyệt đối <strong className="text-white underline">KHÔNG chia sẻ hoặc chụp ảnh mã QR này đăng lên mạng xã hội</strong>. Ai có mã QR hoặc mã đơn ({orderData.order_code}) đều có thể quét vào rạp trước bạn, dẫn đến vé của bạn bị vô hiệu hóa khi vào phòng chiếu!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
