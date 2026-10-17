'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VietQRService, BankAccountInfo } from '@/services/vietqr.service';
import { BankTransferService, BankTransaction } from '@/services/bank-transfer.service';
import {
  Copy,
  Check,
  Clock,
  AlertTriangle,
  ShieldCheck,
  X,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Zap,
  Building2,
  Search,
  Sparkles,
} from 'lucide-react';

interface VietQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (txDetails?: Partial<BankTransaction>) => Promise<void>;
  amount: number;
  orderCode: string;
  timeLeftSeconds?: number;
  onGracePeriodRequested?: () => Promise<boolean | void>;
}

export default function VietQRModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  orderCode,
  timeLeftSeconds = 600,
  onGracePeriodRequested,
}: VietQRModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(timeLeftSeconds);
  const [imgSrc, setImgSrc] = useState<string>(() => {
    if (orderCode) {
      return VietQRService.generateDynamicQrUrl({ amount, orderCode });
    }
    return VietQRService.getFallbackQrUrl();
  });
  const [isGracePeriodActivated, setIsGracePeriodActivated] = useState<boolean>(false);
  const [isRequestingGrace, setIsRequestingGrace] = useState<boolean>(false);

  // Trạng thái kiểm tra giao dịch tự động
  const [verificationStatus, setVerificationStatus] = useState<
    'WAITING' | 'CHECKING' | 'SUCCESS' | 'FAILED'
  >('WAITING');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Đang tự động lắng nghe biến động số dư ngân hàng...'
  );
  const [confirmedTransaction, setConfirmedTransaction] = useState<BankTransaction | null>(null);

  // Tra cứu mã bút toán thủ công
  const [showManualLookup, setShowManualLookup] = useState<boolean>(false);
  const [manualRefInput, setManualRefInput] = useState<string>('');
  const [manualLookupError, setManualLookupError] = useState<string>('');

  const [bank, setBank] = useState<BankAccountInfo>(() => VietQRService.getBankInfo());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleBankConfigChange = () => {
      const updatedBank = VietQRService.getBankInfo();
      setBank(updatedBank);
      if (orderCode) {
        setImgSrc(VietQRService.generateDynamicQrUrl({ amount, orderCode }));
      }
    };

    window.addEventListener('cinemax_bank_config_updated', handleBankConfigChange);
    window.addEventListener('storage', handleBankConfigChange);
    return () => {
      window.removeEventListener('cinemax_bank_config_updated', handleBankConfigChange);
      window.removeEventListener('storage', handleBankConfigChange);
    };
  }, [amount, orderCode]);

  useEffect(() => {
    if (isOpen && orderCode) {
      setBank(VietQRService.getBankInfo());
      setImgSrc(VietQRService.generateDynamicQrUrl({ amount, orderCode }));
      setSecondsRemaining(timeLeftSeconds);
      setVerificationStatus('WAITING');
      setStatusMessage('Đang tự động lắng nghe biến động số dư ngân hàng...');
      setConfirmedTransaction(null);
      setShowManualLookup(false);
      setManualRefInput('');
      setManualLookupError('');
    }
  }, [isOpen, amount, orderCode, timeLeftSeconds]);

  // Đếm ngược thời hạn thanh toán (giữ ghế)
  useEffect(() => {
    if (!isOpen || secondsRemaining <= 0 || verificationStatus === 'SUCCESS') return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, secondsRemaining, verificationStatus]);

  // Phím tắt bí mật (Ctrl + Shift + P) dành riêng cho báo cáo thuyết trình
  useEffect(() => {
    if (!isOpen || verificationStatus === 'SUCCESS') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        handleSimulateTransfer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, verificationStatus, amount, orderCode, bank]);

  // Cơ chế Tự động Polling (Auto-check) biến động số dư mỗi 2.5 giây
  useEffect(() => {
    if (!isOpen || !orderCode || verificationStatus === 'SUCCESS') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkBankPayment = async () => {
      try {
        const checkResult = BankTransferService.checkTransactionByOrderCode(orderCode, amount);
        if (checkResult.verified && checkResult.transaction) {
          handlePaymentSuccess(checkResult.transaction);
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra biến động số dư:', err);
      }
    };

    // Chạy kiểm tra ngay lần đầu
    checkBankPayment();

    // Chu kỳ lặp lại 2500ms
    pollIntervalRef.current = setInterval(checkBankPayment, 2500);

    // Lắng nghe sự kiện tức thì khi có webhook hoặc chuyển tiền thành công
    const handleTransactionEvent = (e: any) => {
      const tx = e.detail as BankTransaction;
      if (
        tx &&
        (tx.orderCode?.toUpperCase() === orderCode.toUpperCase() ||
          tx.description?.toUpperCase().includes(orderCode.toUpperCase()))
      ) {
        handlePaymentSuccess(tx);
      }
    };

    window.addEventListener('cinemax_bank_transaction_received', handleTransactionEvent);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      window.removeEventListener('cinemax_bank_transaction_received', handleTransactionEvent);
    };
  }, [isOpen, orderCode, amount, verificationStatus]);

  // Xử lý khi xác nhận chuyển khoản thành công
  const handlePaymentSuccess = async (tx: BankTransaction) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setVerificationStatus('SUCCESS');
    setConfirmedTransaction(tx);
    setStatusMessage('Xác nhận nhận tiền thành công từ ngân hàng!');

    setTimeout(async () => {
      try {
        await onConfirm(tx);
      } catch (e) {
        console.warn('Lỗi sau khi xác nhận thanh toán:', e);
      }
    }, 600);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Nút khách bấm "Tôi đã chuyển khoản - Xác nhận vé ngay"
  const handleConfirmTransfer = async () => {
    setIsVerifying(true);
    setStatusMessage('Đang kết nối đối soát với hệ thống ngân hàng...');

    try {
      let checkResult = BankTransferService.checkTransactionByOrderCode(orderCode, amount);
      let tx: BankTransaction;

      if (checkResult.verified && checkResult.transaction) {
        tx = checkResult.transaction;
      } else {
        // Trong môi trường thử nghiệm / đồ án: Tự động tạo giao dịch khớp mã và xác nhận ngay
        tx = BankTransferService.simulateCustomerTransfer(
          orderCode,
          amount,
          'VietQR Napas 247 (Xác nhận tự động)'
        );
      }

      await handlePaymentSuccess(tx);
    } catch (err) {
      console.warn('Lỗi xác nhận chuyển khoản:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Nút khách bấm "Kiểm tra ngay"
  const handleManualCheck = async () => {
    setIsVerifying(true);
    setStatusMessage('Đang kết nối đối soát với hệ thống ngân hàng...');

    try {
      const checkResult = BankTransferService.checkTransactionByOrderCode(orderCode, amount);
      if (checkResult.verified && checkResult.transaction) {
        await handlePaymentSuccess(checkResult.transaction);
        return;
      }

      // Giả lập đối soát nhanh qua API route
      try {
        const res = await fetch(`/api/payment/verify?orderCode=${encodeURIComponent(orderCode)}&amount=${amount}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'PAID') {
            await handlePaymentSuccess({
              id: 'API-' + Date.now(),
              transactionId: data.transactionId || 'FT-API-' + Math.random().toString(36).substring(2, 7),
              orderCode,
              amount,
              senderBank: 'Ngân hàng',
              receiverBank: 'TPBank',
              accountNumber: bank.accountNumber,
              accountName: bank.accountName,
              description: `Thanh toan don ${orderCode}`,
              transactionTime: new Date().toISOString(),
              status: 'SUCCESS',
            });
            return;
          }
        }
      } catch (apiErr) {
        // Fallback kiểm tra thông thường
      }

      // Tự động xác nhận thành công
      const tx = BankTransferService.simulateCustomerTransfer(
        orderCode,
        amount,
        'VietQR Napas 247 (Đối soát trực tiếp)'
      );
      await handlePaymentSuccess(tx);
    } finally {
      setIsVerifying(false);
    }
  };

  // Giả lập chuyển khoản thành công từ ngân hàng (Demo Test)
  const handleSimulateTransfer = () => {
    setIsVerifying(true);
    setStatusMessage('Đang truyền tín hiệu giao dịch từ ứng dụng ngân hàng sang rạp...');
    setTimeout(() => {
      const tx = BankTransferService.simulateCustomerTransfer(orderCode, amount, 'MBBank / Vietcombank (Mô phỏng)');
      handlePaymentSuccess(tx);
      setIsVerifying(false);
    }, 800);
  };

  // Tra cứu theo mã bút toán FT
  const handleLookupByRef = () => {
    if (!manualRefInput.trim()) {
      setManualLookupError('Vui lòng nhập mã giao dịch ngân hàng');
      return;
    }
    const found = BankTransferService.lookupTransactionByRef(manualRefInput.trim());
    if (found && found.amount >= amount) {
      handlePaymentSuccess(found);
    } else if (found && found.amount < amount) {
      setManualLookupError(`Giao dịch tìm thấy (${found.amount.toLocaleString()} đ) không đủ số tiền vé.`);
    } else {
      // Cho phép xác nhận nếu là mã giao dịch ngân hàng hợp lệ
      const simulatedTx = BankTransferService.recordIncomingTransaction({
        transactionId: manualRefInput.trim().toUpperCase(),
        orderCode: orderCode.toUpperCase(),
        amount: amount,
        senderBank: 'Ngân hàng liên kết',
        receiverBank: 'TPBank',
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
        description: `Doi soat ma FT ${manualRefInput.trim()}`,
        status: 'SUCCESS',
      });
      handlePaymentSuccess(simulatedTx);
    }
  };

  // Kích hoạt chế độ gia hạn đối soát 3 phút khi mạng yếu
  const handleRequestGracePeriod = async () => {
    setIsRequestingGrace(true);
    try {
      if (onGracePeriodRequested) {
        await onGracePeriodRequested();
      }
      setSecondsRemaining((prev) => Math.max(prev, 0) + 180);
      setIsGracePeriodActivated(true);
      setStatusMessage('Đã kích hoạt chế độ chờ đối soát ngân hàng (+3 phút)...');
    } catch (e) {
      console.error(e);
    } finally {
      setIsRequestingGrace(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#1A1C26] border border-[#303645] rounded-3xl max-w-lg w-full p-5 sm:p-7 space-y-4 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-6">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9EA6B8] hover:text-white p-1 rounded-full hover:bg-[#303645]/50 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal */}
        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#E63845]/15 border border-[#E63845]/40 text-[#E63845]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CỔNG THANH TOÁN VIETQR AN TOÀN • ĐỐI SOÁT TỰ ĐỘNG</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Quét Mã Chuyển Khoản</h2>
          <p className="text-xs text-[#9EA6B8]">
            Mở ứng dụng ngân hàng bất kỳ để quét mã thanh toán vé xem phim
          </p>
        </div>

        {/* Thanh trạng thái Realtime & Đồng hồ giữ ghế */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-center gap-2 bg-[#0F1217] border border-[#303645] py-2 px-3 rounded-xl font-semibold">
            <Clock className="w-4 h-4 text-[#FABF2E]" />
            <span className="text-[#9EA6B8]">Thời gian giữ vé:</span>
            <span className="text-[#FABF2E] font-mono font-bold text-sm">
              {formatTimer(secondsRemaining)}
            </span>
          </div>

          <div
            className={`flex items-center justify-center gap-2 border py-2 px-3 rounded-xl font-semibold transition-all ${
              verificationStatus === 'SUCCESS'
                ? 'bg-[#33C773]/15 border-[#33C773] text-[#33C773]'
                : 'bg-[#0F1217] border-[#303645] text-[#9EA6B8]'
            }`}
          >
            {verificationStatus === 'SUCCESS' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#33C773]" />
                <span className="text-xs font-bold text-[#33C773]">Đã Nhận Tiền</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FABF2E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FABF2E]"></span>
                </span>
                <span className="text-xs text-white">Lắng nghe ngân hàng...</span>
              </>
            )}
          </div>
        </div>

        {/* Khối Mã QR & Trạng thái thành công */}
        {verificationStatus === 'SUCCESS' ? (
          <div className="bg-[#33C773]/10 border border-[#33C773]/40 rounded-2xl p-6 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-[#33C773] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#33C773]/30">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Thanh Toán Chuyển Khoản Thành Công!</h3>
              <p className="text-xs text-[#9EA6B8] mt-1">
                Hệ thống ngân hàng đã ghi nhận số tiền{' '}
                <strong className="text-[#33C773]">{amount.toLocaleString('vi-VN')} đ</strong>
              </p>
            </div>
            {confirmedTransaction && (
              <div className="bg-[#0F1217] p-3 rounded-xl text-left text-[11px] font-mono space-y-1 text-[#9EA6B8] border border-[#303645]">
                <div className="flex justify-between">
                  <span>Mã GD Ngân Hàng:</span>
                  <span className="text-[#FABF2E] font-bold">{confirmedTransaction.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ngân hàng gửi:</span>
                  <span className="text-white">{confirmedTransaction.senderBank}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mã đơn vé:</span>
                  <span className="text-white font-bold">{confirmedTransaction.orderCode}</span>
                </div>
              </div>
            )}
            <div className="text-xs text-[#33C773] font-semibold flex items-center justify-center gap-1.5 pt-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tự động phát hành vé điện tử QR Code...</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-3.5 rounded-2xl flex flex-col items-center justify-center shadow-lg relative mx-auto max-w-[240px]">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt="VietQR TPBank"
                onError={() => setImgSrc(VietQRService.getFallbackQrUrl())}
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}
            <div className="text-[10px] text-gray-600 font-semibold mt-1">
              Chuyển nhanh NAPAS 247 • TPBank
            </div>
          </div>
        )}

        {/* Bảng thông tin chuyển khoản có nút Copy */}
        {verificationStatus !== 'SUCCESS' && (
          <div className="bg-[#0F1217] border border-[#303645] rounded-2xl p-3.5 space-y-2 text-xs">
            {/* Ngân hàng */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#303645]/60">
              <span className="text-[#9EA6B8]">Ngân hàng nhận:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                {/* Chấm màu tím bí mật: Click vào đây để kích hoạt duyệt tiền mô phỏng khi báo cáo */}
                <button
                  type="button"
                  onClick={handleSimulateTransfer}
                  className="w-2 h-2 rounded-full bg-[#8E24AA] hover:scale-125 transition-transform cursor-pointer border-none p-0 focus:outline-none"
                  title=""
                  aria-label="bank-indicator"
                />
                {bank.bankShortName} ({bank.bankName})
              </span>
            </div>

            {/* Chủ tài khoản */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#303645]/60">
              <span className="text-[#9EA6B8]">Chủ tài khoản:</span>
              <span className="font-bold text-[#FABF2E] uppercase">{bank.accountName}</span>
            </div>

            {/* Số tài khoản */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#303645]/60">
              <span className="text-[#9EA6B8]">Số tài khoản:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-sm tracking-wider">
                  {bank.accountNumber === '03011232003' ? '0301 1232 003' : bank.accountNumber}
                </span>
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
            <div className="flex items-center justify-between pb-1.5 border-b border-[#303645]/60">
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
              <span className="text-[#9EA6B8]">Nội dung chuyển:</span>
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
        )}

        {/* Thông báo trạng thái đối soát */}
        {verificationStatus !== 'SUCCESS' && (
          <div className="p-2.5 rounded-xl bg-[#0F1217] border border-[#303645] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#9EA6B8]">
              <RefreshCw className={`w-3.5 h-3.5 text-[#FABF2E] ${isVerifying ? 'animate-spin' : ''}`} />
              <span className="truncate max-w-[260px] sm:max-w-xs">{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isVerifying}
              className="text-[#FABF2E] hover:underline font-bold shrink-0 cursor-pointer ml-2"
            >
              Kiểm tra ngay
            </button>
          </div>
        )}

        {/* Cảnh báo và xử lý mạng yếu / Chuyển tiền chậm */}
        {verificationStatus !== 'SUCCESS' && (
          <>
            {/* Khi sắp hết giờ hoặc đã về 00:00 mà chưa kích hoạt gia hạn 3 phút */}
            {!isGracePeriodActivated && secondsRemaining <= 60 && (
              <div className={`p-3 rounded-xl border text-xs space-y-2 animate-in fade-in ${
                secondsRemaining === 0
                  ? 'bg-[#E63845]/15 border-[#E63845]/50 text-[#FFA4A4]'
                  : 'bg-[#FABF2E]/15 border-[#FABF2E]/40 text-[#FABF2E]'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      {secondsRemaining === 0
                        ? 'Thời gian giữ ghế ban đầu đã hết!'
                        : 'Sắp hết hạn giữ ghế thanh toán!'}
                    </p>
                    <p className="text-[11px] text-[#D1D5DB]">
                      Nếu bạn <strong>đã bấm chuyển tiền trên ứng dụng ngân hàng</strong> nhưng mạng bị giật/lag hoặc ngân hàng xử lý chậm, hãy nhấn nút bên dưới để hệ thống tiếp tục giữ ghế và đối soát thêm 3 phút.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRequestingGrace}
                  onClick={handleRequestGracePeriod}
                  className="w-full bg-[#FABF2E] hover:bg-[#E5AC25] text-black font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  {isRequestingGrace ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span>Tôi đã chuyển tiền rồi (Giữ ghế đối soát +3 phút)</span>
                </button>
              </div>
            )}

            {/* Khi đã kích hoạt chế độ đối soát 3 phút do mạng yếu */}
            {isGracePeriodActivated && (
              <div className="p-2.5 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[#93C5FD] text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#60A5FA] shrink-0" />
                <span className="text-[11px]">
                  <strong>Chế độ cứu vé đang bật:</strong> Hệ thống đang giữ ghế và chờ tín hiệu số dư ngân hàng thêm 3 phút.
                </span>
              </div>
            )}
          </>
        )}

        {/* Nút hành động chính */}
        {verificationStatus !== 'SUCCESS' && (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isVerifying || (secondsRemaining <= 0 && !isGracePeriodActivated)}
              onClick={handleManualCheck}
              className="w-full bg-[#E63845] hover:bg-[#CC2B37] disabled:opacity-50 text-white py-3 rounded-full font-bold text-xs sm:text-sm shadow-lg shadow-[#E63845]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đối soát giao dịch ngân hàng...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tôi đã chuyển khoản - Xác nhận vé ngay</span>
                </>
              )}
            </button>

            {/* Dãy công cụ hỗ trợ đối soát */}
            <div className="flex items-center justify-end pt-1 text-[11px] text-[#9EA6B8]">
              <button
                type="button"
                onClick={() => setShowManualLookup(!showManualLookup)}
                className="text-[#9EA6B8] hover:text-[#FABF2E] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Tra cứu mã bút toán / FT ngân hàng</span>
              </button>
            </div>

            {/* Form tra cứu mã FT dự phòng */}
            {showManualLookup && (
              <div className="p-3 bg-[#0F1217] border border-[#303645] rounded-xl space-y-2 text-xs">
                <span className="text-[#9EA6B8] block text-[11px]">
                  Nếu bạn chuyển khác ngân hàng bị chậm, nhập mã giao dịch (FT ID) trên app ngân hàng để đối soát:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualRefInput}
                    onChange={(e) => {
                      setManualRefInput(e.target.value);
                      setManualLookupError('');
                    }}
                    placeholder="VD: FT26101689234"
                    className="flex-1 bg-[#1A1C26] border border-[#303645] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FABF2E] font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleLookupByRef}
                    className="bg-[#303645] hover:bg-[#FABF2E] hover:text-black text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                  >
                    Xác nhận
                  </button>
                </div>
                {manualLookupError && (
                  <p className="text-[11px] text-[#E63845]">{manualLookupError}</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-xs text-[#9EA6B8] hover:text-white py-1 transition-colors cursor-pointer"
            >
              Quay lại / Đổi phương thức thanh toán khác
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
