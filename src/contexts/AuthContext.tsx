import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'terapeuta' | 'atendimento' | 'financeiro' | 'paciente';
  status?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  loginWithCode: (emailOrPhone: string, code: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'paciente' | 'terapeuta';
  specialty?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (authUserId: string, email?: string): Promise<User | null> => {
    console.log("AuthContext: loadProfile start for id:", authUserId, "email:", email);
    
    // Bypasse de segurança imediato para administradores (evita travamento de RLS no banco)
    if (email === 'tzionterapias@gmail.com' || email === 'admin@tzion.com.br') {
      console.log("AuthContext: loadProfile immediate bypass for admin email:", email);
      return { id: authUserId, name: 'Administrador', email: email, role: 'admin' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .single();
      console.log("AuthContext: profiles query returned", { hasData: !!data, error: error?.message });

      if (!error && data) {
        return {
          id: data.id,
          name: data.name || data.email,
          email: data.email,
          role: data.role as User['role'],
          status: data.status,
        };
      }

      // Fallback: system_users (retrocompatibilidade)
      console.log("AuthContext: loadProfile checking system_users...");
      const { data: sysUser, error: sysError } = await supabase
        .from('system_users')
        .select('*')
        .eq('id', authUserId)
        .single();
      console.log("AuthContext: loadProfile system_users query returned", { hasData: !!sysUser, error: sysError?.message });

      if (sysUser) {
        return { id: sysUser.id, name: sysUser.name, email: sysUser.email, role: sysUser.role };
      }

      // Fallback de emergência: se for o email admin, libera como admin
      console.log("AuthContext: loadProfile checking emergency admin email fallback...");
      if (email === 'tzionterapias@gmail.com' || email === 'admin@tzion.com.br') {
        console.log("AuthContext: loadProfile returning mock admin profile via email fallback");
        return { id: authUserId, name: 'Administrador', email: email, role: 'admin' };
      }

      console.log("AuthContext: loadProfile returning null (no profile found)");
      return null;
    } catch (err: any) {
      console.error("AuthContext: loadProfile caught error", err);
      if (email === 'tzionterapias@gmail.com' || email === 'admin@tzion.com.br') {
        console.log("AuthContext: loadProfile returning mock admin profile via catch fallback");
        return { id: authUserId, name: 'Administrador', email: email, role: 'admin' };
      }
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          const profile = await loadProfile(session.user.id, session.user.email ?? undefined);
          if (!cancelled) setUser(profile);
        } else {
          // Fallback para sistema legado (localStorage)
          const saved = localStorage.getItem('@tzion:user');
          if (saved && !cancelled) {
            try { setUser(JSON.parse(saved)); } catch {}
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        // Tenta recuperar do localStorage mesmo assim
        try {
          const saved = localStorage.getItem('@tzion:user');
          if (saved && !cancelled) setUser(JSON.parse(saved));
        } catch {}
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    // Listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await loadProfile(session.user.id, session.user.email ?? undefined);
        setUser(profile);
        setLoading(false);
        localStorage.removeItem('@tzion:user');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        localStorage.removeItem('@tzion:user');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log("AuthContext: login start for", email);
    try {
      // Tentar Supabase Auth primeiro
      console.log("AuthContext: calling signInWithPassword...");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log("AuthContext: signInWithPassword returned", { hasUser: !!data.user, error: error?.message });

      if (!error && data.user) {
        console.log("AuthContext: calling loadProfile...");
        const profile = await loadProfile(data.user.id, email);
        console.log("AuthContext: loadProfile returned", profile);
        if (profile) {
          setUser(profile);
          console.log("AuthContext: login success via Supabase Auth");
          return { success: true, user: profile };
        }
      }

      // Fallback: system_users (sistema legado)
      console.log("AuthContext: trying legacy system_users fallback...");
      const { data: sysUser, error: sysError } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', email)
        .eq('password_hash', password)
        .single();
      console.log("AuthContext: system_users returned", { hasUser: !!sysUser, error: sysError?.message });

      if (sysUser) {
        const loggedUser: User = { id: sysUser.id, name: sysUser.name, email: sysUser.email, role: sysUser.role };
        setUser(loggedUser);
        localStorage.setItem('@tzion:user', JSON.stringify(loggedUser));
        console.log("AuthContext: login success via legacy system_users");
        return { success: true, user: loggedUser };
      }

      // Fallback demo
      console.log("AuthContext: trying demo fallback...");
      if ((email === 'admin@tzion.com.br' || email === 'tzionterapias@gmail.com') && password === 'admin123') {
        const mockUser: User = { id: 'mock-admin', name: 'Administrador', email, role: 'admin' };
        setUser(mockUser);
        localStorage.setItem('@tzion:user', JSON.stringify(mockUser));
        console.log("AuthContext: login success via demo fallback");
        return { success: true, user: mockUser };
      }

      console.log("AuthContext: login failed, credentials invalid");
      return { success: false, error: error?.message || 'Credenciais inválidas.' };
    } catch (e: any) {
      console.error("AuthContext: login caught exception", e);
      return { success: false, error: e.message || 'Erro inesperado.' };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`,
        },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const register = async ({ name, email, password, phone, role, specialty }: RegisterData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role, specialty: specialty || '', phone: phone || '' },
        },
      });

      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: 'Erro ao criar usuário.' };

      // Upsert profile manually to guarantee it exists
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name,
        email,
        role,
        specialty: specialty || null,
        phone: phone || null,
        status: role === 'terapeuta' ? 'pending' : 'active',
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const loginWithCode = async (emailOrPhone: string, code: string) => {
    console.log("AuthContext: loginWithCode start for", emailOrPhone, "code:", code);
    try {
      const cleanPhone = emailOrPhone.replace(/\D/g, "");
      
      let query = supabase.from('profiles').select('*');
      if (emailOrPhone.includes('@')) {
        query = query.eq('email', emailOrPhone.trim());
      } else {
        const phoneVariants = [emailOrPhone.trim(), cleanPhone];
        if (cleanPhone.startsWith('55')) {
          phoneVariants.push(cleanPhone.substring(2));
        } else {
          phoneVariants.push(`55${cleanPhone}`);
        }
        query = query.or(`phone.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`);
      }

      const { data: profile, error: fetchError } = await query.maybeSingle();
      if (fetchError || !profile) {
        return { success: false, error: 'Usuário não encontrado com estes dados.' };
      }

      if (!profile.whatsapp_login_code || profile.whatsapp_login_code !== code.trim()) {
        return { success: false, error: 'Código de acesso incorreto.' };
      }

      const expiry = new Date(profile.whatsapp_login_code_expires_at);
      if (expiry.getTime() < Date.now()) {
        return { success: false, error: 'Código de acesso expirado. Solicite outro.' };
      }

      // Limpar o código para segurança
      await supabase
        .from('profiles')
        .update({
          whatsapp_login_code: null,
          whatsapp_login_code_expires_at: null
        })
        .eq('id', profile.id);

      const loggedUser: User = { 
        id: profile.id, 
        name: profile.name || profile.email, 
        email: profile.email, 
        role: profile.role as User['role'],
        status: profile.status
      };
      
      setUser(loggedUser);
      localStorage.setItem('@tzion:user', JSON.stringify(loggedUser));
      console.log("AuthContext: loginWithCode success");
      return { success: true, user: loggedUser };

    } catch (e: any) {
      console.error("AuthContext: loginWithCode caught exception", e);
      return { success: false, error: e.message || 'Erro inesperado.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('@tzion:user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithCode, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
