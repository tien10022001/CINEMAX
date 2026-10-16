'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';
import { createClient } from '@/lib/supabase/client';

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
    id: 'fba180c1-ee08-4306-b3be-3ab98d1e217c',
    role_id: 3,
    role_code: 'ADMIN',
    staff_permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    staff_position: 'Quản trị viên hệ thống',
    full_name: 'Trac The',
    email: 'thetrac44@gmail.com',
    password: 'password123',
    phone: '0900000000',
    loyalty_points: 50,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-admin-001',
    role_id: 3,
    role_code: 'ADMIN',
    staff_permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    staff_position: 'Quản trị viên hệ thống',
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
    id: 'usr-staff-001',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    staff_position: 'Trưởng ca rạp (Supervisor)',
    full_name: 'Trần Minh Quân',
    email: 'staff@cinemax.vn',
    password: 'staff',
    phone: '0977111222',
    loyalty_points: 500,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-staff-002',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'],
    staff_position: 'Quản lý vận hành (Supervisor)',
    full_name: 'Trương Công Tiến',
    email: 'tientc@cinemax.vn',
    password: 'staff',
    phone: '0911222333',
    loyalty_points: 800,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-staff-003',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['POS'],
    staff_position: 'Nhân viên Quầy Vé (POS)',
    full_name: 'Nguyễn Văn Thu Ngân',
    email: 'pos.cashier@cinemax.vn',
    password: 'staff',
    phone: '0933444555',
    loyalty_points: 200,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-staff-pos-002',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['POS'],
    staff_position: 'Nhân viên Quầy Vé (POS)',
    full_name: 'Lê Thu Hà',
    email: 'pos@cinemax.vn',
    password: 'staff',
    phone: '0977333444',
    loyalty_points: 200,
    is_active: true,
    created_at: '2026-01-12',
    updated_at: '2026-01-12',
  },
  {
    id: 'usr-staff-004',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['CHECKIN'],
    staff_position: 'Nhân viên Soát Vé (Check-in)',
    full_name: 'Lê Soát Vé',
    email: 'usher@cinemax.vn',
    password: 'staff',
    phone: '0944555666',
    loyalty_points: 200,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-staff-chk-003',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['CHECKIN'],
    staff_position: 'Nhân viên Soát Vé (Check-in)',
    full_name: 'Phạm Hoàng Nam',
    email: 'checkin@cinemax.vn',
    password: 'staff',
    phone: '0977555666',
    loyalty_points: 180,
    is_active: true,
    created_at: '2026-01-15',
    updated_at: '2026-01-15',
  },
  {
    id: 'usr-staff-005',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['CONCESSION'],
    staff_position: 'Nhân viên Bắp Nước (F&B)',
    full_name: 'Phạm Bắp Nước',
    email: 'concession@cinemax.vn',
    password: 'staff',
    phone: '0955666777',
    loyalty_points: 200,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'usr-staff-fnb-004',
    role_id: 2,
    role_code: 'STAFF',
    staff_permissions: ['CONCESSION'],
    staff_position: 'Nhân viên Bắp Nước (F&B)',
    full_name: 'Đỗ Ngọc Lan',
    email: 'fnb@cinemax.vn',
    password: 'staff',
    phone: '0977777888',
    loyalty_points: 220,
    is_active: true,
    created_at: '2026-01-18',
    updated_at: '2026-01-18',
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
      // 1. Ensure user database exists and merge any new seed accounts
      const existingDb = localStorage.getItem('cinemax_users_db');
      if (!existingDb) {
        localStorage.setItem('cinemax_users_db', JSON.stringify(SEED_USERS));
      } else {
        const parsedUsers: (User & { password?: string })[] = JSON.parse(existingDb);
        let updated = false;
        SEED_USERS.forEach((seedUser) => {
          const idx = parsedUsers.findIndex(
            (u) => u.email.toLowerCase() === seedUser.email.toLowerCase()
          );
          if (idx === -1) {
            parsedUsers.push(seedUser);
            updated = true;
          } else if (seedUser.role_code !== parsedUsers[idx].role_code || seedUser.role_id !== parsedUsers[idx].role_id) {
            parsedUsers[idx] = {
              ...parsedUsers[idx],
              role_code: seedUser.role_code,
              role_id: seedUser.role_id,
              staff_permissions: seedUser.staff_permissions,
              staff_position: seedUser.staff_position,
            };
            updated = true;
          } else if (seedUser.staff_permissions && !parsedUsers[idx].staff_permissions) {
            parsedUsers[idx] = {
              ...parsedUsers[idx],
              staff_permissions: seedUser.staff_permissions,
              staff_position: seedUser.staff_position,
            };
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem('cinemax_users_db', JSON.stringify(parsedUsers));
        }
      }

      // 2. Load active session
      const savedSession = localStorage.getItem('cinemax_session_user');
      if (savedSession) {
        let user = JSON.parse(savedSession);

        // Check if seed users have an updated role for this user
        const seedMatch = SEED_USERS.find(
          (su) => su.email.toLowerCase() === user.email?.toLowerCase()
        );
        if (seedMatch && (seedMatch.role_code !== user.role_code || seedMatch.role_id !== user.role_id)) {
          user = {
            ...user,
            role_code: seedMatch.role_code,
            role_id: seedMatch.role_id,
            staff_permissions: seedMatch.staff_permissions,
            staff_position: seedMatch.staff_position,
          };
          localStorage.setItem('cinemax_session_user', JSON.stringify(user));
        }

        setCurrentUser(user);

        // Tự động kiểm tra quyền mới nhất từ bảng profiles trên Supabase
        if (user && user.email) {
          const supabase = createClient();
          const targetId = user.id && user.id.length === 36 ? user.id : 'fba180c1-ee08-4306-b3be-3ab98d1e217c';
          Promise.resolve(
            supabase
              .from('profiles')
              .select('role, full_name, loyalty_points')
              .eq('id', targetId)
              .maybeSingle()
          )
            .then(({ data: profile }: any) => {
              if (profile && profile.role) {
                const mappedRole =
                  profile.role === 'admin'
                    ? 'ADMIN'
                    : profile.role === 'staff'
                    ? 'STAFF'
                    : 'CUSTOMER';
                const roleId = mappedRole === 'ADMIN' ? 3 : mappedRole === 'STAFF' ? 2 : 1;
                if (user.role_code !== mappedRole) {
                  const updatedUser = {
                    ...user,
                    role_code: mappedRole,
                    role_id: roleId,
                    staff_permissions:
                      mappedRole === 'ADMIN'
                        ? ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR']
                        : user.staff_permissions,
                  };
                  setCurrentUser(updatedUser);
                  localStorage.setItem('cinemax_session_user', JSON.stringify(updatedUser));
                }
              }
            })
            .catch(() => {});
        }
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
      const storedUsers: (User & { password?: string })[] = existingDbStr
        ? JSON.parse(existingDbStr)
        : [];

      // Combine stored users and SEED_USERS to ensure preconfigured accounts always exist
      const userMap = new Map<string, User & { password?: string }>();
      SEED_USERS.forEach((u) => userMap.set(u.email.toLowerCase(), u));
      storedUsers.forEach((u) => userMap.set(u.email.toLowerCase(), u));

      const user = userMap.get(cleanEmail);

      if (!user) {
        return { success: false, error: 'Email không tồn tại trong hệ thống. Vui lòng đăng ký tài khoản.' };
      }

      // Check password if set (support both 'staff' or 'staff123' for staff convenience)
      if (user.password && password) {
        const isStaff = user.role_code === 'STAFF';
        const isMatch = user.password === password || (isStaff && (password === 'staff' || password === 'staff123'));
        if (!isMatch) {
          return { success: false, error: 'Mật khẩu không chính xác.' };
        }
      }

      const { password: _, ...userSession } = user;
      setCurrentUser(userSession);
      localStorage.setItem('cinemax_session_user', JSON.stringify(userSession));
      setIsAuthModalOpen(false);

      // Attempt Supabase Auth login if account exists on Supabase Cloud
      try {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password || 'admin'
        });
      } catch (err) {
        console.warn('Supabase auth signin fallback note:', err);
      }

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

      let supabaseUserId = 'usr-' + Date.now();

      // Đồng bộ trực tiếp tài khoản lên Supabase Auth
      try {
        const supabase = createClient();
        const { data: suData } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password || '123456',
          options: {
            data: {
              full_name: name.trim(),
              phone: phone.trim() || '0900000000',
            },
          },
        });
        if (suData?.user?.id) {
          supabaseUserId = suData.user.id;
        }
      } catch (err) {
        console.warn('Supabase auth signup sync notice:', err);
      }

      const newUser: User & { password?: string } = {
        id: supabaseUserId,
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
      const supabase = createClient();
      supabase.auth.signOut().catch(() => {});
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
