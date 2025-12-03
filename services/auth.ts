
import { User, Position } from '../types';

const STORAGE_KEY = 'futgol_user_session';

// Simula delay de API
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  getCurrentUser: async (): Promise<User | null> => {
    await delay(100);
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  login: async (email: string, password: string): Promise<User> => {
    await delay(800);
    
    // Simulação: Aceita qualquer email com senha
    if (!email || !password) throw new Error("Preencha todos os campos");

    // 1. Tenta encontrar usuário real no banco mockado
    const storedUsersJson = localStorage.getItem('futgol_users_db_mock');
    if (storedUsersJson) {
      const users = JSON.parse(storedUsersJson);
      const existingUser = users.find((u: User) => u.email === email);
      if (existingUser) {
        // Verifica senha (simulação simples)
        // Em produção, a senha estaria hasheada e verificada no backend
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existingUser));
        return existingUser;
      }
    }

    // 2. Se não encontrar (Modo Teste/Dev apenas), gera um mock
    // Mantém user_123 apenas para o login padrão de teste
    const sanitizedName = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const userId = email === 'thiago@teste.com' ? 'user_123' : `user_${sanitizedName}`;

    const mockUser: User = {
      id: userId,
      name: email.split('@')[0], 
      email: email,
      avatar: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=random`,
      nickname: email.split('@')[0],
      position: Position.MEIO,
      favoriteTeam: 'Seleção',
      phone: '',
      birthDate: ''
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  },

  loginWithGoogle: async (): Promise<User> => {
    await delay(1000);
    // Simulação de retorno do Google com ID aleatório para não conflitar
    const randomId = Math.floor(Math.random() * 10000);
    const mockUser: User = {
      id: `google_user_${randomId}`,
      name: 'Usuário Google',
      email: `usuario${randomId}@gmail.com`,
      avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      nickname: 'Google User',
      position: Position.MEIO,
      favoriteTeam: '',
      phone: '',
      birthDate: ''
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  },

  register: async (userData: Omit<User, 'id' | 'avatar'> & { password?: string }): Promise<User> => {
    await delay(1000);
    
    if (!userData.name || !userData.email) throw new Error("Preencha os campos obrigatórios");
    if (!userData.phone) throw new Error("O celular é obrigatório para gerar seu ID Global");

    // LÓGICA DE ID ÚNICO: O ID agora é o número do celular (apenas dígitos)
    const cleanPhone = userData.phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      throw new Error("Número de celular inválido. Digite DDD + Número.");
    }

    // Verificar se já existe (simulação de unicidade)
    const storedUsersJson = localStorage.getItem('futgol_users_db_mock');
    const users = storedUsersJson ? JSON.parse(storedUsersJson) : [];
    
    const existingUser = users.find((u: User) => u.id === cleanPhone);
    if (existingUser) {
      throw new Error(`O celular ${userData.phone} já está cadastrado.`);
    }

    const newUser: User = {
      id: cleanPhone, // O ID É O CELULAR
      name: userData.name,
      email: userData.email,
      avatar: `https://ui-avatars.com/api/?name=${userData.name}&background=random`,
      nickname: userData.nickname || userData.name.split(' ')[0],
      birthDate: userData.birthDate || '',
      phone: userData.phone,
      favoriteTeam: userData.favoriteTeam || '',
      position: userData.position || Position.MEIO
    };

    // Store in a "mock DB"
    users.push(newUser);
    localStorage.setItem('futgol_users_db_mock', JSON.stringify(users));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  },

  updateProfile: async (updatedUser: User): Promise<User> => {
    await delay(500);

    // 1. Atualizar na sessão atual
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    // 2. Atualizar no "Banco de Dados" simulado
    const storedUsersJson = localStorage.getItem('futgol_users_db_mock');
    if (storedUsersJson) {
      const users = JSON.parse(storedUsersJson);
      const index = users.findIndex((u: User) => u.id === updatedUser.id);
      if (index >= 0) {
        users[index] = updatedUser;
        localStorage.setItem('futgol_users_db_mock', JSON.stringify(users));
      }
    }

    return updatedUser;
  },

  logout: async (): Promise<void> => {
    await delay(200);
    localStorage.removeItem(STORAGE_KEY);
  }
};
