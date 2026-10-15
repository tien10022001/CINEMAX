import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#1A1C26] border-t border-[#303645] mt-20 text-xs text-[#9EA6B8]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-20 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Brand Logo (Figma Screen 1) */}
        <Link href="/" className="font-black text-xl tracking-wider text-[#E63845]">
          CINEMAX
        </Link>

        {/* Center: Links (Figma Screen 1) */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[#9EA6B8]">
          <span className="hover:text-white cursor-pointer transition-colors">Về chúng tôi</span>
          <span>•</span>
          <span className="hover:text-white cursor-pointer transition-colors">Điều khoản</span>
          <span>•</span>
          <span className="hover:text-white cursor-pointer transition-colors">Chính sách bảo mật</span>
          <span>•</span>
          <span className="hover:text-white cursor-pointer transition-colors">Liên hệ</span>
          <span>•</span>
          <Link href="/admin" className="hover:text-[#FABF2E] text-[#9EA6B8]/70 flex items-center gap-1 transition-colors">
            <span>Cổng Quản Trị</span>
          </Link>
        </div>

        {/* Right: Copyright (Figma Screen 1) */}
        <div className="text-[#9EA6B8]">
          © 2026 Cinemax
        </div>
      </div>
    </footer>
  );
}
