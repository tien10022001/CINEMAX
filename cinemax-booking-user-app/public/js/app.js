/**
 * CLIENT APPLICATION CONTROLLER
 * Điều hướng trang (SPA), lọc phim, lọc suất chiếu và hiển thị thông báo
 */

class CinemaxApp {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadMovies();
    this.loadNews();
  }

  bindEvents() {
    // Điều hướng thanh menu
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.page;
        this.showPage(page);
      });
    });

    // Logo click về trang chủ
    document.querySelector('.brand-logo').addEventListener('click', () => {
      this.showPage('home');
    });
  }

  showPage(pageName) {
    // Cập nhật tab active trên menu
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.dataset.page === pageName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Ẩn tất cả trang và hiển thị trang được chọn
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${pageName}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async loadMovies(status = 'all') {
    const gridEl = document.getElementById('movies-grid');
    const homeGridEl = document.getElementById('home-movies-grid');
    if (!gridEl && !homeGridEl) return;

    try {
      const res = await fetch(`/api/movies?status=${status}`);
      const json = await res.json();
      if (!json.success) return;

      const html = json.data.map(m => `
        <div class="movie-card">
          <div class="movie-poster-box">
            <span class="movie-age-badge">${m.age_rating}</span>
            <div style="font-size:5rem;display:flex;align-items:center;justify-content:center;height:100%;color:#4B5563;">🎬</div>
          </div>
          <div class="movie-info-box">
            <div class="movie-title">${m.title}</div>
            <div class="movie-meta-small">${m.age_rating} • ${m.duration_minutes} phút</div>
            <button class="btn-book-ticket" onclick="window.cinemaxApp.showPage('showtimes')">Đặt vé</button>
          </div>
        </div>
      `).join('');

      if (gridEl) gridEl.innerHTML = html;
      if (homeGridEl) homeGridEl.innerHTML = html;
    } catch (e) {
      console.error('Lỗi tải danh mục phim:', e);
    }
  }

  async loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    try {
      const res = await fetch('/api/news');
      const json = await res.json();
      if (!json.success) return;

      container.innerHTML = json.data.map(n => `
        <div class="news-card">
          <div style="height:180px;background:#1E2538;display:flex;align-items:center;justify-content:center;font-size:3rem;">📰</div>
          <div class="news-body">
            <div class="news-meta-top">
              <span>${n.date}</span>
              <span class="news-tag">${n.category}</span>
            </div>
            <div class="news-title">${n.title}</div>
            <div class="news-summary">${n.summary}</div>
            <div class="news-footer">
              <span class="news-author">${n.author}</span>
              <a href="#" class="news-link">Đọc tiếp →</a>
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Lỗi tải tin tức:', e);
    }
  }

  filterMoviesTab(tabStatus, btn) {
    document.querySelectorAll('.filter-tab-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.loadMovies(tabStatus);
  }
}

// Toast notification helper
window.showToast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>🔔</span> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

window.cinemaxApp = new CinemaxApp();
