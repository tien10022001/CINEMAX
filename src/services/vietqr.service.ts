/**
 * Dịch vụ sinh mã VietQR chuẩn ngân hàng (TPBank)
 * Người thực hiện: Trương Công Tiến (Leader)
 */

export interface VietQRParams {
  amount: number;
  orderCode: string;
}

export interface BankAccountInfo {
  bankId: string;
  bankName: string;
  bankShortName: string;
  accountNumber: string;
  accountName: string;
}

export class VietQRService {
  // Thông tin tài khoản nhận tiền chính thức của rạp
  public static readonly BANK_INFO: BankAccountInfo = {
    bankId: '970423', // Mã BIN NAPAS TPBank
    bankName: 'Ngân hàng TMCP Tiên Phong',
    bankShortName: 'TPBank',
    accountNumber: '08341902000',
    accountName: 'TRUONG CONG TIEN',
  };

  /**
   * Sinh đường dẫn ảnh mã VietQR Động (chuẩn EMVCo Napas 247)
   * Tự động nhúng số tiền và mã đơn hàng vào mã QR.
   */
  public static generateDynamicQrUrl(params: VietQRParams): string {
    const { amount, orderCode } = params;
    const memo = encodeURIComponent(orderCode);
    const accountName = encodeURIComponent(this.BANK_INFO.accountName);

    // Chuẩn Quick Link VietQR (compact2 template hỗ trợ logo và thông tin rõ ràng)
    return `https://img.vietqr.io/image/TPB-${this.BANK_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${memo}&accountName=${accountName}`;
  }

  /**
   * Ảnh QR tĩnh dự phòng trường hợp offline hoặc mất kết nối mạng bên ngoài
   */
  public static getFallbackQrUrl(): string {
    return '/payment-qr.png';
  }
}
