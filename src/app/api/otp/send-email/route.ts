import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { EmailService } from '@/services/email.service';

const configFilePath = path.join(process.cwd(), 'src', 'data', 'email-config.json');

function getResendConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const data = fs.readFileSync(configFilePath, 'utf8');
      const cfg = JSON.parse(data);
      if (cfg.apiKey) {
        return {
          apiKey: cfg.apiKey,
          sender: cfg.sender || 'CinemaX <onboarding@resend.dev>',
        };
      }
    }
  } catch {}

  return {
    apiKey: process.env.RESEND_API_KEY || '',
    sender: process.env.EMAIL_SENDER || 'CinemaX <onboarding@resend.dev>',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toEmail, otpCode, orderCode, customerName, expiresMinutes = 10 } = body;

    if (!toEmail || !otpCode) {
      return NextResponse.json(
        { success: false, error: 'Thiếu email hoặc mã OTP' },
        { status: 400 }
      );
    }

    const { apiKey, sender } = getResendConfig();

    // 1. Nếu có API Key -> Gửi THỰC TẾ qua Cổng Resend API
    if (apiKey && apiKey.startsWith('re_')) {
      const htmlContent = EmailService.renderOtpEmailHtml({
        otpCode,
        orderCode: orderCode || 'DON-HANG-GUEST',
        customerName: customerName || 'Quý khách',
        expiresMinutes,
      });

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [toEmail],
          subject: `[CinemaX] ${otpCode} là mã xác thực tra cứu đơn hàng ${orderCode || ''}`,
          html: htmlContent,
        }),
      });

      const data = await response.json();
      if (response.ok && data.id) {
        console.log(`[EmailServer] Đã gửi OTP THỰC TẾ tới ${toEmail} qua Resend (ID: ${data.id})`);
        return NextResponse.json({
          success: true,
          provider: 'RESEND',
          isLive: true,
          messageId: data.id,
          message: `Mã OTP đã được gửi thành công đến hòm thư thực tế ${toEmail}`,
        });
      }

      console.warn('[EmailServer] Resend trả lỗi:', data);

      // Nếu gặp lỗi 403 (Tài khoản Resend miễn phí chỉ cho phép gửi tới email chủ tài khoản)
      if (data.statusCode === 403 && data.message) {
        const ownerMatch = data.message.match(/\(([^)]+)\)/);
        const ownerEmail = ownerMatch ? ownerMatch[1] : 'email chủ tài khoản Resend';
        return NextResponse.json({
          success: true,
          provider: 'DEVELOPMENT_MOCK',
          isLive: false,
          warning: `Tài khoản Resend thử nghiệm chỉ cho phép gửi tới ${ownerEmail}.`,
          message: `Tài khoản Resend miễn phí chỉ gửi được tới ${ownerEmail}. Mã OTP thử nghiệm: ${otpCode}`,
        });
      }
    }

    // 2. Nếu chưa có API Key -> Chế độ GIẢ LẬP AN TOÀN (Smart Mock)
    console.log('====================================================');
    console.log(`[EmailServer - Smart Mock] MÔ PHỎNG GỬI OTP EMAIL:`);
    console.log(`-> Hòm thư nhận: ${toEmail}`);
    console.log(`-> Mã đơn: ${orderCode}`);
    console.log(`-> Mã OTP: ${otpCode}`);
    console.log(`-> Trạng thái: Giả lập thành công (Chờ cấu hình Resend tại Admin)`);
    console.log('====================================================');

    return NextResponse.json({
      success: true,
      provider: 'DEVELOPMENT_MOCK',
      isLive: false,
      messageId: `mock-${Date.now()}`,
      message: `Hệ thống đang chạy chế độ giả lập an toàn. Mã OTP: ${otpCode}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi gửi email OTP' },
      { status: 500 }
    );
  }
}
