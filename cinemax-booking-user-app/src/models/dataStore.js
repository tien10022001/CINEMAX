/**
 * IN-MEMORY DATA STORE & SEED DATA CHO CINEMAX
 * Đầy đủ dữ liệu phim, rạp, suất chiếu, 80 ghế, bắp nước, combo, mã giảm giá và hội viên
 */

const { BASE_SEAT_PRICES, SEAT_STATUS } = require('../config/constants');

class DataStore {
  constructor() {
    this.movies = [];
    this.cinemas = [];
    this.showtimes = [];
    this.showtimeSeats = {}; // key: showtimeId -> Array of 80 seats
    this.products = [];
    this.productModifiers = [];
    this.coupons = [];
    this.users = [];
    this.orders = [];
    this.tickets = [];
    this.news = [];

    this.initSeedData();
  }

  initSeedData() {
    // 1. Phim chiếu rạp (Bám sát ảnh giao diện)
    this.movies = [
      {
        id: 'mv-dune-2',
        title: 'Dune: Hành Tinh Cát - Phần 2',
        slug: 'dune-hanh-tinh-cat-phan-2',
        synopsis: 'Paul Atreides hợp nhất với Chani và người Fremen trên con đường báo thù gia tộc Harkonnen đã hủy hoại gia đình mình.',
        director: 'Denis Villeneuve',
        cast: 'Timothée Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem',
        duration_minutes: 166,
        age_rating: 'T16',
        genres: ['Hành Động', 'Khoa Học Viễn Tưởng', 'Phiêu Lưu'],
        language: 'Tiếng Anh - Phụ đề Tiếng Việt',
        format: '2D / IMAX',
        poster_url: 'assets/posters/dune2.jpg',
        banner_url: 'assets/posters/dune2_banner.jpg',
        trailer_url: 'https://www.youtube.com/watch?v=Way9Dexny3w',
        status: 'now_showing', // 'now_showing', 'sneak_show', 'coming_soon'
        is_sneak_show: true,
        release_date: '2026-03-15'
      },
      {
        id: 'mv-conan-27',
        title: 'Thám Tử Lừng Danh Conan: Ngôi Sao 5 Cánh',
        slug: 'conan-ngoi-sao-5-canh',
        synopsis: 'Một vụ án bí ẩn xoay quanh thanh kiếm cổ của kiếm khách Toshizo Hijikata và cuộc đối đầu nghẹt thở giữa Conan và Siêu đạo chích Kid tại Hakodate.',
        director: 'Chika Nagaoka',
        cast: 'Minami Takayama, Wakana Yamazaki, Kappei Yamaguchi',
        duration_minutes: 110,
        age_rating: 'T13',
        genres: ['Hoạt Hình', 'Bí Ẩn', 'Trinh Thám'],
        language: 'Tiếng Nhật - Phụ đề & Lồng tiếng Việt',
        format: '2D',
        poster_url: 'assets/posters/conan.jpg',
        banner_url: 'assets/posters/conan_banner.jpg',
        trailer_url: 'https://www.youtube.com/watch?v=conan_trailer',
        status: 'now_showing',
        is_sneak_show: true,
        release_date: '2026-04-10'
      },
      {
        id: 'mv-avatar-3',
        title: 'Avatar: Lửa Và Tro Tàn',
        slug: 'avatar-lua-va-tro-tan',
        synopsis: 'Jake Sully và Neytiri đối mặt với bộ tộc Người Tro (Ash People) hung bạo trên hành tinh Pandora, mở ra chương đen tối nhất của cuộc chiến sinh tồn.',
        director: 'James Cameron',
        cast: 'Sam Worthington, Zoe Saldana, Sigourney Weaver',
        duration_minutes: 190,
        age_rating: 'T13',
        genres: ['Khoa Học Viễn Tưởng', 'Hành Động', 'Sử Thi'],
        language: 'Tiếng Anh - Phụ đề Tiếng Việt',
        format: '3D / IMAX 3D',
        poster_url: 'assets/posters/avatar.jpg',
        banner_url: 'assets/posters/avatar_banner.jpg',
        trailer_url: 'https://www.youtube.com/watch?v=avatar3_trailer',
        status: 'sneak_show',
        is_sneak_show: true,
        release_date: '2026-12-18'
      },
      {
        id: 'mv-mai',
        title: 'Mai',
        slug: 'phim-mai',
        synopsis: 'Mai - người phụ nữ gần 40 tuổi làm nghề massage, tình cờ gặp chàng trai trẻ đào hoa Dương. Mối tình chớm nở gặp muôn vàn định kiến xã hội.',
        director: 'Trấn Thành',
        cast: 'Phương Anh Đào, Tuấn Trần, Trấn Thành, Hồng Đào',
        duration_minutes: 131,
        age_rating: 'T18',
        genres: ['Tâm Lý', 'Tình Cảm'],
        language: 'Tiếng Việt',
        format: '2D',
        poster_url: 'assets/posters/mai.jpg',
        banner_url: 'assets/posters/mai_banner.jpg',
        trailer_url: 'https://www.youtube.com/watch?v=mai_trailer',
        status: 'now_showing',
        is_sneak_show: false,
        release_date: '2026-02-10'
      },
      {
        id: 'mv-godzilla-kong',
        title: 'Godzilla x Kong: Đế Chế Mới',
        slug: 'godzilla-x-kong-de-che-moi',
        synopsis: 'Hai quái thú huyền thoại Godzilla và Kong buộc phải liên minh để đối đầu với mối đe dọa khổng lồ ẩn sâu dưới lòng Trái Đất.',
        director: 'Adam Wingard',
        cast: 'Rebecca Hall, Brian Tyree Henry, Dan Stevens',
        duration_minutes: 115,
        age_rating: 'T13',
        genres: ['Hành Động', 'Quái Thú', 'Viễn Tưởng'],
        language: 'Tiếng Anh - Phụ đề Tiếng Việt',
        format: '2D / 3D',
        poster_url: 'assets/posters/godzilla.jpg',
        banner_url: 'assets/posters/godzilla_banner.jpg',
        trailer_url: 'https://www.youtube.com/watch?v=gxk_trailer',
        status: 'now_showing',
        is_sneak_show: false,
        release_date: '2026-03-29'
      },
      {
        id: 'mv-kungfu-panda-4',
        title: 'Kung Fu Panda 4',
        slug: 'kung-fu-panda-4',
        synopsis: 'Po chuẩn bị trở thành Thủ lĩnh tinh thần của Thung lũng Hòa Bình và phải huấn luyện một hậu duệ mới trong khi đối mặt với phù thủy Tắc Kè Hoa.',
        director: 'Mike Mitchell',
        cast: 'Jack Black, Awkwafina, Viola Davis, Dustin Hoffman',
        duration_minutes: 94,
        age_rating: 'P',
        genres: ['Hoạt Hình', 'Hài Hước', 'Võ Thuật'],
        language: 'Lồng tiếng & Phụ đề Tiếng Việt',
        format: '2D',
        poster_url: 'assets/posters/panda.jpg',
        banner_url: 'assets/posters/panda_banner.jpg',
        trailer_url: 'https://www.youtube.com/watch?v=panda4_trailer',
        status: 'coming_soon',
        is_sneak_show: false,
        release_date: '2026-11-20'
      }
    ];

    // 2. Cụm Rạp Chiếu (Chuẩn ảnh 5)
    this.cinemas = [
      {
        id: 'cinema-plaza',
        name: 'CINEMAX Plaza',
        address: 'Tòa nhà FPT Polytechnic, Phố Trịnh Văn Bô, Nam Từ Liêm, Hà Nội',
        city: 'Hà Nội',
        phone: '024 7300 1955',
        status: 'Đang mở bán',
        total_rooms: 6
      },
      {
        id: 'cinema-cau-giay',
        name: 'Cinemax Cầu Giấy',
        address: 'Tầng 4, 45 Trần Thái Tông, Cầu Giấy, Hà Nội',
        city: 'Hà Nội',
        phone: '024 7300 2233',
        status: 'Đang mở bán',
        total_rooms: 5
      },
      {
        id: 'cinema-landmark-81',
        name: 'Cinemax Landmark 81',
        address: 'Tầng B1, Vincom Landmark 81, Bình Thạnh, TP. Hồ Chí Minh',
        city: 'Hồ Chí Minh',
        phone: '028 7300 8899',
        status: 'Đang mở bán',
        total_rooms: 8
      }
    ];

    // 3. Suất Chiếu (Showtimes) chuẩn các mốc giờ trong ảnh
    const dates = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'];
    
    // Suất chiếu tại CINEMAX Plaza cho Dune 2
    const baseTimes = [
      { time: '01:33', is_past: true, total: 80, available: 0, room: 'Phòng 1 - 2D' },
      { time: '10:00', is_past: false, total: 80, available: 80, room: 'Phòng 3 - 2D' },
      { time: '12:45', is_past: false, total: 80, available: 80, room: 'Phòng 2 - 2D' },
      { time: '15:30', is_past: false, total: 80, available: 80, room: 'Phòng 3 - 2D' },
      { time: '18:15', is_past: false, total: 80, available: 80, room: 'Phòng 1 - 2D' },
      { time: '21:00', is_past: false, total: 80, available: 80, room: 'Phòng 2 - 2D' },
      { time: '23:33', is_past: false, total: 80, available: 61, room: 'Phòng 3 - 2D' }
    ];

    let stCounter = 1;
    dates.forEach(d => {
      baseTimes.forEach(bt => {
        const showtimeId = `st-${stCounter++}`;
        const stObj = {
          id: showtimeId,
          movie_id: 'mv-dune-2',
          cinema_id: 'cinema-plaza',
          auditorium_name: bt.room,
          screen_type: '2D',
          format: '2D Phụ đề Việt',
          date: d,
          time: bt.time,
          starts_at: `${d}T${bt.time}:00+07:00`,
          total_seats: bt.total,
          available_seats: bt.available,
          is_past: (d === '2026-10-17' && bt.is_past),
          status: (d === '2026-10-17' && bt.is_past) ? 'finished' : 'open'
        };
        this.showtimes.push(stObj);

        // Tạo 80 ghế ma trận cho suất chiếu này
        this.generateShowtimeSeats(showtimeId, bt.available, bt.total);
      });

      // Thêm suất chiếu cho Cầu Giấy và Landmark 81
      ['09:30', '12:15', '15:00', '18:30', '21:15'].forEach(t => {
        const idCG = `st-${stCounter++}`;
        this.showtimes.push({
          id: idCG,
          movie_id: 'mv-dune-2',
          cinema_id: 'cinema-cau-giay',
          auditorium_name: 'Phòng 1 - 2D',
          screen_type: '2D',
          format: '2D Phụ đề Việt',
          date: d,
          time: t,
          starts_at: `${d}T${t}:00+07:00`,
          total_seats: 80,
          available_seats: 80,
          is_past: false,
          status: 'open'
        });
        this.generateShowtimeSeats(idCG, 80, 80);

        const idLM = `st-${stCounter++}`;
        this.showtimes.push({
          id: idLM,
          movie_id: 'mv-dune-2',
          cinema_id: 'cinema-landmark-81',
          auditorium_name: 'Phòng IMAX - Laser',
          screen_type: 'IMAX',
          format: '2D Phụ đề Việt',
          date: d,
          time: t,
          starts_at: `${d}T${t}:00+07:00`,
          total_seats: 80,
          available_seats: 80,
          is_past: false,
          status: 'open'
        });
        this.generateShowtimeSeats(idLM, 80, 80);
      });
    });

    // 4. Concessions & Bắp Nước F&B (Chuẩn DB Sheet HK2T)
    this.products = [
      {
        id: 'prod-combo-solo',
        name: 'Combo Solo 1 Người',
        product_type: 'COMBO',
        base_price: 85000,
        description: '1 Bắp rang bơ (Vị ngọt) + 1 Nước ngọt có ga (Size M)',
        image_url: 'assets/concessions/combo_solo.png',
        active: true
      },
      {
        id: 'prod-combo-couple',
        name: 'Combo Đôi Bạn Thân',
        product_type: 'COMBO',
        base_price: 125000,
        description: '1 Bắp rang bơ lớn (Vị ngọt) + 2 Nước ngọt có ga (Size L)',
        image_url: 'assets/concessions/combo_couple.png',
        active: true
      },
      {
        id: 'prod-combo-vip',
        name: 'Combo Gia Đình VIP',
        product_type: 'COMBO',
        base_price: 199000,
        description: '2 Bắp rang bơ lớn + 3 Nước ngọt + 1 Phần Snack khoai tây chiên',
        image_url: 'assets/concessions/combo_vip.png',
        active: true
      },
      {
        id: 'prod-popcorn-sweet',
        name: 'Bắp Rang Bơ (Hộp Giấy)',
        product_type: 'FOOD',
        base_price: 55000,
        description: 'Bắp rang bơ giòn rụm béo thơm làm từ ngô Mỹ nhập khẩu',
        image_url: 'assets/concessions/popcorn.png',
        active: true
      },
      {
        id: 'prod-drink-soda',
        name: 'Nước Ngọt Có Ga Ly Giấy',
        product_type: 'BEVERAGE',
        base_price: 35000,
        description: 'Coca Cola / Sprite / Fanta mát lạnh',
        image_url: 'assets/concessions/drink.png',
        active: true
      }
    ];

    // Tùy chọn đổi vị, đổi nước, tăng size
    this.productModifiers = [
      // Nhóm đổi vị bắp
      { id: 'mod-pop-sweet', product_id: 'all_popcorn', group: 'popcorn_flavor', name: 'Bắp Vị Ngọt (Mặc định)', extra_price: 0, is_default: true },
      { id: 'mod-pop-cheese', product_id: 'all_popcorn', group: 'popcorn_flavor', name: 'Bắp Vị Phô Mai Mặn', extra_price: 10000, is_default: false },
      { id: 'mod-pop-caramel', product_id: 'all_popcorn', group: 'popcorn_flavor', name: 'Bắp Vị Caramel Đậm Đà', extra_price: 10000, is_default: false },
      // Nhóm đổi loại nước
      { id: 'mod-drink-coca', product_id: 'all_drinks', group: 'drink_type', name: 'Coca Cola', extra_price: 0, is_default: true },
      { id: 'mod-drink-sprite', product_id: 'all_drinks', group: 'drink_type', name: 'Sprite', extra_price: 0, is_default: false },
      { id: 'mod-drink-fanta', product_id: 'all_drinks', group: 'drink_type', name: 'Fanta Cam', extra_price: 0, is_default: false },
      { id: 'mod-drink-peach', product_id: 'all_drinks', group: 'drink_type', name: 'Trà Đào Hạt Chia (+5.000đ)', extra_price: 5000, is_default: false },
      // Nhóm kích cỡ
      { id: 'mod-size-m', product_id: 'all_combos', group: 'size', name: 'Size Tiêu Chuẩn (M)', extra_price: 0, is_default: true },
      { id: 'mod-size-l', product_id: 'all_combos', group: 'size', name: 'Nâng Cấp Cỡ Đại (Size L)', extra_price: 15000, is_default: false }
    ];

    // 5. Mã Giảm Giá (Coupons)
    this.coupons = [
      {
        code: 'CINEMAX20',
        discount_type: 'PERCENT',
        discount_value: 20, // 20%
        max_discount: 50000,
        min_order_amount: 100000,
        apply_scope: 'ALL',
        description: 'Giảm 20% tối đa 50k cho đơn từ 100k',
        active: true
      },
      {
        code: 'TICKET10',
        discount_type: 'FIXED',
        discount_value: 10000,
        min_order_amount: 90000,
        apply_scope: 'TICKET_ONLY',
        description: 'Giảm 10.000đ tiền vé xem phim',
        active: true
      },
      {
        code: 'BAPNUOC15',
        discount_type: 'PERCENT',
        discount_value: 15,
        max_discount: 30000,
        min_order_amount: 80000,
        apply_scope: 'COMBO_ONLY',
        description: 'Giảm 15% bắp nước combo',
        active: true
      }
    ];

    // 6. Tài khoản Người dùng mẫu
    this.users = [
      {
        id: 'usr-demo-01',
        full_name: 'Nguyễn Văn A',
        email: 'user@cinemax.vn',
        phone: '0912345678',
        password_hash: 'password123',
        role: 'user',
        loyalty_points: 15000,
        membership_tier: 'VIP',
        created_at: '2026-01-01T00:00:00Z'
      }
    ];

    // 7. Tin Tức Điện Ảnh (Chuẩn ảnh 7)
    this.news = [
      {
        id: 'news-1',
        title: 'Dune: Hành Tinh Cát 2 lập kỷ lục phòng vé toàn cầu với định dạng IMAX',
        summary: 'Siêu phẩm của đạo diễn Denis Villeneuve tiếp tục phá vỡ mọi cột mốc doanh thu phòng vé với định dạng IMAX Laser độc quyền.',
        date: '28/03/2026',
        category: 'Phòng vé',
        author: 'Cinemax Editorial',
        image_url: 'assets/posters/dune2_banner.jpg',
        read_time: '3 phút'
      },
      {
        id: 'news-2',
        title: 'Trải nghiệm công nghệ âm thanh Dolby Atmos thế hệ mới tại Cinemax',
        summary: 'Hệ thống âm thanh đa chiều 64 kênh mang đến cảm giác sống động như đang thực sự hiện diện giữa bối cảnh phim.',
        date: '25/03/2026',
        category: 'Công nghệ',
        author: 'Kỹ thuật Cinemax',
        image_url: 'assets/posters/cinema_hall.jpg',
        read_time: '5 phút'
      },
      {
        id: 'news-3',
        title: 'Chương trình Ngày Hội Thành Viên Cinemax: Nhân đôi điểm thưởng và tặng bắp nước',
        summary: 'Mỗi thứ 4 hàng tuần, thành viên CINEMAX được nhân đôi điểm thưởng loyalty và nhận combo bắp nước với giá ưu đãi đặc biệt.',
        date: '20/03/2026',
        category: 'Khuyến mãi',
        author: 'CSKH Cinemax',
        image_url: 'assets/posters/loyalty_event.jpg',
        read_time: '2 phút'
      }
    ];
  }

  /**
   * Tạo 80 ghế ma trận (A1-H10) cho mỗi suất chiếu
   */
  generateShowtimeSeats(showtimeId, availableCount, totalCount) {
    const seats = [];
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cols = 10;

    let soldTarget = totalCount - availableCount;
    let soldCount = 0;

    rows.forEach((row, rIdx) => {
      for (let c = 1; c <= cols; c++) {
        const seatId = `${row}${c}`;
        let seatType = 'STANDARD';
        let basePrice = BASE_SEAT_PRICES.STANDARD;
        let seatGroup = null;

        if (rIdx >= 0 && rIdx <= 4) {
          seatType = 'STANDARD';
          basePrice = BASE_SEAT_PRICES.STANDARD; // 90.000đ
        } else if (rIdx === 5 || rIdx === 6) {
          seatType = 'VIP';
          basePrice = BASE_SEAT_PRICES.VIP; // 110.000đ
        } else if (rIdx === 7) {
          seatType = 'COUPLE';
          basePrice = BASE_SEAT_PRICES.COUPLE; // 210.000đ
          const pairIndex = Math.ceil(c / 2);
          seatGroup = `COUPLE_${pairIndex}`;
        }

        let status = SEAT_STATUS.AVAILABLE;
        // Nếu là suất có ghế đã bán (ví dụ 61/80 trống -> 19 ghế đã bán)
        if (soldCount < soldTarget && Math.random() < 0.25) {
          status = SEAT_STATUS.SOLD;
          soldCount++;
        }

        seats.push({
          seat_id: seatId,
          showtime_id: showtimeId,
          row_label: row,
          seat_number: c,
          grid_row: rIdx + 1,
          grid_col: c,
          seat_type: seatType,
          seat_group: seatGroup,
          base_price: basePrice,
          status: status,
          held_until: null,
          held_by: null,
          order_id: null
        });
      }
    });

    this.showtimeSeats[showtimeId] = seats;
  }

  getShowtimeSeats(showtimeId) {
    if (!this.showtimeSeats[showtimeId]) {
      this.generateShowtimeSeats(showtimeId, 80, 80);
    }
    return this.showtimeSeats[showtimeId];
  }
}

// Singleton
module.exports = new DataStore();
