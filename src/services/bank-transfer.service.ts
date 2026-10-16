/**
 * Dịch vụ Đối Soát & Kiểm Tra Giao Dịch Chuyển Khoản Ngân Hàng (VietQR/Bank Verification)
 * Tự động kiểm tra biến động số dư ngân hàng theo mã đơn hàng và số tiền thực tế.
 */

export interface BankTransaction {
  id: string;
  transactionId: string; // Mã giao dịch ngân hàng (VD: FT26101689234)
  orderCode: string;     // Mã đơn đặt vé cần khớp (VD: CNM261016-A8F2K)
  amount: number;        // Số tiền chuyển
  senderBank: string;    // Ngân hàng chuyển (Vietcombank, MB, Techcombank, TPBank, ...)
  receiverBank: string;  // TPBank (Ngân hàng nhận của CINEMAX)
  accountNumber: string; // 08341902000
  accountName: string;   // TRUONG CONG TIEN
  description: string;   // Nội dung chuyển khoản
  transactionTime: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

const STORAGE_KEY = 'cinemax_bank_transactions';

export class BankTransferService {
  /**
   * Lấy toàn bộ lịch sử giao dịch chuyển khoản đã ghi nhận từ ngân hàng
   */
  public static getAllTransactions(): BankTransaction[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Lỗi đọc cinemax_bank_transactions:', e);
      return [];
    }
  }

  /**
   * Lưu giao dịch mới nhận được từ Webhook ngân hàng / Casso / SeAPay / Quản trị viên
   */
  public static recordIncomingTransaction(
    tx: Omit<BankTransaction, 'id' | 'transactionTime'>
  ): BankTransaction {
    const newTx: BankTransaction = {
      ...tx,
      id: `BTX-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      transactionTime: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      const list = this.getAllTransactions();
      list.unshift(newTx);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      // Phát sự kiện toàn hệ thống
      window.dispatchEvent(
        new CustomEvent('cinemax_bank_transaction_received', { detail: newTx })
      );
      window.dispatchEvent(new Event('storage'));
    }

    return newTx;
  }

  /**
   * Kiểm tra xem đơn hàng đã được chuyển khoản thành công chưa
   * Chuẩn đối soát:
   * 1. Nội dung chuyển tiền chứa đúng `orderCode` (không phân biệt hoa thường)
   * 2. Số tiền chuyển `amount >= expectedAmount` (cho phép làm tròn hoặc chuyển dư, không chấp nhận thiếu)
   */
  public static checkTransactionByOrderCode(
    orderCode: string,
    expectedAmount: number
  ): {
    verified: boolean;
    transaction?: BankTransaction;
    message: string;
  } {
    if (!orderCode) {
      return { verified: false, message: 'Mã đơn hàng không hợp lệ' };
    }

    const cleanOrderCode = orderCode.trim().toUpperCase();
    const transactions = this.getAllTransactions();

    // 1. Tìm giao dịch ngân hàng khớp mã đơn
    const matchedTx = transactions.find((t) => {
      const desc = (t.description || '').toUpperCase();
      const codeInTx = (t.orderCode || '').toUpperCase();
      return (desc.includes(cleanOrderCode) || codeInTx === cleanOrderCode) && t.status === 'SUCCESS';
    });

    if (!matchedTx) {
      // Cũng kiểm tra xem đơn hàng đã được đánh dấu thanh toán trong cinemax_user_tickets chưa (ví dụ admin đã duyệt tay)
      if (typeof window !== 'undefined') {
        const storedTickets = localStorage.getItem('cinemax_user_tickets');
        if (storedTickets) {
          try {
            const tickets = JSON.parse(storedTickets);
            const foundTicket = tickets.find(
              (t: any) =>
                (t.bookingCode?.toUpperCase() === cleanOrderCode || t.id === cleanOrderCode) &&
                t.status === 'ĐÃ THANH TOÁN'
            );
            if (foundTicket) {
              return {
                verified: true,
                message: 'Đơn hàng đã được quản trị viên duyệt thanh toán thành công!',
                transaction: {
                  id: 'ADMIN-CONFIRM-' + Date.now(),
                  transactionId: 'FT-ADMIN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
                  orderCode: cleanOrderCode,
                  amount: expectedAmount,
                  senderBank: 'Hệ thống CINEMAX',
                  receiverBank: 'TPBank',
                  accountNumber: '08341902000',
                  accountName: 'TRUONG CONG TIEN',
                  description: `Duyet tay don ${cleanOrderCode}`,
                  transactionTime: new Date().toISOString(),
                  status: 'SUCCESS',
                },
              };
            }
          } catch (e) {
            // ignore
          }
        }
      }

      return {
        verified: false,
        message: 'Đang chờ hệ thống ngân hàng ghi nhận biến động số dư...',
      };
    }

    // 2. Đối soát số tiền
    if (matchedTx.amount < expectedAmount) {
      return {
        verified: false,
        transaction: matchedTx,
        message: `Số tiền chuyển (${matchedTx.amount.toLocaleString(
          'vi-VN'
        )} đ) nhỏ hơn số tiền cần thanh toán (${expectedAmount.toLocaleString('vi-VN')} đ).`,
      };
    }

    return {
      verified: true,
      transaction: matchedTx,
      message: 'Giao dịch chuyển khoản đã được xác nhận thành công từ ngân hàng!',
    };
  }

  /**
   * Giả lập khách hàng đã quét QR và chuyển tiền thành công từ App ngân hàng
   * Phục vụ test/demo đồ án và kiểm thử luồng realtime không cần tài khoản bank thật
   */
  public static simulateCustomerTransfer(
    orderCode: string,
    amount: number,
    senderBank: string = 'Vietcombank (Demo)'
  ): BankTransaction {
    const randomFT = 'FT26' + Math.floor(10000000 + Math.random() * 90000000);
    return this.recordIncomingTransaction({
      transactionId: randomFT,
      orderCode: orderCode.trim().toUpperCase(),
      amount,
      senderBank,
      receiverBank: 'TPBank',
      accountNumber: '08341902000',
      accountName: 'TRUONG CONG TIEN',
      description: `CINEMAX ${orderCode.trim().toUpperCase()} chuyen khoan tien ve`,
      status: 'SUCCESS',
    });
  }

  /**
   * Tra cứu giao dịch theo mã bút toán ngân hàng (FT number)
   */
  public static lookupTransactionByRef(refNumber: string): BankTransaction | undefined {
    const cleanRef = refNumber.trim().toUpperCase();
    return this.getAllTransactions().find(
      (t) => t.transactionId.toUpperCase() === cleanRef || t.id.toUpperCase() === cleanRef
    );
  }
}
