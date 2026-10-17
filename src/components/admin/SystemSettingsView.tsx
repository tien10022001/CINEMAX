'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Building2,
  Clock,
  Lock,
  Users,
  Check,
  Save,
  Search,
  Mail,
  Send,
  AlertTriangle,
  Key,
  ExternalLink,
  RefreshCw,
  CreditCard,
  Eye,
  EyeOff
} from 'lucide-react';
import { CinemaSetting, AuditLog, StaffPerm } from '@/lib/types-redesign';

interface SystemSettingsViewProps {
  settings: CinemaSetting[];
  auditLogs: AuditLog[];
  onUpdateSetting: (key: string, value: Record<string, any>) => Promise<void>;
  showToast: (msg: string) => void;
  initialSubTab?: 'SETTINGS' | 'STAFF' | 'AUDIT' | 'EMAIL';
}

export default function SystemSettingsView({
  settings,
  auditLogs,
  onUpdateSetting,
  showToast,
  initialSubTab = 'SETTINGS'
}: SystemSettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'SETTINGS' | 'STAFF' | 'AUDIT' | 'EMAIL'>(initialSubTab);
  const [isSaving, setIsSaving] = useState(false);

  // Email Gateway Settings State
  const [emailConfig, setEmailConfig] = useState<{
    isLive: boolean;
    provider: string;
    sender: string;
    hasKey: boolean;
    maskedKey: string;
  } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [senderInput, setSenderInput] = useState('CinemaX <onboarding@resend.dev>');
  const [testEmailInput, setTestEmailInput] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const fetchEmailConfig = async () => {
    try {
      const res = await fetch('/api/admin/email-settings');
      const data = await res.json();
      if (data.success) {
        setEmailConfig(data);
        if (data.sender) setSenderInput(data.sender);
      }
    } catch {}
  };

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Settings state initialized from DB or standard cinema defaults
  const policiesSetting = settings.find((s) => s.setting_key === 'policies')?.setting_value || {};
  const cinemaInfoSetting = settings.find((s) => s.setting_key === 'cinema_info')?.setting_value || {};

  const [form, setForm] = useState({
    name: cinemaInfoSetting.name || 'CINEMAX Plaza',
    address: cinemaInfoSetting.address || 'Tòa nhà FPT Polytechnic, Phố Trịnh Văn Bô, Nam Từ Liêm, Hà Nội',
    hotline: cinemaInfoSetting.hotline || '1900-6868',
    email: cinemaInfoSetting.email || 'cskh@cinemax.vn',
    cleaning_buffer_minutes: policiesSetting.cleaning_buffer_minutes ?? 15,
    hold_duration_minutes: policiesSetting.hold_duration_minutes ?? 10,
    late_sales_minutes: policiesSetting.late_sales_minutes ?? 15,
    loyalty_rate: policiesSetting.loyalty_rate ?? 0.05
  });

  // Staff Permissions Mock list for Demo
  const [staffList, setStaffList] = useState<
    { id: string; name: string; email: string; permissions: StaffPerm[] }[]
  >([
    {
      id: 'st-1',
      name: 'Trương Công Tiến',
      email: 'tientc@cinemax.vn',
      permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR']
    },
    {
      id: 'st-2',
      name: 'Nguyễn Văn Thu Ngân',
      email: 'pos.cashier@cinemax.vn',
      permissions: ['POS']
    },
    {
      id: 'st-3',
      name: 'Lê Soát Vé',
      email: 'usher@cinemax.vn',
      permissions: ['CHECKIN']
    },
    {
      id: 'st-4',
      name: 'Phạm Bắp Nước',
      email: 'concession@cinemax.vn',
      permissions: ['CONCESSION']
    }
  ]);

  const handleTogglePermission = (staffId: string, perm: StaffPerm) => {
    setStaffList((prev) =>
      prev.map((staff) => {
        if (staff.id !== staffId) return staff;
        const exists = staff.permissions.includes(perm);
        const updated = exists
          ? staff.permissions.filter((p) => p !== perm)
          : [...staff.permissions, perm];
        return { ...staff, permissions: updated };
      })
    );
    showToast('Đã cập nhật ma trận quyền nhân sự!');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onUpdateSetting('cinema_info', {
        name: form.name,
        address: form.address,
        hotline: form.hotline,
        email: form.email
      });

      await onUpdateSetting('policies', {
        cleaning_buffer_minutes: Number(form.cleaning_buffer_minutes),
        hold_duration_minutes: Number(form.hold_duration_minutes),
        late_sales_minutes: Number(form.late_sales_minutes),
        loyalty_rate: Number(form.loyalty_rate)
      });

      showToast('Đã lưu cấu hình rạp thành công vào database Supabase!');
    } catch (err: any) {
      showToast('Lỗi lưu cấu hình: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingEmail(true);
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE',
          apiKey: apiKeyInput,
          sender: senderInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã cập nhật cấu hình cổng email!');
        setApiKeyInput('');
        fetchEmailConfig();
      } else {
        showToast('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      showToast('Lỗi lưu cổng email: ' + err.message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailInput.trim()) {
      showToast('Vui lòng nhập địa chỉ email nhận thử nghiệm!');
      return;
    }
    try {
      setIsTestingEmail(true);
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST',
          testEmail: testEmailInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Đã gửi email thử nghiệm!');
      } else {
        showToast('Gửi thất bại: ' + data.error);
      }
    } catch (err: any) {
      showToast('Lỗi gửi test: ' + err.message);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleResetToMock = async () => {
    try {
      setIsSavingEmail(true);
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE',
          apiKey: '',
          sender: 'CinemaX <onboarding@resend.dev>',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã chuyển về chế độ Giả lập an toàn (Mock)!');
        fetchEmailConfig();
      }
    } catch (err: any) {
      showToast('Lỗi: ' + err.message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Compact Top Bar */}
      <div className="flex items-center gap-2 border-b border-[#222B3D] pb-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveSubTab('SETTINGS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'SETTINGS'
              ? 'bg-[#06B6D4] text-black shadow-md'
              : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Tham Số Vận Hành Rạp</span>
        </button>

        <button
          onClick={() => setActiveSubTab('EMAIL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'EMAIL'
              ? 'bg-[#06B6D4] text-black shadow-md'
              : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Cổng Email & OTP (Resend)</span>
          {emailConfig?.isLive ? (
            <span className="w-2 h-2 rounded-full bg-[#33C773] animate-pulse"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#FABF2E]"></span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('STAFF')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'STAFF'
              ? 'bg-[#06B6D4] text-black shadow-md'
              : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Phân Quyền Nhân Sự (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('AUDIT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'AUDIT'
              ? 'bg-[#06B6D4] text-black shadow-md'
              : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Sổ Kiểm Toán (Audit Logs)</span>
        </button>
      </div>



      {/* SUBTAB 1: CINEMA SETTINGS */}
      {activeSubTab === 'SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-4 max-w-3xl">
          <div className="space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-2 border-b border-[#222B3D] pb-2">
              <Clock className="w-3.5 h-3.5 text-[#FABF2E]" />
              <span>Chính Sách Thời Gian Vận Hành</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">
                  Thời gian dọn rạp đệm (Buffer phút) *
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  required
                  value={form.cleaning_buffer_minutes}
                  onChange={(e) =>
                    setForm({ ...form, cleaning_buffer_minutes: Number(e.target.value) })
                  }
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                />
                <p className="text-[10px] text-[#5C677D]">
                  Khoảng nghỉ bắt buộc giữa 2 suất chiếu cùng phòng để dọn rác.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">
                  Thời gian giữ ghế tạm thời (Lock timeout phút) *
                </label>
                <input
                  type="number"
                  min={5}
                  max={30}
                  required
                  value={form.hold_duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, hold_duration_minutes: Number(e.target.value) })
                  }
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                />
                <p className="text-[10px] text-[#5C677D]">
                  Khách chọn ghế trực tuyến có 10 phút thanh toán trước khi nhả ghế.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">
                  Bán vé trễ sau giờ chiếu (Late sales phút) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  required
                  value={form.late_sales_minutes}
                  onChange={(e) =>
                    setForm({ ...form, late_sales_minutes: Number(e.target.value) })
                  }
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                />
                <p className="text-[10px] text-[#5C677D]">
                  Cho phép quầy POS xuất vé cho khách đến muộn sau khi phim đã bắt đầu.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">
                  Tỷ lệ tích điểm hội viên (Loyalty rate %) *
                </label>
                <input
                  type="number"
                  step={0.01}
                  min={0.01}
                  max={0.2}
                  required
                  value={form.loyalty_rate}
                  onChange={(e) => setForm({ ...form, loyalty_rate: Number(e.target.value) })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                />
                <p className="text-[10px] text-[#5C677D]">
                  Ví dụ: 0.05 tương đương tích 5% giá trị đơn hàng vào ví điểm.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#222B3D] space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-2 border-b border-[#222B3D] pb-2">
              <Building2 className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Thông Tin Cụm Rạp</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Tên rạp hiển thị</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Hotline hỗ trợ</label>
                <input
                  type="text"
                  value={form.hotline}
                  onChange={(e) => setForm({ ...form, hotline: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[#8E9AAF] font-semibold">Địa chỉ rạp</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#06B6D4]"
                />
              </div>
            </div>
          </div>

          {/* Tài khoản doanh nghiệp thụ hưởng thanh toán */}
          <div className="pt-3 border-t border-[#222B3D] space-y-3">
            <div className="text-xs font-bold text-white flex items-center justify-between border-b border-[#222B3D] pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-[#FABF2E]" />
                <span>Tài Khoản Doanh Nghiệp Thụ Hưởng (VietQR Napas 247)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#33C773]/20 text-[#33C773]">
                ✓ Đang hoạt động
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#171D2B] border border-[#253045] text-xs">
              <div>
                <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Ngân hàng thụ hưởng:</span>
                <span className="font-bold text-white">TPBank (Tiên Phong)</span>
              </div>
              <div>
                <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Tên chủ tài khoản:</span>
                <span className="font-bold text-[#FABF2E]">TRUONG VAN HOAN</span>
              </div>
              <div>
                <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Số tài khoản:</span>
                <span className="font-mono font-bold text-white tracking-wider text-sm">0301 1232 003</span>
              </div>
            </div>
            <p className="text-[10px] text-[#5C677D]">
              Mọi đơn đặt vé của khách hàng trên hệ thống sẽ tự động sinh mã VietQR Napas 247 chuyển tiền về tài khoản doanh nghiệp này.
            </p>
          </div>

          <div className="pt-4 border-t border-[#222B3D] flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-black font-black text-xs cursor-pointer shadow-lg shadow-[#06B6D4]/20 disabled:opacity-50"
            >
              {isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi Cấu Hình'}
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB: EMAIL GATEWAY CONFIG (RESEND API & SMART MOCK) */}
      {activeSubTab === 'EMAIL' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 sm:p-6 space-y-6 max-w-3xl">
          {/* Status Banner */}
          <div className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161D2B] border-[#253045]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Trạng thái Cổng Email:</span>
                {emailConfig?.isLive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#22C55E]/20 text-[#22C55E] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
                    PHÁT THƯ THỰC TẾ (RESEND API)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#FABF2E]/20 text-[#FABF2E] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#FABF2E]"></span>
                    GIẢ LẬP AN TOÀN (SMART MOCK)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8E9AAF]">
                {emailConfig?.isLive
                  ? 'Mã OTP và vé điện tử đang được chuyển giao trực tiếp tới hòm thư thực của khách hàng.'
                  : 'Chưa có Resend API Key. Hệ thống tự động giả lập phát mã để kiểm thử giao diện mượt mà.'}
              </p>
              {emailConfig?.maskedKey && (
                <div className="text-[11px] font-mono text-[#06B6D4]">
                  Key hiện hành: {emailConfig.maskedKey} • Người gửi: {emailConfig.sender}
                </div>
              )}
            </div>

            {emailConfig?.isLive && (
              <button
                type="button"
                onClick={handleResetToMock}
                disabled={isSavingEmail}
                className="px-3 py-1.5 rounded-xl border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 text-xs font-bold cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Chuyển Về Giả Lập
              </button>
            )}
          </div>

          {/* Form Cấu Hình Cổng Email */}
          <form onSubmit={handleSaveEmailConfig} className="space-y-4">
            <div className="text-xs font-bold text-white flex items-center gap-2 border-b border-[#222B3D] pb-2">
              <Key className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Thiết Lập Khóa Cổng Phát Thư (Resend API)</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8E9AAF] font-semibold block mb-1">
                  Resend API Key * (Dạng: re_xxxxxxxxxxxx)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={emailConfig?.maskedKey ? `Đang dùng: ${emailConfig.maskedKey} (Nhập key mới nếu muốn đổi)` : 're_123456789...'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 pr-10 text-white font-mono focus:outline-none focus:border-[#06B6D4] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E9AAF] hover:text-white transition-colors cursor-pointer p-1"
                    title={showApiKey ? 'Ẩn khóa' : 'Hiện khóa'}
                    aria-label={showApiKey ? 'Ẩn khóa' : 'Hiện khóa'}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4 text-[#06B6D4]" />
                    ) : (
                      <Eye className="w-4 h-4 hover:text-[#06B6D4]" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-[#5C677D] mt-1">
                  Khóa được bảo mật trong file cấu hình máy chủ, không bị lộ ra Client.
                </p>
              </div>

              <div>
                <label className="text-[#8E9AAF] font-semibold block mb-1">
                  Email người gửi (Sender / From Header)
                </label>
                <input
                  type="text"
                  value={senderInput}
                  onChange={(e) => setSenderInput(e.target.value)}
                  placeholder="CinemaX <onboarding@resend.dev>"
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                />
                <p className="text-[10px] text-[#5C677D] mt-1">
                  Mặc định Resend cho phép test ngay bằng <code className="text-[#FABF2E]">CinemaX &lt;onboarding@resend.dev&gt;</code>.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#222B3D]">
              <button
                type="submit"
                disabled={isSavingEmail}
                className="px-5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-black font-black text-xs cursor-pointer shadow-lg shadow-[#06B6D4]/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                <span>Lưu & Kích Hoạt Cổng Email</span>
              </button>
            </div>
          </form>

          {/* Công cụ gửi email thử nghiệm */}
          <div className="p-4 rounded-2xl bg-[#171D2B] border border-[#253045] space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-[#33C773]" />
              <span>Gửi Thử Nghiệm Kiểm Tra Kết Nối</span>
            </div>
            <p className="text-xs text-[#8E9AAF]">
              Nhập địa chỉ email của bạn để hệ thống gửi 1 bức thư kiểm tra đường truyền Resend tức thì:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="your-email@gmail.com"
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                className="flex-1 bg-[#121622] border border-[#253045] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={isTestingEmail}
                className="px-4 py-2 rounded-xl bg-[#33C773] hover:bg-[#2EB367] text-black font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isTestingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                <span>Bắn Thử Nghiệm</span>
              </button>
            </div>
          </div>

          {/* Hướng dẫn nhận key miễn phí */}
          <div className="p-4 rounded-2xl bg-[#0F1217] border border-[#222B3D] space-y-2 text-xs">
            <div className="font-bold text-[#FABF2E] flex items-center gap-1.5">
              <span>💡 Hướng dẫn lấy Resend API Key miễn phí (Chỉ mất 30 giây):</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[#8E9AAF]">
              <li>Truy cập <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[#06B6D4] underline inline-flex items-center gap-0.5">resend.com <ExternalLink className="w-2.5 h-2.5" /></a> và đăng ký bằng Google/GitHub.</li>
              <li>Vào mục <strong>API Keys</strong> $\rightarrow$ Bấm <strong>Create API Key</strong>.</li>
              <li>Sao chép mã khóa (dạng <code className="text-white bg-[#1A1C26] px-1 rounded">re_...</code>) rồi dán vào ô trên và bấm <strong>Lưu & Kích Hoạt</strong>.</li>
            </ol>
            <div className="pt-2 text-[11px] text-[#5C677D]">
              Hoặc dùng câu lệnh CLI: <code className="text-[#06B6D4] bg-[#161D2B] px-2 py-0.5 rounded font-mono">npm run setup:resend &lt;KEY_CỦA_BẠN&gt;</code>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: STAFF RBAC MATRIX */}
      {activeSubTab === 'STAFF' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Ma Trận Phân Quyền Nhân Viên</span>
            <span className="text-[#8E9AAF]">{staffList.length} tài khoản</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222B3D] text-[#8E9AAF]">
                  <th className="py-2.5 px-3 font-bold">Nhân Viên</th>
                  <th className="py-2.5 px-3 font-bold text-center">POS (Quầy vé)</th>
                  <th className="py-2.5 px-3 font-bold text-center">CHECKIN (Soát vé)</th>
                  <th className="py-2.5 px-3 font-bold text-center">CONCESSION (Bắp nước)</th>
                  <th className="py-2.5 px-3 font-bold text-center">SUPERVISOR (Duyệt ca)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D2536]">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-[#161C2A]">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{staff.name}</div>
                      <div className="text-[10px] text-[#5C677D] font-mono">{staff.email}</div>
                    </td>

                    {(['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'] as StaffPerm[]).map((perm) => {
                      const hasPerm = staff.permissions.includes(perm);
                      return (
                        <td key={perm} className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleTogglePermission(staff.id, perm)}
                            className={`w-6 h-6 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center ${
                              hasPerm
                                ? 'bg-[#22C55E] text-black shadow-md'
                                : 'bg-[#1F2739] text-[#5C677D] hover:bg-[#28324A]'
                            }`}
                          >
                            {hasPerm ? '✓' : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: AUDIT LOGS */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Sổ Nhật Ký Kiểm Toán Hệ Thống</span>
            <span className="text-[#8E9AAF]">{auditLogs.length} sự kiện</span>
          </div>

          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-[#8E9AAF] text-xs">
                Chưa có thao tác kiểm toán nào được ghi nhận gần đây.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-[#161D2B] border border-[#242D40] flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#FABF2E]">{log.action}</span>
                      <span className="text-[#5C677D]">•</span>
                      <span className="text-white font-semibold">{log.entity_type}</span>
                    </div>
                    <div className="text-[10px] text-[#8E9AAF]">Thực thể ID: {log.entity_id}</div>
                  </div>

                  <div className="text-right text-[#5C677D] font-mono text-[11px]">
                    {new Date(log.created_at).toLocaleTimeString('vi-VN')} •{' '}
                    {new Date(log.created_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
