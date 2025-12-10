
import { User, Position } from '../types';
import api, { setToken } from './api';

const STORAGE_KEY = 'futgol_user_session';

// Simula delay de API
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  getCurrentUser: async (): Promise<User | null> => {
    await delay(100);
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  validateSession: async (): Promise<User | null> => {
    await delay(50);
    try {
      const data = await api.get('/api/auth/me/');
      const user = data as User;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return user;
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        try { localStorage.removeItem('futgol_jwt_token'); } catch {}
        return null;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    }
  },

  login: async (email: string, password: string): Promise<User> => {
    if (!email || !password) throw new Error('Preencha todos os campos');
    try {
      const resp = await api.post('/api/auth/login/', { email, password });
      const { user, access } = resp;
      if (access) setToken(access);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return user as User;
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('Credenciais inválidas') || msg.includes('HTTP 400')) {
        throw new Error('Email ou senha inválidos. Verifique os dados e tente novamente.');
      }
      throw new Error(`Falha de conexão com o servidor (${msg || 'erro de rede'}). Verifique se o backend está acessível em :8000.`);
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    throw new Error('Login com Google não implementado');
  },

  register: async (userData: Omit<User, 'id' | 'avatar'> & { password?: string }): Promise<User> => {
    if (!userData.password) throw new Error('Senha obrigatória');
    const resp = await api.post('/api/auth/register/', userData);
    const { user, access } = resp;
    if (access) setToken(access);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user as User;
  },

  updateProfile: async (updatedUser: User): Promise<User> => {
    // Opcional: criar endpoint backend para perfil; por ora, atualiza cache local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    return updatedUser;
  },
  forgotPassword: async (email: string): Promise<any> => {
    const r = await api.post('/api/auth/password/reset/', { email });
    return r;
  },
  resetPasswordConfirm: async (uid: string, token: string, password: string): Promise<void> => {
    await api.post('/api/auth/password/reset/confirm/', { uid, token, password });
  },
  logout: async (): Promise<void> => {
    await delay(200);
    localStorage.removeItem(STORAGE_KEY);
    try { localStorage.removeItem('futgol_jwt_token'); } catch {}
  },
  lookupByPhone: async (phone: string): Promise<{ found: boolean; profile?: any; groups?: Array<{id: string; name: string}> }> => {
    const r = await api.get(`/api/accounts/lookup_by_phone/?phone=${encodeURIComponent(phone)}`);
    return r;
  }
};
