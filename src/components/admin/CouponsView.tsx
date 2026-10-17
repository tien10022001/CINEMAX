'use client';

import React, { useState } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Trash2,
  X,
  Tag,
  Percent,
  Calendar,
  Layers,
  Sparkles,
  Gift,
  CheckCircle2,
  Edit3
} from 'lucide-react';
import { Coupon, DiscountType, CouponScope } from '@/lib/types-redesign';

interface CouponsViewProps {
  coupons: Coupon[];
  onSaveCoupon: (coupon: Partial<Coupon>) => Promise<void>;
  onDeleteCoupon?: (idOrCode: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export default function CouponsView({
  coupons,
  onSaveCoupon,
  onDeleteCoupon,
  showToast
}: CouponsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | CouponScope>('ALL');

  // Coupon modal (Create & Edit)
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirmCoupon, setDeleteConfirmCoupon] = useState<{ idOrCode: string; code: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setCouponForm({
      code: '',
      discount_type: 'FIXED',
      discount_value: 30000,
      min_order_amount: 100000,
      apply_scope: 'ALL',
      starts_at: new Date().toISOString().split('T')[0],
      ends_at: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      usage_limit: 100
    });
    setCouponModalOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      discount_type: coupon.discount_type || 'FIXED',
      discount_value: coupon.discount_value || 0,
      min_order_amount: coupon.min_order_amount || 0,
      apply_scope: coupon.apply_scope || 'ALL',
      starts_at: coupon.starts_at ? new Date(coupon.starts_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      ends_at: coupon.ends_at ? new Date(coupon.ends_at).toISOString().split('T')[0] : new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      usage_limit: coupon.usage_limit || 100
    });
    setCouponModalOpen(true);
  };

  const handleSaveCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      showToast('Vui lòng nhập mã ưu đãi!');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSaveCoupon({
        id: editingCoupon?.id,
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
      showToast(
        editingCoupon
          ? `Đã cập nhật mã giảm giá "${couponForm.code.toUpperCase()}" thành công!`
          : `Đã tạo mã giảm giá "${couponForm.code.toUpperCase()}" thành công!`
      );
      setCouponModalOpen(false);
      setEditingCoupon(null);
      setCouponForm({
        code: '',
        discount_type: 'FIXED',
        discount_value: 30000,
        min_order_amount: 100000,
        apply_scope: 'ALL',
        starts_at: new Date().toISOString().split('T')[0],
        ends_at: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
        usage_limit: 100
      });
    } catch (err: any) {
      showToast('Lỗi lưu mã: ' + (err.message || 'Thử lại sau'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const matchSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchScope = scopeFilter === 'ALL' || coupon.apply_scope === scopeFilter;
    return matchSearch && matchScope;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222B3D] pb-3">
        {/* Scope Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {[
            { id: 'ALL', label: 'Tất cả mã', count: coupons.length },
            { id: 'TICKET_ONLY', label: 'Giảm tiền vé', count: coupons.filter((c) => c.apply_scope === 'TICKET_ONLY').length },
            { id: 'COMBO_ONLY', label: 'Giảm bắp nước', count: coupons.filter((c) => c.apply_scope === 'COMBO_ONLY').length }
          ].map((tab) => {
            const isActive = scopeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setScopeFilter(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E63845] text-white shadow-md'
                    : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                    isActive ? 'bg-white text-black' : 'bg-[#1F2739] text-[#8E9AAF]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Add Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8E9AAF]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã code..."
              className="w-full bg-[#141924] border border-[#222B3D] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#5C677D] focus:outline-none focus:border-[#E63845]"
            />
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white text-xs font-bold shadow-md shadow-[#E63845]/20 flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Mã Mới</span>
          </button>
        </div>
      </div>

      {/* Coupons Grid */}
      {filteredCoupons.length === 0 ? (
        <div className="py-16 text-center bg-[#121622]/50 border border-[#222B3D] rounded-2xl">
          <Gift className="w-10 h-10 text-[#5C677D] mx-auto mb-3 opacity-50" />
          <p className="text-sm font-semibold text-white">Chưa có mã giảm giá nào phù hợp</p>
          <p className="text-xs text-[#8E9AAF] mt-1">Bấm &quot;Tạo Mã Mới&quot; để phát hành mã ưu đãi cho khách hàng</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => {
            const isPercent = coupon.discount_type === 'PERCENT';
            const isTicketOnly = coupon.apply_scope === 'TICKET_ONLY';
            const isComboOnly = coupon.apply_scope === 'COMBO_ONLY';

            return (
              <div
                key={coupon.id}
                className="p-5 rounded-2xl bg-[#121622] border border-[#222B3D] space-y-3 hover:border-[#384663] transition-all relative group overflow-hidden"
              >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#E63845]/5 rounded-bl-full pointer-events-none" />

                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl bg-[#E63845]/15 border border-[#E63845]/30 text-[#E63845] font-mono font-black text-sm tracking-wider">
                    {coupon.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isTicketOnly
                          ? 'bg-[#3B82F6]/15 text-[#60A5FA] border border-[#3B82F6]/30'
                          : isComboOnly
                          ? 'bg-[#FABF2E]/15 text-[#FABF2E] border border-[#FABF2E]/30'
                          : 'bg-[#22C55E]/15 text-[#4ADE80] border border-[#22C55E]/30'
                      }`}
                    >
                      {isTicketOnly ? 'Vé Xem Phim' : isComboOnly ? 'Bắp & Nước' : 'Toàn Đơn'}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(coupon)}
                      title="Chỉnh sửa mã giảm giá"
                      className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-[#38BDF8] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteCoupon && (
                      <button
                        onClick={() =>
                          setDeleteConfirmCoupon({ idOrCode: coupon.id || coupon.code, code: coupon.code })
                        }
                        title="Xóa mã giảm giá"
                        className="p-1.5 rounded-lg text-[#8E9AAF] hover:text-[#EF4444] hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="text-lg font-black text-white flex items-center gap-1">
                    <span>
                      Giảm {isPercent ? `${coupon.discount_value}%` : `${coupon.discount_value.toLocaleString('vi-VN')} đ`}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#8E9AAF] flex items-center gap-1">
                    <span className="text-white font-semibold">Đơn tối thiểu:</span>
                    <span>{coupon.min_order_amount.toLocaleString('vi-VN')} đ</span>
                  </div>

                  <div className="text-[11px] text-[#8E9AAF] flex items-center gap-1">
                    <span className="text-white font-semibold">Lượt dùng tối đa:</span>
                    <span>{coupon.usage_limit || 'Không giới hạn'}</span>
                  </div>

                  <div className="text-[10px] text-[#5C677D] pt-1 border-t border-[#1F2739] flex items-center justify-between">
                    <span>Hạn dùng:</span>
                    <span className="font-mono text-[#8E9AAF]">
                      {new Date(coupon.ends_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Coupon */}
      {couponModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263147] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E63845]/15 text-[#E63845] flex items-center justify-center">
                  {editingCoupon ? <Edit3 className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-white text-base">
                  {editingCoupon ? `Chỉnh Sửa Mã Giảm Giá: ${editingCoupon.code}` : 'Tạo Mã Giảm Giá Mới'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setCouponModalOpen(false);
                  setEditingCoupon(null);
                }}
                className="text-[#8E9AAF] hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
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
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono uppercase focus:outline-none focus:border-[#E63845]"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Bắt đầu</label>
                  <input
                    type="date"
                    value={couponForm.starts_at}
                    onChange={(e) => setCouponForm({ ...couponForm, starts_at: e.target.value })}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#8E9AAF] font-semibold">Kết thúc</label>
                  <input
                    type="date"
                    value={couponForm.ends_at}
                    onChange={(e) => setCouponForm({ ...couponForm, ends_at: e.target.value })}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCouponModalOpen(false);
                    setEditingCoupon(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1A202E] text-[#8E9AAF] hover:text-white cursor-pointer font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#E63845] hover:bg-[#D42B38] text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingCoupon ? 'Lưu Thay Đổi' : 'Tạo Mã'}
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
              Bạn có chắc chắn muốn xóa mã ưu đãi:{' '}
              <strong className="text-[#E63845] font-mono text-sm">{deleteConfirmCoupon.code}</strong>?
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
