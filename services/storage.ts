
import { Player, Field, Match, User, Group, Position, Transaction } from '../types';

/**
 * SERVIÇO DE ARMAZENAMENTO (CAMADA DE DADOS)
 * 
 * Agora suporta multi-tenancy (grupos). Os métodos getAll filtram por groupId.
 */

const KEYS = {
  PLAYERS: 'futgol_players',
  FIELDS: 'futgol_fields',
  MATCHES: 'futgol_matches',
  GROUPS: 'futgol_groups',
  USERS: 'futgol_users_global',
  TRANSACTIONS: 'futgol_transactions'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- DATA SEEDING (DADOS FICTÍCIOS) ---
export const seedDatabase = () => {
  // Check if Groups exist
  const hasGroups = localStorage.getItem(KEYS.GROUPS);
  const hasTransactions = localStorage.getItem(KEYS.TRANSACTIONS);

  // Helper to init transactions if they are missing (feature backfill)
  if (hasGroups && !hasTransactions) {
    const groupId = 'group_demo_01';
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        groupId,
        description: 'Compra de Coletes',
        amount: 150,
        type: 'EXPENSE',
        category: 'EQUIPMENT',
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        id: 'tx_2',
        groupId,
        description: 'Mensalidade - Thiago',
        amount: 100,
        type: 'INCOME',
        category: 'MONTHLY_FEE',
        relatedPlayerId: 'player_admin_123',
        date: new Date().toISOString().split('T')[0]
      }
    ];
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
    console.log("🌱 Transações financeiras inicializadas para usuários existentes.");
    return;
  }

  if (hasGroups) return; // Full database already exists

  console.log("🌱 Semeando banco de dados completo com dados de teste...");

  const adminId = 'user_123'; // ID do usuário mockado no authService
  const groupId = 'group_demo_01';

  // 1. Criar Grupo
  const group: Group = {
    id: groupId,
    adminId: adminId,
    admins: [adminId], // Initialize admins list with owner
    name: 'Pelada dos Amigos ⚽',
    sport: 'Futebol Society',
    inviteCode: 'GOL-10',
    createdAt: new Date().toISOString(),
    members: [adminId], // Admin is automatically a member
    pendingRequests: []
  };

  // 2. Criar Campos
  const fields: Field[] = [
    {
      id: 'field_1',
      groupId,
      name: 'Arena Champions',
      location: 'Av. Paulista, 1000 - SP',
      contactName: 'Sr. Carlos',
      contactPhone: '(11) 99999-1111',
      hourlyRate: 250,
      coordinates: { lat: -23.561414, lng: -46.655881 }
    },
    {
      id: 'field_2',
      groupId,
      name: 'Quadra do Bairro',
      location: 'Rua das Flores, 123',
      contactName: 'Dona Maria',
      contactPhone: '(11) 98888-2222',
      hourlyRate: 150,
      coordinates: { lat: -23.550520, lng: -46.633309 }
    },
    {
      id: 'field_3',
      groupId,
      name: 'Estádio Municipal',
      location: 'Centro Esportivo',
      hourlyRate: 0, // Grátis
    }
  ];

  // 3. Criar Jogadores (20 registros)
  const playerNames = [
    { n: 'Ronaldinho', p: Position.MEIO, r: 5 },
    { n: 'Ronaldo Fenômeno', p: Position.ATACANTE, r: 5 },
    { n: 'Cafu', p: Position.DEFENSOR, r: 4.5 },
    { n: 'Roberto Carlos', p: Position.DEFENSOR, r: 4.5 },
    { n: 'Kaká', p: Position.MEIO, r: 4.5 },
    { n: 'Neymar Jr', p: Position.ATACANTE, r: 5 },
    { n: 'Alisson Becker', p: Position.GOLEIRO, r: 4.5 },
    { n: 'Thiago Silva', p: Position.DEFENSOR, r: 4 },
    { n: 'Casemiro', p: Position.MEIO, r: 4 },
    { n: 'Vinicius Jr', p: Position.ATACANTE, r: 5 },
    { n: 'Marquinhos', p: Position.DEFENSOR, r: 4 },
    { n: 'Dida', p: Position.GOLEIRO, r: 4 },
    { n: 'Rivaldo', p: Position.MEIO, r: 5 },
    { n: 'Romário', p: Position.ATACANTE, r: 5 },
    { n: 'Bebeto', p: Position.ATACANTE, r: 4 },
    { n: 'Taffarel', p: Position.GOLEIRO, r: 4.5 },
    { n: 'Zico', p: Position.MEIO, r: 5 },
    { n: 'Sócrates', p: Position.MEIO, r: 4.5 },
    { n: 'Pelé', p: Position.ATACANTE, r: 5 },
    { n: 'Garrincha', p: Position.ATACANTE, r: 5 }
  ];

  const players: Player[] = playerNames.map((p, index) => ({
    id: `player_${index + 1}`,
    groupId,
    name: p.n,
    nickname: p.n.split(' ')[0],
    birthDate: '1990-01-01',
    email: `${p.n.toLowerCase().replace(' ', '')}@email.com`,
    favoriteTeam: 'Brasil',
    position: p.p,
    rating: p.r,
    matchesPlayed: Math.floor(Math.random() * 20),
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.n)}&background=random&size=128`,
    isMonthlySubscriber: index < 5 // First 5 are subscribers
  }));

  // NEW: Add Admin as a Player to allow testing of match participation
  const adminPlayer: Player = {
    id: 'player_admin_123',
    groupId,
    userId: adminId, // Link to the 'thiago@teste.com' user
    name: 'Thiago Admin',
    nickname: 'Thiago',
    birthDate: '1985-05-20',
    email: 'thiago@teste.com',
    favoriteTeam: 'São Paulo',
    position: Position.MEIO,
    rating: 5,
    matchesPlayed: 5,
    avatar: 'https://ui-avatars.com/api/?name=Thiago+Admin&background=random',
    isMonthlySubscriber: true
  };
  players.unshift(adminPlayer); // Add to beginning

  // 4. Criar Partidas
  const match1: Match = {
    id: 'match_old_1',
    groupId,
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias atrás
    time: '20:00',
    fieldId: 'field_1',
    finished: true,
    scoreA: 5,
    scoreB: 4,
    mvpId: players[1].id, // Ronaldinho MVP (index 1 now)
    confirmedPlayerIds: players.slice(0, 14).map(p => p.id),
    paidPlayerIds: players.slice(0, 10).map(p => p.id), // 10 paid
    teamA: players.slice(0, 7),
    teamB: players.slice(7, 14)
  };

  const match2: Match = {
    id: 'match_future_1',
    groupId,
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Daqui a 2 dias
    time: '19:30',
    fieldId: 'field_2',
    finished: false,
    scoreA: 0,
    scoreB: 0,
    confirmedPlayerIds: players.slice(0, 10).map(p => p.id), // 10 confirmados
    teamA: [],
    teamB: []
  };

  // 5. Criar Transações de Exemplo
  const transactions: Transaction[] = [
    {
      id: 'tx_1',
      groupId,
      description: 'Compra de Coletes',
      amount: 150,
      type: 'EXPENSE',
      category: 'EQUIPMENT',
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      id: 'tx_2',
      groupId,
      description: 'Mensalidade - Thiago',
      amount: 100,
      type: 'INCOME',
      category: 'MONTHLY_FEE',
      relatedPlayerId: adminPlayer.id,
      date: new Date().toISOString().split('T')[0]
    }
  ];

  // Salvar tudo
  localStorage.setItem(KEYS.GROUPS, JSON.stringify([group]));
  localStorage.setItem(KEYS.FIELDS, JSON.stringify(fields));
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
  localStorage.setItem(KEYS.MATCHES, JSON.stringify([match1, match2]));
  localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
};


export const storage = {
  seedDatabase, // Exportar para usar no App.tsx
  
  users: {
    findById: async (id: string): Promise<User | null> => {
      await delay(300);
      
      const session = localStorage.getItem('futgol_user_session');
      if (session) {
        const self = JSON.parse(session);
        if (self.id === id) return self;
      }

      const storedUsersJson = localStorage.getItem('futgol_users_db_mock');
      if (storedUsersJson) {
        const users = JSON.parse(storedUsersJson);
        const found = users.find((u: User) => u.id === id);
        if (found) return found;
      }
         
      if (id === 'user_123') return { id: 'user_123', name: 'Admin Teste', email: 'thiago@teste.com' };
      if (id === '123') return { id: '123', name: 'Neymar Júnior', email: 'njr@brasil.com', avatar: 'https://ui-avatars.com/api/?name=Neymar+Jr&background=random' };
      if (id === 'cr7') return { id: 'cr7', name: 'Cristiano Ronaldo', email: 'cr7@portugal.com', avatar: 'https://ui-avatars.com/api/?name=Cristiano+Ronaldo&background=random' };
      
      return { 
        id, 
        name: `Usuário ${id.substring(0,5)}`, 
        email: 'usuario@exemplo.com', 
        avatar: `https://ui-avatars.com/api/?name=User+${id}&background=random` 
      };
    }
  },

  groups: {
    getByUser: async (userId: string): Promise<Group[]> => {
      await delay(200);
      try {
        const data = localStorage.getItem(KEYS.GROUPS);
        const allGroups: Group[] = data ? JSON.parse(data) : [];
        return allGroups.filter(g => g.adminId === userId || (g.members && g.members.includes(userId)));
      } catch (e) {
        return [];
      }
    },
    getAll: async (): Promise<Group[]> => {
      await delay(200);
      try {
        const data = localStorage.getItem(KEYS.GROUPS);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    },
    save: async (group: Group): Promise<void> => {
      await delay(200);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === group.id);
      
      if (!group.admins) {
        group.admins = [group.adminId];
      }
      
      if (index >= 0) {
        allGroups[index] = group;
      } else {
        if (!group.members) group.members = [group.adminId];
        if (!group.pendingRequests) group.pendingRequests = [];
        allGroups.push(group);
      }
      localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));
    },
    
    requestJoin: async (groupId: string, userId: string): Promise<void> => {
      await delay(300);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === groupId);
      
      if (index >= 0) {
        const group = allGroups[index];
        if (!group.members?.includes(userId) && !group.pendingRequests?.includes(userId)) {
          if (!group.pendingRequests) group.pendingRequests = [];
          group.pendingRequests.push(userId);
          allGroups[index] = group;
          localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));
        }
      }
    },

    approveRequest: async (groupId: string, userId: string): Promise<void> => {
      await delay(300);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === groupId);
      
      if (index >= 0) {
        const group = allGroups[index];
        if (group.pendingRequests) {
          group.pendingRequests = group.pendingRequests.filter(id => id !== userId);
        }
        if (!group.members) group.members = [];
        if (!group.members.includes(userId)) {
          group.members.push(userId);
        }
        allGroups[index] = group;
        localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));

        const user = await storage.users.findById(userId);
        if (user) {
          const newPlayer: Player = {
            id: crypto.randomUUID(),
            groupId: groupId,
            userId: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            nickname: user.nickname || user.name.split(' ')[0],
            phone: user.phone || '',
            birthDate: user.birthDate || '',
            favoriteTeam: user.favoriteTeam || '',
            position: user.position || Position.MEIO,
            rating: 3, 
            matchesPlayed: 0
          };
          await storage.players.save(newPlayer);
        }
      }
    },

    rejectRequest: async (groupId: string, userId: string): Promise<void> => {
      await delay(300);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === groupId);
      
      if (index >= 0) {
        const group = allGroups[index];
        if (group.pendingRequests) {
          group.pendingRequests = group.pendingRequests.filter(id => id !== userId);
        }
        allGroups[index] = group;
        localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));
      }
    },

    removeMember: async (groupId: string, userId: string): Promise<void> => {
      await delay(300);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === groupId);
      
      if (index >= 0) {
        const group = allGroups[index];
        if (group.members) {
          group.members = group.members.filter(id => id !== userId);
        }
        if (group.admins) {
          group.admins = group.admins.filter(id => id !== userId);
        }
        if (group.pendingRequests) {
          group.pendingRequests = group.pendingRequests.filter(id => id !== userId);
        }
        allGroups[index] = group;
        localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));
      }
    },

    promoteMember: async (groupId: string, userId: string): Promise<void> => {
      await delay(200);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === groupId);

      if (index >= 0) {
        const group = allGroups[index];
        if (!group.admins) group.admins = [group.adminId];
        
        if (!group.admins.includes(userId)) {
          group.admins.push(userId);
          allGroups[index] = group;
          localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));
        }
      }
    },

    demoteMember: async (groupId: string, userId: string): Promise<void> => {
      await delay(200);
      const data = localStorage.getItem(KEYS.GROUPS);
      const allGroups: Group[] = data ? JSON.parse(data) : [];
      const index = allGroups.findIndex(g => g.id === groupId);

      if (index >= 0) {
        const group = allGroups[index];
        if (userId === group.adminId) return;

        if (group.admins) {
          group.admins = group.admins.filter(id => id !== userId);
          allGroups[index] = group;
          localStorage.setItem(KEYS.GROUPS, JSON.stringify(allGroups));
        }
      }
    }
  },

  players: {
    getAll: async (groupId: string): Promise<Player[]> => {
      await delay(200);
      try {
        const data = localStorage.getItem(KEYS.PLAYERS);
        const allPlayers: Player[] = data ? JSON.parse(data) : [];
        return allPlayers.filter(p => p.groupId === groupId);
      } catch (e) {
        return [];
      }
    },
    save: async (player: Player): Promise<void> => {
      await delay(100); 
      const data = localStorage.getItem(KEYS.PLAYERS);
      const allPlayers: Player[] = data ? JSON.parse(data) : [];
      
      const index = allPlayers.findIndex(p => p.id === player.id);
      if (index >= 0) {
        allPlayers[index] = player;
      } else {
        allPlayers.push(player);
      }
      
      localStorage.setItem(KEYS.PLAYERS, JSON.stringify(allPlayers));
    },
    
    updateByUserId: async (userId: string, userData: Partial<User>): Promise<void> => {
      await delay(200);
      const data = localStorage.getItem(KEYS.PLAYERS);
      const allPlayers: Player[] = data ? JSON.parse(data) : [];
      
      let hasChanges = false;
      const updatedPlayers = allPlayers.map(p => {
        if (p.userId === userId) {
          hasChanges = true;
          return {
            ...p,
            name: userData.name || p.name,
            nickname: userData.nickname || p.nickname,
            email: userData.email || p.email,
            avatar: userData.avatar !== undefined ? userData.avatar : p.avatar,
            phone: userData.phone || p.phone,
            birthDate: userData.birthDate || p.birthDate,
            favoriteTeam: userData.favoriteTeam || p.favoriteTeam,
            position: userData.position || p.position
          };
        }
        return p;
      });

      if (hasChanges) {
        localStorage.setItem(KEYS.PLAYERS, JSON.stringify(updatedPlayers));
      }
    },

    delete: async (id: string): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.PLAYERS);
      let allPlayers: Player[] = data ? JSON.parse(data) : [];
      allPlayers = allPlayers.filter(p => p.id !== id);
      localStorage.setItem(KEYS.PLAYERS, JSON.stringify(allPlayers));
    }
  },

  fields: {
    getAll: async (groupId: string): Promise<Field[]> => {
      await delay(200);
      try {
        const data = localStorage.getItem(KEYS.FIELDS);
        const allFields: Field[] = data ? JSON.parse(data) : [];
        return allFields.filter(f => f.groupId === groupId);
      } catch (e) {
        return [];
      }
    },
    save: async (field: Field): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.FIELDS);
      const allFields: Field[] = data ? JSON.parse(data) : [];
      
      const index = allFields.findIndex(f => f.id === field.id);
      if (index >= 0) {
        allFields[index] = field;
      } else {
        allFields.push(field);
      }

      localStorage.setItem(KEYS.FIELDS, JSON.stringify(allFields));
    },
    delete: async (id: string): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.FIELDS);
      let allFields: Field[] = data ? JSON.parse(data) : [];
      allFields = allFields.filter(f => f.id !== id);
      localStorage.setItem(KEYS.FIELDS, JSON.stringify(allFields));
    }
  },

  matches: {
    getAll: async (groupId: string): Promise<Match[]> => {
      await delay(200);
      try {
        const data = localStorage.getItem(KEYS.MATCHES);
        const allMatches: Match[] = data ? JSON.parse(data) : [];
        return allMatches.filter(m => m.groupId === groupId);
      } catch (e) {
        return [];
      }
    },
    save: async (match: Match): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.MATCHES);
      const allMatches: Match[] = data ? JSON.parse(data) : [];
      
      const index = allMatches.findIndex(m => m.id === match.id);
      if (index >= 0) {
        allMatches[index] = match;
      } else {
        allMatches.push(match);
      }

      localStorage.setItem(KEYS.MATCHES, JSON.stringify(allMatches));
    },
    delete: async (id: string): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.MATCHES);
      let allMatches: Match[] = data ? JSON.parse(data) : [];
      allMatches = allMatches.filter(m => m.id !== id);
      localStorage.setItem(KEYS.MATCHES, JSON.stringify(allMatches));
    }
  },

  transactions: {
    getAll: async (groupId: string): Promise<Transaction[]> => {
      await delay(200);
      try {
        const data = localStorage.getItem(KEYS.TRANSACTIONS);
        const all: Transaction[] = data ? JSON.parse(data) : [];
        return all.filter(t => t.groupId === groupId);
      } catch (e) {
        return [];
      }
    },
    save: async (transaction: Transaction): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.TRANSACTIONS);
      const all: Transaction[] = data ? JSON.parse(data) : [];
      
      const index = all.findIndex(t => t.id === transaction.id);
      if (index >= 0) {
        all[index] = transaction;
      } else {
        all.push(transaction);
      }
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(all));
    },
    
    upsertMatchTransaction: async (groupId: string, matchId: string, totalAmount: number, description: string, date: string): Promise<void> => {
      await delay(100);
      const data = localStorage.getItem(KEYS.TRANSACTIONS);
      let all: Transaction[] = data ? JSON.parse(data) : [];
      
      // Find existing record for this match
      const existingIdx = all.findIndex(t => t.relatedMatchId === matchId);
      
      if (totalAmount > 0) {
        // Create or Update
        if (existingIdx >= 0) {
          all[existingIdx].amount = totalAmount;
          all[existingIdx].description = description;
          all[existingIdx].date = date; // Update date in case match date changed
        } else {
           const newTx: Transaction = {
             id: crypto.randomUUID(),
             groupId,
             relatedMatchId: matchId,
             description,
             amount: totalAmount,
             type: 'INCOME',
             category: 'MATCH_REVENUE',
             date
           };
           all.push(newTx);
        }
      } else {
        // Remove if amount is 0 (all unchecked)
        if (existingIdx >= 0) {
          all = all.filter(t => t.relatedMatchId !== matchId);
        }
      }
      
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(all));
    },

    delete: async (id: string): Promise<void> => {
       await delay(100);
       const data = localStorage.getItem(KEYS.TRANSACTIONS);
       let all: Transaction[] = data ? JSON.parse(data) : [];
       all = all.filter(t => t.id !== id);
       localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(all));
    }
  }
};
