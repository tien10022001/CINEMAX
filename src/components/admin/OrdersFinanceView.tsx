'use client';

import React, { useState } from 'react';
import {
  Receipt,
  DollarSign,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  FileText,
  X,
  CreditCard,
  Building2,
  Trash2,
  Headphones,
  Send,
  ShieldCheck,
  XCircle,
  Eye,
  RotateCcw
} from 'lucide-react';
import {
  Order,
  Refund,
  InvoiceRequest,
  Coupon,
  DiscountType,
  CouponScope
} from '@/lib/types-redesign';

interface OrdersFinanceViewProps {
  orders: Order[];
  refunds: Refund[];
  invoices: InvoiceRequest[];
  coupons: Coupon[];
  supportRequests?: any[];
  onApproveRefund: (refundId: string) => Promise<void>;
  onIssueInvoice: (requestId: string, invoiceRef: string) => Promise<void>;
  onSaveCoupon: (coupon: Partial<Coupon>) => Promise<void>;
  onDeleteCoupon?: (idOrCode: string) => Promise<void>;
  onApproveSupport?: (requestId: string, adminNote?: string, isResendTicket?: boolean) => Promise<void>;
  onRejectSupport?: (requestId: string, adminNote?: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function OrdersFinanceView({
  orders,
  refunds,
  invoices,
  coupons,
  supportRequests = [],
  onApproveRefund,
  onIssueInvoice,
  onSaveCoupon,
  onDeleteCoupon,
  onApproveSupport,
  onRejectSupport,
  showToast
}: OrdersFinanceViewProps) {
  const [subTab, setSubTab] = useState<'ORDERS' | 'REFUNDS' | 'INVOICES' | 'SUPPORT'>('ORDERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [supportFilterStatus, setSupportFilterStatus] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'REJECTED'>('ALL');

  // Support Request modal state
  const [activeSupportModal, setActiveSupportModal] = useState<any | null>(null);
  const [supportActionType, setSupportActionType] = useState<'APPROVE' | 'REJECT' | 'RESEND' | null>(null);
  const [supportAdminNote, setSupportAdminNote] = useState('');
  const [isProcessingSupport, setIsProcessingSupport] = useState(false);

  // Invoice issue modal
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRequest | null>(null);
  const [invoiceRefInput, setInvoiceRefInput] = useState('');

  const handleIssueInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || !invoiceRefInput.trim()) return;

    try {
      await onIssueInvoice(activeInvoice.id, invoiceRefInput.trim());
      showToast(`Đã xuất hóa đơn VAT thành công với mã ${invoiceRefInput}!`);
      setActiveInvoice(null);
    } catch (err: any) {
      showToast('Lỗi xuất hóa đơn: ' + err.message);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Compact Top Bar: Sub Tabs + Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-2">
        {/* Sub Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {[
            { id: 'ORDERS', label: 'Tất Cả Đơn Hàng', icon: Receipt, count: orders.length },
            { id: 'REFUNDS', label: 'Xử Lý Hoàn Tiền', icon: DollarSign, count: refunds.filter((r) => r.status === 'pending').length },
            { id: 'INVOICES', label: 'Hóa Đơn VAT', icon: FileText, count: invoices.filter((i) => i.status === 'pending').length },
            {
              id: 'SUPPORT',
              label: 'Yêu Cầu Hỗ Trợ & Mất Vé',
              icon: Headphones,
              count: (supportRequests || []).filter((s: any) => s.status === 'pending').length
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E63845] text-white shadow-md'
                    : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                      isActive ? 'bg-white text-black' : 'bg-[#1F2739] text-[#8E9AAF]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>


      {/* TAB 1: ALL ORDERS */}
      {subTab === 'ORDERS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Danh Sách Đơn Hàng</span>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E9AAF]" />
              <input
                type="text"
                placeholder="Tìm mã đơn, SĐT khách..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#171D2B] border border-[#253045] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222B3D] text-[#8E9AAF]">
                  <th className="py-2.5 px-3 font-bold">Mã Đơn</th>
                  <th className="py-2.5 px-3 font-bold">Kênh</th>
                  <th className="py-2.5 px-3 font-bold">Khách Hàng</th>
                  <th className="py-2.5 px-3 font-bold text-right">Tổng Tiền</th>
                  <th className="py-2.5 px-3 font-bold text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 font-bold">Thời Gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D2536]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#161C2A]">
                    <td className="py-3 px-3 font-mono font-bold text-white">{order.order_code}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          order.channel === 'online'
                            ? 'bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30'
                            : 'bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30'
                        }`}
                      >
                        {order.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{order.contact_name}</div>
                      <div className="text-[10px] text-[#8E9AAF]">{order.contact_phone}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#22C55E]">
                      {order.total_amount.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'paid'
                            ? 'bg-[#22C55E]/15 text-[#22C55E]'
                            : order.status === 'refunded'
                            ? 'bg-[#EF4444]/15 text-[#EF4444]'
                            : 'bg-[#FABF2E]/15 text-[#FABF2E]'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#8E9AAF]">
                      {new Date(order.created_at).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REFUNDS CENTER */}
      {subTab === 'REFUNDS' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Xử Lý Yêu Cầu Hoàn Tiền</span>
            <span className="text-[#8E9AAF]">{refunds.filter((r) => r.status === 'pending').length} chờ duyệt</span>
          </div>

          <div className="space-y-3">
            {refunds.length === 0 ? (
              <div className="p-8 text-center text-[#8E9AAF] text-xs">Không có yêu cầu hoàn tiền nào cần xử lý.</div>
            ) : (
              refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="p-4 rounded-2xl bg-[#161D2B] border border-[#253045] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">ĐƠN #{refund.order_id?.slice(0, 8)}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#E63845]/20 text-[#E63845] uppercase">
                        {refund.refund_type}
                      </span>
                    </div>
                    <div className="text-[#8E9AAF]">Lý do: <strong className="text-white">{refund.reason}</strong></div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-[#8E9AAF] uppercase block">Số tiền hoàn</span>
                      <span className="font-mono font-bold text-[#EF4444] text-sm">
                        {refund.amount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    {refund.status === 'pending' ? (
                      <button
                        onClick={() => onApproveRefund(refund.id)}
                        className="px-3.5 py-2 rounded-xl bg-[#22C55E] hover:bg-[#1CA34D] text-black font-bold text-xs cursor-pointer shadow-md"
                      >
                        Duyệt Hoàn Tiền
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E]">
                        ĐÃ DUYỆT
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VAT INVOICE REQUESTS */}
      {subTab === 'INVOICES' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Yêu Cầu Xuất Hóa Đơn VAT</span>
            <span className="text-[#8E9AAF]">{invoices.filter((i) => i.status === 'pending').length} chờ xuất</span>
          </div>

          <div className="space-y-3">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-[#8E9AAF] text-xs">Chưa có yêu cầu xuất hóa đơn VAT nào.</div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-2xl bg-[#161D2B] border border-[#253045] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-white text-sm">{inv.company_name}</div>
                    <div className="text-[11px] text-[#8E9AAF]">
                      MST: <strong className="text-[#FABF2E] font-mono">{inv.tax_code}</strong> • Email: {inv.email}
                    </div>
                    <div className="text-[10px] text-[#5C677D]">{inv.address}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {inv.status === 'issued' ? (
                      <span className="text-xs text-[#22C55E] font-bold flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mã HĐ: {inv.invoice_ref}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveInvoice(inv);
                          setInvoiceRefInput('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black text-xs cursor-pointer shadow-md"
                      >
                        Nhập Mã Hóa Đơn
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 4: YÊU CẦU HỖ TRỢ & MẤT VÉ (ĐƯỜNG TRUYỀN TỪ KHÁCH) */}
      {/* ======================================================== */}
      {subTab === 'SUPPORT' && (
        <div className="space-y-3">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141924] border border-[#222B3D] p-3 rounded-2xl">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'Tất Cả', count: supportRequests.length },
                {
                  id: 'PENDING',
                  label: 'Chờ Duyệt',
                  count: supportRequests.filter((s: any) => s.status === 'pending').length,
                  highlight: true
                },
                {
                  id: 'RESOLVED',
                  label: 'Đã Xử Lý',
                  count: supportRequests.filter((s: any) => s.status === 'resolved').length
                },
                {
                  id: 'REJECTED',
                  label: 'Từ Chối',
                  count: supportRequests.filter((s: any) => s.status === 'rejected').length
                }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSupportFilterStatus(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    supportFilterStatus === f.id
                      ? f.highlight
                        ? 'bg-[#FABF2E] text-black shadow-md'
                        : 'bg-[#E63845] text-white shadow-md'
                      : 'bg-[#1A202E] text-[#8E9AAF] hover:text-white border border-[#263147]'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                      supportFilterStatus === f.id
                        ? 'bg-black/20 text-inherit'
                        : f.highlight && f.count > 0
                        ? 'bg-[#FABF2E]/20 text-[#FABF2E]'
                        : 'bg-[#222B3D] text-[#8E9AAF]'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8E9AAF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã đơn, SĐT, mã yêu cầu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1A202E] border border-[#263147] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E63845]"
              />
            </div>
          </div>

          {/* Danh sách yêu cầu hỗ trợ */}
          <div className="space-y-2">
            {supportRequests
              .filter((req: any) => {
                if (supportFilterStatus !== 'ALL') {
                  if (req.status?.toLowerCase() !== supportFilterStatus.toLowerCase()) return false;
                }
                if (searchTerm.trim()) {
                  const term = searchTerm.toLowerCase();
                  const matchCode = req.id?.toLowerCase().includes(term);
                  const matchOrder = req.order_code?.toLowerCase().includes(term);
                  const matchContact = req.contact?.toLowerCase().includes(term);
                  const matchDesc = req.description?.toLowerCase().includes(term);
                  return matchCode || matchOrder || matchContact || matchDesc;
                }
                return true;
              })
              .length === 0 ? (
              <div className="p-12 text-center bg-[#141924] border border-[#222B3D] rounded-2xl text-[#8E9AAF] space-y-2">
                <Headphones className="w-8 h-8 mx-auto opacity-40 text-[#FABF2E]" />
                <p className="text-sm font-semibold text-white">Không có yêu cầu hỗ trợ nào</p>
                <p className="text-xs">
                  {supportFilterStatus === 'PENDING'
                    ? 'Tất cả yêu cầu gửi lên đã được duyệt và xử lý xong.'
                    : 'Chưa có yêu cầu hỗ trợ nào phù hợp với bộ lọc hiện tại.'}
                </p>
              </div>
            ) : (
              supportRequests
                .filter((req: any) => {
                  if (supportFilterStatus !== 'ALL') {
                    if (req.status?.toLowerCase() !== supportFilterStatus.toLowerCase()) return false;
                  }
                  if (searchTerm.trim()) {
                    const term = searchTerm.toLowerCase();
                    const matchCode = req.id?.toLowerCase().includes(term);
                    const matchOrder = req.order_code?.toLowerCase().includes(term);
                    const matchContact = req.contact?.toLowerCase().includes(term);
                    const matchDesc = req.description?.toLowerCase().includes(term);
                    return matchCode || matchOrder || matchContact || matchDesc;
                  }
                  return true;
                })
                .map((req: any) => {
                  const isPending = req.status === 'pending';
                  const isResolved = req.status === 'resolved';
                  const isRejected = req.status === 'rejected';
                  const vData = req.verified_data;

                  return (
                    <div
                      key={req.id}
                      className={`bg-[#141924] border rounded-2xl p-4 transition-all space-y-3 ${
                        isPending
                          ? 'border-[#FABF2E]/40 hover:border-[#FABF2E]'
                          : 'border-[#222B3D] hover:border-[#303B52]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222B3D] pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-bold text-white text-sm bg-[#1A202E] px-2.5 py-1 rounded-lg border border-[#263147]">
                            #{req.id}
                          </span>

                          {/* Badge loại sự cố */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              req.type === 'lost_ticket'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : req.type === 'payment_pending'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : req.type === 'seat_exchange'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}
                          >
                            {req.type === 'lost_ticket'
                              ? 'Mất vé / Chưa nhận email'
                              : req.type === 'payment_pending'
                              ? 'Treo giao dịch / Đã trừ tiền'
                              : req.type === 'contact_change'
                              ? 'Sai SĐT / Email'
                              : req.type === 'seat_exchange'
                              ? 'Đổi suất / Đổi ghế'
                              : 'Hủy vé / Hoàn tiền'}
                          </span>

                          {/* Badge đối chiếu dữ liệu */}
                          {req.verified || vData ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3" /> ĐÃ ĐỐI CHIẾU KHỚP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#263147] text-[#8E9AAF]">
                              Tra soát thủ công
                            </span>
                          )}
                        </div>

                        {/* Badge trạng thái duyệt */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase inline-flex items-center gap-1.5 ${
                              isPending
                                ? 'bg-[#FABF2E]/20 text-[#FABF2E] border border-[#FABF2E]/40 animate-pulse'
                                : isResolved
                                ? 'bg-[#33C773]/20 text-[#33C773] border border-[#33C773]/40'
                                : 'bg-[#E63845]/20 text-[#E63845] border border-[#E63845]/40'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPending ? 'bg-[#FABF2E]' : isResolved ? 'bg-[#33C773]' : 'bg-[#E63845]'
                              }`}
                            />
                            {isPending ? 'Chờ Admin Duyệt' : isResolved ? 'Đã Xử Lý Xong' : 'Đã Từ Chối'}
                          </span>

                          <span className="text-[11px] text-[#8E9AAF] font-mono">
                            {new Date(req.created_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Thông tin đối chiếu & Nội dung sự cố */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                        {/* Cột 1: Thông tin khách hàng & Đơn hàng */}
                        <div className="bg-[#10141D] p-3 rounded-xl border border-[#1F2739] space-y-1.5">
                          <div className="text-[#8E9AAF] text-[11px] font-bold uppercase">Khách Hàng & Đơn Hàng</div>
                          <div className="text-white font-bold">
                            Liên hệ: <span className="text-[#FABF2E] font-mono">{req.contact}</span>
                          </div>
                          <div className="text-[#8E9AAF]">
                            Mã đơn: <span className="font-mono text-white font-bold">{req.order_code || 'Không có'}</span>
                          </div>
                          {vData && (
                            <div className="pt-1 border-t border-[#1F2739] space-y-1">
                              <div className="text-white font-semibold line-clamp-1">{vData.movie_title}</div>
                              <div className="text-[11px] text-[#8E9AAF]">
                                {vData.cinema_name} • {vData.showtime}
                              </div>
                              <div className="text-[11px] text-[#33C773] font-mono font-bold">
                                Ghế: {Array.isArray(vData.seats) ? vData.seats.join(', ') : vData.seats} • {Number(vData.total_amount || 0).toLocaleString('vi-VN')}đ
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Cột 2: Nội dung khách mô tả */}
                        <div className="lg:col-span-2 bg-[#10141D] p-3 rounded-xl border border-[#1F2739] flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="text-[#8E9AAF] text-[11px] font-bold uppercase">Chi Tiết Vấn Đề Khách Gặp Phải</div>
                            <p className="text-gray-200 leading-relaxed italic bg-[#141924] p-2.5 rounded-lg border border-[#222B3D]">
                              &ldquo;{req.description}&rdquo;
                            </p>
                          </div>

                          {req.admin_note && (
                            <div className="mt-2 pt-2 border-t border-[#1F2739] text-[11px] text-[#FABF2E]">
                              <strong>Ghi chú xử lý của Admin:</strong> {req.admin_note}
                            </div>
                          )}

                          {/* Action Buttons cho Admin */}
                          <div className="flex items-center justify-end gap-2 pt-3 flex-wrap">
                            {isPending ? (
                              <>
                                {/* Nút 1: Duyệt & Gửi lại vé nếu khách mất vé/chưa nhận email */}
                                {req.type === 'lost_ticket' && (
                                  <button
                                    onClick={() => {
                                      setActiveSupportModal(req);
                                      setSupportActionType('RESEND');
                                      setSupportAdminNote('Đã kiểm tra đối chiếu dữ liệu khớp và gửi lại mã vé qua email cho khách');
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-[#33C773] hover:bg-[#2BB265] text-black font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#33C773]/20"
                                  >
                                    <Send className="w-3.5 h-3.5" /> Duyệt & Gửi Lại Vé
                                  </button>
                                )}

                                {/* Nút 2: Duyệt xử lý xong */}
                                <button
                                  onClick={() => {
                                    setActiveSupportModal(req);
                                    setSupportActionType('APPROVE');
                                    setSupportAdminNote('Admin đã đối chiếu và xử lý thành công yêu cầu hỗ trợ');
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt Xử Lý
                                </button>

                                {/* Nút 3: Từ chối */}
                                <button
                                  onClick={() => {
                                    setActiveSupportModal(req);
                                    setSupportActionType('REJECT');
                                    setSupportAdminNote('Thông tin đơn hàng không khớp hoặc không tìm thấy giao dịch hợp lệ');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[#1A202E] hover:bg-rose-500/20 text-[#8E9AAF] hover:text-rose-400 border border-[#263147] hover:border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Từ Chối
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveSupportModal(req);
                                  setSupportActionType(null);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#1A202E] hover:bg-[#242D40] text-gray-300 border border-[#263147] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#FABF2E]" /> Xem Chi Tiết
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DUYỆT & XỬ LÝ YÊU CẦU HỖ TRỢ DÀNH CHO ADMIN */}
      {/* ======================================================== */}
      {activeSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#FABF2E]" />
                <h3 className="font-bold text-white text-base">
                  {supportActionType === 'RESEND'
                    ? 'Duyệt & Gửi Lại Vé Cho Khách'
                    : supportActionType === 'APPROVE'
                    ? 'Xác Nhận Duyệt Xử Lý Yêu Cầu'
                    : supportActionType === 'REJECT'
                    ? 'Từ Chối Yêu Cầu Hỗ Trợ'
                    : 'Chi Tiết Yêu Cầu Hỗ Trợ'}
                </h3>
              </div>
              <button
                onClick={() => setActiveSupportModal(null)}
                className="text-[#8E9AAF] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#171D2B] rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[#8E9AAF]">Mã yêu cầu:</span>
                  <span className="font-mono font-bold text-white">#{activeSupportModal.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8E9AAF]">Mã đơn hàng:</span>
                  <span className="font-mono font-bold text-[#FABF2E]">{activeSupportModal.order_code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8E9AAF]">Thông tin liên hệ:</span>
                  <span className="font-mono text-white">{activeSupportModal.contact}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8E9AAF]">Thời gian gửi:</span>
                  <span className="text-gray-300">
                    {new Date(activeSupportModal.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Dữ liệu đối chiếu nếu có */}
              {activeSupportModal.verified_data && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Dữ Liệu Đối Chiếu Khớp Hệ Thống:
                  </div>
                  <div className="text-white font-semibold">{activeSupportModal.verified_data.movie_title}</div>
                  <div className="text-gray-300">
                    {activeSupportModal.verified_data.cinema_name} • Ghế: {Array.isArray(activeSupportModal.verified_data.seats) ? activeSupportModal.verified_data.seats.join(', ') : activeSupportModal.verified_data.seats}
                  </div>
                  <div className="text-[#FABF2E] font-bold">
                    Tổng tiền: {Number(activeSupportModal.verified_data.total_amount || 0).toLocaleString('vi-VN')}đ (Đã thanh toán)
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[#8E9AAF] font-semibold">Nội dung khách phản ánh:</span>
                <p className="bg-[#171D2B] p-3 rounded-xl text-gray-200 italic border border-[#253045]">
                  &ldquo;{activeSupportModal.description}&rdquo;
                </p>
              </div>

              {supportActionType && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[#8E9AAF] font-semibold">
                    {supportActionType === 'REJECT' ? 'Lý do từ chối *' : 'Ghi chú phê duyệt / xử lý của Admin:'}
                  </label>
                  <textarea
                    rows={2}
                    value={supportAdminNote}
                    onChange={(e) => setSupportAdminNote(e.target.value)}
                    placeholder="Nhập ghi chú phản hồi..."
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl p-3 text-white focus:outline-none focus:border-[#FABF2E]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setActiveSupportModal(null)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white"
                >
                  Đóng
                </button>

                {supportActionType === 'RESEND' && (
                  <button
                    type="button"
                    disabled={isProcessingSupport}
                    onClick={async () => {
                      setIsProcessingSupport(true);
                      try {
                        if (onApproveSupport) {
                          await onApproveSupport(activeSupportModal.id, supportAdminNote, true);
                        }
                        showToast(`Đã duyệt và gửi lại mã vé thành công cho ${activeSupportModal.contact}!`);
                        setActiveSupportModal(null);
                      } catch (err: any) {
                        showToast('Lỗi duyệt: ' + err.message);
                      } finally {
                        setIsProcessingSupport(false);
                      }
                    }}
                    className="px-5 py-2 rounded-xl bg-[#33C773] hover:bg-[#2BB265] text-black font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {isProcessingSupport ? 'Đang gửi vé...' : 'Xác Nhận & Gửi Lại Vé'}
                  </button>
                )}

                {supportActionType === 'APPROVE' && (
                  <button
                    type="button"
                    disabled={isProcessingSupport}
                    onClick={async () => {
                      setIsProcessingSupport(true);
                      try {
                        if (onApproveSupport) {
                          await onApproveSupport(activeSupportModal.id, supportAdminNote, false);
                        }
                        showToast(`Đã duyệt và xử lý thành công yêu cầu #${activeSupportModal.id}!`);
                        setActiveSupportModal(null);
                      } catch (err: any) {
                        showToast('Lỗi duyệt: ' + err.message);
                      } finally {
                        setIsProcessingSupport(false);
                      }
                    }}
                    className="px-5 py-2 rounded-xl bg-[#FABF2E] hover:bg-[#E5AC24] text-black font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isProcessingSupport ? 'Đang xử lý...' : 'Xác Nhận Đã Xử Lý'}
                  </button>
                )}

                {supportActionType === 'REJECT' && (
                  <button
                    type="button"
                    disabled={isProcessingSupport}
                    onClick={async () => {
                      setIsProcessingSupport(true);
                      try {
                        if (onRejectSupport) {
                          await onRejectSupport(activeSupportModal.id, supportAdminNote);
                        }
                        showToast(`Đã từ chối yêu cầu #${activeSupportModal.id}!`);
                        setActiveSupportModal(null);
                      } catch (err: any) {
                        showToast('Lỗi từ chối: ' + err.message);
                      } finally {
                        setIsProcessingSupport(false);
                      }
                    }}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {isProcessingSupport ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Issue Invoice */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base">Xác Nhận Xuất Hóa Đơn VAT</h3>
              <button onClick={() => setActiveInvoice(null)} className="text-[#8E9AAF] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueInvoiceSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#171D2B] space-y-1">
                <div className="font-bold text-white">{activeInvoice.company_name}</div>
                <div className="text-[#FABF2E] font-mono">MST: {activeInvoice.tax_code}</div>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Mã tra cứu hóa đơn điện tử *</label>
                <input
                  type="text"
                  required
                  placeholder="Vd: 1C24TBB-008129"
                  value={invoiceRefInput}
                  onChange={(e) => setInvoiceRefInput(e.target.value)}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#FABF2E]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#FABF2E] text-black font-black"
                >
                  Xác Nhận Đã Xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
