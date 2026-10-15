'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { OtpService } from '@/services/otp.service';
import { Search, ShieldCheck, Ticket, QrCode, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function LookupPage() {
  const [step, setStep] = useState<'INPUT' | 'OTP' | 'RESULT'>('INPUT');
  const [orderCode, setOrderCode] = useState('');
  const [contact, setContact] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [orderData, setOrderData] = useState<any>(null);
  const [ticketsData, setTicketsData] = useState<any[]>([]);

  // Bước 1: Yêu cầu gửi mã OTP (Zero-Leakage)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCode.trim() || !contact.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ mã đơn hàng và thông tin liên hệ!');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await OtpService.requestLookupOtp(orderCode, contact);
      if (res.challengeId) {
        setChallengeId(res.challengeId);
        setDebugOtp(res.debugOtp || null);
        setSuccessMsg(res.message);
        setStep('OTP');
      } else {
        // Zero-Leakage: Vẫn báo thành công nếu không tìm thấy để bảo vệ quyền riêng tư
        setSuccessMsg(res.message);
        setStep('OTP');
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
        setOrderData(res.order);
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
            <ShieldCheck className="w-4 h-4" /> Bảo Mật Zero-Leakage OTP
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">Tra Cứu Đơn Hàng & Vé Điện Tử</h1>
          <p className="text-sm text-[#9EA6B8] max-w-lg mx-auto">
            Dành cho Khách vãng lai (Guest). Nhập mã đơn hàng và số điện thoại/email đã đặt để nhận mã xác thực OTP bảo mật.
          </p>
        </div>

        {/* ======================================================== */}
        {/* BƯỚC 1: NHẬP MÃ ĐƠN HÀNG & THÔNG TIN LIÊN HỆ */}
        {/* ======================================================== */}
        {step === 'INPUT' && (
          <div className="max-w-md mx-auto bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 shadow-2xl">
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                  Mã đơn hàng *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="VD: CNM261015-ABCDE"
                    value={orderCode}
                    onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-[#E63845]"
                  />
                  <Search className="w-4 h-4 text-[#9EA6B8] absolute right-4 top-3.5" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                  Số điện thoại hoặc Email nhận vé *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0912 345 678 hoặc email@gmail.com"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E63845]/10 border border-[#E63845]/30 text-xs text-[#E63845]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Đang kiểm tra...' : 'Tiếp tục nhận mã OTP'}
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

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E63845]/10 border border-[#E63845]/30 text-xs text-[#E63845]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('INPUT')}
                  className="px-4 py-3 rounded-full border border-[#303645] text-xs font-bold hover:bg-[#0F1217]"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
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
          <div className="space-y-6">
            <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#303645] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#33C773]/10 text-[#33C773] flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Đơn hàng: {orderData.order_code}</h2>
                    <span className="text-xs text-[#9EA6B8]">
                      Trạng thái: <strong className="text-[#33C773] uppercase">{orderData.status}</strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setStep('INPUT')}
                  className="text-xs text-[#9EA6B8] hover:text-white flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Tra cứu đơn khác
                </button>
              </div>

              {/* Chi tiết khách & Tiền */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-[#0F1217] p-4 rounded-2xl border border-[#303645]">
                <div>
                  <span className="text-[#9EA6B8] block">Người nhận vé:</span>
                  <strong className="text-white text-sm">{orderData.contact_name}</strong>
                </div>
                <div>
                  <span className="text-[#9EA6B8] block">Số điện thoại:</span>
                  <strong className="text-white text-sm">{orderData.contact_phone}</strong>
                </div>
                <div>
                  <span className="text-[#9EA6B8] block">Tổng tiền đã trả:</span>
                  <strong className="text-[#E63845] text-sm">{Number(orderData.total_amount).toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>

              {/* Danh sách vé điện tử */}
              <div className="space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#E63845]" /> Vé Điện Tử Vào Phòng Chiếu ({ticketsData.length || 1})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ticketsData.map((t: any, idx: number) => (
                    <div
                      key={t.id || idx}
                      className="bg-gradient-to-br from-[#1E2230] to-[#0F1217] border border-[#303645] rounded-2xl p-5 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#FABF2E] font-bold uppercase tracking-wider block">
                          CINEMAX E-TICKET
                        </span>
                        <h4 className="font-bold text-white text-base">
                          {t.order_items?.item_snapshot?.seat_label || `Ghế ${idx + 1}`}
                        </h4>
                        <span className="text-xs text-[#9EA6B8] block font-mono">
                          Mã vé: TKT-{t.id?.substring(0, 8).toUpperCase() || 'VALID'}
                        </span>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#33C773]/20 text-[#33C773]">
                          ✓ ĐÃ XÁC NHẬN
                        </span>
                      </div>

                      <div className="w-20 h-20 bg-white rounded-xl p-1.5 flex flex-col items-center justify-center shrink-0 shadow-lg">
                        <QrCode className="w-14 h-14 text-black" />
                        <span className="text-[8px] text-black font-mono font-bold">SOÁT VÉ</span>
                      </div>
                    </div>
                  ))}
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
