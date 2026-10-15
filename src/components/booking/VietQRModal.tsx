'use client';

import React, { useState, useEffect } from 'react';
import { VietQRService } from '@/services/vietqr.service';
import {
  Copy,
  Check,
  Clock,
  AlertTriangle,
  ShieldCheck,
  X,
  Loader2,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

interface VietQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  amount: number;
  orderCode: string;
  timeLeftSeconds?: number;
}

export default function VietQRModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  orderCode,
  timeLeftSeconds = 600,
}: VietQRModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(timeLeftSeconds);

  const bank = VietQRService.BANK_INFO;

  useEffect(() => {
    if (isOpen && orderCode) {
      setImgSrc(VietQRService.generateDynamicQrUrl({ amount, orderCode }));
      setSecondsRemaining(timeLeftSeconds);
    }
  }, [isOpen, amount, orderCode, timeLeftSeconds]);

  // Đếm ngược thời hạn thanh toán
  useEffect(() => {
    if (!isOpen || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, secondsRemaining]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmClick = async () => {
    setIsVerifying(true);
    try {
      await onConfirm();
    } finally {
      setIsVerifying(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl max-w-lg w-full p-5 sm:p-7 space-y-5 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9EA6B8] hover:text-white p-1 rounded-full hover:bg-[#303645]/50 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#E63845]/15 border border-[#E63845]/40 text-[#E63845]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CỔNG THANH TOÁN VIETQR AN TOÀN</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Quét Mã Chuyển Khoản</h2>
          <p className="text-xs text-[#9EA6B8]">
            Mở ứng dụng ngân hàng bất kỳ để quét mã thanh toán vé xem phim
          </p>
        </div>

        {/* Đồng hồ đếm ngược giữ chỗ */}
        <div className="flex items-center justify-center gap-2 bg-[#0F1217] border border-[#303645] py-2 px-4 rounded-xl text-xs font-semibold">
          <Clock className="w-4 h-4 text-[#FABF2E]" />
          <span className="text-[#9EA6B8]">Thời gian giữ vé:</span>
          <span className="text-[#FABF2E] font-mono font-bold text-sm">
            {formatTimer(secondsRemaining)}
          </span>
        </div>

        {/* Khối Mã QR */}
        <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg relative mx-auto max-w-[260px]">
          <img
            src={imgSrc}
            alt="VietQR TPBank"
            onError={() => setImgSrc(VietQRService.getFallbackQrUrl())}
            className="w-52 h-52 object-contain"
          />
          <div className="text-[10px] text-gray-500 font-semibold mt-1">
            Chuyển nhanh NAPAS 247 • TPBank
          </div>
        </div>

        {/* Bảng thông tin chuyển khoản có nút Copy */}
        <div className="bg-[#0F1217] border border-[#303645] rounded-2xl p-4 space-y-2.5 text-xs">
          {/* Ngân hàng */}
          <div className="flex items-center justify-between pb-2 border-b border-[#303645]/60">
            <span className="text-[#9EA6B8]">Ngân hàng nhận:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8E24AA]" />
              {bank.bankShortName} ({bank.bankName})
            </span>
          </div>

          {/* Chủ tài khoản */}
          <div className="flex items-center justify-between pb-2 border-b border-[#303645]/60">
            <span className="text-[#9EA6B8]">Chủ tài khoản:</span>
            <span className="font-bold text-[#FABF2E] uppercase">{bank.accountName}</span>
          </div>

          {/* Số tài khoản */}
          <div className="flex items-center justify-between pb-2 border-b border-[#303645]/60">
            <span className="text-[#9EA6B8]">Số tài khoản:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-sm">{bank.accountNumber}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(bank.accountNumber, 'acc')}
                className="text-[#9EA6B8] hover:text-white p-1 rounded hover:bg-[#1A1C26] cursor-pointer"
                title="Sao chép số tài khoản"
              >
                {copiedField === 'acc' ? (
                  <Check className="w-3.5 h-3.5 text-[#33C773]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Số tiền */}
          <div className="flex items-center justify-between pb-2 border-b border-[#303645]/60">
            <span className="text-[#9EA6B8]">Số tiền thanh toán:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#E63845] text-sm">
                {amount.toLocaleString('vi-VN')} đ
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(amount.toString(), 'amount')}
                className="text-[#9EA6B8] hover:text-white p-1 rounded hover:bg-[#1A1C26] cursor-pointer"
                title="Sao chép số tiền"
              >
                {copiedField === 'amount' ? (
                  <Check className="w-3.5 h-3.5 text-[#33C773]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Nội dung chuyển khoản */}
          <div className="flex items-center justify-between">
            <span className="text-[#9EA6B8]">Nội dung chuyển khoản:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-[#FABF2E] text-sm bg-[#1A1C26] px-2 py-0.5 rounded border border-[#FABF2E]/30">
                {orderCode}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(orderCode, 'memo')}
                className="text-[#9EA6B8] hover:text-white p-1 rounded hover:bg-[#1A1C26] cursor-pointer"
                title="Sao chép nội dung"
              >
                {copiedField === 'memo' ? (
                  <Check className="w-3.5 h-3.5 text-[#33C773]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Cảnh báo bảo mật */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FABF2E]/10 border border-[#FABF2E]/30 text-[11px] text-[#FABF2E]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Lưu ý quan trọng:</strong> Vui lòng giữ đúng nội dung chuyển khoản{' '}
            <strong className="underline">{orderCode}</strong> để hệ thống tự động đối soát và xuất
            vé QR xem phim ngay lập tức.
          </span>
        </div>

        {/* Nút hành động */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={isVerifying || secondsRemaining <= 0}
            onClick={handleConfirmClick}
            className="w-full bg-[#E63845] hover:bg-[#CC2B37] disabled:opacity-50 text-white py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-lg shadow-[#E63845]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kiểm tra giao dịch...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Tôi đã chuyển khoản thành công</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-[#9EA6B8] hover:text-white py-1 transition-colors cursor-pointer"
          >
            Quay lại / Đổi phương thức thanh toán khác
          </button>
        </div>
      </div>
    </div>
  );
}
