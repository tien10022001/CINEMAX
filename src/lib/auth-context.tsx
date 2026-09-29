'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, phone: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  authModalTab: 'LOGIN' | 'REGISTER';
  openAuthModal: (tab?: 'LOGIN' | 'REGISTER') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial pre-seeded accounts in local store if not yet set
const SEED_USERS: (User & { password?: string })[] = [
  {
    id: 'usr-admin-001',
    role_id: 3,
    role_code: 'ADMIN',
    full_name: 'Quản trị viên Cinemax',
    email: 'admin@cinemax.vn',
    password: 'admin',
    phone: '0988888888',
    loyalty_points: 9999,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-cust-001',
    role_id: 1,
    role_code: 'CUSTOMER',
    full_name: 'Nguyễn Văn A',
    email: 'user@cinemax.vn',
    password: 'user123',
    phone: '0912345678',
    loyalty_points: 150,
    is_active: true,
    created_at: '2026-02-15',
    updated_at: '2026-02-15',
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Load session from localStorage on client mount (Default is NULL / GUEST)
  useEffect(() => {
    try {
      // 1. Ensure user database exists
      const existingDb = localStorage.getItem('cinemax_users_db');
      if (!existingDb) {
        localStorage.setItem('cinemax_users_db', JSON.stringify(SEED_USERS));
      }

      // 2. Load active session
      const savedSession = localStorage.getItem('cinemax_session_user');
      if (savedSession) {
        const user = JSON.parse(savedSession);
        setCurrentUser(user);
      } else {
        // GUEST by default - No hardcoded user!
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Error loading auth session', err);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const existingDbStr = localStorage.getItem('cinemax_users_db');
      const users: (User & { password?: string })[] = existingDbStr
        ? JSON.parse(existingDbStr)
        : SEED_USERS;

      const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        return { success: false, error: 'Email không tồn tại trong hệ thống. Vui lòng đăng ký tài khoản.' };
      }

      // Check password if set
      if (user.password && password && user.password !== password) {
        return { success: false, error: 'Mật khẩu không chính xác.' };
      }

      const { password: _, ...userSession } = user;
      setCurrentUser(userSession);
      localStorage.setItem('cinemax_session_user', JSON.stringify(userSession));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Đã có lỗi xảy ra khi đăng nhập.' };
    }
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const existingDbStr = localStorage.getItem('cinemax_users_db');
      const users: (User & { password?: string })[] = existingDbStr
        ? JSON.parse(existingDbStr)
        : SEED_USERS;

      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return { success: false, error: 'Email này đã được sử dụng. Vui lòng đăng nhập.' };
      }

      const newUser: User & { password?: string } = {
        id: 'usr-' + Date.now(),
        role_id: 1,
        role_code: 'CUSTOMER',
        full_name: name.trim(),
        email: cleanEmail,
        phone: phone.trim() || '0900000000',
        password: password || '123456',
        loyalty_points: 50, // Welcome gift 50 points
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      users.push(newUser);
      localStorage.setItem('cinemax_users_db', JSON.stringify(users));

      const { password: _, ...userSession } = newUser;
      setCurrentUser(userSession);
      localStorage.setItem('cinemax_session_user', JSON.stringify(userSession));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Đã có lỗi xảy ra khi tạo tài khoản.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('cinemax_session_user');
    } catch (e) {
      console.error(e);
    }
  };

  const openAuthModal = (tab: 'LOGIN' | 'REGISTER' = 'LOGIN') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        logout,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
