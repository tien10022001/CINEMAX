import { NextRequest, NextResponse } from 'next/server';
import { ContactValidator } from '@/lib/contact-validator';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const dnsPromises = dns.promises;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, isValid: false, error: 'Thiếu tham số email' },
        { status: 400 }
      );
    }

    // 1. Kiểm tra cấu trúc cú pháp & Domain rác
    const validation = ContactValidator.validateEmail(email);
    if (!validation.isValid) {
      return NextResponse.json({
        success: true,
        isValid: false,
        error: validation.error,
        suggestion: validation.suggestion,
      });
    }

    const domain = validation.domain || email.split('@')[1];

    // 2. Truy vấn DNS MX thực tế từ máy chủ thư tín quốc tế
    try {
      const mxRecords = await dnsPromises.resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        return NextResponse.json({
          success: true,
          isValid: false,
          error: `Tên miền @${domain} không có máy chủ nhận mail (Không tìm thấy bản ghi DNS MX). Vui lòng kiểm tra lại!`,
        });
      }

      // Sắp xếp lấy mail server ưu tiên cao nhất
      mxRecords.sort((a, b) => a.priority - b.priority);

      return NextResponse.json({
        success: true,
        isValid: true,
        domain,
        primaryMxServer: mxRecords[0].exchange,
        message: 'Địa chỉ email và máy chủ thư tín hợp lệ, sẵn sàng nhận mã OTP.',
      });
    } catch (dnsErr: any) {
      // Mã lỗi ENOTFOUND / ENODATA -> Tên miền không tồn tại
      if (dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'ENODATA') {
        return NextResponse.json({
          success: true,
          isValid: false,
          error: `Tên miền @${domain} không tồn tại trên hệ thống internet quốc tế. Vui lòng kiểm tra lại chính tả!`,
        });
      }

      // Nếu lỗi timeout mạng DNS, fallback tạm chấp nhận nếu cú pháp hợp lệ
      return NextResponse.json({
        success: true,
        isValid: true,
        domain,
        warning: 'Không thể truy vấn DNS thời gian thực, tạm chấp nhận theo cú pháp chuẩn.',
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, isValid: false, error: err?.message || 'Lỗi kiểm tra email' },
      { status: 500 }
    );
  }
}
