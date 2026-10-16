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
  Trash2
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
  onApproveRefund: (refundId: string) => Promise<void>;
  onIssueInvoice: (requestId: string, invoiceRef: string) => Promise<void>;
  onSaveCoupon: (coupon: Partial<Coupon>) => Promise<void>;
  onDeleteCoupon?: (idOrCode: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function OrdersFinanceView({
  orders,
  refunds,
  invoices,
  coupons,
  onApproveRefund,
  onIssueInvoice,
  onSaveCoupon,
  onDeleteCoupon,
  showToast
}: OrdersFinanceViewProps) {
  const [subTab, setSubTab] = useState<'ORDERS' | 'REFUNDS' | 'INVOICES' | 'COUPONS'>('ORDERS');
  const [searchTerm, setSearchTerm] = useState('');

  // Invoice issue modal
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRequest | null>(null);
  const [invoiceRefInput, setInvoiceRefInput] = useState('');

  // Coupon modal
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [deleteConfirmCoupon, setDeleteConfirmCoupon] = useState<{ idOrCode: string; code: string } | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'FIXED' as DiscountType,
    discount_value: 30000,
    min_order_amount: 100000,
    apply_scope: 'ALL' as CouponScope,
    starts_at: new Date().toISOString().split('T')[0],
    ends_at: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    usage_limit: 100
  });

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

  const handleSaveCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) return;

    try {
      await onSaveCoupon({
        code: couponForm.code.trim().toUpperCase(),
        discount_type: couponForm.discount_type,
        discount_value: Number(couponForm.discount_value),
        min_order_amount: Number(couponForm.min_order_amount),
        apply_scope: couponForm.apply_scope,
        starts_at: new Date(couponForm.starts_at).toISOString(),
        ends_at: new Date(couponForm.ends_at).toISOString(),
        usage_limit: Number(couponForm.usage_limit),
        per_user_limit: 1,
        active: true
      });
      showToast(`Đã tạo mã giảm giá "${couponForm.code.toUpperCase()}" thành công!`);
      setCouponModalOpen(false);
    } catch (err: any) {
      showToast('Lỗi tạo mã: ' + err.message);
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
            { id: 'COUPONS', label: 'Mã Giảm Giá', icon: Ticket, count: coupons.length }
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

        {subTab === 'COUPONS' && (
          <button
            onClick={() => setCouponModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white text-xs font-bold shadow-md shadow-[#E63845]/20 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Mã Mới</span>
          </button>
        )}
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

      {/* TAB 4: COUPONS */}
      {subTab === 'COUPONS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="p-5 rounded-2xl bg-[#121622] border border-[#222B3D] space-y-3 hover:border-[#384663] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-[#E63845]/15 border border-[#E63845]/30 text-[#E63845] font-mono font-black text-sm">
                  {coupon.code}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1F2739] text-[#8E9AAF] uppercase">
                    {coupon.apply_scope}
                  </span>
                  {onDeleteCoupon && (
                    <button
                      onClick={() => setDeleteConfirmCoupon({ idOrCode: coupon.id || coupon.code, code: coupon.code })}
                      title="Xóa mã giảm giá"
                      className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-[#EF4444] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="text-base font-bold text-white">
                  Giảm {coupon.discount_type === 'PERCENT' ? `${coupon.discount_value}%` : `${coupon.discount_value.toLocaleString('vi-VN')} đ`}
                </div>
                <div className="text-[11px] text-[#8E9AAF]">
                  Đơn tối thiểu: {coupon.min_order_amount.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-[10px] text-[#5C677D]">
                  Hạn dùng: {new Date(coupon.ends_at).toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>
          ))}
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

      {/* Modal: Add Coupon */}
      {couponModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <h3 className="font-bold text-white text-base">Tạo Mã Giảm Giá Mới</h3>
              <button onClick={() => setCouponModalOpen(false)} className="text-[#8E9AAF] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCouponSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Mã Code *</label>
                <input
                  type="text"
                  required
                  placeholder="Vd: CINEMAX30K"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#E63845]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Kiểu giảm</label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discount_type: e.target.value as DiscountType })
                    }
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="FIXED">Số tiền cố định (VND)</option>
                    <option value="PERCENT">Phần trăm (%)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Mức giảm *</label>
                  <input
                    type="number"
                    required
                    value={couponForm.discount_value}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })
                    }
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Phạm vi áp dụng (Apply Scope)</label>
                <select
                  value={couponForm.apply_scope}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, apply_scope: e.target.value as CouponScope })
                  }
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white"
                >
                  <option value="ALL">Toàn bộ đơn hàng (ALL)</option>
                  <option value="TICKET_ONLY">Chỉ giảm tiền vé xem phim (TICKET_ONLY)</option>
                  <option value="COMBO_ONLY">Chỉ giảm tiền bắp nước F&B (COMBO_ONLY)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Đơn hàng tối thiểu (VND)</label>
                  <input
                    type="number"
                    step={10000}
                    value={couponForm.min_order_amount}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, min_order_amount: Number(e.target.value) })
                    }
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Lượt dùng tối đa</label>
                  <input
                    type="number"
                    value={couponForm.usage_limit}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, usage_limit: Number(e.target.value) })
                    }
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCouponModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#E63845] text-white font-bold"
                >
                  Tạo Mã
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Coupon Delete Confirmation Modal */}
      {deleteConfirmCoupon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#2E1F24] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#3B191C] text-[#EF4444] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Xác Nhận Xóa Mã Ưu Đãi</h3>
                <p className="text-xs text-[#8E9AAF]">Mã giảm giá này sẽ bị gỡ khỏi toàn bộ hệ thống.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#1A1F2C] border border-[#263147] text-xs text-white">
              Bạn có chắc chắn muốn xóa mã ưu đãi: <strong className="text-[#E63845] font-mono text-sm">{deleteConfirmCoupon.code}</strong>?
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCoupon(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmCoupon.idOrCode;
                  setDeleteConfirmCoupon(null);
                  if (onDeleteCoupon) {
                    await onDeleteCoupon(target);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold transition-all shadow-lg shadow-[#EF4444]/30 cursor-pointer"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
