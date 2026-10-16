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
  Search
} from 'lucide-react';
import { CinemaSetting, AuditLog, StaffPerm } from '@/lib/types-redesign';
import { createClient } from '@/lib/supabase/client';

interface SystemSettingsViewProps {
  settings: CinemaSetting[];
  auditLogs: AuditLog[];
  onUpdateSetting: (key: string, value: Record<string, any>) => Promise<void>;
  showToast: (msg: string) => void;
  initialSubTab?: 'SETTINGS' | 'STAFF' | 'AUDIT';
}

export default function SystemSettingsView({
  settings,
  auditLogs,
  onUpdateSetting,
  showToast,
  initialSubTab = 'SETTINGS'
}: SystemSettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'SETTINGS' | 'STAFF' | 'AUDIT'>(initialSubTab);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

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

  // Dynamic Staff List from Supabase Profiles & Local Database
  const [staffList, setStaffList] = useState<
    { id: string; name: string; email: string; permissions: StaffPerm[] }[]
  >([]);

  const fetchStaffData = async () => {
    setIsLoadingStaff(true);
    let mergedStaff: { id: string; name: string; email: string; permissions: StaffPerm[] }[] = [];

    // 1. Đọc danh sách nhân viên từ local database (cinemax_users_db)
    try {
      const stored = localStorage.getItem('cinemax_users_db');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed
          .filter((u: any) => u.role_code === 'STAFF' || u.role_id === 2)
          .forEach((u: any) => {
            mergedStaff.push({
              id: u.id,
              name: u.full_name,
              email: u.email,
              permissions: (u.staff_permissions && u.staff_permissions.length > 0
                ? u.staff_permissions
                : ['POS']) as StaffPerm[],
            });
          });
      }
    } catch (e) {
      console.warn('Lỗi đọc nhân viên local:', e);
    }

    // 2. Truy vấn trực tiếp từ bảng profiles trên Supabase nơi role = 'staff'
    try {
      const supabase = createClient();
      const [profilesRes, permsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, phone').eq('role', 'staff'),
        supabase.from('staff_permissions').select('staff_id, permission, active'),
      ]);

      const dbStaff = profilesRes.data || [];
      const dbPerms = permsRes.data || [];

      dbStaff.forEach((sp: any) => {
        const activePerms = dbPerms
          .filter((p: any) => p.staff_id === sp.id && p.active)
          .map((p: any) => p.permission as StaffPerm);

        const existingIdx = mergedStaff.findIndex((s) => s.id === sp.id || (sp.phone && s.email.includes(sp.phone)));
        if (existingIdx !== -1) {
          mergedStaff[existingIdx].id = sp.id;
          mergedStaff[existingIdx].name = sp.full_name;
          if (activePerms.length > 0) {
            mergedStaff[existingIdx].permissions = Array.from(new Set([...mergedStaff[existingIdx].permissions, ...activePerms]));
          }
        } else {
          mergedStaff.push({
            id: sp.id,
            name: sp.full_name,
            email: sp.phone ? `${sp.phone}@cinemax.vn` : `staff_${sp.id.slice(0, 6)}@cinemax.vn`,
            permissions: activePerms.length > 0 ? activePerms : ['POS', 'CHECKIN'],
          });
        }
      });
    } catch (err) {
      console.warn('Lỗi tải nhân viên từ Supabase:', err);
    }

    // Đảm bảo luôn có các nhân viên mẫu mặc định nếu database trống
    if (mergedStaff.length === 0) {
      mergedStaff = [
        { id: 'st-1', name: 'Trương Công Tiến', email: 'tientc@cinemax.vn', permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'] },
        { id: 'st-2', name: 'Nguyễn Văn Thu Ngân', email: 'pos.cashier@cinemax.vn', permissions: ['POS'] },
        { id: 'st-3', name: 'Lê Soát Vé', email: 'usher@cinemax.vn', permissions: ['CHECKIN'] },
        { id: 'st-4', name: 'Phạm Bắp Nước', email: 'concession@cinemax.vn', permissions: ['CONCESSION'] },
      ];
    }

    setStaffList(mergedStaff);
    setIsLoadingStaff(false);
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  const handleTogglePermission = async (staffId: string, perm: StaffPerm) => {
    let willHavePerm = false;
    setStaffList((prev) =>
      prev.map((staff) => {
        if (staff.id !== staffId) return staff;
        const exists = staff.permissions.includes(perm);
        willHavePerm = !exists;
        const updated = exists
          ? staff.permissions.filter((p) => p !== perm)
          : [...staff.permissions, perm];
        return { ...staff, permissions: updated };
      })
    );

    // 1. Cập nhật local storage
    try {
      const stored = localStorage.getItem('cinemax_users_db');
      if (stored) {
        const parsed = JSON.parse(stored);
        const idx = parsed.findIndex((u: any) => u.id === staffId);
        if (idx !== -1) {
          const current = parsed[idx].staff_permissions || [];
          parsed[idx].staff_permissions = willHavePerm
            ? Array.from(new Set([...current, perm]))
            : current.filter((p: string) => p !== perm);
          localStorage.setItem('cinemax_users_db', JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.warn('Lỗi lưu quyền local:', e);
    }

    // 2. Ghi nhận trực tiếp vào bảng staff_permissions trên Supabase nếu có UUID
    if (staffId.length === 36) {
      try {
        const supabase = createClient();
        await supabase.from('staff_permissions').upsert(
          {
            staff_id: staffId,
            permission: perm,
            active: willHavePerm,
          },
          { onConflict: 'staff_id,permission' }
        );
      } catch (err) {
        console.warn('Lỗi đồng bộ staff_permissions lên Supabase:', err);
      }
    }

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

      {/* SUBTAB 2: STAFF RBAC MATRIX */}
      {activeSubTab === 'STAFF' && (
        <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#222B3D] pb-2 text-xs">
            <span className="font-bold text-white">Ma Trận Phân Quyền Nhân Viên</span>
            <div className="flex items-center gap-3">
              <span className="text-[#8E9AAF]">{staffList.length} tài khoản</span>
              <button
                type="button"
                onClick={fetchStaffData}
                disabled={isLoadingStaff}
                className="px-2.5 py-1 rounded-lg bg-[#1F2739] hover:bg-[#28324A] text-[#06B6D4] text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                title="Đồng bộ danh sách nhân viên từ Supabase"
              >
                <span>{isLoadingStaff ? 'Đang tải...' : '↻ Đồng Bộ Từ Supabase'}</span>
              </button>
            </div>
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
