/**
 * Dịch vụ sinh mã VietQR Động chuẩn Napas 247 lấy cấu hình trực tiếp từ Admin
 * Cho phép Quản trị viên thay đổi Ngân hàng, Số tài khoản, Tên chủ tài khoản bất cứ lúc nào.
 */

export interface VietQRParams {
  amount: number;
  orderCode: string;
}

export interface BankAccountInfo {
  bankId: string;         // Mã BIN NAPAS
  bankName: string;       // Tên đầy đủ ngân hàng
  bankShortName: string;  // Tên viết tắt (TPBank, Vietcombank, MBBank...)
  bankCode?: string;      // Mã viết tắt VietQR (TPB, VCB, MB, TCB...)
  accountNumber: string;  // Số tài khoản nhận tiền
  accountName: string;    // Tên chủ tài khoản thụ hưởng
}

export interface BankDefinition {
  bin: string;
  shortName: string;
  code: string;
  name: string;
}

export const POPULAR_VIETQR_BANKS: BankDefinition[] = [
  { bin: '970423', shortName: 'TPBank', code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong' },
  { bin: '970436', shortName: 'Vietcombank', code: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
  { bin: '970422', shortName: 'MBBank', code: 'MB', name: 'Ngân hàng TMCP Quân Đội' },
  { bin: '970407', shortName: 'Techcombank', code: 'TCB', name: 'Ngân hàng TMCP Kỹ Thương Việt Nam' },
  { bin: '970415', shortName: 'VietinBank', code: 'CTG', name: 'Ngân hàng TMCP Công Thương Việt Nam' },
  { bin: '970418', shortName: 'BIDV', code: 'BIDV', name: 'Ngân hàng TMCP Đầu Tư & Phát Triển Việt Nam' },
  { bin: '970416', shortName: 'ACB', code: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { bin: '970432', shortName: 'VPBank', code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970403', shortName: 'Sacombank', code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { bin: '970437', shortName: 'HDBank', code: 'HDB', name: 'Ngân hàng TMCP Phát Triển TP.HCM' },
  { bin: '970448', shortName: 'OCB', code: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
  { bin: '970441', shortName: 'VIB', code: 'VIB', name: 'Ngân hàng TMCP Quốc Tế Việt Nam' },
];

const ADMIN_BANK_CONFIG_KEY = 'cinemax_admin_bank_config';

// Cấu hình ngân hàng mặc định
export const DEFAULT_BANK_INFO: BankAccountInfo = {
  bankId: '970423',
  bankName: 'Ngân hàng TMCP Tiên Phong',
  bankShortName: 'TPBank',
  bankCode: 'TPB',
  accountNumber: '08341902000',
  accountName: 'TRUONG CONG TIEN',
};

export class VietQRService {
  /**
   * Lấy cấu hình tài khoản nhận tiền do Admin thiết lập
   * Ưu tiên đọc từ cấu hình Admin trong hệ thống, nếu chưa có thì dùng mặc định
   */
  public static getBankInfo(): BankAccountInfo {
    if (typeof window === 'undefined') {
      return DEFAULT_BANK_INFO;
    }

    try {
      const stored = localStorage.getItem(ADMIN_BANK_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.accountNumber && parsed.accountName) {
          return {
            bankId: parsed.bankId || DEFAULT_BANK_INFO.bankId,
            bankName: parsed.bankName || DEFAULT_BANK_INFO.bankName,
            bankShortName: parsed.bankShortName || DEFAULT_BANK_INFO.bankShortName,
            bankCode: parsed.bankCode || this.resolveBankCode(parsed.bankShortName || 'TPBank'),
            accountNumber: parsed.accountNumber.trim(),
            accountName: parsed.accountName.trim().toUpperCase(),
          };
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc cinemax_admin_bank_config:', e);
    }

    return DEFAULT_BANK_INFO;
  }

  /**
   * Cập nhật thông tin tài khoản ngân hàng từ Admin
   */
  public static saveBankInfo(config: BankAccountInfo): void {
    if (typeof window === 'undefined') return;

    const normalized: BankAccountInfo = {
      ...config,
      accountName: config.accountName.trim().toUpperCase(),
      accountNumber: config.accountNumber.trim(),
      bankCode: config.bankCode || this.resolveBankCode(config.bankShortName),
    };

    localStorage.setItem(ADMIN_BANK_CONFIG_KEY, JSON.stringify(normalized));

    // Phát sự kiện để tất cả các màn hình đang mở (Booking Modal, Admin, v.v.) cập nhật ngay lập tức
    window.dispatchEvent(new CustomEvent('cinemax_bank_config_updated', { detail: normalized }));
    window.dispatchEvent(new Event('storage'));
  }

  /**
   * Tìm mã viết tắt VietQR (TPB, VCB, MB...) từ shortName
   */
  public static resolveBankCode(shortName: string): string {
    const found = POPULAR_VIETQR_BANKS.find(
      (b) => b.shortName.toLowerCase() === shortName.toLowerCase() || b.code.toLowerCase() === shortName.toLowerCase()
    );
    return found ? found.code : shortName.toUpperCase();
  }

  /**
   * Sinh đường dẫn ảnh mã VietQR ĐỘNG chuẩn EMVCo Napas 247
   * Lấy trực tiếp STK, Tên Chủ TK và Ngân hàng từ Admin cấu hình
   * Nhúng chính xác Số tiền và Mã đơn hàng (orderCode) vào QR
   */
  public static generateDynamicQrUrl(params: VietQRParams): string {
    const bank = this.getBankInfo();
    const bankCode = bank.bankCode || this.resolveBankCode(bank.bankShortName);
    const memo = encodeURIComponent(params.orderCode);
    const accountName = encodeURIComponent(bank.accountName);

    // Chuẩn Quick Link VietQR Napas 247 (compact2 template gồm QR + Logo ngân hàng + số tiền + nội dung)
    return `https://img.vietqr.io/image/${bankCode}-${bank.accountNumber}-compact2.png?amount=${params.amount}&addInfo=${memo}&accountName=${accountName}`;
  }

  /**
   * Sinh mã QR Preview kiểm tra thử cho Admin (không cần số tiền/nội dung cố định)
   */
  public static generatePreviewQrUrl(bankInfo: BankAccountInfo, sampleAmount: number = 100000): string {
    const bankCode = bankInfo.bankCode || this.resolveBankCode(bankInfo.bankShortName);
    const accountName = encodeURIComponent(bankInfo.accountName);
    return `https://img.vietqr.io/image/${bankCode}-${bankInfo.accountNumber}-compact2.png?amount=${sampleAmount}&addInfo=TEST%20CINEMAX&accountName=${accountName}`;
  }

  /**
   * Ảnh QR tĩnh dự phòng trường hợp offline
   */
  public static getFallbackQrUrl(): string {
    return '/payment-qr.png';
  }

  // Khả năng tương thích ngược (Getter BANK_INFO)
  public static get BANK_INFO(): BankAccountInfo {
    return this.getBankInfo();
  }
}
