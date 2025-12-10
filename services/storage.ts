
import { Player, Field, Match, User, Group, Position, Transaction, Comment } from '../types';
import api from './api';

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
export const seedDatabase = async () => {
  try {
    const existing: Group[] = await api.get(`/api/groups/`);
    if (Array.isArray(existing) && existing.length > 0) return;

    const adminId = 'user_123';
    const groupId = 'group_demo_01';

      const group: Group = {
        id: groupId,
        adminId: adminId,
        admins: [adminId],
        name: 'Pelada dos Amigos ⚽',
        sport: 'Futebol Society',
        inviteCode: 'GOL-10',
        createdAt: new Date().toISOString(),
        members: [adminId],
        pendingRequests: [],
        paymentMode: 'fixed',
        fixedAmount: 0,
        monthlyFee: 100,
        city: 'São Paulo, SP'
      };
    await api.put(`/api/groups/${group.id}/`, group);

    const fields: Field[] = [
      { id: 'field_1', groupId, name: 'Arena Champions', location: 'Av. Paulista, 1000 - SP', contactName: 'Sr. Carlos', contactPhone: '(11) 99999-1111', hourlyRate: 250, coordinates: { lat: -23.561414, lng: -46.655881 } },
      { id: 'field_2', groupId, name: 'Quadra do Bairro', location: 'Rua das Flores, 123', contactName: 'Dona Maria', contactPhone: '(11) 98888-2222', hourlyRate: 150, coordinates: { lat: -23.55052, lng: -46.633309 } },
      { id: 'field_3', groupId, name: 'Estádio Municipal', location: 'Centro Esportivo', hourlyRate: 0 }
    ];
    for (const f of fields) await api.put(`/api/fields/${f.id}/`, f);

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
      isMonthlySubscriber: index < 5
    }));

    const adminPlayer: Player = {
      id: 'player_admin_123',
      groupId,
      userId: adminId,
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
    players.unshift(adminPlayer);
    for (const p of players) await api.put(`/api/players/${p.id}/`, p);

    const match1: Match = {
      id: 'match_old_1',
      groupId,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '20:00',
      fieldId: 'field_1',
      finished: true,
      scoreA: 5,
      scoreB: 4,
      mvpId: players[1].id,
      confirmedPlayerIds: players.slice(0, 14).map(p => p.id),
      paidPlayerIds: players.slice(0, 10).map(p => p.id),
      teamA: players.slice(0, 7),
      teamB: players.slice(7, 14)
    };

    const match2: Match = {
      id: 'match_future_1',
      groupId,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '19:30',
      fieldId: 'field_2',
      finished: false,
      scoreA: 0,
      scoreB: 0,
      confirmedPlayerIds: players.slice(0, 10).map(p => p.id),
      teamA: [],
      teamB: []
    };
    await api.put(`/api/matches/${match1.id}/`, match1);
    await api.put(`/api/matches/${match2.id}/`, match2);

    const transactions: Transaction[] = [
      { id: 'tx_1', groupId, description: 'Compra de Coletes', amount: 150, type: 'EXPENSE', category: 'EQUIPMENT', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { id: 'tx_2', groupId, description: 'Mensalidade - Thiago', amount: 100, type: 'INCOME', category: 'MONTHLY_FEE', relatedPlayerId: adminPlayer.id, date: new Date().toISOString().split('T')[0] }
    ];
    for (const t of transactions) await api.put(`/api/transactions/${t.id}/`, t);
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('HTTP 401')) {
      return;
    }
    console.error(e);
  }
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
      const data = await api.get(`/api/groups/by_user/?userId=${encodeURIComponent(userId)}`);
      return data as Group[];
    },
    getAll: async (): Promise<Group[]> => {
      const data = await api.get(`/api/groups/`);
      return data as Group[];
    },
    save: async (group: Group): Promise<void> => {
      if (!group.admins) group.admins = [group.adminId];
      if (!group.members) group.members = [group.adminId];
      if (!group.pendingRequests) group.pendingRequests = [];
      await api.put(`/api/groups/${encodeURIComponent(group.id)}/`, group);
    },
    requestJoin: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/request_join/`, { userId });
    },
    cancelRequest: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/cancel_request/`, { userId });
    },
    approveRequest: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/approve_request/`, { userId });
    },
    rejectRequest: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/reject_request/`, { userId });
    },
    removeMember: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/remove_member/`, { userId });
    },
    promoteMember: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/promote_member/`, { userId });
    },
    demoteMember: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/demote_member/`, { userId });
    },
    generateInvite: async (groupId: string, ttlSeconds?: number): Promise<{ token: string; ttl: number }> => {
      const data = await api.post(`/api/groups/${encodeURIComponent(groupId)}/generate_invite/`, { ttl: ttlSeconds });
      return data as { token: string; ttl: number };
    },
    joinWithInvite: async (token: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/join_with_invite/`, { token, userId });
    }
  },

  players: {
    getAll: async (groupId: string): Promise<Player[]> => {
      const data = await api.get(`/api/players/?groupId=${encodeURIComponent(groupId)}`);
      return data as Player[];
    },
    save: async (player: Player): Promise<void> => {
      await api.put(`/api/players/${encodeURIComponent(player.id)}/`, player);
    },
    
    updateByUserId: async (userId: string, userData: Partial<User>): Promise<void> => {
      await api.post(`/api/players/update_by_user/`, { userId, userData });
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/players/${encodeURIComponent(id)}/`);
    }
  },

  fields: {
    getAll: async (groupId: string): Promise<Field[]> => {
      const data = await api.get(`/api/fields/?groupId=${encodeURIComponent(groupId)}`);
      return data as Field[];
    },
    save: async (field: Field): Promise<void> => {
      await api.put(`/api/fields/${encodeURIComponent(field.id)}/`, field);
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/fields/${encodeURIComponent(id)}/`);
    }
  },

  matches: {
    getAll: async (groupId: string): Promise<Match[]> => {
      const data = await api.get(`/api/matches/?groupId=${encodeURIComponent(groupId)}`);
      return data as Match[];
    },
    save: async (match: Match): Promise<void> => {
      await api.put(`/api/matches/${encodeURIComponent(match.id)}/`, match);
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/matches/${encodeURIComponent(id)}/`);
    },
    reopen: async (id: string): Promise<Match> => {
      const data = await api.post(`/api/matches/${encodeURIComponent(id)}/reopen/`, {});
      return data as Match;
    }
  },

  transactions: {
    getAll: async (groupId: string): Promise<Transaction[]> => {
      const data = await api.get(`/api/transactions/?groupId=${encodeURIComponent(groupId)}`);
      return data as Transaction[];
    },
    save: async (transaction: Transaction): Promise<void> => {
      await api.put(`/api/transactions/${encodeURIComponent(transaction.id)}/`, transaction);
    },
    upsertMatchTransaction: async (groupId: string, matchId: string, totalAmount: number, description: string, date: string): Promise<void> => {
      await api.post(`/api/transactions/upsert_match/`, { groupId, matchId, totalAmount, description, date });
    },
    delete: async (id: string): Promise<void> => {
       await api.delete(`/api/transactions/${encodeURIComponent(id)}/`);
    }
  },
  comments: {
    getAll: async (groupId: string, matchId: string): Promise<Comment[]> => {
      const data = await api.get(`/api/comments/?groupId=${encodeURIComponent(groupId)}&matchId=${encodeURIComponent(matchId)}`);
      return data as Comment[];
    },
    save: async (comment: Comment): Promise<void> => {
      await api.put(`/api/comments/${encodeURIComponent(comment.id)}/`, comment);
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/comments/${encodeURIComponent(id)}/`);
    }
  }
};
