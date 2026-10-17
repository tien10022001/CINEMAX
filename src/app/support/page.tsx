'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { SupportService } from '@/services/support.service';
import { useAuth } from '@/lib/auth-context';
import {
  Headphones,
  Gift,
  AlertCircle,
  CheckCircle2,
  Send,
  Award,
  Link2,
  Search,
  ShieldCheck,
  Ticket,
  Film,
  Loader2,
  X,
  RefreshCw,
  Clock,
  MapPin
} from 'lucide-react';

export default function SupportPage() {
  const { currentUser: user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SUPPORT' | 'LINK_MEMBER'>('SUPPORT');

  // Form Hỗ trợ
  const [supportType, setSupportType] = useState<string>('lost_ticket');
  const [orderCode, setOrderCode] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [supportStatus, setSupportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Form Liên kết thành viên
  const [linkOrderCode, setLinkOrderCode] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ success: boolean; message: string } | null>(null);

  // State Đối chiếu dữ liệu trước khi gửi
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<any>(null);
  const [verifyMessage, setVerifyMessage] = useState<{ found: boolean; message: string } | null>(null);

  // Hàm đối chiếu với dữ liệu hệ thống
  const handleVerifyData = async () => {
    if (!contact.trim() && !orderCode.trim()) {
      alert('Vui lòng nhập Mã đơn hàng hoặc Số điện thoại/Email để đối chiếu!');
      return;
    }

    setIsVerifying(true);
    setVerifyMessage(null);
    try {
      const res = await SupportService.verifyOrder({
        orderCode: orderCode.trim() || undefined,
        contact: contact.trim(),
      });

      if (res.found && res.order) {
        setVerifiedOrder(res.order);
        if (!orderCode && res.order.order_code) {
          setOrderCode(res.order.order_code);
        }
        setVerifyMessage({ found: true, message: res.message || 'Đã đối chiếu khớp dữ liệu đơn hàng trên hệ thống.' });
      } else {
        setVerifiedOrder(null);
        setVerifyMessage({
          found: false,
          message: res.message || 'Không tìm thấy đơn hàng tự động. Bạn vẫn có thể gửi yêu cầu để Admin tra soát thủ công!',
        });
      }
    } catch (err: any) {
      setVerifiedOrder(null);
      setVerifyMessage({ found: false, message: 'Lỗi kết nối khi đối chiếu dữ liệu.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !contact.trim()) {
      alert('Vui lòng điền thông tin liên hệ và nội dung cần hỗ trợ!');
      return;
    }

    setIsSubmittingSupport(true);
    setSupportStatus(null);
    try {
      const res = await SupportService.createRequest({
        orderCode: orderCode.trim() || undefined,
        type: supportType,
        description: description.trim(),
        contactEmailOrPhone: contact.trim(),
        verifiedOrder: verifiedOrder || undefined,
      });
      setSupportStatus({ success: true, message: res.message });
      setDescription('');
      setOrderCode('');
      setVerifiedOrder(null);
      setVerifyMessage(null);
    } catch (err: any) {
      setSupportStatus({ success: false, message: err?.message || 'Có lỗi xảy ra khi gửi yêu cầu lên Admin.' });
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const handleLinkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vui lòng đăng nhập tài khoản thành viên để thực hiện liên kết!');
      return;
    }
    if (!linkOrderCode.trim()) {
      alert('Vui lòng nhập mã đơn hàng cần liên kết!');
      return;
    }

    setIsSubmittingLink(true);
    setLinkStatus(null);
    try {
      const res = await SupportService.linkGuestOrderToMember(linkOrderCode.trim(), user.id);
      setLinkStatus({ success: res.success, message: res.message });
      if (res.success) setLinkOrderCode('');
    } catch (err: any) {
      setLinkStatus({ success: false, message: err?.message || 'Lỗi liên kết đơn hàng.' });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1217] flex flex-col text-white">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-10 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black">Trung Tâm Hỗ Trợ & Thành Viên</h1>
          <p className="text-sm text-[#9EA6B8] max-w-lg mx-auto">
            Hỗ trợ xử lý sự cố đặt vé, mất vé điện tử cho Khách vãng lai và đăng ký tích lũy điểm hội viên.
          </p>

          {/* Tab selector */}
          <div className="inline-flex p-1 bg-[#1A1C26] border border-[#303645] rounded-full mt-4">
            <button
              onClick={() => setActiveTab('SUPPORT')}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'SUPPORT' ? 'bg-[#E63845] text-white' : 'text-[#9EA6B8] hover:text-white'
              }`}
            >
              <Headphones className="w-4 h-4" /> Gửi Yêu Cầu Hỗ Trợ
            </button>
            <button
              onClick={() => setActiveTab('LINK_MEMBER')}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'LINK_MEMBER' ? 'bg-[#E63845] text-white' : 'text-[#9EA6B8] hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" /> Liên Kết Đơn & Tích Điểm
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: FORM GỬI YÊU CẦU HỖ TRỢ (CÓ ĐỐI CHIẾU DỮ LIỆU) */}
        {/* ======================================================== */}
        {activeTab === 'SUPPORT' && (
          <div className="max-w-xl mx-auto bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <form onSubmit={handleSubmitSupport} className="space-y-5">
              {/* 1. Loại yêu cầu */}
              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                  Loại yêu cầu hỗ trợ *
                </label>
                <select
                  value={supportType}
                  onChange={(e) => setSupportType(e.target.value)}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#E63845] cursor-pointer"
                >
                  <option value="lost_ticket">Mất vé / Chưa nhận được email vé</option>
                  <option value="payment_pending">Giao dịch bị treo / Đã trừ tiền nhưng chưa thấy vé</option>
                  <option value="contact_change">Sai số điện thoại / email nhận vé</option>
                  <option value="seat_exchange">Đổi suất chiếu / Đổi ghế ngồi</option>
                  <option value="cancellation">Yêu cầu hủy vé / hoàn tiền sự cố</option>
                </select>
              </div>

              {/* 2. Mã đơn hàng & Nút đối chiếu */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#9EA6B8] uppercase">
                    Mã đơn hàng (nếu có)
                  </label>
                  <span className="text-[11px] text-[#FABF2E] font-medium">Khuyên dùng để đối chiếu nhanh</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="VD: CNM261015-ABCDE"
                    value={orderCode}
                    onChange={(e) => {
                      setOrderCode(e.target.value.toUpperCase());
                      setVerifiedOrder(null);
                      setVerifyMessage(null);
                    }}
                    className="flex-1 bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-[#E63845]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyData}
                    disabled={isVerifying || (!orderCode.trim() && !contact.trim())}
                    className="px-4 py-3 rounded-xl bg-[#202534] hover:bg-[#2A3144] border border-[#303645] hover:border-[#E63845]/50 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    title="Đối chiếu với cơ sở dữ liệu để xác nhận"
                  >
                    {isVerifying ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#E63845]" />
                    ) : (
                      <Search className="w-4 h-4 text-[#FABF2E]" />
                    )}
                    <span>Đối chiếu</span>
                  </button>
                </div>
              </div>

              {/* 3. Thông tin liên hệ */}
              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                  Số điện thoại hoặc Email liên hệ lại *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0912 345 678 hoặc email@gmail.com"
                  value={contact}
                  onChange={(e) => {
                    setContact(e.target.value);
                    setVerifiedOrder(null);
                    setVerifyMessage(null);
                  }}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              {/* KHỐI KẾT QUẢ ĐỐI CHIẾU DỮ LIỆU ĐỂ XÁC NHẬN */}
              {verifiedOrder && (
                <div className="bg-[#0F1217] border border-[#33C773]/40 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-[#303645]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#33C773]" />
                      <span className="text-xs font-bold text-[#33C773] uppercase tracking-wide">
                        Đã đối chiếu khớp dữ liệu hệ thống
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerifiedOrder(null)}
                      className="text-xs text-[#9EA6B8] hover:text-white flex items-center gap-0.5"
                    >
                      <X className="w-3.5 h-3.5" /> Hủy
                    </button>
                  </div>

                  <div className="flex gap-3 items-start">
                    {verifiedOrder.poster_url && (
                      <img
                        src={verifiedOrder.poster_url}
                        alt={verifiedOrder.movie_title}
                        className="w-14 h-20 object-cover rounded-lg border border-[#303645] shrink-0"
                      />
                    )}
                    <div className="space-y-1 text-xs text-[#9EA6B8] flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm line-clamp-1">
                          {verifiedOrder.movie_title}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#33C773]/20 text-[#33C773] border border-[#33C773]/30">
                          {verifiedOrder.status === 'paid' ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
                        </span>
                      </div>

                      <p className="flex items-center gap-1.5 text-gray-300">
                        <MapPin className="w-3.5 h-3.5 text-[#FABF2E]" />
                        {verifiedOrder.cinema_name} • {verifiedOrder.auditorium_name}
                      </p>

                      <p className="flex items-center gap-1.5 text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-[#FABF2E]" />
                        {verifiedOrder.showtime}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-white font-mono font-bold">
                        <span>Ghế: {Array.isArray(verifiedOrder.seats) ? verifiedOrder.seats.join(', ') : verifiedOrder.seats}</span>
                        <span className="text-[#FABF2E]">{Number(verifiedOrder.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#33C773] bg-[#33C773]/10 p-2 rounded-lg border border-[#33C773]/20">
                    ✓ Dữ liệu đơn hàng này sẽ được truyền trực tiếp đính kèm lên Admin để duyệt xử lý ngay.
                  </div>
                </div>
              )}

              {/* Thông báo nếu đối chiếu không ra */}
              {verifyMessage && !verifyMessage.found && (
                <div className="bg-[#FABF2E]/10 border border-[#FABF2E]/30 rounded-xl p-3 text-xs text-[#FABF2E] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Chưa tìm thấy đơn tự động: </span>
                    {verifyMessage.message}
                  </div>
                </div>
              )}

              {/* 4. Nội dung mô tả */}
              <div>
                <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                  Chi tiết vấn đề cần hỗ trợ *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Mô tả cụ thể suất chiếu, số ghế hoặc lỗi bạn gặp phải..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#0F1217] border border-[#303645] rounded-xl p-4 text-sm text-white focus:outline-none focus:border-[#E63845]"
                />
              </div>

              {/* Trạng thái gửi phản hồi */}
              {supportStatus && (
                <div
                  className={`flex items-start gap-2.5 p-4 rounded-2xl border text-xs ${
                    supportStatus.success
                      ? 'bg-[#33C773]/10 border-[#33C773]/30 text-[#33C773]'
                      : 'bg-[#E63845]/10 border-[#E63845]/30 text-[#E63845]'
                  }`}
                >
                  {supportStatus.success ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#33C773]" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#E63845]" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold text-sm">
                      {supportStatus.success ? 'Gửi yêu cầu thành công!' : 'Chưa thể gửi yêu cầu'}
                    </p>
                    <p className="leading-relaxed opacity-90">{supportStatus.message}</p>
                  </div>
                </div>
              )}

              {/* Nút gửi đường truyền lên Admin duyệt */}
              <button
                type="submit"
                disabled={isSubmittingSupport}
                className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-3.5 rounded-full font-bold text-sm shadow-xl shadow-[#E63845]/30 hover:shadow-[#E63845]/50 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 transform hover:-translate-y-0.5"
              >
                {isSubmittingSupport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang truyền dữ liệu lên Admin...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {verifiedOrder
                        ? 'Xác nhận & Gửi yêu cầu lên Admin duyệt'
                        : 'Gửi yêu cầu lên Admin duyệt'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: LIÊN KẾT ĐƠN HÀNG THÀNH VIÊN */}
        {/* ======================================================== */}
        {activeTab === 'LINK_MEMBER' && (
          <div className="max-w-xl mx-auto bg-[#1A1C26] border border-[#303645] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="p-4 rounded-2xl bg-[#FABF2E]/10 border border-[#FABF2E]/30 text-xs text-[#FABF2E] flex items-center gap-3">
              <Gift className="w-6 h-6 shrink-0" />
              <span>
                <strong>Đặc quyền hội viên CINEMAX:</strong> Khách vãng lai sau khi đặt vé xong có thể tạo tài khoản và liên kết đơn hàng để nhận ngay <strong>5% điểm tích lũy</strong> dùng đổi bắp nước và vé miễn phí!
              </span>
            </div>

            {!user ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-[#9EA6B8]">
                  Bạn cần đăng nhập tài khoản CINEMAX trước khi liên kết đơn hàng.
                </p>
                <span className="inline-block text-xs text-[#FABF2E] font-bold">
                  (Vui lòng bấm nút Đăng nhập ở góc trên bên phải trang)
                </span>
              </div>
            ) : (
              <form onSubmit={handleLinkOrder} className="space-y-4">
                <div className="p-3 bg-[#0F1217] rounded-xl text-xs text-[#9EA6B8]">
                  Đang đăng nhập: <strong className="text-white">{user.email}</strong>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#9EA6B8] uppercase block mb-1.5">
                    Mã đơn hàng Guest cần tích điểm *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: CNM261015-ABCDE"
                    value={linkOrderCode}
                    onChange={(e) => setLinkOrderCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#0F1217] border border-[#303645] rounded-xl px-4 py-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-[#E63845]"
                  />
                </div>

                {linkStatus && (
                  <div
                    className={`flex items-center gap-2 p-3.5 rounded-xl border text-xs ${
                      linkStatus.success
                        ? 'bg-[#33C773]/10 border-[#33C773]/30 text-[#33C773]'
                        : 'bg-[#E63845]/10 border-[#E63845]/30 text-[#E63845]'
                    }`}
                  >
                    {linkStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{linkStatus.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingLink}
                  className="w-full bg-[#E63845] hover:bg-[#CC2B37] text-white py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#E63845]/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Link2 className="w-4 h-4" />
                  {isSubmittingLink ? 'Đang liên kết...' : 'Xác minh & Tích lũy điểm'}
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
