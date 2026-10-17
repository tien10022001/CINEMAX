import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configFilePath = path.join(process.cwd(), 'src', 'data', 'email-config.json');
const envFilePath = path.join(process.cwd(), '.env.local');

function getRuntimeConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const data = fs.readFileSync(configFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch {}
  return {
    provider: 'DEVELOPMENT_MOCK',
    apiKey: process.env.RESEND_API_KEY || '',
    sender: process.env.EMAIL_SENDER || 'CinemaX <onboarding@resend.dev>',
    isLive: Boolean(process.env.RESEND_API_KEY),
  };
}

// GET: Lấy trạng thái cấu hình hiện tại (đã ẩn danh key)
export async function GET() {
  try {
    const config = getRuntimeConfig();
    const effectiveKey = config.apiKey || process.env.RESEND_API_KEY || '';
    const isLive = Boolean(effectiveKey && effectiveKey.startsWith('re_'));

    const maskedKey = effectiveKey
      ? effectiveKey.length > 10
        ? `${effectiveKey.slice(0, 6)}...${effectiveKey.slice(-4)}`
        : '******'
      : '';

    return NextResponse.json({
      success: true,
      isLive,
      provider: isLive ? 'RESEND' : 'DEVELOPMENT_MOCK',
      sender: config.sender || 'CinemaX <onboarding@resend.dev>',
      hasKey: Boolean(effectiveKey),
      maskedKey,
      updatedAt: config.updatedAt || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi đọc cấu hình' },
      { status: 500 }
    );
  }
}

// POST: Cập nhật API Key từ Admin hoặc gửi test email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, apiKey, sender, testEmail } = body;

    // 1. Kiểm tra hoặc lưu cấu hình mới
    if (action === 'SAVE') {
      const trimmedKey = (apiKey || '').trim();
      const trimmedSender = (sender || '').trim() || 'CinemaX <onboarding@resend.dev>';

      if (trimmedKey && !trimmedKey.startsWith('re_')) {
        return NextResponse.json(
          { success: false, error: 'Khóa API Resend không đúng định dạng (phải bắt đầu bằng "re_")' },
          { status: 400 }
        );
      }

      const isLive = Boolean(trimmedKey);
      const newConfig = {
        provider: isLive ? 'RESEND' : 'DEVELOPMENT_MOCK',
        apiKey: trimmedKey,
        sender: trimmedSender,
        isLive,
        updatedAt: new Date().toISOString(),
      };

      // Ghi vào file runtime config
      fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf8');

      // Đồng bộ cập nhật vào .env.local nếu có key
      if (fs.existsSync(envFilePath)) {
        let envContent = fs.readFileSync(envFilePath, 'utf8');
        if (envContent.includes('RESEND_API_KEY=')) {
          envContent = envContent.replace(/RESEND_API_KEY=.*(\r?\n|$)/, `RESEND_API_KEY=${trimmedKey}$1`);
        } else if (trimmedKey) {
          envContent += `\nRESEND_API_KEY=${trimmedKey}\n`;
        }
        fs.writeFileSync(envFilePath, envContent, 'utf8');
      }

      // Cập nhật runtime process.env
      if (trimmedKey) {
        process.env.RESEND_API_KEY = trimmedKey;
      } else {
        delete process.env.RESEND_API_KEY;
      }

      return NextResponse.json({
        success: true,
        message: isLive
          ? 'Đã kết nối Cổng Resend API thành công! Hệ thống chuyển sang chế độ GỬI THỰC TẾ.'
          : 'Đã xóa API Key. Hệ thống chuyển về chế độ GIẢ LẬP AN TOÀN (Mock Testing).',
        isLive,
        provider: newConfig.provider,
      });
    }

    // 2. Gửi thử nghiệm email test
    if (action === 'TEST') {
      if (!testEmail) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng nhập email nhận thử nghiệm' },
          { status: 400 }
        );
      }

      const config = getRuntimeConfig();
      const effectiveKey = config.apiKey || process.env.RESEND_API_KEY;

      if (!effectiveKey) {
        return NextResponse.json({
          success: true,
          mode: 'MOCK',
          message: `[Giả lập] Đã mô phỏng gửi email test tới ${testEmail}. Vui lòng nhập Resend API Key để gửi email thật!`,
        });
      }

      // Gửi thật qua Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveKey}`,
        },
        body: JSON.stringify({
          from: config.sender || 'CinemaX <onboarding@resend.dev>',
          to: [testEmail],
          subject: '[CinemaX Admin] Kiểm tra kết nối Cổng Email thành công',
          html: `
            <div style="font-family: sans-serif; background-color: #0F1217; color: #FFF; padding: 30px; border-radius: 16px;">
              <h2 style="color: #E63845;">🎬 CinemaX - Cổng Email Đã Sẵn Sàng</h2>
              <p>Xin chúc mừng! Cổng gửi thư Resend API của hệ thống rạp CinemaX đã được thiết lập thành công.</p>
              <p>Mọi mã OTP tra cứu đơn hàng và vé điện tử sẽ được chuyển giao tức thì đến khách hàng.</p>
              <div style="margin-top: 20px; font-size: 12px; color: #888;">Thời gian: ${new Date().toLocaleString('vi-VN')}</div>
            </div>
          `,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: resData.message || 'Lỗi phản hồi từ máy chủ Resend',
        });
      }

      return NextResponse.json({
        success: true,
        mode: 'LIVE',
        messageId: resData.id,
        message: `Đã gửi email thử nghiệm thành công tới ${testEmail} (ID: ${resData.id})`,
      });
    }

    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi xử lý cài đặt email' },
      { status: 500 }
    );
  }
}
