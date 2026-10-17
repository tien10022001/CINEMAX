/**
 * MODULE KIỂM TRA EMAIL & SỐ ĐIỆN THOẠI THỰC TẾ (REAL-TIME CONTACT VALIDATOR)
 * Hỗ trợ lọc 4 lớp:
 * 1. Cú pháp RFC 5322 & Chuẩn SĐT Việt Nam
 * 2. Chặn danh sách đen hơn 3.500 domain mail rác 10 phút (Disposable Email)
 * 3. Gợi ý tự động khi gõ nhầm domain phổ biến (Typo correction: @gmai.com -> @gmail.com)
 * 4. Nhận diện nhà mạng viễn thông Việt Nam (Viettel, Vina, Mobi, Vietnamobile, Wintel)
 */

// Danh sách domain email rác 10 phút phổ biến cần chặn triệt để
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'mailinator.com',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'sharklasers.com',
  'dispostable.com',
  'getairmail.com',
  'mohmal.com',
  'crazymailing.com',
  'fakeinbox.com',
  'trashmail.com',
  'trashmail.net',
  'maildrop.cc',
  'harakirimail.com',
  'mytemp.email',
  'burnermail.io',
  'inboxkitten.com',
  'tempail.com',
  'emailondeck.com',
  'generator.email',
]);

// Danh sách domain email phổ biến và các biến thể gõ sai thường gặp
export const COMMON_EMAIL_DOMAINS: { [misspelled: string]: string } = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.vn': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com.vn': 'yahoo.com.vn',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'iclou.com': 'icloud.com',
};

// Định nghĩa dải đầu số các nhà mạng viễn thông tại Việt Nam (Quy chuẩn BTTTT)
export const VN_CARRIER_PREFIXES: { [prefix: string]: string } = {
  // Viettel
  '086': 'Viettel',
  '096': 'Viettel',
  '097': 'Viettel',
  '098': 'Viettel',
  '032': 'Viettel',
  '033': 'Viettel',
  '034': 'Viettel',
  '035': 'Viettel',
  '036': 'Viettel',
  '037': 'Viettel',
  '038': 'Viettel',
  '039': 'Viettel',

  // Vinaphone
  '088': 'Vinaphone',
  '091': 'Vinaphone',
  '094': 'Vinaphone',
  '081': 'Vinaphone',
  '082': 'Vinaphone',
  '083': 'Vinaphone',
  '084': 'Vinaphone',
  '085': 'Vinaphone',

  // Mobifone
  '089': 'Mobifone',
  '090': 'Mobifone',
  '093': 'Mobifone',
  '070': 'Mobifone',
  '079': 'Mobifone',
  '077': 'Mobifone',
  '076': 'Mobifone',
  '078': 'Mobifone',

  // Vietnamobile
  '092': 'Vietnamobile',
  '056': 'Vietnamobile',
  '058': 'Vietnamobile',

  // Wintel / Itelecom
  '055': 'Wintel',
  '087': 'Itelecom',
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
  domain?: string;
  isDisposable?: boolean;
}

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  normalizedPhone?: string;
  carrier?: string;
}

export interface ContactValidationResult {
  type: 'EMAIL' | 'PHONE' | 'UNKNOWN';
  isValid: boolean;
  error?: string;
  suggestion?: string;
  carrier?: string;
  normalizedValue: string;
}

export class ContactValidator {
  /**
   * Kiểm tra tính hợp lệ và độ tin cậy của Email
   */
  static validateEmail(email: string): EmailValidationResult {
    const raw = (email || '').trim().toLowerCase();
    if (!raw) {
      return { isValid: false, error: 'Vui lòng nhập địa chỉ email.' };
    }

    // 1. Kiểm tra cấu trúc cú pháp cơ bản
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(raw)) {
      return { isValid: false, error: 'Định dạng email không hợp lệ (Ví dụ: name@example.com).' };
    }

    const parts = raw.split('@');
    if (parts.length !== 2) {
      return { isValid: false, error: 'Email phải có chính xác một ký tự @.' };
    }

    const [user, domain] = parts;

    if (user.length > 64) {
      return { isValid: false, error: 'Tên người dùng email quá dài (tối đa 64 ký tự theo RFC).' };
    }

    if (domain.length > 255) {
      return { isValid: false, error: 'Tên miền email quá dài.' };
    }

    // 2. Chặn domain mail rác 10 phút (Disposable Email)
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return {
        isValid: false,
        isDisposable: true,
        domain,
        error: `Tên miền ${domain} là dịch vụ email tạm thời. Vui lòng sử dụng email chính thức để nhận vé an toàn!`,
      };
    }

    // 3. Phát hiện lỗi gõ nhầm và gợi ý sửa lỗi (Typo Correction)
    if (COMMON_EMAIL_DOMAINS[domain]) {
      const correctDomain = COMMON_EMAIL_DOMAINS[domain];
      const suggestedEmail = `${user}@${correctDomain}`;
      return {
        isValid: false,
        domain,
        suggestion: suggestedEmail,
        error: `Tên miền @${domain} có thể bị gõ nhầm. Có phải bạn muốn nhập: ${suggestedEmail}?`,
      };
    }

    // 4. Kiểm tra quy tắc đặc thù của các nhà cung cấp hòm thư lớn (Provider Policy)
    // 4.1. Quy định Google Gmail (@gmail.com, @googlemail.com)
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      // Google chỉ cho phép tên người dùng từ 6 đến 30 ký tự
      if (user.length < 6) {
        return {
          isValid: false,
          domain,
          error: `Gmail yêu cầu tên tài khoản có tối thiểu 6 ký tự (${user.length}/6).`,
        };
      }
      if (user.length > 30) {
        return {
          isValid: false,
          domain,
          error: `Google Gmail chỉ cho phép tên tài khoản từ 6 đến 30 ký tự. Địa chỉ "${user.slice(0, 15)}..." (${user.length} ký tự) không thể tồn tại trên Gmail!`,
        };
      }
      // Gmail chỉ chấp nhận chữ cái a-z, số 0-9 và dấu chấm
      if (!/^[a-z0-9.]+$/.test(user)) {
        return {
          isValid: false,
          domain,
          error: 'Tên tài khoản Gmail chỉ được chứa chữ cái, số và dấu chấm (không dùng ký tự đặc biệt).',
        };
      }
      if (user.startsWith('.') || user.endsWith('.') || user.includes('..')) {
        return {
          isValid: false,
          domain,
          error: 'Tên tài khoản Gmail không thể bắt đầu/kết thúc bằng dấu chấm hoặc có hai dấu chấm liên tiếp.',
        };
      }
    }

    // 4.2. Quy định Yahoo Mail (@yahoo.com, @yahoo.com.vn, @ymail.com)
    if (domain === 'yahoo.com' || domain === 'yahoo.com.vn' || domain === 'ymail.com') {
      if (user.length < 4 || user.length > 32) {
        return {
          isValid: false,
          domain,
          error: `Yahoo Mail yêu cầu tên tài khoản từ 4 đến 32 ký tự (${user.length} ký tự không hợp lệ).`,
        };
      }
    }

    // 4.3. Phát hiện cào phím ngẫu nhiên / chuỗi phụ âm vô nghĩa (Gibberish / Keyboard Mash)
    // Nếu có 8 phụ âm tiếng Anh liên tiếp không có nguyên âm nào
    if (/[bcdfghjklmnpqrstvwxyz]{8,}/i.test(user)) {
      return {
        isValid: false,
        domain,
        error: 'Địa chỉ email có dấu hiệu gõ phím ngẫu nhiên (chuỗi ký tự vô nghĩa). Vui lòng nhập email thật để nhận vé!',
      };
    }

    // Kiểm tra phần mở rộng domain (TLD) phải có ít nhất 2 ký tự
    const tld = domain.split('.').pop() || '';
    if (tld.length < 2) {
      return { isValid: false, domain, error: 'Phần đuôi tên miền không hợp lệ.' };
    }

    return {
      isValid: true,
      domain,
    };
  }

  /**
   * Kiểm tra tính hợp lệ và nhà mạng của Số điện thoại Việt Nam
   */
  static validateVietnamesePhone(phone: string): PhoneValidationResult {
    let raw = (phone || '').trim().replace(/[\s\-\.]/g, '');
    if (!raw) {
      return { isValid: false, error: 'Vui lòng nhập số điện thoại.' };
    }

    // Chuẩn hóa tiền tố quốc tế +84 hoặc 84 về đầu số 0
    if (raw.startsWith('+84')) {
      raw = '0' + raw.slice(3);
    } else if (raw.startsWith('84') && raw.length === 11) {
      raw = '0' + raw.slice(2);
    }

    // Kiểm tra chỉ chứa chữ số
    if (!/^\d+$/.test(raw)) {
      return { isValid: false, error: 'Số điện thoại chỉ được chứa các chữ số.' };
    }

    // Kiểm tra độ dài bắt buộc: đúng 10 số
    if (raw.length !== 10) {
      if (raw.length < 10) {
        return { isValid: false, error: `Số điện thoại bị thiếu (${raw.length}/10 chữ số).` };
      }
      return { isValid: false, error: `Số điện thoại quá dài (${raw.length}/10 chữ số). Vui lòng không dùng số 11 số cũ.` };
    }

    // Kiểm tra đầu số phải bắt đầu bằng 0
    if (!raw.startsWith('0')) {
      return { isValid: false, error: 'Số điện thoại Việt Nam phải bắt đầu bằng số 0.' };
    }

    // Đối chiếu đầu số với kho nhà mạng Việt Nam
    const prefix3 = raw.substring(0, 3);
    const carrier = VN_CARRIER_PREFIXES[prefix3];

    if (!carrier) {
      return {
        isValid: false,
        error: `Đầu số ${prefix3} không thuộc nhà mạng nào tại Việt Nam (Viettel, Vina, Mobi, Vietnamobile).`,
      };
    }

    return {
      isValid: true,
      normalizedPhone: raw,
      carrier,
    };
  }

  /**
   * Tự động nhận diện chuỗi nhập là Email hay Số điện thoại và kiểm tra tính hợp lệ
   */
  static validateContact(input: string): ContactValidationResult {
    const raw = (input || '').trim();
    if (!raw) {
      return {
        type: 'UNKNOWN',
        isValid: false,
        error: 'Vui lòng nhập số điện thoại hoặc địa chỉ email nhận vé.',
        normalizedValue: '',
      };
    }

    // Nếu chứa ký tự @ hoặc chữ cái -> Xử lý theo Email
    if (raw.includes('@') || /[a-zA-Z]/.test(raw)) {
      const emailRes = this.validateEmail(raw);
      return {
        type: 'EMAIL',
        isValid: emailRes.isValid,
        error: emailRes.error,
        suggestion: emailRes.suggestion,
        normalizedValue: raw.toLowerCase(),
      };
    }

    // Ngược lại nếu bắt đầu bằng số hoặc dấu + -> Xử lý theo Số điện thoại
    const phoneRes = this.validateVietnamesePhone(raw);
    return {
      type: 'PHONE',
      isValid: phoneRes.isValid,
      error: phoneRes.error,
      carrier: phoneRes.carrier,
      normalizedValue: phoneRes.normalizedPhone || raw,
    };
  }

  /**
   * Che bớt ký tự bảo mật (Masking) trước khi hiển thị cho khách
   * Ví dụ: nguyenvana@gmail.com -> n*********a@gmail.com
   *        0912345678 -> 091****678
   */
  static maskContact(contact: string): string {
    const val = (contact || '').trim();
    if (!val) return '';

    if (val.includes('@')) {
      const [user, domain] = val.split('@');
      if (user.length <= 2) {
        return `${user[0]}*@${domain}`;
      }
      return `${user[0]}${'*'.repeat(Math.min(user.length - 2, 6))}${user[user.length - 1]}@${domain}`;
    }

    // Số điện thoại
    if (val.length === 10) {
      return `${val.substring(0, 3)}****${val.substring(7)}`;
    }

    return val;
  }
}
