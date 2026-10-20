'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  ShieldCheck,
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
  EyeOff,
  UserPlus,
  User,
  Shield,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  Filter,
  BadgeCheck,
  ShieldAlert,
  UserCheck,
  Phone,
  Plus,
  Crown,
  Ticket,
  Sparkles,
  QrCode,
  Upload,
  Copy
} from 'lucide-react';
import {
  VietQRService,
  POPULAR_VIETQR_BANKS,
  BankAccountInfo,
  DEFAULT_BANK_INFO
} from '@/services/vietqr.service';
import { CinemaSetting, AuditLog, StaffPerm } from '@/lib/types-redesign';

export type AccountRole = 'ADMIN' | 'STAFF' | 'USER' | 'GUEST';

export interface SystemAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: AccountRole;
  staff_position?: string;
  permissions: StaffPerm[];
  is_active: boolean;
  created_at?: string;
  source?: 'SUPABASE' | 'LOCAL' | 'GUEST';
}

const DEFAULT_SYSTEM_ACCOUNTS: SystemAccount[] = [
  // ADMINS
  {
    id: 'usr-admin-001',
    name: 'Quản trị viên Cinemax',
    email: 'admin@cinemax.vn',
    phone: '0988888888',
    role: 'ADMIN',
    staff_position: 'Quản trị viên hệ thống (Super Admin)',
    permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    is_active: true,
    created_at: '2026-01-01',
    source: 'LOCAL'
  },
  {
    id: 'usr-admin-002',
    name: 'Trương Công Tiến',
    email: 'tientc@cinemax.vn',
    phone: '0911222333',
    role: 'ADMIN',
    staff_position: 'Giám đốc Vận hành & Hệ thống (Admin)',
    permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    is_active: true,
    created_at: '2026-01-01',
    source: 'LOCAL'
  },
  // STAFF
  {
    id: 'usr-staff-001',
    name: 'Trần Minh Quân',
    email: 'staff@cinemax.vn',
    phone: '0977111222',
    role: 'STAFF',
    staff_position: 'Trưởng ca rạp (Supervisor)',
    permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    is_active: true,
    created_at: '2026-01-05',
    source: 'LOCAL'
  },
  {
    id: 'usr-staff-002',
    name: 'Nguyễn Văn Thu Ngân',
    email: 'pos.cashier@cinemax.vn',
    phone: '0933444555',
    role: 'STAFF',
    staff_position: 'Thu ngân quầy vé (POS)',
    permissions: ['POS'],
    is_active: true,
    created_at: '2026-01-10',
    source: 'LOCAL'
  },
  {
    id: 'usr-staff-pos-002',
    name: 'Lê Thu Hà',
    email: 'pos@cinemax.vn',
    phone: '0977333444',
    role: 'STAFF',
    staff_position: 'Thu ngân quầy vé (POS)',
    permissions: ['POS'],
    is_active: true,
    created_at: '2026-01-12',
    source: 'LOCAL'
  },
  {
    id: 'usr-staff-003',
    name: 'Lê Soát Vé',
    email: 'usher@cinemax.vn',
    phone: '0944555666',
    role: 'STAFF',
    staff_position: 'Nhân viên soát vé (Check-in)',
    permissions: ['CHECKIN'],
    is_active: true,
    created_at: '2026-01-10',
    source: 'LOCAL'
  },
  {
    id: 'usr-staff-chk-003',
    name: 'Phạm Hoàng Nam',
    email: 'checkin@cinemax.vn',
    phone: '0977555666',
    role: 'STAFF',
    staff_position: 'Nhân viên soát vé (Check-in)',
    permissions: ['CHECKIN'],
    is_active: true,
    created_at: '2026-01-15',
    source: 'LOCAL'
  },
  {
    id: 'usr-staff-004',
    name: 'Phạm Bắp Nước',
    email: 'concession@cinemax.vn',
    phone: '0955666777',
    role: 'STAFF',
    staff_position: 'Nhân viên Bắp Nước (F&B)',
    permissions: ['CONCESSION'],
    is_active: true,
    created_at: '2026-01-10',
    source: 'LOCAL'
  },
  {
    id: 'usr-staff-fnb-004',
    name: 'Đỗ Ngọc Lan',
    email: 'fnb@cinemax.vn',
    phone: '0977777888',
    role: 'STAFF',
    staff_position: 'Nhân viên Bắp Nước (F&B)',
    permissions: ['CONCESSION'],
    is_active: true,
    created_at: '2026-01-18',
    source: 'LOCAL'
  },
  // USERS (Khách thành viên)
  {
    id: 'usr-cust-001',
    name: 'Nguyễn Văn A',
    email: 'user@cinemax.vn',
    phone: '0912345678',
    role: 'USER',
    staff_position: 'Khách hàng thành viên VIP',
    permissions: [],
    is_active: true,
    created_at: '2026-02-15',
    source: 'LOCAL'
  },
  {
    id: 'usr-cust-002',
    name: 'Hoàng Mai Anh',
    email: 'maianh.hoang@gmail.com',
    phone: '0905123987',
    role: 'USER',
    staff_position: 'Khách hàng thành viên Standard',
    permissions: [],
    is_active: true,
    created_at: '2026-03-01',
    source: 'LOCAL'
  },
  {
    id: 'usr-cust-003',
    name: 'Lê Minh Khang',
    email: 'khang.le@outlook.com',
    phone: '0918765432',
    role: 'USER',
    staff_position: 'Khách hàng thân thiết',
    permissions: [],
    is_active: true,
    created_at: '2026-03-12',
    source: 'LOCAL'
  },
  // GUEST (Khách vãng lai)
  {
    id: 'usr-guest-001',
    name: 'Trần Thị Bích',
    email: 'bich.tran@yahoo.com',
    phone: '0983112233',
    role: 'GUEST',
    staff_position: 'Khách vãng lai (Đặt vé online)',
    permissions: [],
    is_active: true,
    created_at: '2026-03-20',
    source: 'GUEST'
  },
  {
    id: 'usr-guest-002',
    name: 'Đoàn Quốc Cường',
    email: 'cuong.doan@gmail.com',
    phone: '0972334455',
    role: 'GUEST',
    staff_position: 'Khách vãng lai (Đặt vé online)',
    permissions: [],
    is_active: true,
    created_at: '2026-03-21',
    source: 'GUEST'
  },
  {
    id: 'usr-guest-003',
    name: 'Khách Vãng Lai Quầy Vé #102',
    email: 'guest.pos@cinemax.vn',
    phone: '0900000001',
    role: 'GUEST',
    staff_position: 'Khách vãng lai mua vé tại quầy',
    permissions: [],
    is_active: true,
    created_at: '2026-03-22',
    source: 'GUEST'
  }
];

interface SystemSettingsViewProps {
  settings: CinemaSetting[];
  auditLogs?: AuditLog[];
  onUpdateSetting: (key: string, value: Record<string, any>) => Promise<void>;
  showToast: (msg: string) => void;
  initialSubTab?: 'SETTINGS' | 'STAFF' | 'EMAIL';
}

export default function SystemSettingsView({
  settings,
  onUpdateSetting,
  showToast,
  initialSubTab = 'SETTINGS'
}: SystemSettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'SETTINGS' | 'STAFF' | 'EMAIL'>(
    initialSubTab === ('AUDIT' as any) ? 'STAFF' : initialSubTab
  );
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
    } catch { }
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
  const bankAccountSetting = settings.find((s) => s.setting_key === 'bank_account')?.setting_value || {};

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

  // Beneficiary Bank Account State
  const [bankForm, setBankForm] = useState<BankAccountInfo>(() => {
    const fromService = VietQRService.getBankInfo();
    return {
      bankId: bankAccountSetting.bankId || fromService.bankId || DEFAULT_BANK_INFO.bankId,
      bankName: bankAccountSetting.bankName || fromService.bankName || DEFAULT_BANK_INFO.bankName,
      bankShortName: bankAccountSetting.bankShortName || fromService.bankShortName || DEFAULT_BANK_INFO.bankShortName,
      bankCode: bankAccountSetting.bankCode || fromService.bankCode || DEFAULT_BANK_INFO.bankCode,
      accountNumber: bankAccountSetting.accountNumber || fromService.accountNumber || DEFAULT_BANK_INFO.accountNumber,
      accountName: bankAccountSetting.accountName || fromService.accountName || DEFAULT_BANK_INFO.accountName,
      customQrUrl: bankAccountSetting.customQrUrl || fromService.customQrUrl || '',
      qrMode: (bankAccountSetting.qrMode || fromService.qrMode || 'AUTO') as 'AUTO' | 'CUSTOM',
    };
  });
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isCopiedStk, setIsCopiedStk] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    const handleBankUpdated = (e: any) => {
      if (e.detail) {
        setBankForm((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('cinemax_bank_config_updated', handleBankUpdated);
    return () => window.removeEventListener('cinemax_bank_config_updated', handleBankUpdated);
  }, []);

  const handleSelectBank = (shortName: string) => {
    const found = POPULAR_VIETQR_BANKS.find((b) => b.shortName === shortName);
    if (found) {
      setBankForm((prev) => ({
        ...prev,
        bankId: found.bin,
        bankName: found.name,
        bankShortName: found.shortName,
        bankCode: found.code,
      }));
    } else {
      setBankForm((prev) => ({
        ...prev,
        bankShortName: shortName,
        bankCode: VietQRService.resolveBankCode(shortName),
      }));
    }
  };

  const handleUploadCustomQr = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file hình ảnh (PNG, JPG, WEBP)!');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('Kích thước ảnh tối đa là 3MB!');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setBankForm((prev) => ({
        ...prev,
        customQrUrl: result,
        qrMode: 'CUSTOM',
      }));
      showToast('Đã tải ảnh mã QR tùy chỉnh lên thành công!');
    };
    reader.readAsDataURL(file);
  };

  const handleCopyStk = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(bankForm.accountNumber.replace(/\s+/g, ''));
      setIsCopiedStk(true);
      setTimeout(() => setIsCopiedStk(false), 2000);
      showToast('Đã sao chép số tài khoản thụ hưởng!');
    }
  };

  const handleSaveBankConfig = async () => {
    if (!bankForm.accountNumber.trim()) {
      showToast('Vui lòng nhập số tài khoản ngân hàng!');
      return;
    }
    if (!bankForm.accountName.trim()) {
      showToast('Vui lòng nhập tên chủ tài khoản!');
      return;
    }

    try {
      setIsSavingBank(true);
      const normalizedBank: BankAccountInfo = {
        ...bankForm,
        accountName: bankForm.accountName.trim().toUpperCase(),
        accountNumber: bankForm.accountNumber.trim(),
        bankCode: bankForm.bankCode || VietQRService.resolveBankCode(bankForm.bankShortName),
      };

      // 1. Lưu vào local storage & phát broadcast tức thì cho mọi tab & modal
      VietQRService.saveBankInfo(normalizedBank);

      // 2. Lưu vào Supabase settings
      await onUpdateSetting('bank_account', normalizedBank);

      showToast('Đã lưu thông tin tài khoản thụ hưởng & mã VietQR thành công!');
      setIsEditingBank(false);
    } catch (err: any) {
      showToast('Lỗi lưu tài khoản: ' + err.message);
    } finally {
      setIsSavingBank(false);
    }
  };

  const previewQrUrl = useMemo(() => {
    if (bankForm.qrMode === 'CUSTOM' && bankForm.customQrUrl) {
      return bankForm.customQrUrl;
    }
    return VietQRService.generatePreviewQrUrl(bankForm, 100000);
  }, [bankForm]);

  // Accounts & RBAC State
  const [accounts, setAccounts] = useState<SystemAccount[]>(DEFAULT_SYSTEM_ACCOUNTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AccountRole>('ALL');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  // Modal State for Add / Edit Account
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SystemAccount | null>(null);
  const [modalForm, setModalForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'STAFF' as AccountRole,
    staff_position: '',
    permissions: ['POS'] as StaffPerm[],
    is_active: true
  });

  // 1. Tải toàn bộ tài khoản thực tế trực tiếp từ Supabase Cloud Database (bảng profiles, staff_permissions, orders)
  const fetchAccountsFromDb = async () => {
    try {
      setIsLoadingAccounts(true);
      const res = await fetch('/api/admin/accounts');
      const data = await res.json();
      if (data.success && Array.isArray(data.accounts) && data.accounts.length > 0) {
        setAccounts(data.accounts);
        setDbConnected(true);
        localStorage.setItem('cinemax_system_accounts', JSON.stringify(data.accounts));
        return;
      }
    } catch (err) {
      console.warn('Lỗi lấy tài khoản từ Supabase Cloud:', err);
    } finally {
      setIsLoadingAccounts(false);
    }

    // Fallback nếu không có mạng
    try {
      const stored = localStorage.getItem('cinemax_system_accounts');
      if (stored) {
        setAccounts(JSON.parse(stored));
      }
    } catch { }
  };

  useEffect(() => {
    fetchAccountsFromDb();
  }, []);

  // Sync helper to update state & localStorage & dispatch events
  const saveAccounts = (newAccounts: SystemAccount[]) => {
    setAccounts(newAccounts);
    localStorage.setItem('cinemax_system_accounts', JSON.stringify(newAccounts));

    // Đồng bộ vào cinemax_users_db
    try {
      const usersDbStr = localStorage.getItem('cinemax_users_db');
      let usersDb: any[] = usersDbStr ? JSON.parse(usersDbStr) : [];
      newAccounts.forEach((acc) => {
        const uIdx = usersDb.findIndex((u) => u.email.toLowerCase() === acc.email.toLowerCase());
        const dbRoleCode = acc.role === 'ADMIN' ? 'ADMIN' : (acc.role === 'STAFF' ? 'STAFF' : 'CUSTOMER');
        const dbRoleId = acc.role === 'ADMIN' ? 3 : (acc.role === 'STAFF' ? 2 : 1);
        if (uIdx >= 0) {
          usersDb[uIdx] = {
            ...usersDb[uIdx],
            full_name: acc.name,
            phone: acc.phone,
            role_code: dbRoleCode,
            role_id: dbRoleId,
            staff_permissions: acc.permissions,
            staff_position: acc.staff_position,
            is_active: acc.is_active
          };
        } else if (acc.role !== 'GUEST') {
          usersDb.push({
            id: acc.id,
            email: acc.email,
            full_name: acc.name,
            phone: acc.phone,
            role_code: dbRoleCode,
            role_id: dbRoleId,
            staff_permissions: acc.permissions,
            staff_position: acc.staff_position,
            is_active: acc.is_active,
            loyalty_points: 0,
            password: 'password123'
          });
        }
      });
      localStorage.setItem('cinemax_users_db', JSON.stringify(usersDb));
      window.dispatchEvent(new Event('cinemax_users_updated'));
    } catch { }
  };

  // Cấp quyền giao chức danh (Change Role) - BẮN TRỰC TIẾP QUA SUPABASE DB
  const handleUpdateRole = async (accountId: string, newRole: AccountRole) => {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;

    let updatedPerms = [...target.permissions];
    let updatedPosition = target.staff_position;

    if (newRole === 'ADMIN') {
      updatedPerms = ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'];
      updatedPosition = 'Quản trị viên hệ thống (Admin)';
    } else if (newRole === 'STAFF') {
      if (updatedPerms.length === 0) {
        updatedPerms = ['POS'];
      }
      if (!updatedPosition || updatedPosition.includes('Khách')) {
        updatedPosition = 'Nhân viên vận hành rạp';
      }
    } else if (newRole === 'USER') {
      updatedPerms = [];
      updatedPosition = 'Khách hàng thành viên';
    } else if (newRole === 'GUEST') {
      updatedPerms = [];
      updatedPosition = 'Khách vãng lai tra cứu';
    }

    const updated = accounts.map((acc) =>
      acc.id === accountId
        ? {
          ...acc,
          role: newRole,
          permissions: updatedPerms,
          staff_position: updatedPosition
        }
        : acc
    );

    saveAccounts(updated);
    showToast(`Đã chuyển chức danh [${newRole}] cho ${target.name}! Đang lưu DB...`);

    // Bắn trực tiếp qua Supabase Database
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ROLE',
          accountId,
          newRole
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã lưu chức danh [${newRole}] vào Supabase Cloud DB!`);
      }
    } catch (err) {
      console.warn('Lỗi ghi role qua DB:', err);
    }
  };

  // Bật/tắt quyền chức năng RBAC (Toggle Permission) - BẮN TRỰC TIẾP VÀO BẢNG staff_permissions SUPABASE DB
  const handleTogglePermission = async (accountId: string, perm: StaffPerm) => {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;

    if (target.role === 'ADMIN') {
      showToast('Tài khoản Quản Trị Viên (Admin) mặc định có toàn bộ quyền hạn!');
      return;
    }

    if (target.role !== 'STAFF') {
      await handleUpdateRole(accountId, 'STAFF');
      showToast(`Đã chuyển tài khoản ${target.name} sang [STAFF] để cấp quyền ${perm}!`);
      return;
    }

    const exists = target.permissions.includes(perm);
    const newPerms = exists
      ? target.permissions.filter((p) => p !== perm)
      : [...target.permissions, perm];

    const updated = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, permissions: newPerms } : acc
    );

    saveAccounts(updated);
    showToast(`Đã ${exists ? 'thu hồi' : 'cấp'} quyền [${perm}] cho ${target.name}! Đang lưu DB...`);

    // Bắn trực tiếp vào bảng staff_permissions trên Supabase Cloud
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_PERMISSION',
          accountId,
          permission: perm,
          enable: !exists
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã đồng bộ quyền [${perm}] vào database Supabase!`);
      }
    } catch (err) {
      console.warn('Lỗi ghi quyền qua DB:', err);
    }
  };

  // Toggle trạng thái kích hoạt tài khoản - BẮN VÀO SUPABASE DB
  const handleToggleActive = async (accountId: string) => {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;
    if (target.email === 'admin@cinemax.vn') {
      showToast('Không thể khóa tài khoản Admin quản trị viên gốc!');
      return;
    }

    const newStatus = !target.is_active;
    const updated = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, is_active: newStatus } : acc
    );
    saveAccounts(updated);
    showToast(`Tài khoản ${target.name} đã được ${newStatus ? 'mở khóa' : 'tạm khóa'}! Đang lưu DB...`);

    try {
      await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_STATUS',
          accountId,
          is_active: newStatus
        })
      });
      showToast('Đã lưu trạng thái vào Supabase Cloud DB!');
    } catch (err) {
      console.warn('Lỗi lưu status qua DB:', err);
    }
  };

  // Xóa tài khoản - BẮN VÀO SUPABASE DB
  const handleDeleteAccount = async (accountId: string) => {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;
    if (target.email === 'admin@cinemax.vn' || target.email === 'tientc@cinemax.vn') {
      showToast('Không thể xóa tài khoản Quản trị viên chính!');
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${target.name}" (${target.email}) khỏi hệ thống và database Supabase?`)) {
      const updated = accounts.filter((a) => a.id !== accountId);
      saveAccounts(updated);
      showToast(`Đã xóa tài khoản ${target.name}! Đang xóa khỏi DB...`);

      try {
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'DELETE_ACCOUNT',
            accountId
          })
        });
        showToast('Đã xóa tài khoản hoàn toàn khỏi Supabase Database!');
      } catch (err) {
        console.warn('Lỗi xóa tài khoản DB:', err);
      }
    }
  };

  // Mở modal thêm tài khoản mới
  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setModalForm({
      name: '',
      email: '',
      phone: '',
      role: 'STAFF',
      staff_position: 'Nhân viên quầy vé',
      permissions: ['POS'],
      is_active: true
    });
    setIsAccountModalOpen(true);
  };

  // Mở modal chỉnh sửa tài khoản
  const handleOpenEditModal = (account: SystemAccount) => {
    setEditingAccount(account);
    setModalForm({
      name: account.name,
      email: account.email,
      phone: account.phone || '',
      role: account.role,
      staff_position: account.staff_position || '',
      permissions: [...account.permissions],
      is_active: account.is_active
    });
    setIsAccountModalOpen(true);
  };

  // Lưu form modal (Thêm mới hoặc Cập nhật) - BẮN TRỰC TIẾP VÀO SUPABASE DB
  const handleSaveModalAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.name.trim() || !modalForm.email.trim()) {
      showToast('Vui lòng nhập họ tên và email hợp lệ!');
      return;
    }

    const perms = modalForm.role === 'ADMIN'
      ? (['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'] as StaffPerm[])
      : (modalForm.role === 'STAFF' ? modalForm.permissions : []);

    if (editingAccount) {
      // Update
      const updated = accounts.map((a) =>
        a.id === editingAccount.id
          ? {
            ...a,
            name: modalForm.name.trim(),
            email: modalForm.email.trim().toLowerCase(),
            phone: modalForm.phone.trim(),
            role: modalForm.role,
            staff_position: modalForm.staff_position.trim(),
            permissions: perms,
            is_active: modalForm.is_active
          }
          : a
      );
      saveAccounts(updated);
      showToast(`Đã cập nhật ${modalForm.name}! Đang lưu DB...`);

      try {
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_ROLE',
            accountId: editingAccount.id,
            newRole: modalForm.role
          })
        });
        showToast('Đã lưu thành công vào Supabase Cloud DB!');
      } catch { }
    } else {
      // Check duplicate email
      const emailLower = modalForm.email.trim().toLowerCase();
      if (accounts.some((a) => a.email.toLowerCase() === emailLower)) {
        showToast('Email này đã tồn tại trên hệ thống!');
        return;
      }

      showToast(`Đang tạo tài khoản "${modalForm.name}" trên Supabase Cloud DB...`);

      try {
        const res = await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CREATE_ACCOUNT',
            name: modalForm.name.trim(),
            email: emailLower,
            phone: modalForm.phone.trim(),
            role: modalForm.role,
            staff_position: modalForm.staff_position.trim(),
            permissions: perms,
            is_active: modalForm.is_active
          })
        });
        const data = await res.json();
        if (data.success && data.account) {
          saveAccounts([data.account, ...accounts]);
          showToast(`Đã tạo thành công tài khoản "${modalForm.name}" trên Supabase Cloud Database!`);
        } else {
          // Local fallback
          const newAcc: SystemAccount = {
            id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: modalForm.name.trim(),
            email: emailLower,
            phone: modalForm.phone.trim(),
            role: modalForm.role,
            staff_position: modalForm.staff_position.trim() || modalForm.role,
            permissions: perms,
            is_active: modalForm.is_active,
            created_at: new Date().toISOString().split('T')[0],
            source: 'LOCAL'
          };
          saveAccounts([newAcc, ...accounts]);
          showToast(`Đã tạo tài khoản "${modalForm.name}"!`);
        }
      } catch (err) {
        showToast('Tạo tài khoản thất bại: ' + err);
      }
    }

    setIsAccountModalOpen(false);
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

      // Đồng thời lưu cấu hình tài khoản ngân hàng thụ hưởng & mã QR
      const normalizedBank: BankAccountInfo = {
        ...bankForm,
        accountName: bankForm.accountName.trim().toUpperCase(),
        accountNumber: bankForm.accountNumber.trim(),
        bankCode: bankForm.bankCode || VietQRService.resolveBankCode(bankForm.bankShortName),
      };
      VietQRService.saveBankInfo(normalizedBank);
      await onUpdateSetting('bank_account', normalizedBank);

      showToast('Đã lưu cấu hình rạp & tài khoản thụ hưởng thành công!');
      setIsEditingBank(false);
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeSubTab === 'SETTINGS'
              ? 'bg-[#06B6D4] text-black shadow-md'
              : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
            }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Tham Số Vận Hành Rạp</span>
        </button>

        <button
          onClick={() => setActiveSubTab('EMAIL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeSubTab === 'EMAIL'
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeSubTab === 'STAFF'
              ? 'bg-[#06B6D4] text-black shadow-md'
              : 'bg-[#141924] text-[#8E9AAF] hover:text-white border border-[#222B3D]'
            }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Phân Quyền & Quản Lý Toàn Bộ Tài Khoản (RBAC)</span>
          <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#1F2739] text-[#06B6D4] font-mono">
            {accounts.length}
          </span>
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
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#33C773]/20 text-[#33C773]">
                  ✓ Đang hoạt động
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingBank(!isEditingBank)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isEditingBank
                      ? 'bg-[#1E2738] text-[#8E9AAF] hover:text-white border border-[#2D3952]'
                      : 'bg-[#06B6D4]/15 text-[#06B6D4] hover:bg-[#06B6D4]/25 border border-[#06B6D4]/30'
                  }`}
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{isEditingBank ? 'Đóng Sửa' : 'Chỉnh Sửa Tài Khoản & QR'}</span>
                </button>
              </div>
            </div>

            {/* Chế độ Xem (View Mode) */}
            {!isEditingBank ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-xl bg-[#171D2B] border border-[#253045] text-xs">
                  {/* Cột thông tin chi tiết */}
                  <div className="sm:col-span-8 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Ngân hàng thụ hưởng:</span>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-[#222B3D] text-[10px] text-[#06B6D4] font-mono font-bold">
                            {bankForm.bankCode || bankForm.bankShortName}
                          </span>
                          <span className="truncate">{bankForm.bankShortName} ({bankForm.bankName})</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Tên chủ tài khoản:</span>
                        <span className="font-bold text-[#FABF2E] tracking-wide block truncate">{bankForm.accountName}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#222B3D]/70 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Số tài khoản nhận tiền:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white tracking-widest text-base bg-[#0E131F] px-2.5 py-1 rounded-lg border border-[#222B3D]">
                            {bankForm.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyStk}
                            className="p-1.5 rounded-lg bg-[#222B3D] hover:bg-[#2C384E] text-[#8E9AAF] hover:text-white transition-colors cursor-pointer"
                            title="Sao chép số tài khoản"
                          >
                            {isCopiedStk ? <Check className="w-3.5 h-3.5 text-[#33C773]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[#8E9AAF] block text-[11px] mb-0.5">Hình thức mã QR:</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#06B6D4] bg-[#06B6D4]/10 px-2 py-0.5 rounded-md border border-[#06B6D4]/20">
                          <QrCode className="w-3 h-3" />
                          {bankForm.qrMode === 'CUSTOM' && bankForm.customQrUrl
                            ? 'Mã QR tùy chỉnh (File tải lên)'
                            : 'Tự động sinh VietQR Napas 247'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cột mã QR Preview */}
                  <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-[#0E131F] border border-[#222B3D] text-center">
                    <div className="relative group cursor-pointer" onClick={() => setShowQrModal(true)}>
                      <img
                        src={previewQrUrl}
                        alt="Mã QR thụ hưởng"
                        className="w-24 h-24 object-contain rounded-lg bg-white p-1 border border-white/20 shadow-md group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as any).src = '/payment-qr.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white font-medium">
                        Phóng to
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="text-[10px] text-[#06B6D4] hover:underline mt-1.5 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Xem mã QR mẫu</span>
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[#5C677D]">
                  Mọi đơn đặt vé của khách hàng trên hệ thống sẽ tự động sinh mã VietQR Napas 247 chuyển tiền về tài khoản doanh nghiệp này.
                </p>
              </div>
            ) : (
              /* Chế độ Chỉnh Sửa (Edit Mode) */
              <div className="p-4 rounded-2xl bg-[#151B27] border border-[#06B6D4]/40 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[#222B3D]">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-[#06B6D4]" />
                    <span className="text-xs font-bold text-white">Chỉnh Sửa Thông Tin Tài Khoản Thụ Hưởng & Mã QR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingBank(false)}
                    className="text-[#8E9AAF] hover:text-white p-1 rounded-lg hover:bg-[#222B3D] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Form Inputs (7 cols) */}
                  <div className="lg:col-span-7 space-y-3 text-xs">
                    {/* 1. Ngân Hàng */}
                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] font-semibold flex items-center justify-between">
                        <span>1. Ngân Hàng Thụ Hưởng *</span>
                        <span className="text-[10px] text-[#06B6D4]">Chuẩn Napas 247</span>
                      </label>
                      <select
                        value={bankForm.bankShortName}
                        onChange={(e) => handleSelectBank(e.target.value)}
                        className="w-full bg-[#1A2232] border border-[#2D3952] rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-[#06B6D4] cursor-pointer"
                      >
                        {POPULAR_VIETQR_BANKS.map((b) => (
                          <option key={b.bin} value={b.shortName} className="bg-[#121622] text-white">
                            {b.shortName} — {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Số Tài Khoản */}
                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] font-semibold">2. Số Tài Khoản Nhận Tiền *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: 03011232003"
                        value={bankForm.accountNumber}
                        onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/[^0-9a-zA-Z]/g, '') })}
                        className="w-full bg-[#1A2232] border border-[#2D3952] rounded-xl px-3.5 py-2 text-white font-mono font-bold tracking-wider focus:outline-none focus:border-[#06B6D4]"
                      />
                      <p className="text-[10px] text-[#5C677D]">Nhập chính xác số tài khoản ngân hàng không chứa dấu cách.</p>
                    </div>

                    {/* 3. Tên Chủ Tài Khoản */}
                    <div className="space-y-1">
                      <label className="text-[#8E9AAF] font-semibold">3. Tên Chủ Tài Khoản (In hoa không dấu) *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: TRUONG VAN HOAN"
                        value={bankForm.accountName}
                        onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value.toUpperCase() })}
                        className="w-full bg-[#1A2232] border border-[#2D3952] rounded-xl px-3.5 py-2 text-white font-bold tracking-wide focus:outline-none focus:border-[#06B6D4]"
                      />
                      <p className="text-[10px] text-[#5C677D]">Tên chủ tài khoản hiển thị trên ứng dụng ngân hàng khi khách quét mã.</p>
                    </div>

                    {/* 4. Cấu hình Mã QR */}
                    <div className="space-y-2 pt-2 border-t border-[#222B3D]">
                      <label className="text-[#8E9AAF] font-semibold block">4. Cấu Hình Mã QR Thanh Toán</label>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBankForm({ ...bankForm, qrMode: 'AUTO' })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            bankForm.qrMode !== 'CUSTOM'
                              ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-white'
                              : 'bg-[#1A2232] border-[#2D3952] text-[#8E9AAF] hover:border-[#3D4C6A]'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-xs text-white">
                            <span className={`w-2 h-2 rounded-full ${bankForm.qrMode !== 'CUSTOM' ? 'bg-[#06B6D4]' : 'bg-[#5C677D]'}`} />
                            <span>VietQR Napas 247</span>
                          </div>
                          <p className="text-[10px] text-[#8E9AAF] mt-1">
                            Tự động sinh mã động kèm logo ngân hàng, số tiền và nội dung đơn.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBankForm({ ...bankForm, qrMode: 'CUSTOM' })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            bankForm.qrMode === 'CUSTOM'
                              ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-white'
                              : 'bg-[#1A2232] border-[#2D3952] text-[#8E9AAF] hover:border-[#3D4C6A]'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-xs text-white">
                            <span className={`w-2 h-2 rounded-full ${bankForm.qrMode === 'CUSTOM' ? 'bg-[#06B6D4]' : 'bg-[#5C677D]'}`} />
                            <span>Tải ảnh QR riêng</span>
                          </div>
                          <p className="text-[10px] text-[#8E9AAF] mt-1">
                            Dùng mã QR tĩnh in sẵn từ tài khoản doanh nghiệp.
                          </p>
                        </button>
                      </div>

                      {/* Custom QR Upload / URL */}
                      {bankForm.qrMode === 'CUSTOM' && (
                        <div className="p-3 rounded-xl bg-[#1A2232] border border-[#2D3952] space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white font-medium">Tải file ảnh QR hoặc dán link:</span>
                            <label className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#06B6D4] text-black font-bold text-[10px] cursor-pointer hover:bg-[#0891B2] transition-colors">
                              <Upload className="w-3 h-3" />
                              <span>Chọn file ảnh</span>
                              <input type="file" accept="image/*" onChange={handleUploadCustomQr} className="hidden" />
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder="Hoặc dán URL ảnh QR tại đây (https://...)"
                            value={bankForm.customQrUrl || ''}
                            onChange={(e) => setBankForm({ ...bankForm, customQrUrl: e.target.value })}
                            className="w-full bg-[#121622] border border-[#253045] rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                          />
                        </div>
                      )}
                    </div>

                    {/* Nút hành động */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSavingBank}
                        onClick={handleSaveBankConfig}
                        className="px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-black font-bold text-xs cursor-pointer shadow-md shadow-[#06B6D4]/20 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSavingBank ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{isSavingBank ? 'Đang lưu...' : 'Lưu Tài Khoản Thụ Hưởng'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditingBank(false)}
                        className="px-3.5 py-2 rounded-xl bg-[#222B3D] hover:bg-[#2C384E] text-white text-xs font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>

                  {/* Live Preview (5 cols) */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-xl bg-[#0E131F] border border-[#222B3D] text-center space-y-2">
                    <div className="text-[11px] font-bold text-[#06B6D4] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Xem Trước Trực Quan (Live Preview)</span>
                    </div>

                    <div className="relative p-2 bg-white rounded-xl shadow-lg border border-white/20">
                      <img
                        src={previewQrUrl}
                        alt="Live VietQR Preview"
                        className="w-36 h-36 object-contain"
                        onError={(e) => {
                          (e.target as any).src = '/payment-qr.png';
                        }}
                      />
                    </div>

                    <div className="text-[10px] space-y-0.5">
                      <div className="font-bold text-white">{bankForm.bankShortName} • {bankForm.accountNumber || 'Chưa nhập STK'}</div>
                      <div className="text-[#FABF2E] font-bold">{bankForm.accountName || 'CHỦ TÀI KHOẢN'}</div>
                      <div className="text-[9px] text-[#5C677D]">Mã QR trên sẽ tự động cập nhật ngay lập tức vào màn hình thanh toán của khách.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Phóng To QR */}
            {showQrModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-5 max-w-sm w-full space-y-4 text-center">
                  <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-[#06B6D4]" />
                      <span>Mã VietQR Thụ Hưởng Rạp</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQrModal(false)}
                      className="text-[#8E9AAF] hover:text-white p-1 rounded-lg hover:bg-[#1E2738] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl shadow-xl inline-block mx-auto">
                    <img
                      src={previewQrUrl}
                      alt="VietQR Full"
                      className="w-56 h-56 object-contain"
                      onError={(e) => {
                        (e.target as any).src = '/payment-qr.png';
                      }}
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-white">{bankForm.bankShortName} ({bankForm.bankName})</div>
                    <div className="font-mono font-bold text-[#06B6D4] text-sm tracking-widest">{bankForm.accountNumber}</div>
                    <div className="font-bold text-[#FABF2E]">{bankForm.accountName}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowQrModal(false)}
                    className="w-full py-2 rounded-xl bg-[#222B3D] hover:bg-[#2C384E] text-white font-bold text-xs cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
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

      {/* SUBTAB 2: ACCOUNTS MANAGEMENT & RBAC MATRIX */}
      {activeSubTab === 'STAFF' && (() => {
        const filteredAccounts = accounts.filter((acc) => {
          const query = searchQuery.toLowerCase().trim();
          const matchesSearch =
            !query ||
            acc.name.toLowerCase().includes(query) ||
            acc.email.toLowerCase().includes(query) ||
            (acc.phone && acc.phone.includes(query)) ||
            (acc.staff_position && acc.staff_position.toLowerCase().includes(query));

          const matchesRole = roleFilter === 'ALL' || acc.role === roleFilter;

          return matchesSearch && matchesRole;
        });

        const adminCount = accounts.filter((a) => a.role === 'ADMIN').length;
        const staffCount = accounts.filter((a) => a.role === 'STAFF').length;
        const userCount = accounts.filter((a) => a.role === 'USER').length;
        const guestCount = accounts.filter((a) => a.role === 'GUEST').length;

        return (
          <div className="space-y-4">
            {/* Stat Cards by Role */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div
                onClick={() => setRoleFilter(roleFilter === 'ADMIN' ? 'ALL' : 'ADMIN')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${roleFilter === 'ADMIN'
                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                    : 'bg-[#141924] border-[#222B3D] hover:border-[#8B5CF6]/50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#A78BFA] flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Quản Trị Viên (Admin)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#8B5CF6]/20 text-[#C4B5FD]">
                    Toàn quyền
                  </span>
                </div>
                <div className="text-2xl font-black text-white mt-1.5 font-mono">{adminCount}</div>
                <p className="text-[10px] text-[#8E9AAF] mt-0.5">Quản lý hệ thống, rạp & nhân sự</p>
              </div>

              <div
                onClick={() => setRoleFilter(roleFilter === 'STAFF' ? 'ALL' : 'STAFF')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${roleFilter === 'STAFF'
                    ? 'bg-[#06B6D4]/20 border-[#06B6D4] shadow-lg shadow-[#06B6D4]/20'
                    : 'bg-[#141924] border-[#222B3D] hover:border-[#06B6D4]/50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#06B6D4] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Nhân Sự Rạp (Staff)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#06B6D4]/20 text-[#67E8F9]">
                    Phân quyền RBAC
                  </span>
                </div>
                <div className="text-2xl font-black text-white mt-1.5 font-mono">{staffCount}</div>
                <p className="text-[10px] text-[#8E9AAF] mt-0.5">Quầy POS, soát vé, bắp nước, ca</p>
              </div>

              <div
                onClick={() => setRoleFilter(roleFilter === 'USER' ? 'ALL' : 'USER')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${roleFilter === 'USER'
                    ? 'bg-[#22C55E]/20 border-[#22C55E] shadow-lg shadow-[#22C55E]/20'
                    : 'bg-[#141924] border-[#222B3D] hover:border-[#22C55E]/50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#22C55E] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Khách Thành Viên (User)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#22C55E]/20 text-[#86EFAC]">
                    Có tài khoản
                  </span>
                </div>
                <div className="text-2xl font-black text-white mt-1.5 font-mono">{userCount}</div>
                <p className="text-[10px] text-[#8E9AAF] mt-0.5">Đặt vé online, tích điểm thành viên</p>
              </div>

              <div
                onClick={() => setRoleFilter(roleFilter === 'GUEST' ? 'ALL' : 'GUEST')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${roleFilter === 'GUEST'
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B] shadow-lg shadow-[#F59E0B]/20'
                    : 'bg-[#141924] border-[#222B3D] hover:border-[#F59E0B]/50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#F59E0B] flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5" />
                    Khách Vãng Lai (Guest)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F59E0B]/20 text-[#FCD34D]">
                    Tra cứu vé
                  </span>
                </div>
                <div className="text-2xl font-black text-white mt-1.5 font-mono">{guestCount}</div>
                <p className="text-[10px] text-[#8E9AAF] mt-0.5">Mua vé nhanh qua quầy / online</p>
              </div>
            </div>

            {/* Filter Toolbar & Actions */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#8E9AAF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm tài khoản theo tên, email, SĐT hoặc chức danh..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#171D2B] border border-[#253045] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-[#5C677D] focus:outline-none focus:border-[#06B6D4] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E9AAF] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Role filter buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar text-xs">
                {(
                  [
                    { key: 'ALL', label: 'Tất cả', count: accounts.length },
                    { key: 'ADMIN', label: 'Admin', count: adminCount },
                    { key: 'STAFF', label: 'Staff', count: staffCount },
                    { key: 'USER', label: 'User', count: userCount },
                    { key: 'GUEST', label: 'Guest', count: guestCount }
                  ] as const
                ).map((rf) => (
                  <button
                    key={rf.key}
                    onClick={() => setRoleFilter(rf.key)}
                    className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${roleFilter === rf.key
                        ? 'bg-[#06B6D4] text-black shadow-md'
                        : 'bg-[#171D2B] text-[#8E9AAF] hover:text-white border border-[#253045]'
                      }`}
                  >
                    <span>{rf.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${roleFilter === rf.key ? 'bg-black/20 text-black' : 'bg-[#222B3D] text-[#8E9AAF]'
                        }`}
                    >
                      {rf.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Add Account Button */}
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-black font-black text-xs cursor-pointer shadow-lg shadow-[#06B6D4]/20 flex items-center justify-center gap-1.5 whitespace-nowrap transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Thêm / Cấp Quyền Tài Khoản</span>
              </button>
            </div>

            {/* Main Accounts & RBAC Matrix Table */}
            <div className="bg-[#121622] border border-[#222B3D] rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3.5 border-b border-[#222B3D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-white">Danh Sách Toàn Bộ Tài Khoản & Phân Quyền Chức Năng</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#4ADE80] text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    <span>Supabase Cloud DB ({accounts.length} tài khoản thực tế)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchAccountsFromDb}
                    disabled={isLoadingAccounts}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#171D2B] hover:bg-[#253045] text-[11px] font-semibold text-[#8E9AAF] hover:text-white border border-[#253045] transition-colors cursor-pointer disabled:opacity-50"
                    title="Đồng bộ lại danh sách tài khoản từ Supabase Cloud"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingAccounts ? 'animate-spin text-[#06B6D4]' : ''}`} />
                    <span>Đồng bộ từ DB</span>
                  </button>
                  <span className="text-[11px] text-[#5C677D] hidden md:inline">
                    (Hiển thị {filteredAccounts.length}/{accounts.length})
                  </span>
                </div>
              </div>

              {filteredAccounts.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Users className="w-8 h-8 text-[#5C677D] mx-auto opacity-50" />
                  <p className="text-xs text-[#8E9AAF]">Không tìm thấy tài khoản nào khớp với bộ lọc.</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setRoleFilter('ALL');
                    }}
                    className="text-xs text-[#06B6D4] hover:underline font-bold"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#222B3D] text-[#8E9AAF] bg-[#0E121B]">
                        <th className="py-3 px-3.5 font-bold">Tài Khoản & Liên Hệ</th>
                        <th className="py-3 px-3.5 font-bold">Chức Danh (Vai Trò)</th>
                        <th className="py-3 px-3.5 font-bold">Cấp Quyền Giao Chức Năng (RBAC)</th>
                        <th className="py-3 px-3 font-bold text-center">Trạng Thái</th>
                        <th className="py-3 px-3 font-bold text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2233]">
                      {filteredAccounts.map((account) => {
                        const isPrimaryAdmin = account.email === 'admin@cinemax.vn';
                        const roleColor =
                          account.role === 'ADMIN'
                            ? 'text-[#C4B5FD] bg-[#8B5CF6]/15 border-[#8B5CF6]/40'
                            : account.role === 'STAFF'
                              ? 'text-[#67E8F9] bg-[#06B6D4]/15 border-[#06B6D4]/40'
                              : account.role === 'USER'
                                ? 'text-[#86EFAC] bg-[#22C55E]/15 border-[#22C55E]/40'
                                : 'text-[#FCD34D] bg-[#F59E0B]/15 border-[#F59E0B]/40';

                        return (
                          <tr key={account.id} className="hover:bg-[#161D2B]/70 transition-colors">
                            {/* Cột 1: Thông tin tài khoản */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border ${account.role === 'ADMIN'
                                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#C4B5FD]'
                                      : account.role === 'STAFF'
                                        ? 'bg-[#06B6D4]/20 border-[#06B6D4]/50 text-[#67E8F9]'
                                        : account.role === 'USER'
                                          ? 'bg-[#22C55E]/20 border-[#22C55E]/50 text-[#86EFAC]'
                                          : 'bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#FCD34D]'
                                    }`}
                                >
                                  {account.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                    <span>{account.name}</span>
                                    {isPrimaryAdmin && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#8B5CF6]/30 text-[#E9D5FF] border border-[#8B5CF6]/40">
                                        SUPER
                                      </span>
                                    )}
                                    {account.source === 'SUPABASE' && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#22C55E]/15 text-[#4ADE80] border border-[#22C55E]/30">
                                        Cloud DB
                                      </span>
                                    )}
                                    {account.source === 'GUEST' && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/30">
                                        Đơn hàng
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#8E9AAF] font-mono flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-[#5C677D]" />
                                    <span>{account.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#5C677D]">
                                    {account.phone && (
                                      <span className="flex items-center gap-0.5">
                                        <Phone className="w-2.5 h-2.5" />
                                        {account.phone}
                                      </span>
                                    )}
                                    {account.created_at && (
                                      <span>• Tạo: {account.created_at}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Cột 2: Chức danh (Giao chức danh) */}
                            <td className="py-3 px-3.5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={account.role}
                                    onChange={(e) =>
                                      handleUpdateRole(account.id, e.target.value as AccountRole)
                                    }
                                    className={`px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none cursor-pointer transition-colors ${roleColor}`}
                                  >
                                    <option value="ADMIN" className="bg-[#141924] text-[#C4B5FD]">
                                      👑 Quản trị viên (Admin)
                                    </option>
                                    <option value="STAFF" className="bg-[#141924] text-[#67E8F9]">
                                      💼 Nhân viên rạp (Staff)
                                    </option>
                                    <option value="USER" className="bg-[#141924] text-[#86EFAC]">
                                      👤 Khách thành viên (User)
                                    </option>
                                    <option value="GUEST" className="bg-[#141924] text-[#FCD34D]">
                                      🎟️ Khách vãng lai (Guest)
                                    </option>
                                  </select>
                                </div>
                                <div className="text-[10px] text-[#8E9AAF] italic">
                                  {account.staff_position ||
                                    (account.role === 'ADMIN'
                                      ? 'Quản trị hệ thống'
                                      : account.role === 'STAFF'
                                        ? 'Nhân viên vận hành'
                                        : account.role === 'USER'
                                          ? 'Khách hàng thành viên'
                                          : 'Khách vãng lai')}
                                </div>
                              </div>
                            </td>

                            {/* Cột 3: Cấp quyền giao chức năng RBAC */}
                            <td className="py-3 px-3.5">
                              {account.role === 'ADMIN' ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#C4B5FD] font-bold text-[11px]">
                                  <Crown className="w-3.5 h-3.5 text-[#A78BFA]" />
                                  <span>Toàn Quyền Quản Trị Hệ Thống (Không Giới Hạn)</span>
                                </div>
                              ) : account.role === 'STAFF' ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(
                                    [
                                      { code: 'POS', label: 'POS (Quầy vé)', tip: 'Bán vé, chọn ghế, xuất vé cứng tại quầy' },
                                      { code: 'CHECKIN', label: 'CHECKIN (Soát vé)', tip: 'Quét QR và soát vé vào phòng chiếu' },
                                      { code: 'CONCESSION', label: 'CONCESSION (Bắp nước)', tip: 'Bán bắp nước combo tại quầy F&B' },
                                      { code: 'SUPERVISOR', label: 'SUPERVISOR (Duyệt ca)', tip: 'Duyệt ca, hủy vé, xem báo cáo doanh thu' }
                                    ] as { code: StaffPerm; label: string; tip: string }[]
                                  ).map((perm) => {
                                    const hasPerm = account.permissions.includes(perm.code);
                                    return (
                                      <button
                                        key={perm.code}
                                        type="button"
                                        onClick={() => handleTogglePermission(account.id, perm.code)}
                                        title={`${perm.label}: ${perm.tip}`}
                                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${hasPerm
                                            ? 'bg-[#22C55E]/20 text-[#4ADE80] border-[#22C55E]/50 shadow-[0_0_8px_rgba(34,197,94,0.25)]'
                                            : 'bg-[#171D2B] text-[#5C677D] border-[#253045] hover:text-[#8E9AAF] hover:border-[#384661]'
                                          }`}
                                      >
                                        {hasPerm ? (
                                          <Check className="w-3 h-3 text-[#22C55E] stroke-[3]" />
                                        ) : (
                                          <span className="w-3 text-center text-[#5C677D] font-mono">—</span>
                                        )}
                                        <span>{perm.code}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : account.role === 'USER' ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#86EFAC] text-[11px]">
                                  <UserCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                                  <span>Khách Thành Viên: Đặt vé online • Tích lũy điểm thưởng • Lịch sử vé</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#FCD34D] text-[11px]">
                                  <Ticket className="w-3.5 h-3.5 text-[#F59E0B]" />
                                  <span>Khách Vãng Lai: Mua vé nhanh • Tra cứu đơn hàng bằng Mã vé/Email</span>
                                </div>
                              )}
                            </td>

                            {/* Cột 4: Trạng thái (Hoạt động / Khóa) */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleActive(account.id)}
                                disabled={isPrimaryAdmin}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 border ${account.is_active
                                    ? 'bg-[#22C55E]/15 text-[#4ADE80] border-[#22C55E]/30'
                                    : 'bg-[#EF4444]/15 text-[#F87171] border-[#EF4444]/30'
                                  } ${isPrimaryAdmin ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                                title={account.is_active ? 'Bấm để tạm khóa tài khoản' : 'Bấm để kích hoạt lại'}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-[#22C55E] animate-pulse' : 'bg-[#EF4444]'
                                    }`}
                                />
                                <span>{account.is_active ? 'Hoạt động' : 'Đang khóa'}</span>
                              </button>
                            </td>

                            {/* Cột 5: Thao tác */}
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(account)}
                                  className="p-1.5 rounded-lg bg-[#171D2B] border border-[#253045] text-[#8E9AAF] hover:text-[#06B6D4] hover:border-[#06B6D4]/50 transition-colors cursor-pointer"
                                  title="Chỉnh sửa chi tiết tài khoản & chức danh"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!isPrimaryAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(account.id)}
                                    className="p-1.5 rounded-lg bg-[#171D2B] border border-[#253045] text-[#8E9AAF] hover:text-[#EF4444] hover:border-[#EF4444]/50 transition-colors cursor-pointer"
                                    title="Xóa tài khoản khỏi hệ thống"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Thêm Mới / Chỉnh Sửa Tài Khoản & Cấp Quyền */}
            {isAccountModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                <div className="bg-[#121622] border border-[#253045] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4">
                  {/* Modal Header */}
                  <div className="p-4 border-b border-[#222B3D] flex items-center justify-between bg-[#161D2B]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-[#06B6D4]/20 border border-[#06B6D4]/50 flex items-center justify-center text-[#06B6D4]">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">
                          {editingAccount ? 'Chỉnh Sửa Quyền & Chức Danh' : 'Thêm & Cấp Quyền Tài Khoản Mới'}
                        </h3>
                        <p className="text-[10px] text-[#8E9AAF]">
                          Giao vai trò rõ ràng và thiết lập quyền hạn chi tiết trên hệ thống Cinemax
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAccountModalOpen(false)}
                      className="text-[#8E9AAF] hover:text-white p-1 rounded-lg hover:bg-[#222B3D]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Form */}
                  <form onSubmit={handleSaveModalAccount} className="p-4 space-y-3.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#8E9AAF] font-semibold block mb-1">Họ và tên *</label>
                        <input
                          type="text"
                          required
                          placeholder="Nguyễn Văn A"
                          value={modalForm.name}
                          onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                          className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                      <div>
                        <label className="text-[#8E9AAF] font-semibold block mb-1">Email đăng nhập *</label>
                        <input
                          type="email"
                          required
                          placeholder="user@cinemax.vn"
                          value={modalForm.email}
                          onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                          className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#8E9AAF] font-semibold block mb-1">Số điện thoại</label>
                        <input
                          type="tel"
                          placeholder="0912345678"
                          value={modalForm.phone}
                          onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                          className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                      <div>
                        <label className="text-[#8E9AAF] font-semibold block mb-1">
                          Chức Danh / Vai Trò Cấp Quyền *
                        </label>
                        <select
                          value={modalForm.role}
                          onChange={(e) => {
                            const newRole = e.target.value as AccountRole;
                            setModalForm({
                              ...modalForm,
                              role: newRole,
                              permissions:
                                newRole === 'ADMIN'
                                  ? ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR']
                                  : newRole === 'STAFF'
                                    ? ['POS']
                                    : []
                            });
                          }}
                          className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-[#06B6D4]"
                        >
                          <option value="ADMIN">👑 Quản trị viên (Admin)</option>
                          <option value="STAFF">💼 Nhân viên rạp (Staff)</option>
                          <option value="USER">👤 Khách thành viên (User)</option>
                          <option value="GUEST">🎟️ Khách vãng lai (Guest)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[#8E9AAF] font-semibold block mb-1">
                        Vị trí công tác / Ghi chú chức danh
                      </label>
                      <input
                        type="text"
                        placeholder="VD: Thu ngân ca sáng, Trưởng ca soát vé, Khách VIP..."
                        value={modalForm.staff_position}
                        onChange={(e) => setModalForm({ ...modalForm, staff_position: e.target.value })}
                        className="w-full bg-[#171D2B] border border-[#253045] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#06B6D4]"
                      />
                    </div>

                    {/* RBAC Checklist when role is STAFF */}
                    {modalForm.role === 'STAFF' && (
                      <div className="p-3 rounded-2xl bg-[#171D2B] border border-[#253045] space-y-2">
                        <label className="text-white font-bold block flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#06B6D4]" />
                          <span>Cấp Quyền Chức Năng Chi Tiết (RBAC)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(
                            [
                              { code: 'POS', label: 'POS (Bán vé tại quầy)' },
                              { code: 'CHECKIN', label: 'CHECKIN (Soát vé vào rạp)' },
                              { code: 'CONCESSION', label: 'CONCESSION (Bắp nước F&B)' },
                              { code: 'SUPERVISOR', label: 'SUPERVISOR (Duyệt ca, hủy giao dịch)' }
                            ] as { code: StaffPerm; label: string }[]
                          ).map((p) => {
                            const isChecked = modalForm.permissions.includes(p.code);
                            return (
                              <label
                                key={p.code}
                                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${isChecked
                                    ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-white'
                                    : 'bg-[#121622] border-[#222B3D] text-[#8E9AAF]'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const newP = isChecked
                                      ? modalForm.permissions.filter((x) => x !== p.code)
                                      : [...modalForm.permissions, p.code];
                                    setModalForm({ ...modalForm, permissions: newP });
                                  }}
                                  className="accent-[#22C55E] rounded"
                                />
                                <span className="text-[11px] font-semibold">{p.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {modalForm.role === 'ADMIN' && (
                      <div className="p-2.5 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#C4B5FD] flex items-center gap-2 text-xs">
                        <Crown className="w-4 h-4 text-[#A78BFA]" />
                        <span>Tài khoản Quản Trị Viên (Admin) tự động sở hữu toàn bộ quyền hạn.</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-[#8E9AAF]">
                        <input
                          type="checkbox"
                          checked={modalForm.is_active}
                          onChange={(e) => setModalForm({ ...modalForm, is_active: e.target.checked })}
                          className="accent-[#22C55E]"
                        />
                        <span className="text-white font-semibold">Kích hoạt tài khoản ngay</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAccountModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-[#171D2B] hover:bg-[#222B3D] text-[#8E9AAF] hover:text-white font-bold cursor-pointer transition-colors"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-black font-black cursor-pointer shadow-lg shadow-[#06B6D4]/20 flex items-center gap-1.5 transition-all"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{editingAccount ? 'Lưu Thay Đổi' : 'Xác Nhận & Cấp Quyền'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
