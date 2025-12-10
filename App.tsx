
import React, { useState, useEffect, useRef } from 'react';
import { Player, Field, Match, ViewState, User, Group } from './types';
import { PlayerScreen } from './components/PlayerScreen';
import { FieldScreen } from './components/FieldScreen';
import { MatchScreen } from './components/MatchScreen';
import { LandingScreen } from './components/LandingScreen';
import { GroupsScreen } from './components/GroupsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { FinancialScreen } from './components/FinancialScreen';
import { storage } from './services/storage';
import { authService } from './services/auth';

const VIEW_KEY = 'futgol_last_view';
const ACTIVE_GROUP_KEY = 'futgol_active_group_id';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Header Menu State
  const [showUserMenu, setShowUserMenu] = useState(false);
  // FIX: Separate refs for desktop and mobile to avoid conflict
  const desktopUserMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const mobileMainMenuRef = useRef<HTMLDivElement>(null);

  // App State & Multi-tenancy
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY) as ViewState | null;
      return (v as ViewState) || 'groups';
    } catch {
      return 'groups';
    }
  });
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Data State (Filtered by activeGroup)
  const [players, setPlayers] = useState<Player[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const prevConfirmCountsRef = useRef<Record<string, number>>({});

  // Permission Checks
  const isAdmin = activeGroup && currentUser && (activeGroup.adminId === currentUser.id || activeGroup.admins?.includes(currentUser.id));

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutsideDesktop = desktopUserMenuRef.current && !desktopUserMenuRef.current.contains(event.target as Node);
      const clickedOutsideMobile = mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(event.target as Node);
      const clickedOutsideMain = mobileMainMenuRef.current && !mobileMainMenuRef.current.contains(event.target as Node);

      if (showUserMenu && clickedOutsideDesktop && clickedOutsideMobile) {
        setShowUserMenu(false);
      }
      if (showMainMenu && clickedOutsideMain) {
        setShowMainMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu, showMainMenu]);

  // Check Session on Boot
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await authService.validateSession();
        setCurrentUser(user);
        if (user) {
          await storage.seedDatabase();
        }
      } catch (err) {
        console.error("Session check failed", err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, currentView);
    } catch {}
  }, [currentView]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_GROUP_KEY, activeGroup?.id || '');
    } catch {}
  }, [activeGroup]);

  // POLLING: Refresh Active Group data periodically to catch new join requests
  useEffect(() => {
    if (!activeGroup) return;

    const intervalId = setInterval(async () => {
      try {
        const allGroups = await storage.groups.getAll();
        const updatedGroup = allGroups.find(g => g.id === activeGroup.id);
        
        // If pending requests changed, update state
        if (updatedGroup) {
          const hasNewRequests = JSON.stringify(updatedGroup.pendingRequests) !== JSON.stringify(activeGroup.pendingRequests);
          const hasNewMembers = JSON.stringify(updatedGroup.members) !== JSON.stringify(activeGroup.members);
          
          if (hasNewRequests || hasNewMembers) {
            setActiveGroup(updatedGroup);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(intervalId);
  }, [activeGroup]);

  // Load Groups on Login and Select First
  useEffect(() => {
    if (currentUser && !activeGroup) {
      const initGroups = async () => {
        try {
          const userGroups = await storage.groups.getByUser(currentUser.id);
          const savedId = (() => {
            try { return localStorage.getItem(ACTIVE_GROUP_KEY) || ''; } catch { return ''; }
          })();
          const chosen = userGroups.find(g => g.id === savedId) || userGroups[0];
          if (chosen) {
            setActiveGroup(chosen);
            const savedView = (() => {
              try { return localStorage.getItem(VIEW_KEY) as ViewState | null; } catch { return null; }
            })();
            setCurrentView(savedView || 'dashboard');
          } else {
            setCurrentView('groups');
          }
        } catch (e) {
          const savedView = (() => {
            try { return localStorage.getItem(VIEW_KEY) as ViewState | null; } catch { return null; }
          })();
          setCurrentView(savedView || 'groups');
        }
      };
      initGroups();
    }
  }, [currentUser, activeGroup]);

  // Load Data specific to Active Group
  useEffect(() => {
    if (currentUser && activeGroup) {
      fetchGroupData();
    } else {
      // Clear data if no group selected
      setPlayers([]);
      setFields([]);
      setMatches([]);
    }
  }, [currentUser, activeGroup]);

  const fetchGroupData = async () => {
    if (!activeGroup) return;
    setIsDataLoading(true);
    try {
      // Pass activeGroup.id to filter data
      const [loadedPlayers, loadedFields, loadedMatches] = await Promise.all([
        storage.players.getAll(activeGroup.id),
        storage.fields.getAll(activeGroup.id),
        storage.matches.getAll(activeGroup.id)
      ]);
      
      setPlayers(loadedPlayers);
      setFields(loadedFields);
      setMatches(loadedMatches);
    } catch (error) {
      console.error("Erro ao carregar dados do grupo:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (!activeGroup) return;
    const capacityForSport = (sport?: string) => {
      if (!sport) return 14;
      if (sport === 'Futebol de Campo') return 22;
      return 14;
    };
    const intervalId = setInterval(async () => {
      try {
        const loadedMatches = await storage.matches.getAll(activeGroup.id);
        setMatches(loadedMatches);
        const cap = capacityForSport(activeGroup.sport);
        const prev = prevConfirmCountsRef.current;
        loadedMatches.forEach(m => {
          const count = (m.confirmedPlayerIds || []).length;
          const prevCount = prev[m.id] ?? count;
          if (prevCount >= cap && count < cap) {
            const field = fields.find(f => f.id === m.fieldId);
            const label = `${m.date} ${m.time || ''} ${field ? ' - ' + field.name : ''}`.trim();
            setNotifications(n => [
              `Vaga aberta no jogo ${label}`,
              ...n
            ].slice(0, 5));
          }
          prev[m.id] = count;
        });
      } catch (e) {
        // ignore
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [activeGroup, fields]);

  const handlePersistPlayer = async (player: Player) => {
    if (!activeGroup) return;
    const playerWithGroup = { ...player, groupId: activeGroup.id };
    await storage.players.save(playerWithGroup);
    // Update local state
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.id === player.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = playerWithGroup;
        return newArr;
      }
      return [...prev, playerWithGroup];
    });
  };

  const handleDeletePlayer = async (id: string) => {
    if (!activeGroup) return;

    // Find the player before deleting to get their User ID
    const playerToRemove = players.find(p => p.id === id);

    // 1. Delete player profile
    await storage.players.delete(id);

    // 2. If linked to a user, remove from group membership
    if (playerToRemove && playerToRemove.userId) {
      await storage.groups.removeMember(activeGroup.id, playerToRemove.userId);
      
      // Update local activeGroup state to reflect removal immediately
      setActiveGroup(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members ? prev.members.filter(mId => mId !== playerToRemove.userId) : []
        };
      });
    }

    // 3. Update local players state
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handlePersistField = async (field: Field) => {
    if (!activeGroup) return;
    const fieldWithGroup = { ...field, groupId: activeGroup.id };
    await storage.fields.save(fieldWithGroup);
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === field.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = fieldWithGroup;
        return newArr;
      }
      return [...prev, fieldWithGroup];
    });
  };

  const handleDeleteField = async (id: string) => {
    await storage.fields.delete(id);
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const handlePersistMatch = async (match: Match) => {
    if (!activeGroup) return;
    const matchWithGroup = { ...match, groupId: activeGroup.id };
    await storage.matches.save(matchWithGroup);
    setMatches(prev => {
      const idx = prev.findIndex(m => m.id === match.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = matchWithGroup;
        return newArr;
      }
      return [matchWithGroup, ...prev];
    });
  };

  const handleDeleteMatch = async (id: string) => {
    await storage.matches.delete(id);
    setMatches(prev => prev.filter(m => m.id !== id));
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("Error logging out", e);
    }
    
    // Clear all states
    setShowLogoutModal(false);
    setShowUserMenu(false);
    setPlayers([]);
    setMatches([]);
    setFields([]);
    setActiveGroup(null);
    setCurrentUser(null);
    
    // Reset view (optional, but good practice)
    setCurrentView('groups');
  };

  const handleGroupSelect = (group: Group) => {
    setActiveGroup(group);
    setCurrentView('dashboard');
  };
  
  const handleUpdateProfile = async (updatedUser: User) => {
    try {
      // 1. Update the User Session & Global Mock DB
      const savedUser = await authService.updateProfile(updatedUser);
      setCurrentUser(savedUser);

      // 2. Propagate changes to all Player records linked to this user across ALL groups
      await storage.players.updateByUserId(savedUser.id, savedUser);

      // 3. Refresh data for the current group if active, to see changes immediately
      if (activeGroup) {
        await fetchGroupData();
        setCurrentView('dashboard'); // Return to Dashboard
      } else {
        setCurrentView('groups'); // Return to Groups list
      }
    } catch (e) {
      console.error("Failed to update profile", e);
    }
  };

  // --- Statistics Helpers for Dashboard ---
  const getTopScorer = () => {
    if (players.length === 0 || matches.length === 0) return null;
    const mvpCounts: Record<string, number> = {};
    matches.forEach(m => {
      if (m.finished && m.mvpId) {
        mvpCounts[m.mvpId] = (mvpCounts[m.mvpId] || 0) + 1;
      }
    });

    let topPlayerId = null;
    let maxMvps = 0;
    Object.entries(mvpCounts).forEach(([id, count]) => {
      if (count > maxMvps) {
        maxMvps = count;
        topPlayerId = id;
      }
    });
    if (!topPlayerId) return null;
    const player = players.find(p => p.id === topPlayerId);
    return player ? { ...player, mvpCount: maxMvps } : null;
  };

  const topPlayer = getTopScorer();

  const renderContent = () => {
    if (currentView === 'profile') {
      return (
        <ProfileScreen 
          user={currentUser!}
          onSave={handleUpdateProfile}
          onCancel={() => activeGroup ? setCurrentView('dashboard') : setCurrentView('groups')}
        />
      );
    }

    if (!activeGroup && currentView !== 'groups') {
       return (
         <div className="flex flex-col items-center justify-center h-full text-gray-500">
           <p>Selecione um grupo para continuar.</p>
           <button onClick={() => setCurrentView('groups')} className="text-green-600 font-bold mt-2 hover:underline">Ir para Meus Grupos</button>
         </div>
       );
    }

    switch (currentView) {
      case 'groups':
        return <GroupsScreen user={currentUser!} onSelectGroup={handleGroupSelect} activeGroupId={activeGroup?.id} />;
      case 'players':
        return (
          <PlayerScreen 
            players={players} 
            matches={matches} 
            onSave={handlePersistPlayer}
            onDelete={handleDeletePlayer}
            activeGroup={activeGroup!}
            currentUser={currentUser!}
            onRefresh={fetchGroupData}
          />
        );
      case 'fields':
        return (
          <FieldScreen 
            fields={fields} 
            onSave={handlePersistField}
            onDelete={handleDeleteField}
            activeGroupId={activeGroup!.id}
            currentUser={currentUser!}
            activeGroup={activeGroup!}
          />
        );
      case 'matches':
        return (
          <MatchScreen 
            players={players} 
            fields={fields} 
            matches={matches} 
            onSave={handlePersistMatch}
            onDelete={handleDeleteMatch}
            activeGroupId={activeGroup!.id}
            currentUser={currentUser!}
            activeGroup={activeGroup!}
            onRefresh={fetchGroupData}
          />
        );
      case 'financial':
        return (
          <FinancialScreen 
            activeGroup={activeGroup!}
            players={players}
          />
        );
      case 'dashboard':
      default:
        return (
          <div className="space-y-6 animate-fade-in pb-10">
            {/* Group Banner */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {activeGroup?.logo ? (
                  <img 
                    src={activeGroup.logo}
                    alt="Logo do Grupo"
                    className="w-14 h-14 rounded-lg border border-gray-200 object-cover flex-none"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 flex-none">
                    ⚽
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 uppercase font-bold">Grupo Ativo</p>
                  <h3 className="text-xl font-bold text-gray-800 truncate">{activeGroup?.name}</h3>
                  <p className="text-xs text-green-600 font-bold truncate">{activeGroup?.sport}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={() => setCurrentView('matches')} className="text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                    {notifications[0]}
                  </button>
                )}
                <button onClick={() => setCurrentView('groups')} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                  Trocar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div 
                onClick={() => setCurrentView('matches')}
                className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-2xl text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden"
              >
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold">Próximos Jogos</h3>
                  <div className="mt-6 flex items-baseline gap-2">
                     <span className="text-5xl font-bold">{matches.filter(m => !m.finished).length}</span>
                     <span className="text-green-100 font-medium">agendados</span>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              </div>

              {topPlayer ? (
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold uppercase tracking-wider text-yellow-50 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 00-.556-.144h-3.554a1 1 0 00-.556.144A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274zM10 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                      Destaque da Temporada
                    </h3>
                    <div className="mt-4">
                      <div className="text-3xl font-bold truncate">{topPlayer.nickname || topPlayer.name}</div>
                      <div className="mt-1 inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                        🏆 {topPlayer.mvpCount} vezes MVP
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setCurrentView('players')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-yellow-400 transition-colors group"
                >
                  <h3 className="text-xl font-bold text-gray-800 group-hover:text-yellow-600 transition-colors">Craque da Galera</h3>
                  <p className="mt-2 text-gray-500 text-sm">Realize partidas e eleja o MVP para ver quem se destaca aqui!</p>
                  <div className="mt-4 flex justify-end">
                    <span className="text-5xl opacity-20 group-hover:opacity-100 transition-opacity">🏆</span>
                  </div>
                </div>
              )}

              {/* Admin Only: Financial Card */}
              {isAdmin && (
                <div 
                  onClick={() => setCurrentView('financial')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-500 transition-colors group flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">Financeiro</h3>
                    <p className="mt-2 text-gray-500 text-sm">Controle o caixa, mensalidades e pagamentos de jogos.</p>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                     <span className="text-blue-600 font-bold text-sm bg-blue-50 px-2 py-1 rounded">Acesso Restrito</span>
                     <span className="text-4xl">💰</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-bold text-indigo-900 text-sm">Dica Profissional</h4>
                <p className="text-indigo-800 text-sm mt-1">
                  Ao finalizar uma partida, não esqueça de selecionar o <strong>Craque da Partida (MVP)</strong>. 
                  Isso gera estatísticas automáticas para o seu grupo!
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  // --- Auth & Loading States ---
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LandingScreen onLoginSuccess={setCurrentUser} />;
  }

  return (
    <div className="h-screen bg-amber-50 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <nav className="flex-none bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col z-30 shadow-sm md:shadow-none md:w-64">
        <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => activeGroup && setCurrentView('dashboard')}>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md bg-gradient-to-br from-green-500 to-green-700">
              ⚽
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">Futgol</h1>
            {activeGroup && (
              <div className="md:hidden relative ml-1" ref={mobileMainMenuRef}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowMainMenu(!showMainMenu); }} 
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-900 focus:outline-none" 
                  aria-label="Menu"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                {showMainMenu && (
                  <div className="absolute top-10 left-0 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-fade-in-up z-50">
                    <button onClick={(e) => { e.stopPropagation(); setCurrentView('dashboard'); setShowMainMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><span className="text-lg">🏠</span> Início</button>
                    <button onClick={(e) => { e.stopPropagation(); setCurrentView('matches'); setShowMainMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><span className="text-lg">📅</span> Partidas</button>
                    <button onClick={(e) => { e.stopPropagation(); setCurrentView('players'); setShowMainMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><span className="text-lg">👥</span> Jogadores</button>
                    <button onClick={(e) => { e.stopPropagation(); setCurrentView('fields'); setShowMainMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><span className="text-lg">📍</span> Campos</button>
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); setCurrentView('financial'); setShowMainMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><span className="text-lg">💰</span> Financeiro</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>


           {/* Mobile Profile Icon with UNIQUE REF */}
           <div className="md:hidden relative" ref={mobileUserMenuRef}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="focus:outline-none">
                <img 
                  src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}`} 
                  className="w-8 h-8 rounded-full border border-gray-100"
                  alt="Avatar"
                />
              </button>
              
              {showUserMenu && (
                <div className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-fade-in-up z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                  </div>
                  <button 
                    onClick={() => { setCurrentView('profile'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-lg">👤</span> Minha Conta
                  </button>
                  <button 
                    onClick={() => { setCurrentView('groups'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-lg">👥</span> Meus Grupos
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sair da conta
                  </button>
                </div>
              )}
           </div>
        </div>
        
        {/* Navigation */}
        {activeGroup && (
          <div className="hidden md:flex md:flex-col overflow-x-auto md:overflow-visible p-2 md:p-4 gap-1.5 md:flex-1 mt-0">
            {/* Removed 'Meus Grupos' from here as requested, it is now only in User Menu */}
            
            <NavButton 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')} 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
              label="Início" 
            />
            <NavButton 
              active={currentView === 'matches'} 
              onClick={() => setCurrentView('matches')} 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              label="Partidas" 
            />
            <NavButton 
              active={currentView === 'players'} 
              onClick={() => setCurrentView('players')} 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              label="Jogadores" 
            />
            <NavButton 
              active={currentView === 'fields'} 
              onClick={() => setCurrentView('fields')} 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              label="Campos" 
            />
            {isAdmin && (
              <NavButton 
                active={currentView === 'financial'} 
                onClick={() => setCurrentView('financial')} 
                icon={<span className="text-lg">💰</span>}
                label="Financeiro" 
              />
            )}
          </div>
        )}
      </nav>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 capitalize">
              {currentView === 'dashboard' ? 'Início' : 
               currentView === 'matches' ? 'Gerenciar Partidas' :
               currentView === 'players' ? 'Gerenciar Jogadores' : 
               currentView === 'groups' ? 'Meus Grupos' : 
               currentView === 'profile' ? 'Minha Conta' : 
               currentView === 'financial' ? 'Gestão Financeira' : 'Gerenciar Campos'}
            </h2>
          <p className="text-gray-500 text-sm mt-1">
            {currentView === 'dashboard' ? `Olá, ${currentUser.name.split(' ')[0]}! Tudo pronto para o jogo?` : 
             currentView === 'groups' ? 'Gerencie seus times' : 
             currentView === 'profile' ? 'Atualize seus dados pessoais' : 
             currentView === 'financial' ? 'Controle o caixa do grupo' : 'Controle total do seu futebol.'}
          </p>
          
          </div>
          
          <div className="flex items-center gap-4 self-end md:self-auto">
             {isDataLoading && (
              <div className="text-sm text-green-600 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full font-medium animate-pulse">
                 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Sincronizando...
              </div>
            )}
            
            {/* Desktop User Profile / Dropdown with UNIQUE REF */}
            <div className="hidden md:block relative" ref={desktopUserMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 bg-white pl-2 pr-4 py-1.5 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                 <img 
                  src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}`} 
                  className="w-8 h-8 rounded-full border border-gray-100"
                  alt="Avatar"
                />
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800 leading-none">{currentUser.name}</p>
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wide">
                    {activeGroup && activeGroup.adminId === currentUser.id ? 'Admin' : 'Membro'}
                  </p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-fade-in-up z-50">
                  <div className="px-4 py-2 border-b border-gray-100 md:hidden">
                    <p className="text-sm font-bold text-gray-800">{currentUser.name}</p>
                    <p className="text-xs text-gray-500">{currentUser.email}</p>
                  </div>
                  <button 
                    onClick={() => { setCurrentView('profile'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span className="text-lg">👤</span> Minha Conta
                  </button>
                  <button 
                    onClick={() => { setCurrentView('groups'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span className="text-lg">👥</span> Meus Grupos
                  </button>
                  <button 
                    onClick={() => { activeGroup ? setCurrentView('dashboard') : setCurrentView('groups'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors md:hidden"
                  >
                    <span className="text-lg">🏠</span> Início
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sair da conta
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>
        {renderContent()}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900">Sair da Conta?</h3>
            <p className="text-gray-500 mt-2 mb-6">
              Tem certeza que deseja sair? Você precisará fazer login novamente para acessar seus dados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper UI Component
const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all whitespace-nowrap
      ${active ? 'bg-green-600 text-white font-semibold shadow-md shadow-green-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;
