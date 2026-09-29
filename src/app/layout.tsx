import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CINEMAX — Đặt Vé Xem Phim Online | Trải Nghiệm IMAX Đỉnh Cao",
  description: "Website đặt vé xem phim CINEMAX chính thức: Chọn ghế online, giữ chỗ 10 phút, thanh toán tiện lợi MoMo, VNPAY, nhận vé điện tử QR nhanh chóng.",
};

import { AuthProvider } from "@/lib/auth-context";
import { DataProvider } from "@/lib/data-context";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0F1217] text-white">
        <AuthProvider>
          <DataProvider>{children}</DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
