const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} = require('docx');

// Color Palette Constants
const COLOR_PRIMARY = '991B1B'; // Deep Red / Burgundy
const COLOR_SECONDARY = '1F2937'; // Slate Charcoal
const COLOR_HEADER_BG = '1E293B'; // Dark Slate for Table Headers
const COLOR_ALT_ROW = 'F8FAFC'; // Light Gray for zebra striping
const COLOR_BORDER = 'CBD5E1'; // Soft gray border
const COLOR_MUTED = '64748B'; // Muted text

// Helper for building table borders
const tableBorderConfig = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
};

// Helper for Heading 1
function createH1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 150 },
    run: {
      size: 32, // 16pt
      bold: true,
      color: COLOR_PRIMARY,
      font: 'Calibri',
    },
  });
}

// Helper for Heading 2
function createH2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    run: {
      size: 26, // 13pt
      bold: true,
      color: COLOR_SECONDARY,
      font: 'Calibri',
    },
  });
}

// Helper for Heading 3
function createH3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    run: {
      size: 22, // 11pt
      bold: true,
      color: '475569',
      font: 'Calibri',
    },
  });
}

// Helper for normal paragraph
function createP(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { before: 60, after: 80, ...options.spacing },
    children: [
      new TextRun({
        text: text,
        bold: options.bold || false,
        italics: options.italics || false,
        size: options.size || 20, // 10pt
        color: options.color || '1E293B',
        font: 'Calibri',
      }),
    ],
  });
}

// Helper for Table Cell
function createCell(text, options = {}) {
  const isHeader = options.isHeader || false;
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: {
      type: ShadingType.CLEAR,
      fill: isHeader ? COLOR_HEADER_BG : options.bg || 'FFFFFF',
    },
    margins: {
      top: 120,
      bottom: 120,
      left: 140,
      right: 140,
    },
    children: [
      new Paragraph({
        alignment: options.alignment || (isHeader ? AlignmentType.CENTER : AlignmentType.LEFT),
        children: [
          new TextRun({
            text: text,
            bold: isHeader || options.bold || false,
            color: isHeader ? 'FFFFFF' : options.color || '1E293B',
            size: options.size || (isHeader ? 19 : 18),
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

// ============================================================================
// DOCUMENT 1: BÁO CÁO ĐẦY ĐỦ VỀ CÁC CHỨC NĂNG VÀ PHÂN QUYỀN (DẠNG BẢNG CHI TIẾT)
// ============================================================================
async function generateFeaturesAndRolesDoc() {
  console.log('Generating Document 1: Báo cáo Chức Năng và Phân Quyền...');

  const doc = new Document({
    title: 'BÁO CÁO ĐẶC TẢ CHỨC NĂNG VÀ MA TRẬN PHÂN QUYỀN HỆ THỐNG CINEMAX',
    description: 'Báo cáo chi tiết dạng bảng về hệ thống đặt vé xem phim trực tuyến và quản trị rạp CINEMAX',
    sections: [
      {
        properties: {},
        children: [
          // Header / Title Block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'HỆ THỐNG ĐẶT VÉ XEM PHIM TRỰC TUYẾN CINEMAX',
                bold: true,
                size: 36,
                color: COLOR_PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'BÁO CÁO ĐẶC TẢ TỔNG QUAN TÍNH NĂNG VÀ MA TRẬN PHÂN QUYỀN CHI TIẾT',
                bold: true,
                size: 24,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Dự án', { isHeader: true, width: 25 }),
                  createCell('CINEMAX - Cinema Ticketing & Theater Management Platform', { width: 75 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Công nghệ', { isHeader: true, width: 25 }),
                  createCell('Next.js 15 (App Router, Turbopack), TypeScript, TailwindCSS, Supabase / PostgreSQL', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Tiêu chuẩn UI/UX', { isHeader: true, width: 25 }),
                  createCell('100% Khớp Thiết kế Figma Prototype (5 Frames chuẩn: Trang chủ, Chi tiết, Chọn ghế, Thanh toán, Vé QR)', { width: 75 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Mô hình bảo mật', { isHeader: true, width: 25 }),
                  createCell('Role-Based Access Control (RBAC): 3 Cấp độ (Guest - User - Admin) + Session Isolation', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Thời gian hoàn thiện', { isHeader: true, width: 25 }),
                  createCell(new Date().toLocaleDateString('vi-VN') + ' | Phiên bản Release v2.0 Production-Ready', { width: 75 }),
                ],
              }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 1: TỔNG QUAN CÁC VAI TRÒ TRUY CẬP (ROLES DEFINITION)
          // ------------------------------------------------------------------
          createH1('I. ĐỊNH NGHĨA CÁC VAI TRÒ TRUY CẬP VÀ PHÂN QUYỀN (ROLES)'),
          createP('Hệ thống CINEMAX phân chia người dùng thành 4 vai trò rõ ràng với các ranh giới quyền hạn được cô lập hoàn toàn nhằm ngăn ngừa lộ lọt thông tin cá nhân và dữ liệu nhạy cảm:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Mã Vai Trò', { isHeader: true, width: 15 }),
                  createCell('Tên Vai Trò', { isHeader: true, width: 20 }),
                  createCell('Đối Tượng Áp Dụng', { isHeader: true, width: 25 }),
                  createCell('Đặc Điểm & Phạm Vi Truy Cập', { isHeader: true, width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('GUEST', { bold: true, width: 15, alignment: AlignmentType.CENTER }),
                  createCell('Khách Vãng Lai / Chưa Đăng Nhập', { bold: true, width: 20 }),
                  createCell('Người dùng truy cập tự do chưa có tài khoản hoặc chưa đăng nhập', { width: 25 }),
                  createCell('• Xem danh sách phim, lịch chiếu, tin tức, khuyến mãi, hệ thống rạp.\n• Đặt vé trực tiếp bằng thông tin liên hệ riêng (Tên, SĐT, Email nhận vé).\n• Nhận vé điện tử mã QR sau khi thanh toán.\n• Tra cứu vé cá nhân bằng Mã đặt vé + Số điện thoại.\n• KHÔNG được truy cập vé của người khác; KHÔNG được vào khu vực Admin.', { width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('CUSTOMER (USER)', { bold: true, width: 15, bg: COLOR_ALT_ROW, alignment: AlignmentType.CENTER }),
                  createCell('Thành Viên Khách Hàng', { bold: true, width: 20, bg: COLOR_ALT_ROW }),
                  createCell('Khách hàng đã đăng ký tài khoản thành viên hợp lệ trên hệ thống', { width: 25, bg: COLOR_ALT_ROW }),
                  createCell('• Toàn bộ quyền của khách vãng lai.\n• Tự động điền sẵn thông tin khi thanh toán, rút ngắn thời gian đặt vé.\n• Tích lũy điểm thưởng thành viên (Loyalty points) cho mỗi đơn hàng thanh toán thành công.\n• Quản lý lịch sử vé xem phim của riêng mình tại trang /my-tickets.\n• Tải file vé PDF, xuất trình mã QR soát vé.\n• Sử dụng các mã giảm giá dành riêng cho thành viên.', { width: 40, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('STAFF', { bold: true, width: 15, alignment: AlignmentType.CENTER }),
                  createCell('Nhân Viên Rạp / Soát Vé', { bold: true, width: 20 }),
                  createCell('Nhân viên vận hành quầy vé và nhân viên kiểm soát cửa phòng chiếu', { width: 25 }),
                  createCell('• Tra cứu thông tin vé qua mã vé hoặc quét mã QR.\n• Thực hiện nghiệp vụ soát vé (Check-in), đổi trạng thái vé từ SOLD sang USED.\n• Kiểm tra tình trạng ghế trống theo suất chiếu thực tế.', { width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('ADMIN', { bold: true, width: 15, bg: COLOR_ALT_ROW, alignment: AlignmentType.CENTER, color: COLOR_PRIMARY }),
                  createCell('Quản Trị Viên Toàn Quyền', { bold: true, width: 20, bg: COLOR_ALT_ROW, color: COLOR_PRIMARY }),
                  createCell('Ban giám đốc, quản trị viên hệ thống kỹ thuật CINEMAX', { width: 25, bg: COLOR_ALT_ROW }),
                  createCell('• Cổng đăng nhập bảo mật riêng biệt tại /admin (ADMIN CONSOLE).\n• Toàn quyền thêm, sửa, xóa (CRUD) danh mục Phim, Cụm rạp, Phòng chiếu, Suất chiếu, Bảng giá vé, Combo bắp nước, Mã khuyến mãi, Tin tức.\n• Tùy chỉnh Banner Hero trang chủ, số hotline, thông báo toàn hệ thống.\n• Xem báo cáo doanh thu tổng quan, số vé bán, tỷ lệ lấp đầy phòng chiếu.\n• Quản lý toàn bộ danh sách đơn vé trên toàn hệ thống và cập nhật trạng thái đơn.', { width: 40, bg: COLOR_ALT_ROW }),
                ],
              }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 2: BẢNG MA TRẬN PHÂN QUYỀN CHI TIẾT (RBAC MATRIX)
          // ------------------------------------------------------------------
          createH1('II. BẢNG MA TRẬN PHÂN QUYỀN CHI TIẾT (RBAC MATRIX)'),
          createP('Bảng ma trận đối chiếu quyền hạn chi tiết cho từng chức năng nghiệp vụ cụ thể trên toàn bộ hệ thống CINEMAX (Ký hiệu: [✓] Cho phép, [✗] Không cho phép, [-] Không áp dụng):'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('STT', { isHeader: true, width: 6 }),
                  createCell('Phân Hệ / Module', { isHeader: true, width: 18 }),
                  createCell('Tác Vụ / Chức Năng Chi Tiết', { isHeader: true, width: 34 }),
                  createCell('GUEST', { isHeader: true, width: 10 }),
                  createCell('USER', { isHeader: true, width: 10 }),
                  createCell('STAFF', { isHeader: true, width: 10 }),
                  createCell('ADMIN', { isHeader: true, width: 12 }),
                ],
              }),
              // Module 1: Trang chủ & Khám phá
              new TableRow({
                children: [
                  createCell('1', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Trang chủ & Header', { bold: true, width: 18 }),
                  createCell('Xem Banner nổi bật, phim đang chiếu, phim sắp chiếu', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('2', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Trang chủ & Header', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Sử dụng Thanh mua vé nhanh (Chọn rạp, ngày, khung giờ Sáng/Trưa/Chiều/Tối)', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('3', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Trang chủ & Header', { bold: true, width: 18 }),
                  createCell('Tìm kiếm phim, rạp chiếu theo từ khóa thời gian thực', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('4', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Trang chủ & Header', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Chuyển đổi các tab (Phim, Rạp chiếu, Khuyến mãi, Tin tức) kèm hiệu ứng phát sáng tab', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),

              // Module 2: Chi tiết phim & Trailer
              new TableRow({
                children: [
                  createCell('5', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Chi Tiết Phim', { bold: true, width: 18 }),
                  createCell('Xem trang chi tiết phim, đạo diễn, diễn viên, tóm tắt, điểm IMDb', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('6', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Chi Tiết Phim', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Mở Trailer Popup video xem thử trailer chính thức', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('7', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Chi Tiết Phim', { bold: true, width: 18 }),
                  createCell('Chọn ngày chiếu, xem danh sách rạp và chọn chip suất chiếu', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),

              // Module 3: Quy trình đặt vé
              new TableRow({
                children: [
                  createCell('8', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Đặt Vé - Bước 1', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Chọn ghế trên sơ đồ (Standard, VIP, Couple), đếm ngược giữ ghế 10:00', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('9', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Đặt Vé - Bước 2', { bold: true, width: 18 }),
                  createCell('Chọn combo bắp nước bán kèm, tăng giảm số lượng', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('10', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Đặt Vé - Bước 2', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Áp dụng mã giảm giá / Voucher khuyến mãi (VD: GIAM20K, CHAOBANMOI)', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('11', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Đặt Vé - Bước 2', { bold: true, width: 18 }),
                  createCell('Nhập thông tin người nhận vé vãng lai (Họ tên, SĐT, Email riêng biệt)', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('12', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Đặt Vé - Bước 2', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Tự động nạp thông tin thành viên và tích lũy điểm Loyalty khi đặt vé', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('13', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Đặt Vé - Bước 2', { bold: true, width: 18 }),
                  createCell('Chọn phương thức thanh toán (MoMo, VNPAY, ZaloPay, Thẻ ATM/Visa)', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('14', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Đặt Vé - Bước 3', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Nhận vé điện tử, hiển thị mã QR, mã đặt vé, thông tin chi tiết', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),

              // Module 4: Vé của tôi & Tra cứu
              new TableRow({
                children: [
                  createCell('15', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Tra cứu vé', { bold: true, width: 18 }),
                  createCell('Tra cứu vé vãng lai an toàn bằng cặp khóa (Mã vé + Số điện thoại)', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('16', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Vé của tôi', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Xem danh sách toàn bộ các vé đã đặt thuộc sở hữu tài khoản đang đăng nhập', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('17', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Vé của tôi', { bold: true, width: 18 }),
                  createCell('Xem danh sách vé của người dùng khác', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, color: COLOR_PRIMARY, bold: true }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, color: COLOR_PRIMARY, bold: true }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, color: COLOR_PRIMARY, bold: true }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),

              // Module 5: Soát vé (Staff)
              new TableRow({
                children: [
                  createCell('18', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Soát vé', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Quét mã QR soát vé tại cửa phòng, chuyển trạng thái vé sang USED', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),

              // Module 6: Tài khoản & Phiên
              new TableRow({
                children: [
                  createCell('19', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Tài Khoản', { bold: true, width: 18 }),
                  createCell('Đăng ký tài khoản thành viên mới (nhận thưởng 50 điểm khởi đầu)', { width: 34 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('20', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Tài Khoản', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Đăng nhập tài khoản thành viên (Email & Mật khẩu chuẩn)', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('21', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Tài Khoản', { bold: true, width: 18 }),
                  createCell('Đăng xuất tài khoản, xóa phiên an toàn khỏi trình duyệt', { width: 34 }),
                  createCell('-', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12 }),
                ],
              }),

              // Module 7: Cổng Quản trị Admin
              new TableRow({
                children: [
                  createCell('22', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Cổng Quản Trị', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Truy cập Cổng Quản Trị Hệ Thống (/admin) qua xác thực riêng biệt', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('23', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Quản Trị Phim', { bold: true, width: 18 }),
                  createCell('Thêm phim mới, upload URL poster, trailer, thời lượng, độ tuổi', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('24', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Quản Trị Phim', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Chỉnh sửa thông tin phim hiện có (tiêu đề, tóm tắt, đạo diễn...)', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('25', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Quản Trị Phim', { bold: true, width: 18 }),
                  createCell('Chuyển đổi trạng thái phim nhanh (Đang chiếu ↔ Sắp chiếu), Xóa phim', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('26', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Quản Trị Rạp', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Thêm cụm rạp mới, chỉnh sửa địa chỉ, thành phố, hotline, xóa cụm rạp', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('27', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Quản Trị Suất Chiếu', { bold: true, width: 18 }),
                  createCell('Tạo suất chiếu mới (chọn phim, chọn rạp, chọn phòng, ngày giờ), xóa suất chiếu', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('28', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Quản Trị Voucher', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Tạo mã khuyến mãi mới, sửa mức giảm (% hoặc số tiền), hạn dùng, xóa mã', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('29', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Quản Trị Bắp Nước', { bold: true, width: 18 }),
                  createCell('Thêm combo mới, chỉnh sửa giá bán, tên món, hình ảnh, xóa combo', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('30', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Quản Trị Tin Tức', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Đăng bài viết mới, cập nhật tóm tắt, ảnh bìa, nội dung, xóa bài viết', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('31', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Quản Trị Cấu Hình', { bold: true, width: 18 }),
                  createCell('Chỉnh sửa Banner Hero, phụ đề, số điện thoại hotline, email CSKH', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('32', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Quản Trị Đơn Hàng', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Xem danh sách tất cả các đơn vé trên toàn hệ thống, cập nhật trạng thái đơn', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('33', { alignment: AlignmentType.CENTER, width: 6 }),
                  createCell('Báo Cáo Doanh Thu', { bold: true, width: 18 }),
                  createCell('Xem tổng doanh thu hệ thống, tổng số vé bán ra, tỷ lệ lấp đầy rạp', { width: 34 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10 }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('34', { alignment: AlignmentType.CENTER, width: 6, bg: COLOR_ALT_ROW }),
                  createCell('Khôi Phục Dữ Liệu', { bold: true, width: 18, bg: COLOR_ALT_ROW }),
                  createCell('Thực hiện Reset toàn bộ dữ liệu phim/rạp/voucher về mặc định hệ thống', { width: 34, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✗', { alignment: AlignmentType.CENTER, width: 10, bg: COLOR_ALT_ROW }),
                  createCell('✓', { alignment: AlignmentType.CENTER, width: 12, bg: COLOR_ALT_ROW, bold: true, color: COLOR_PRIMARY }),
                ],
              }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 3: ĐẶC TẢ CHI TIẾT TỪNG TÍNH NĂNG NGHIỆP VỤ (FUNCTIONAL SPECS)
          // ------------------------------------------------------------------
          createH1('III. ĐẶC TẢ CHI TIẾT CÁC TÍNH NĂNG NGHIỆP VỤ CỐT LÕI'),
          createP('Dưới đây là bảng đặc tả chi tiết 6 luồng tính năng nghiệp vụ trọng yếu của hệ thống:'),

          // Spec 1: Đặt vé trực tuyến
          createH2('1. Tính Năng: Đặt Vé Xem Phim Trực Tuyến 3 Bước (Online Booking Flow)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Mã Tính Năng', { isHeader: true, width: 25 }), createCell('UC-BOOKING-01', { bold: true, width: 75 })] }),
              new TableRow({ children: [createCell('Tác nhân (Actor)', { isHeader: true, width: 25 }), createCell('GUEST, CUSTOMER (USER)', { width: 75, bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('Điều kiện tiên quyết', { isHeader: true, width: 25 }), createCell('Suất chiếu còn mở (OPEN), còn ghế trống, trong khung giờ cho phép đặt.', { width: 75 })] }),
              new TableRow({
                children: [
                  createCell('Luồng xử lý chính', { isHeader: true, width: 25 }),
                  createCell('Bước 1 (Chọn ghế): Khách xem sơ đồ phòng chiếu, chọn các ghế mong muốn (tối đa 8 ghế). Hệ thống khởi động đồng hồ đếm ngược 10:00 và tạm khóa ghế (trạng thái HELD) ngăn người khác chọn trùng.\nBước 2 (Bắp nước & Thanh toán): Chọn combo bắp nước, nhập mã khuyến mãi (hệ thống tự động trừ tiền nếu hợp lệ). Người dùng vãng lai nhập Họ tên, SĐT, Email; thành viên được tự động nạp thông tin. Chọn 1 trong 4 cổng thanh toán (MoMo, VNPAY, ZaloPay, Thẻ ATM/Visa) và bấm "Thanh Toán".\nBước 3 (Vé điện tử): Giao dịch thành công, hệ thống phát sinh Mã đặt vé và Mã QR vé điện tử, hiển thị thông báo thành công và cộng điểm Loyalty nếu là thành viên.', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({ children: [createCell('Xử lý ngoại lệ', { isHeader: true, width: 25 }), createCell('• Quá 10:00 chưa thanh toán: Đơn chuyển EXPIRED, ghế tự động giải phóng (CANCELLED).\n• Ghế vừa có người khác chọn: Báo lỗi "Ghế vừa được giữ chỗ, vui lòng chọn ghế khác".\n• Nhập sai định dạng SĐT/Email đối với khách vãng lai: Hiển thị thông báo đỏ yêu cầu nhập đúng.', { width: 75 })] }),
            ],
          }),

          // Spec 2: Tra cứu vé vãng lai & Vé của tôi
          createH2('2. Tính Năng: Tra Cứu Vé & Quản Lý Vé Cá Nhân (Ticket Management)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Mã Tính Năng', { isHeader: true, width: 25 }), createCell('UC-TICKET-02', { bold: true, width: 75 })] }),
              new TableRow({ children: [createCell('Tác nhân (Actor)', { isHeader: true, width: 25 }), createCell('GUEST (Khách vãng lai), CUSTOMER (Thành viên)', { width: 75, bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('Mục tiêu bảo mật', { isHeader: true, width: 25 }), createCell('Xóa bỏ hoàn toàn tình trạng lộ thông tin vé người khác; đảm bảo nguyên tắc người nào chỉ xem được vé người đó.', { width: 75 })] }),
              new TableRow({
                children: [
                  createCell('Luồng xử lý chi tiết', { isHeader: true, width: 25 }),
                  createCell('• Đối với Khách vãng lai (Guest): Trang /my-tickets không hiển thị danh sách vé nào. Cung cấp form tra cứu bảo mật yêu cầu nhập 2 trường xác thực: [Mã đặt vé] + [Số điện thoại đặt vé]. Khi trùng khớp cả 2 thông tin, hệ thống mới hiển thị thông tin vé và mã QR.\n• Đối với Thành viên (Customer): Đăng nhập tài khoản, trang /my-tickets tự động truy vấn danh sách vé có user_id trùng khớp với tài khoản đang đăng nhập, hiển thị chi tiết lịch sử vé đã đặt, cho phép tải PDF hoặc xuất trình mã QR soát vé.', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
            ],
          }),

          // Spec 3: Quản trị toàn diện (Admin Control Suite)
          createH2('3. Tính Năng: Quản Trị Hệ Thống Toàn Diện (Master Admin Control Suite)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Mã Tính Năng', { isHeader: true, width: 25 }), createCell('UC-ADMIN-03', { bold: true, width: 75 })] }),
              new TableRow({ children: [createCell('Tác nhân (Actor)', { isHeader: true, width: 25 }), createCell('ADMIN (Quản trị viên hệ thống)', { width: 75, bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('Phạm vi hiệu lực', { isHeader: true, width: 25 }), createCell('Tác động trực tiếp đến toàn bộ nội dung hiển thị trên trang chủ, chi tiết phim, bắp nước và các tab dịch vụ.', { width: 75 })] }),
              new TableRow({
                children: [
                  createCell('Các chức năng quản trị', { isHeader: true, width: 25 }),
                  createCell('1. Quản lý Phim: Thêm phim mới, chỉnh sửa thông tin, đổi trạng thái Đang chiếu / Sắp chiếu, xóa phim.\n2. Quản lý Cụm rạp: Thêm rạp mới, cập nhật địa chỉ, số điện thoại hotline, thành phố.\n3. Quản lý Suất chiếu: Tạo lịch chiếu theo phim và phòng chiếu, xóa suất chiếu.\n4. Quản lý Voucher: Tạo mã giảm giá (tiền mặt / %), đặt hạn dùng và đơn tối thiểu.\n5. Quản lý Bắp nước: Thêm combo mới, chỉnh sửa giá bán và hình ảnh món.\n6. Quản lý Tin tức: Đăng bài viết mới, chỉnh sửa bài viết điện ảnh.\n7. Cấu hình Website: Tùy chỉnh tiêu đề banner trang chủ, phụ đề, hotline hỗ trợ, email CSKH.\n8. Quản lý Đơn hàng: Xem bảng tổng hợp đơn đặt vé của khách, theo dõi trạng thái thanh toán.', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 4: GIẢI PHÁP BẢO MẬT & KHẮC PHỤC LỖI HARDCODE
          // ------------------------------------------------------------------
          createH1('IV. GIẢI PHÁP BẢO MẬT VÀ KHẮC PHỤC TRIỆT ĐỂ LỖI LỘ THÔNG TIN'),
          createP('Bảng tổng hợp các lỗ hổng đã được xử lý triệt để trong phiên bản nâng cấp:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Vấn Đề / Lỗ Hổng Cũ', { isHeader: true, width: 30 }),
                  createCell('Hậu Quả Trước Đây', { isHeader: true, width: 30 }),
                  createCell('Giải Pháp & Hiện Thực Mới', { isHeader: true, width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Hardcode tài khoản người dùng "Tiến" trong Header & Auth Context', { bold: true, width: 30 }),
                  createCell('Mọi người dùng khi vào web hoặc bấm "Mua vé" đều tự động bị gán vào tài khoản "Tiến", gây lộ thông tin cá nhân và điểm tích lũy.', { width: 30 }),
                  createCell('• Loại bỏ 100% hardcode user.\n• currentUser mặc định là null (GUEST).\n• Header hiển thị nút đỏ "Đăng nhập" chuẩn Figma.\n• Form đăng nhập / đăng ký chuẩn mực không hiển thị bất kỳ tài khoản mẫu nào.', { width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Mảng vé mẫu cố định DEFAULT_MOCK_TICKETS trong trang Vé của tôi', { bold: true, width: 30, bg: COLOR_ALT_ROW }),
                  createCell('Khách chưa mua vé nào khi vào trang /my-tickets vẫn nhìn thấy vé phim Dune và Mai của người khác, làm lộ mã vé QR.', { width: 30, bg: COLOR_ALT_ROW }),
                  createCell('• Xóa bỏ hoàn toàn mảng vé mẫu.\n• Người dùng chưa đăng nhập chỉ được tra cứu vé thông qua cặp khóa an toàn: [Mã vé] + [Số điện thoại].\n• Thành viên chỉ xem được danh sách vé do chính tài khoản của mình đặt.', { width: 40, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Cổng Quản trị Admin không có cơ chế bảo vệ route độc lập', { bold: true, width: 30 }),
                  createCell('Bất kỳ ai truy cập đường dẫn /admin đều có thể thấy nút đăng nhập 1-click hoặc dữ liệu quản trị.', { width: 30 }),
                  createCell('• Thiết kế Cổng Quản Trị Hệ Thống (ADMIN CONSOLE) riêng biệt.\n• Form đăng nhập yêu cầu email & mật khẩu tài khoản quản trị.\n• Hệ thống kiểm tra nghiêm ngặt quyền role_code === "ADMIN", từ chối mọi truy cập trái phép của Guest và Customer.', { width: 40 }),
                ],
              }),
            ],
          }),

          createP('--- HẾT BÁO CÁO ĐẶC TẢ TÍNH NĂNG VÀ PHÂN QUYỀN CINEMAX ---', {
            alignment: AlignmentType.CENTER,
            bold: true,
            color: COLOR_MUTED,
            spacing: { before: 300 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filePath = path.join(process.cwd(), 'BAO_CAO_CHUC_NANG_VA_PHAN_QUYEN_CINEMAX.docx');
  fs.writeFileSync(filePath, buffer);
  console.log(`Document 1 generated successfully at: ${filePath}`);
}

// ============================================================================
// DOCUMENT 2: BẢN WORD VỀ TOÀN BỘ ERD VÀ THIẾT KẾ CƠ SỞ DỮ LIỆU CINEMAX
// ============================================================================
async function generateDatabaseAndErdDoc() {
  console.log('Generating Document 2: Bản đặc tả Toàn bộ ERD Cơ Sở Dữ Liệu...');

  const doc = new Document({
    title: 'BẢN ĐẶC TẢ TOÀN BỘ THIẾT KẾ CƠ SỞ DỮ LIỆU VÀ ERD CINEMAX',
    description: 'Tài liệu chi tiết về 17 bảng dữ liệu, kiểu ENUM, ràng buộc khóa, RLS Policies và hàm giao dịch nguyên tử',
    sections: [
      {
        properties: {},
        children: [
          // Header / Title Block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'HỆ THỐNG ĐẶT VÉ XEM PHIM TRỰC TUYẾN CINEMAX',
                bold: true,
                size: 36,
                color: COLOR_PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'BẢN ĐẶC TẢ TOÀN BỘ THIẾT KẾ CƠ SỞ DỮ LIỆU & BIỂU ĐỒ QUAN HỆ THỰC THỂ (ERD)',
                bold: true,
                size: 24,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Hệ Quản Trị CSDL', { isHeader: true, width: 25 }),
                  createCell('PostgreSQL 15+ (Hosted on Supabase Platform)', { width: 75 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Chuẩn Thiết Kế', { isHeader: true, width: 25 }),
                  createCell('Chuẩn hóa 3NF (Third Normal Form), Toàn vẹn tham chiếu (Referential Integrity)', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Số Lượng Bảng', { isHeader: true, width: 25 }),
                  createCell('17 Bảng dữ liệu chính + 13 Kiểu ENUM tùy biến + Bảng giá động + Khóa nguyên tử', { width: 75 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Cơ chế Bảo mật', { isHeader: true, width: 25 }),
                  createCell('Row Level Security (RLS) Policies + Tích hợp Supabase Auth (auth.users) + Transaction Atomicity', { width: 75, bg: COLOR_ALT_ROW }),
                ],
              }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 1: TỔNG QUAN VÀ BIỂU ĐỒ QUAN HỆ THỰC THỂ (ERD)
          // ------------------------------------------------------------------
          createH1('I. TỔNG QUAN KIẾN TRÚC DỮ LIỆU VÀ BIỂU ĐỒ QUAN HỆ (ERD)'),
          createP('Cơ sở dữ liệu CINEMAX được thiết kế chuyên biệt nhằm phục vụ hệ thống rạp chiếu phim hiện đại hỗ trợ đa cụm rạp, phòng chiếu IMAX/3D/2D, bảng giá vé phân tầng theo ghế và suất chiếu, quản lý menu bắp nước, áp dụng mã khuyến mãi và thanh toán trực tuyến.'),

          createH2('1. Danh Sách 17 Thực Thể Dữ Liệu (Entities)'),
          createP('Hệ thống gồm 17 bảng được phân chia thành 4 nhóm nghiệp vụ chính:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Nhóm Nghiệp Vụ', { isHeader: true, width: 25 }),
                  createCell('Các Bảng Dữ Liệu', { isHeader: true, width: 35 }),
                  createCell('Mô Tả & Trách Nhiệm Dữ Liệu', { isHeader: true, width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('1. Phân Quyền & Người Dùng', { bold: true, width: 25 }),
                  createCell('roles, users', { bold: true, width: 35 }),
                  createCell('Quản lý vai trò (Customer, Staff, Admin) và hồ sơ người dùng liên kết Supabase Auth.', { width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('2. Phim & Suất Chiếu', { bold: true, width: 25, bg: COLOR_ALT_ROW }),
                  createCell('movies, genres, movie_genres, cinemas, rooms, seat_types, seats, showtimes, showtime_prices', { bold: true, width: 35, bg: COLOR_ALT_ROW }),
                  createCell('Quản lý danh mục phim, thể loại, cụm rạp, phòng chiếu, sơ đồ vị trí ghế, lịch chiếu và bảng giá vé theo loại phòng/ghế.', { width: 40, bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('3. Bắp Nước & Khuyến Mãi', { bold: true, width: 25 }),
                  createCell('food_items, promotions', { bold: true, width: 35 }),
                  createCell('Quản lý thực đơn combo bắp nước bán kèm và các mã voucher giảm giá.', { width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('4. Đặt Vé, Ghế & Thanh Toán', { bold: true, width: 25, bg: COLOR_ALT_ROW }),
                  createCell('bookings, tickets, booking_items, payments', { bold: true, width: 35, bg: COLOR_ALT_ROW }),
                  createCell('Quản lý giao dịch đặt chỗ, tình trạng giữ ghế 10 phút, đồ ăn kèm theo đơn và lịch sử giao dịch cổng thanh toán.', { width: 40, bg: COLOR_ALT_ROW }),
                ],
              }),
            ],
          }),

          createH2('2. Bảng Quan Hệ Giữa Các Thực Thể (Relationships & Cardinality)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Thực Thể Cha (Parent)', { isHeader: true, width: 22 }),
                  createCell('Quan Hệ', { isHeader: true, width: 14 }),
                  createCell('Thực Thể Con (Child)', { isHeader: true, width: 22 }),
                  createCell('Khóa Ngoại (Foreign Key)', { isHeader: true, width: 22 }),
                  createCell('Ràng Buộc Xóa (On Delete)', { isHeader: true, width: 20 }),
                ],
              }),
              new TableRow({ children: [createCell('roles'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('users'), createCell('users.role_id -> roles.id'), createCell('RESTRICT')] }),
              new TableRow({ children: [createCell('auth.users'), createCell('1 - 1', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('public.users', { bg: COLOR_ALT_ROW }), createCell('users.id -> auth.users.id', { bg: COLOR_ALT_ROW }), createCell('CASCADE', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('movies'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('movie_genres'), createCell('movie_genres.movie_id -> movies.id'), createCell('CASCADE')] }),
              new TableRow({ children: [createCell('genres'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('movie_genres', { bg: COLOR_ALT_ROW }), createCell('movie_genres.genre_id -> genres.id', { bg: COLOR_ALT_ROW }), createCell('CASCADE', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('cinemas'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('rooms'), createCell('rooms.cinema_id -> cinemas.id'), createCell('CASCADE')] }),
              new TableRow({ children: [createCell('rooms'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('seats', { bg: COLOR_ALT_ROW }), createCell('seats.room_id -> rooms.id', { bg: COLOR_ALT_ROW }), createCell('CASCADE', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('seat_types'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('seats'), createCell('seats.seat_type_id -> seat_types.id'), createCell('RESTRICT')] }),
              new TableRow({ children: [createCell('movies'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('showtimes', { bg: COLOR_ALT_ROW }), createCell('showtimes.movie_id -> movies.id', { bg: COLOR_ALT_ROW }), createCell('RESTRICT', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('rooms'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('showtimes'), createCell('showtimes.room_id -> rooms.id'), createCell('RESTRICT')] }),
              new TableRow({ children: [createCell('showtimes'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('showtime_prices', { bg: COLOR_ALT_ROW }), createCell('showtime_prices.showtime_id -> showtimes.id', { bg: COLOR_ALT_ROW }), createCell('CASCADE', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('users'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('bookings'), createCell('bookings.user_id -> users.id'), createCell('CASCADE')] }),
              new TableRow({ children: [createCell('showtimes'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('bookings', { bg: COLOR_ALT_ROW }), createCell('bookings.showtime_id -> showtimes.id', { bg: COLOR_ALT_ROW }), createCell('RESTRICT', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('promotions'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('bookings'), createCell('bookings.promotion_id -> promotions.id'), createCell('SET NULL')] }),
              new TableRow({ children: [createCell('bookings'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('tickets', { bg: COLOR_ALT_ROW }), createCell('tickets.booking_id -> bookings.id', { bg: COLOR_ALT_ROW }), createCell('CASCADE', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('showtimes'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('tickets'), createCell('tickets.showtime_id -> showtimes.id'), createCell('RESTRICT')] }),
              new TableRow({ children: [createCell('seats'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('tickets', { bg: COLOR_ALT_ROW }), createCell('tickets.seat_id -> seats.id', { bg: COLOR_ALT_ROW }), createCell('RESTRICT', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('bookings'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('booking_items'), createCell('booking_items.booking_id -> bookings.id'), createCell('CASCADE')] }),
              new TableRow({ children: [createCell('food_items'), createCell('1 - N', { alignment: AlignmentType.CENTER, bg: COLOR_ALT_ROW }), createCell('booking_items', { bg: COLOR_ALT_ROW }), createCell('booking_items.food_item_id -> food_items.id', { bg: COLOR_ALT_ROW }), createCell('RESTRICT', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('bookings'), createCell('1 - N', { alignment: AlignmentType.CENTER }), createCell('payments'), createCell('payments.booking_id -> bookings.id'), createCell('CASCADE')] }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 2: DANH MỤC KIỂU DỮ LIỆU ENUM (13 KIỂU ENUM)
          // ------------------------------------------------------------------
          createH1('II. DANH MỤC CÁC KIỂU DỮ LIỆU ENUM (ENUMERATIONS)'),
          createP('Hệ thống định nghĩa 13 kiểu ENUM đảm bảo tính toàn vẹn dữ liệu ở mức database engine:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Tên Kiểu ENUM', { isHeader: true, width: 25 }),
                  createCell('Các Giá Trị Cho Phép (Allowed Values)', { isHeader: true, width: 40 }),
                  createCell('Ý Nghĩa & Mục Đích Sử Dụng', { isHeader: true, width: 35 }),
                ],
              }),
              new TableRow({ children: [createCell('gender', { bold: true }), createCell("'M', 'F', 'OTHER'"), createCell('Giới tính người dùng (Nam, Nữ, Khác)')] }),
              new TableRow({ children: [createCell('age_rating', { bold: true, bg: COLOR_ALT_ROW }), createCell("'P', 'K', 'T13', 'T16', 'T18'", { bg: COLOR_ALT_ROW }), createCell('Giới hạn độ tuổi khán giả theo quy định điện ảnh', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('movie_status', { bold: true }), createCell("'COMING_SOON', 'NOW_SHOWING', 'ENDED'"), createCell('Trạng thái phim (Sắp chiếu, Đang chiếu, Kết thúc)')] }),
              new TableRow({ children: [createCell('screen_type', { bold: true, bg: COLOR_ALT_ROW }), createCell("'2D', '3D', 'IMAX', '4DX'", { bg: COLOR_ALT_ROW }), createCell('Định dạng phòng chiếu / công nghệ hiển thị', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('room_status', { bold: true }), createCell("'ACTIVE', 'MAINTENANCE'"), createCell('Trạng thái phòng chiếu (Hoạt động, Bảo trì)')] }),
              new TableRow({ children: [createCell('language_type', { bold: true, bg: COLOR_ALT_ROW }), createCell("'SUBTITLED', 'DUBBED', 'ORIGINAL'", { bg: COLOR_ALT_ROW }), createCell('Định dạng âm thanh/ngôn ngữ (Phụ đề, Lồng tiếng)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('showtime_status', { bold: true }), createCell("'OPEN', 'CLOSED', 'CANCELLED'"), createCell('Tình trạng suất chiếu (Mở bán, Đóng, Đã hủy)')] }),
              new TableRow({ children: [createCell('discount_type', { bold: true, bg: COLOR_ALT_ROW }), createCell("'PERCENT', 'FIXED'", { bg: COLOR_ALT_ROW }), createCell('Loại giảm giá: Theo phần trăm (%) hoặc số tiền cố định', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('booking_status', { bold: true }), createCell("'PENDING', 'PAID', 'CANCELLED', 'EXPIRED'"), createCell('Trạng thái đơn: Chờ thanh toán, Đã trả tiền, Hủy, Quá hạn 10p')] }),
              new TableRow({ children: [createCell('ticket_status', { bold: true, bg: COLOR_ALT_ROW }), createCell("'HELD', 'SOLD', 'CANCELLED', 'USED'", { bg: COLOR_ALT_ROW }), createCell('Trạng thái vé: Đang giữ chỗ, Đã bán, Đã hủy, Đã soát vé', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('food_category', { bold: true }), createCell("'POPCORN', 'DRINK', 'SNACK', 'COMBO'"), createCell('Phân loại đồ ăn: Bắp rang, Nước ngọt, Đồ ăn vặt, Combo')] }),
              new TableRow({ children: [createCell('payment_method', { bold: true, bg: COLOR_ALT_ROW }), createCell("'MOMO', 'VNPAY', 'ZALOPAY', 'CARD', 'CASH'", { bg: COLOR_ALT_ROW }), createCell('Phương thức thanh toán: Ví điện tử, Thẻ ngân hàng, Tiền mặt', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('payment_status', { bold: true }), createCell("'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'"), createCell('Trạng thái giao dịch: Đang xử lý, Thành công, Thất bại, Hoàn tiền')] }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 3: TỪ ĐIỂN DỮ LIỆU CHI TIẾT 17 BẢNG (DATA DICTIONARY)
          // ------------------------------------------------------------------
          createH1('III. TỪ ĐIỂN DỮ LIỆU CHI TIẾT (DATA DICTIONARY - 17 BẢNG)'),
          createP('Đặc tả cấu trúc cột, kiểu dữ liệu và ràng buộc cho toàn bộ 17 bảng trong cơ sở dữ liệu CINEMAX:'),

          // 1. roles
          createH2('1. Bảng: roles (Vai trò hệ thống)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Tên Cột', { isHeader: true, width: 22 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 38 })] }),
              new TableRow({ children: [createCell('id', { bold: true }), createCell('smallint'), createCell('PRIMARY KEY, IDENTITY'), createCell('Mã định danh vai trò (1: CUSTOMER, 2: STAFF, 3: ADMIN)')] }),
              new TableRow({ children: [createCell('code', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(20)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, UNIQUE', { bg: COLOR_ALT_ROW }), createCell('Mã vai trò định danh hệ thống (CUSTOMER, STAFF, ADMIN)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('name', { bold: true }), createCell('varchar(50)'), createCell('NOT NULL'), createCell('Tên hiển thị tiếng Việt (Khách hàng, Nhân viên, Quản trị viên)')] }),
            ],
          }),

          // 2. users
          createH2('2. Bảng: users (Hồ sơ người dùng & thành viên)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Tên Cột', { isHeader: true, width: 22 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 38 })] }),
              new TableRow({ children: [createCell('id', { bold: true }), createCell('uuid'), createCell('PRIMARY KEY, FK auth.users'), createCell('ID người dùng đồng bộ 1-1 với Supabase Auth')] }),
              new TableRow({ children: [createCell('role_id', { bold: true, bg: COLOR_ALT_ROW }), createCell('smallint', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, FK roles(id)', { bg: COLOR_ALT_ROW }), createCell('Vai trò của người dùng (Mặc định = 1: CUSTOMER)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('full_name', { bold: true }), createCell('varchar(100)'), createCell('NOT NULL'), createCell('Họ và tên đầy đủ của người dùng')] }),
              new TableRow({ children: [createCell('email', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(255)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, UNIQUE', { bg: COLOR_ALT_ROW }), createCell('Địa chỉ email đăng nhập và nhận vé điện tử', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('phone', { bold: true }), createCell('varchar(20)'), createCell('NULL, UNIQUE'), createCell('Số điện thoại liên hệ nhận thông báo')] }),
              new TableRow({ children: [createCell('gender', { bold: true, bg: COLOR_ALT_ROW }), createCell('gender (enum)', { bg: COLOR_ALT_ROW }), createCell('NULL', { bg: COLOR_ALT_ROW }), createCell('Giới tính (M, F, OTHER)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('birth_date', { bold: true }), createCell('date'), createCell('NULL'), createCell('Ngày sinh (dùng để xác thực độ tuổi khi mua vé T16, T18)')] }),
              new TableRow({ children: [createCell('loyalty_points', { bold: true, bg: COLOR_ALT_ROW }), createCell('integer', { bg: COLOR_ALT_ROW }), createCell('DEFAULT 0, >= 0', { bg: COLOR_ALT_ROW }), createCell('Điểm thưởng tích lũy thành viên (cộng khi thanh toán vé)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('is_active', { bold: true }), createCell('boolean'), createCell('DEFAULT true'), createCell('Trạng thái tài khoản (true: hoạt động, false: bị khóa)')] }),
            ],
          }),

          // 3. movies
          createH2('3. Bảng: movies (Danh mục phim chiếu rạp)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Tên Cột', { isHeader: true, width: 22 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 38 })] }),
              new TableRow({ children: [createCell('id', { bold: true }), createCell('integer'), createCell('PRIMARY KEY, IDENTITY'), createCell('Mã định danh duy nhất của phim')] }),
              new TableRow({ children: [createCell('title', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(255)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Tên phim tiếng Việt hiển thị chính', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('original_title', { bold: true }), createCell('varchar(255)'), createCell('NULL'), createCell('Tên gốc quốc tế của phim (tiếng Anh/bản địa)')] }),
              new TableRow({ children: [createCell('slug', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(255)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, UNIQUE', { bg: COLOR_ALT_ROW }), createCell('Đường dẫn URL thân thiện SEO (VD: dune-hanh-tinh-cat-2)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('duration_min', { bold: true }), createCell('smallint'), createCell('NOT NULL, > 0'), createCell('Thời lượng chiếu tính theo phút')] }),
              new TableRow({ children: [createCell('age_rating', { bold: true, bg: COLOR_ALT_ROW }), createCell('age_rating (enum)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, DEFAULT P', { bg: COLOR_ALT_ROW }), createCell('Phân loại độ tuổi (P, K, T13, T16, T18)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('status', { bold: true }), createCell('movie_status (enum)'), createCell('NOT NULL'), createCell('Trạng thái chiếu: COMING_SOON, NOW_SHOWING, ENDED')] }),
              new TableRow({ children: [createCell('poster_url', { bold: true, bg: COLOR_ALT_ROW }), createCell('text', { bg: COLOR_ALT_ROW }), createCell('NULL', { bg: COLOR_ALT_ROW }), createCell('Đường dẫn ảnh Poster dọc hiển thị thẻ phim', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('banner_url', { bold: true }), createCell('text'), createCell('NULL'), createCell('Đường dẫn ảnh Banner ngang lớn trên Hero Banner')] }),
              new TableRow({ children: [createCell('trailer_url', { bold: true, bg: COLOR_ALT_ROW }), createCell('text', { bg: COLOR_ALT_ROW }), createCell('NULL', { bg: COLOR_ALT_ROW }), createCell('Link YouTube trailer mở popup xem thử', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('imdb_score', { bold: true }), createCell('numeric(3,1)'), createCell('NULL, 0..10'), createCell('Điểm đánh giá quốc tế IMDb (VD: 8.1)')] }),
              new TableRow({ children: [createCell('is_deleted', { bold: true, bg: COLOR_ALT_ROW }), createCell('boolean', { bg: COLOR_ALT_ROW }), createCell('DEFAULT false', { bg: COLOR_ALT_ROW }), createCell('Soft delete (xóa mềm)', { bg: COLOR_ALT_ROW })] }),
            ],
          }),

          // 4. cinemas & rooms
          createH2('4. Bảng: cinemas (Cụm rạp chiếu) & rooms (Phòng chiếu)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Bảng & Cột', { isHeader: true, width: 25 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 35 })] }),
              new TableRow({ children: [createCell('cinemas.id', { bold: true }), createCell('integer'), createCell('PRIMARY KEY'), createCell('Mã định danh cụm rạp')] }),
              new TableRow({ children: [createCell('cinemas.name', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(150)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, UNIQUE', { bg: COLOR_ALT_ROW }), createCell('Tên cụm rạp (VD: Cinemax Hà Nội Centre)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('cinemas.address', { bold: true }), createCell('text'), createCell('NOT NULL'), createCell('Địa chỉ đầy đủ của cụm rạp')] }),
              new TableRow({ children: [createCell('cinemas.city', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(100)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Thành phố (Hà Nội, TP. Hồ Chí Minh, Đà Nẵng)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('cinemas.phone', { bold: true }), createCell('varchar(20)'), createCell('NULL'), createCell('Hotline liên hệ cụm rạp')] }),
              new TableRow({ children: [createCell('rooms.id', { bold: true, bg: COLOR_ALT_ROW }), createCell('integer', { bg: COLOR_ALT_ROW }), createCell('PRIMARY KEY', { bg: COLOR_ALT_ROW }), createCell('Mã định danh phòng chiếu', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('rooms.cinema_id', { bold: true }), createCell('integer'), createCell('NOT NULL, FK cinemas'), createCell('Thuộc về cụm rạp nào (ON DELETE CASCADE)')] }),
              new TableRow({ children: [createCell('rooms.name', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(50)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Tên phòng (Phòng 1 - IMAX Laser, Phòng 2 - 2D)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('rooms.screen_type', { bold: true }), createCell('screen_type (enum)'), createCell('NOT NULL'), createCell('Công nghệ phòng (2D, 3D, IMAX, 4DX)')] }),
              new TableRow({ children: [createCell('rooms.total_rows', { bold: true, bg: COLOR_ALT_ROW }), createCell('smallint', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, > 0', { bg: COLOR_ALT_ROW }), createCell('Số hàng ghế (mặc định 8 hàng A->H theo Figma)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('rooms.total_cols', { bold: true }), createCell('smallint'), createCell('NOT NULL, > 0'), createCell('Số cột ghế (mặc định 10 cột theo Figma)')] }),
            ],
          }),

          // 5. seat_types & seats
          createH2('5. Bảng: seat_types & seats (Sơ đồ bố trí ghế trong phòng)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Bảng & Cột', { isHeader: true, width: 25 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 35 })] }),
              new TableRow({ children: [createCell('seat_types.code', { bold: true }), createCell('varchar(20)'), createCell('UNIQUE'), createCell('STANDARD (Ghế thường), VIP, COUPLE (Ghế đôi)')] }),
              new TableRow({ children: [createCell('seat_types.capacity', { bold: true, bg: COLOR_ALT_ROW }), createCell('smallint', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, >= 1', { bg: COLOR_ALT_ROW }), createCell('Sức chứa (Ghế thường/VIP = 1, Ghế đôi = 2)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('seats.id', { bold: true }), createCell('integer'), createCell('PRIMARY KEY'), createCell('Mã định danh ghế')] }),
              new TableRow({ children: [createCell('seats.room_id', { bold: true, bg: COLOR_ALT_ROW }), createCell('integer', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, FK rooms', { bg: COLOR_ALT_ROW }), createCell('Thuộc về phòng chiếu nào', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('seats.row_label', { bold: true }), createCell('varchar(5)'), createCell('NOT NULL'), createCell('Nhãn hàng ghế (A, B, C, D, E, F, G, H)')] }),
              new TableRow({ children: [createCell('seats.seat_number', { bold: true, bg: COLOR_ALT_ROW }), createCell('smallint', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Số thứ tự ghế trong hàng (1..10)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('seats.grid_row / col', { bold: true }), createCell('smallint'), createCell('NOT NULL'), createCell('Tọa độ hàng và cột trên ma trận hiển thị')] }),
            ],
          }),

          // 6. showtimes & showtime_prices
          createH2('6. Bảng: showtimes & showtime_prices (Suất chiếu & Bảng giá vé)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Bảng & Cột', { isHeader: true, width: 25 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 35 })] }),
              new TableRow({ children: [createCell('showtimes.id', { bold: true }), createCell('integer'), createCell('PRIMARY KEY'), createCell('Mã suất chiếu')] }),
              new TableRow({ children: [createCell('showtimes.movie_id', { bold: true, bg: COLOR_ALT_ROW }), createCell('integer', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, FK movies', { bg: COLOR_ALT_ROW }), createCell('Phim được chiếu trong suất này', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('showtimes.room_id', { bold: true }), createCell('integer'), createCell('NOT NULL, FK rooms'), createCell('Phòng chiếu diễn ra suất')] }),
              new TableRow({ children: [createCell('showtimes.start_time', { bold: true, bg: COLOR_ALT_ROW }), createCell('timestamptz', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Thời điểm bắt đầu chiếu', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('showtimes.end_time', { bold: true }), createCell('timestamptz'), createCell('NOT NULL, > start_time'), createCell('Thời điểm kết thúc suất chiếu')] }),
              new TableRow({ children: [createCell('showtimes.status', { bold: true, bg: COLOR_ALT_ROW }), createCell('showtime_status', { bg: COLOR_ALT_ROW }), createCell('DEFAULT OPEN', { bg: COLOR_ALT_ROW }), createCell('Trạng thái mở bán: OPEN, CLOSED, CANCELLED', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('showtime_prices.price', { bold: true }), createCell('numeric(10,2)'), createCell('NOT NULL, >= 0'), createCell('Giá vé cơ sở chốt tại thời điểm đặt (VD: 90.000đ, 110.000đ, 210.000đ)')] }),
            ],
          }),

          // 7. bookings & tickets
          createH2('7. Bảng: bookings & tickets (Đơn đặt vé & Chi tiết từng vé)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Bảng & Cột', { isHeader: true, width: 25 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 35 })] }),
              new TableRow({ children: [createCell('bookings.id', { bold: true }), createCell('integer'), createCell('PRIMARY KEY'), createCell('Mã định danh đơn đặt')] }),
              new TableRow({ children: [createCell('bookings.booking_code', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(20)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, UNIQUE', { bg: COLOR_ALT_ROW }), createCell('Mã đơn đặt vé xuất trình (VD: CMX-982314)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('bookings.user_id', { bold: true }), createCell('uuid'), createCell('NULL, FK users'), createCell('Khách đăng nhập (hoặc NULL nếu khách vãng lai)')] }),
              new TableRow({ children: [createCell('bookings.showtime_id', { bold: true, bg: COLOR_ALT_ROW }), createCell('integer', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, FK showtimes', { bg: COLOR_ALT_ROW }), createCell('Suất chiếu của đơn đặt', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('bookings.status', { bold: true }), createCell('booking_status'), createCell('DEFAULT PENDING'), createCell('PENDING -> PAID (khi trả tiền) -> EXPIRED (quá 10p)')] }),
              new TableRow({ children: [createCell('bookings.expires_at', { bold: true, bg: COLOR_ALT_ROW }), createCell('timestamptz', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Hạn giữ ghế 10:00 (now() + 10 minutes)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('bookings.total_amount', { bold: true }), createCell('numeric(10,2)'), createCell('NOT NULL, >= 0'), createCell('Tổng thanh toán = Tiền vé + Tiền bắp nước - Giảm giá')] }),
              new TableRow({ children: [createCell('tickets.ticket_code', { bold: true, bg: COLOR_ALT_ROW }), createCell('varchar(30)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, UNIQUE', { bg: COLOR_ALT_ROW }), createCell('Mã vé điện tử dùng tạo mã QR soát vé tại rạp', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('tickets.status', { bold: true }), createCell('ticket_status'), createCell('DEFAULT HELD'), createCell('HELD (Đang giữ chỗ) -> SOLD (Đã bán) -> USED (Đã soát)')] }),
              new TableRow({ children: [createCell('tickets.checked_in_at', { bold: true, bg: COLOR_ALT_ROW }), createCell('timestamptz', { bg: COLOR_ALT_ROW }), createCell('NULL', { bg: COLOR_ALT_ROW }), createCell('Thời điểm nhân viên quét mã QR cho vào rạp', { bg: COLOR_ALT_ROW })] }),
            ],
          }),

          // 8. food_items, booking_items, promotions, payments
          createH2('8. Bảng: food_items, booking_items, promotions & payments'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({ children: [createCell('Bảng & Cột', { isHeader: true, width: 25 }), createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }), createCell('Ràng Buộc', { isHeader: true, width: 20 }), createCell('Mô Tả Nghiệp Vụ', { isHeader: true, width: 35 })] }),
              new TableRow({ children: [createCell('food_items.name', { bold: true }), createCell('varchar(100)'), createCell('NOT NULL'), createCell('Tên combo (VD: Combo 1 bắp + 1 nước)')] }),
              new TableRow({ children: [createCell('food_items.price', { bold: true, bg: COLOR_ALT_ROW }), createCell('numeric(10,2)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, >= 0', { bg: COLOR_ALT_ROW }), createCell('Giá bán niêm yết của combo (VD: 69.000đ)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('booking_items.quantity', { bold: true }), createCell('smallint'), createCell('NOT NULL, > 0'), createCell('Số lượng combo đặt trong đơn hàng')] }),
              new TableRow({ children: [createCell('booking_items.unit_price', { bold: true, bg: COLOR_ALT_ROW }), createCell('numeric(10,2)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL', { bg: COLOR_ALT_ROW }), createCell('Giá chốt tại thời điểm đặt (tránh bị lệch khi đổi giá)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('promotions.code', { bold: true }), createCell('varchar(50)'), createCell('NOT NULL, UNIQUE'), createCell('Mã giảm giá (VD: GIAM20K, CHAOBANMOI)')] }),
              new TableRow({ children: [createCell('promotions.discount_value', { bold: true, bg: COLOR_ALT_ROW }), createCell('numeric(10,2)', { bg: COLOR_ALT_ROW }), createCell('NOT NULL, > 0', { bg: COLOR_ALT_ROW }), createCell('Mức giảm (% hoặc số tiền VNĐ)', { bg: COLOR_ALT_ROW })] }),
              new TableRow({ children: [createCell('payments.method', { bold: true }), createCell('payment_method'), createCell('NOT NULL'), createCell('Cổng thanh toán: MOMO, VNPAY, ZALOPAY, CARD, CASH')] }),
              new TableRow({ children: [createCell('payments.status', { bold: true, bg: COLOR_ALT_ROW }), createCell('payment_status', { bg: COLOR_ALT_ROW }), createCell('DEFAULT PENDING', { bg: COLOR_ALT_ROW }), createCell('PENDING -> SUCCESS -> FAILED', { bg: COLOR_ALT_ROW })] }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 4: CÁC RÀNG BUỘC TOÀN VẸN VÀ CHÍNH SÁCH BẢO MẬT (RLS)
          // ------------------------------------------------------------------
          createH1('IV. RÀNG BUỘC TOÀN VẸN VÀ CHÍNH SÁCH BẢO MẬT DỮ LIỆU'),
          
          createH2('1. Ràng Buộc Khóa Chống Trùng Ghế (Crucial Integrity Constraint)'),
          createP('Hệ thống thiết lập một Partial Unique Index đặc biệt trên bảng tickets:'),
          createP('CREATE UNIQUE INDEX uq_tickets_active_seat ON tickets (showtime_id, seat_id) WHERE status IN (\'HELD\', \'SOLD\', \'USED\');', {
            bold: true,
            color: COLOR_PRIMARY,
            bg: COLOR_ALT_ROW,
          }),
          createP('Ý nghĩa sống còn: Đảm bảo ở mức database engine rằng trong cùng 1 suất chiếu, một chiếc ghế KHÔNG BAO GIỜ bị 2 giao dịch đồng thời đặt trùng nhau, kể cả khi cả 2 khách hàng bấm chọn cùng một mili-giây.'),

          createH2('2. Phân Quyền Cấp Hàng (Row Level Security - RLS Policies)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Bảng Dữ Liệu', { isHeader: true, width: 25 }),
                  createCell('Chính Sách Quyền Đọc (SELECT)', { isHeader: true, width: 35 }),
                  createCell('Chính Sách Quyền Ghi (INSERT/UPDATE/DELETE)', { isHeader: true, width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('movies, cinemas, rooms, seats, showtimes, food_items, promotions', { bold: true }),
                  createCell('PUBLIC READ: Cho phép mọi người (kể cả khách vãng lai) truy vấn đọc.'),
                  createCell('ADMIN & STAFF ONLY: Chỉ tài khoản có phân quyền ADMIN mới được thêm, sửa, xóa.'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('users', { bold: true, bg: COLOR_ALT_ROW }),
                  createCell('Chỉ chủ sở hữu (auth.uid() = id) hoặc ADMIN được đọc hồ sơ.', { bg: COLOR_ALT_ROW }),
                  createCell('Chỉ chủ sở hữu được sửa thông tin cá nhân; trigger tự động chèn.', { bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('bookings, tickets, payments', { bold: true }),
                  createCell('Chỉ chủ sở hữu đơn (auth.uid() = user_id) hoặc STAFF/ADMIN mới có quyền xem.'),
                  createCell('Ghi thông qua hàm giao dịch bảo mật (atomic function), cấm cập nhật trực tiếp từ client.'),
                ],
              }),
            ],
          }),

          // ------------------------------------------------------------------
          // PHẦN 5: CÁC HÀM GIAO DỊCH NGUYÊN TỬ (ATOMIC PROCEDURES)
          // ------------------------------------------------------------------
          createH1('V. CÁC HÀM GIAO DỊCH NGUYÊN TỬ (DATABASE FUNCTIONS)'),
          createP('Ba hàm giao dịch nguyên tử (Stored Procedures) quan trọng nhất đảm bảo tính nhất quán (ACID):'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderConfig,
            rows: [
              new TableRow({
                children: [
                  createCell('Tên Hàm Database', { isHeader: true, width: 30 }),
                  createCell('Tham Số Đầu Vào', { isHeader: true, width: 30 }),
                  createCell('Hành Động & Nguyên Tắc Nguyên Tử (ACID)', { isHeader: true, width: 40 }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('fn_hold_seats', { bold: true }),
                  createCell('p_showtime_id, p_user_id, p_seat_ids[], p_food_items[]'),
                  createCell('Trong 1 TRANSACTION duy nhất:\n1. Kiểm tra toàn bộ ghế có đang trống không.\n2. Tạo bản ghi bookings trạng thái PENDING với expires_at = now() + 10 phút.\n3. Tạo các dòng tickets trạng thái HELD.\n4. Nếu bất kỳ ghế nào bị trùng → ROLLBACK toàn bộ và ném ngoại lệ ngay lập tức.'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('fn_confirm_payment', { bold: true, bg: COLOR_ALT_ROW }),
                  createCell('p_booking_id, p_payment_method, p_transaction_ref', { bg: COLOR_ALT_ROW }),
                  createCell('Khi cổng thanh toán gọi Webhook callback thành công:\n1. Cập nhật payments -> SUCCESS.\n2. Chuyển bookings -> PAID.\n3. Chuyển tickets -> SOLD (vé chính thức phát hành).\n4. Tăng used_count ở promotions nếu có áp mã.', { bg: COLOR_ALT_ROW }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('fn_cleanup_expired_bookings', { bold: true }),
                  createCell('(Chạy tự động theo lịch Cron định kỳ mỗi phút)'),
                  createCell('Tìm tất cả đơn có status = PENDING và expires_at < now():\n1. Chuyển bookings -> EXPIRED.\n2. Chuyển tickets -> CANCELLED.\n3. Ghế tự động được giải phóng để người khác vào đặt.'),
                ],
              }),
            ],
          }),

          createP('--- HẾT BẢN ĐẶC TẢ CƠ SỞ DỮ LIỆU & ERD CINEMAX ---', {
            alignment: AlignmentType.CENTER,
            bold: true,
            color: COLOR_MUTED,
            spacing: { before: 300 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filePath = path.join(process.cwd(), 'TAI_LIEU_ERD_CO_SO_DU_LIEU_CINEMAX.docx');
  fs.writeFileSync(filePath, buffer);
  console.log(`Document 2 generated successfully at: ${filePath}`);
}

async function main() {
  try {
    await generateFeaturesAndRolesDoc();
    await generateDatabaseAndErdDoc();
    console.log('ALL WORD DOCUMENTS GENERATED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error generating documents:', err);
    process.exit(1);
  }
}

main();
