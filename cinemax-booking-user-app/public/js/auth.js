/**
 * XÁC THỰC TÀI KHOẢN & QUẢN LÝ THÀNH VIÊN
 * Đăng nhập, Đăng ký (Modal ảnh 2 & 3), Quản lý vé và Điểm tích lũy
 */

class CinemaxAuth {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('cinemax_user') || 'null');
    this.token = localStorage.getItem('cinemax_token') || null;
    this.initUI();
  }

  initUI() {
    this.updateUserNav();
  }

  getCurrentUserId() {
    return this.currentUser ? this.currentUser.id : null;
  }

  openModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('active');
    this.switchTab(tab);
  }

  closeModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  }

  switchTab(tab) {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    } else {
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'block';
    }
  }

  async login(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        this.token = data.token;
        localStorage.setItem('cinemax_user', JSON.stringify(data.user));
        localStorage.setItem('cinemax_token', data.token);

        this.closeModal();
        this.updateUserNav();
        if (window.showToast) window.showToast(`Xin chào ${data.user.full_name}!`, 'success');
      } else {
        alert(data.error || 'Đăng nhập không thành công');
      }
    } catch (e) {
      console.error('Lỗi đăng nhập:', e);
    }
  }

  async register(fullName, phone, email, password) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, email, password })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        this.token = data.token;
        localStorage.setItem('cinemax_user', JSON.stringify(data.user));
        localStorage.setItem('cinemax_token', data.token);

        this.closeModal();
        this.updateUserNav();
        if (window.showToast) window.showToast('Chúc mừng bạn đã trở thành Hội viên CINEMAX!', 'success');
      } else {
        alert(data.error || 'Đăng ký không thành công');
      }
    } catch (e) {
      console.error('Lỗi đăng ký:', e);
    }
  }

  logout() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('cinemax_user');
    localStorage.removeItem('cinemax_token');
    this.updateUserNav();
    if (window.showToast) window.showToast('Đã đăng xuất khỏi tài khoản.', 'info');
  }

  updateUserNav() {
    const btnLogin = document.getElementById('nav-btn-login');
    const badgeUser = document.getElementById('nav-user-badge');
    const userName = document.getElementById('nav-user-name');

    if (this.currentUser) {
      if (btnLogin) btnLogin.style.display = 'none';
      if (badgeUser) badgeUser.style.display = 'flex';
      if (userName) userName.innerText = this.currentUser.full_name;
    } else {
      if (btnLogin) btnLogin.style.display = 'block';
      if (badgeUser) badgeUser.style.display = 'none';
    }
  }
}

window.cinemaxAuth = new CinemaxAuth();
