#!/usr/bin/env node

/**
 * CINEMAX - SCRIPT CẤU HÌNH CỔNG EMAIL RESEND TỨC THÌ
 * Cách dùng:
 *   npm run setup:resend <RESEND_API_KEY>
 * Hoặc:
 *   node scripts/setup-resend.js re_123456789
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.argv[2] ? process.argv[2].trim() : '';
const sender = process.argv[3] ? process.argv[3].trim() : 'CinemaX <onboarding@resend.dev>';

const rootDir = process.cwd();
const configFilePath = path.join(rootDir, 'src', 'data', 'email-config.json');
const envFilePath = path.join(rootDir, '.env.local');

console.log('\n=============================================================');
console.log('🎬 CINEMAX - THIẾT LẬP CỔNG PHÁT THƯ RESEND API');
console.log('=============================================================\n');

if (!apiKey) {
  console.log('⚠️  CẢNH BÁO: Bạn chưa truyền khóa API Key!');
  console.log('👉 Hướng dẫn sử dụng:');
  console.log('   npm run setup:resend <KEY_RESEND_CỦA_BẠN>');
  console.log('   Ví dụ: npm run setup:resend re_123456789abcde\n');
  console.log('ℹ️  Nếu chưa có API Key, hệ thống CinemaX đang tự động chạy ở:');
  console.log('   [CHẾ ĐỘ GIẢ LẬP AN TOÀN - MOCK DELIVERY]');
  console.log('   (Mã OTP sẽ được in ra màn hình và console để bạn kiểm thử mượt mà)\n');
  process.exit(0);
}

if (!apiKey.startsWith('re_')) {
  console.error('❌ LỖI: Khóa Resend API không hợp lệ! (Khóa chuẩn phải bắt đầu bằng "re_")\n');
  process.exit(1);
}

// 1. Cập nhật src/data/email-config.json
try {
  const newConfig = {
    provider: 'RESEND',
    apiKey: apiKey,
    sender: sender,
    isLive: true,
    updatedAt: new Date().toISOString(),
  };

  const dataDir = path.dirname(configFilePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf8');
  console.log('✅ Đã lưu cấu hình runtime vào: src/data/email-config.json');
} catch (err) {
  console.error('❌ Không thể ghi file config runtime:', err.message);
}

// 2. Cập nhật .env.local
try {
  let envContent = '';
  if (fs.existsSync(envFilePath)) {
    envContent = fs.readFileSync(envFilePath, 'utf8');
  }

  if (envContent.includes('RESEND_API_KEY=')) {
    envContent = envContent.replace(/RESEND_API_KEY=.*(\r?\n|$)/, `RESEND_API_KEY=${apiKey}$1`);
  } else {
    envContent += `\nRESEND_API_KEY=${apiKey}\n`;
  }

  if (!envContent.includes('EMAIL_SENDER=')) {
    envContent += `EMAIL_SENDER=${sender}\n`;
  }

  fs.writeFileSync(envFilePath, envContent, 'utf8');
  console.log('✅ Đã đồng bộ biến môi trường vào: .env.local');
} catch (err) {
  console.error('❌ Không thể ghi file .env.local:', err.message);
}

console.log('\n🎉 THIẾT LẬP THÀNH CÔNG!');
console.log('-------------------------------------------------------------');
console.log(`• Cổng phát thư : RESEND TRANSACTIONAL API (CHẾ ĐỘ THẬT)`);
console.log(`• Khóa API     : ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
console.log(`• Người gửi    : ${sender}`);
console.log('-------------------------------------------------------------');
console.log('👉 Bây giờ khi khách hàng bấm nhận OTP hoặc đặt vé, email sẽ');
console.log('   được gửi TRỰC TIẾP vào hòm thư Gmail/Yahoo thực tế!\n');
