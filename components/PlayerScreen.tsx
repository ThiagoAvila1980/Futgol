
import React, { useState, useRef, useEffect } from 'react';
import DateInput from './DateInput';
import { Player, Position, Match, User, Group } from '../types';
import { storage } from '../services/storage';

interface PlayerScreenProps {
  players: Player[];
  matches: Match[];
  onSave: (player: Player) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeGroup: Group;
  currentUser: User;
  onRefresh?: () => Promise<void>;
}

type SortOption = 'name' | 'rating_desc' | 'rating_asc';

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ players, matches, onSave, onDelete, activeGroup, currentUser, onRefresh }) => {
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Pending Requests State
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  
  // Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null); 
  
  // Search State (Global Import)
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Search & Sort State (Local List)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [position, setPosition] = useState<Position>(Position.MEIO);
  const [rating, setRating] = useState(3);
  const [avatar, setAvatar] = useState<string>('');
  const [isMonthlySubscriber, setIsMonthlySubscriber] = useState(false);
  const [monthlyStartMonth, setMonthlyStartMonth] = useState<string>('');
  const [isGuestCheckbox, setIsGuestCheckbox] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hideGuests, setHideGuests] = useState(false);
  
  // Admin Permission State
  const [isAdminCheckbox, setIsAdminCheckbox] = useState(false);

  // Ensure guest cannot be monthly subscriber
  useEffect(() => {
    if (isGuestCheckbox && isMonthlySubscriber) {
      setIsMonthlySubscriber(false);
      setMonthlyStartMonth('');
    }
  }, [isGuestCheckbox, isMonthlySubscriber]);

  // Delete Modal State
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isOwner = activeGroup.adminId === currentUser.id;
  const isAdmin = isOwner || (activeGroup.admins?.includes(currentUser.id));

  useEffect(() => {
    if (isAdmin) {
      loadPendingRequests();
    }
  }, [activeGroup, isAdmin]);

  const loadPendingRequests = async () => {
    if (!activeGroup.pendingRequests || activeGroup.pendingRequests.length === 0) {
      setPendingUsers([]);
      return;
    }

    const users: User[] = [];
    for (const userId of activeGroup.pendingRequests) {
      const user = await storage.users.findById(userId);
      if (user) users.push(user);
    }
    setPendingUsers(users);
  };

  const handleApprove = async (userId: string) => {
    await storage.groups.approveRequest(activeGroup.id, userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    alert("Usuário aprovado! Ele foi adicionado à lista de membros e de jogadores.");
    if (onRefresh) await onRefresh();
  };

  const handleReject = async (userId: string) => {
    await storage.groups.rejectRequest(activeGroup.id, userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
      .slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const processPlayers = () => {
    let result = players.filter(player => {
      const term = searchTerm.toLowerCase();
      const matchesName = player.name.toLowerCase().includes(term);
      const matchesNickname = player.nickname && player.nickname.toLowerCase().includes(term);
      return matchesName || matchesNickname;
    });

    if (hideGuests) {
      result = result.filter(p => !p.isGuest);
    }

    result.sort((a, b) => {
      if (sortOption === 'name') {
        const nameA = (a.nickname || a.name).toLowerCase();
        const nameB = (b.nickname || b.name).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortOption === 'rating_desc') {
        return b.rating - a.rating;
      }
      if (sortOption === 'rating_asc') {
        return a.rating - b.rating;
      }
      return 0;
    });

    return result;
  };

  const displayedPlayers = processPlayers();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem deve ser menor que 2MB.");
        return;
      }

      setIsUploading(true);

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSearchGlobalId = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    try {
      const existingInGroup = players.find(p => p.id === searchId);
      if (existingInGroup) {
        alert("Este jogador já está cadastrado no seu grupo!");
        handleEdit(existingInGroup);
        setIsSearching(false);
        return;
      }

      const globalUser = await storage.users.findById(searchId);
      
      if (globalUser) {
        setName(globalUser.name);
        setEmail(globalUser.email);
        setNickname(globalUser.name.split(' ')[0]);
        if (globalUser.avatar) setAvatar(globalUser.avatar);
        setImportedId(globalUser.id);
        alert(`Perfil encontrado: ${globalUser.name}`);
      } else {
        alert("ID de usuário não encontrado no sistema global.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar usuário.");
    } finally {
      setIsSearching(false);
    }
  };

  const openNewPlayerModal = () => {
    resetForm();
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10) {
      alert('Informe um celular válido (somente números).');
      return;
    }

    const syntheticEmail = `guest+${crypto.randomUUID()}@example.com`;
    const basePlayer = {
      name,
      nickname: nickname.trim() || name.split(' ')[0],
      birthDate: isGuestCheckbox && !birthDate ? '1900-01-01' : birthDate,
      email: isGuestCheckbox && !email ? syntheticEmail : email,
      phone: phoneDigits,
      userId: phoneDigits,
      favoriteTeam,
      position,
      rating,
      avatar,
      isMonthlySubscriber: isGuestCheckbox ? false : isMonthlySubscriber,
      monthlyStartMonth: isGuestCheckbox ? undefined : monthlyStartMonth,
      isGuest: isGuestCheckbox,
      groupId: activeGroup.id
    };

    let targetUserId: string | undefined = undefined;

    try {
      setIsSaving(true);
      if (editingId) {
        const existing = players.find(p => p.id === editingId);
        if (existing) {
          await onSave({ ...existing, ...basePlayer });
          targetUserId = existing.userId;
        }
      } else {
        const newPlayer: Player = {
          ...basePlayer,
          id: importedId || crypto.randomUUID(), 
          matchesPlayed: 0
        };
        await onSave(newPlayer);
        targetUserId = newPlayer.userId;
      }

      if (isOwner && targetUserId) {
        const isCurrentlyAdmin = activeGroup.admins?.includes(targetUserId);
        if (isAdminCheckbox && !isCurrentlyAdmin) {
          await storage.groups.promoteMember(activeGroup.id, targetUserId);
        } else if (!isAdminCheckbox && isCurrentlyAdmin) {
          if (targetUserId !== activeGroup.adminId) {
            await storage.groups.demoteMember(activeGroup.id, targetUserId);
          }
        }
        if (onRefresh) await onRefresh();
      }

      closeModal();
    } catch (err) {
      alert('Falha ao cadastrar jogador. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (player: Player) => {
    if (!isAdmin) return;
    setName(player.name);
    setNickname(player.nickname);
    setBirthDate(player.birthDate);
    setEmail(player.email);
    setPhone(player.phone || '');
    setFavoriteTeam(player.favoriteTeam);
    setPosition(player.position);
    setRating(player.rating);
    setAvatar(player.avatar || '');
    setIsMonthlySubscriber(player.isMonthlySubscriber || false);
    setMonthlyStartMonth(player.monthlyStartMonth || '');
    setIsGuestCheckbox(player.isGuest || false);
    setEditingId(player.id);
    setImportedId(null);
    setSearchId(player.id); 
    
    if (player.userId && activeGroup.admins?.includes(player.userId)) {
      setIsAdminCheckbox(true);
    } else {
      setIsAdminCheckbox(false);
    }
    
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setEditingId(null);
  };

  const resetForm = () => {
    setName('');
    setNickname('');
    setBirthDate('');
    setEmail('');
    setPhone('');
    setFavoriteTeam('');
    setRating(3);
    setPosition(Position.MEIO);
    setAvatar('');
    setSearchId('');
    setImportedId(null);
    setIsUploading(false);
    setIsAdminCheckbox(false);
    setIsMonthlySubscriber(false);
    setMonthlyStartMonth('');
    setIsGuestCheckbox(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmDelete = async () => {
    if (playerToDelete) {
      await onDelete(playerToDelete);
      setPlayerToDelete(null);
    }
  };

  const calculateAge = (dateString: string) => {
    if (!dateString) return '';
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} anos`;
  };

  const getPlayerStats = (playerId: string) => {
    const matchesPlayed = matches.filter(m => m.finished && m.confirmedPlayerIds.includes(playerId)).length;
    const mvpCount = matches.filter(m => m.mvpId === playerId).length;
    return { matchesPlayed, mvpCount };
  };

  return (
    <div className="space-y-6 relative h-full">
      {/* Header Actions & Search */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-2">
        <div className="flex items-center gap-4">
           <h3 className="font-bold text-gray-700 text-lg">Elenco ({players.length})</h3>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          {isAdmin && (
            <button 
              onClick={() => setIsRequestsModalOpen(true)}
              className={`px-3 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all border
                ${pendingUsers.length > 0 
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 animate-pulse' 
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
             >
               <span>🔔 Solicitações</span>
               {pendingUsers.length > 0 && (
                 <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>
               )}
             </button>
          )}

          <div className="relative w-full md:w-56">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              className="pl-10 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none shadow-sm text-sm"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-full md:w-40">
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
               </div>
               <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none shadow-sm text-sm bg-white appearance-none cursor-pointer"
               >
                 <option value="name">Nome (A-Z)</option>
                 <option value="rating_desc">Melhores (5★)</option>
                 <option value="rating_asc">Menores (1★)</option>
               </select>
             </div>
          </div>

          <button 
            onClick={() => setHideGuests(v => !v)}
            className={`px-3 py-2.5 rounded-lg font-bold shadow-sm border transition-all whitespace-nowrap
              ${hideGuests ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            {hideGuests ? 'Convidados ocultos' : 'Ocultar Convidados'}
          </button>

          {isAdmin && (
            <button 
              onClick={openNewPlayerModal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-105 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Novo Jogador
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
        {players.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="text-6xl mb-4">🏃</div>
            <p className="text-lg font-medium">Nenhum jogador cadastrado.</p>
          </div>
        ) : displayedPlayers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400">
            <p className="text-lg font-medium">Nenhum jogador encontrado.</p>
          </div>
        ) : (
          displayedPlayers.map((player) => {
            const stats = getPlayerStats(player.id);
            const displayName = player.nickname || player.name;
            const avatarUrl = player.avatar;
            const whatsappLink = player.phone ? `https://wa.me/55${player.phone.replace(/\D/g, '')}` : null;
            const isPlayerOwner = player.userId === activeGroup.adminId;
            const isPlayerAdmin = activeGroup.admins?.includes(player.userId || '');
            
            const positionColorClass = 
              player.position === Position.GOLEIRO ? 'bg-yellow-500' :
              player.position === Position.DEFENSOR ? 'bg-blue-500' :
              player.position === Position.MEIO ? 'bg-green-500' :
              'bg-red-500';

            return (
              <div key={player.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group flex flex-col relative">
                <div className={`h-1.5 w-full ${positionColorClass}`}></div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    {/* Avatar */}
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="font-bold text-gray-900 truncate text-lg">{displayName}</h4>
                        {isPlayerOwner && <span title="Dono do Grupo" className="text-sm">👑</span>}
                        {isPlayerAdmin && !isPlayerOwner && <span title="Administrador" className="text-sm">🛡️</span>}
                        {player.isGuest && <span className="text-xs bg-yellow-100 px-1.5 py-0.5 rounded text-yellow-800 border border-yellow-200">Convidado</span>}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        {player.position}
                        {player.favoriteTeam && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">❤️ {player.favoriteTeam}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1 mb-3">
                    {player.birthDate && <p>Idade: <span className="font-medium text-gray-700">{calculateAge(player.birthDate)}</span></p>}
                    <p className="flex items-center gap-1">Jogos: <span className="font-medium text-gray-700">{stats.matchesPlayed}</span> | MVP: <span className="font-medium text-yellow-600">🏆 {stats.mvpCount}</span></p>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 font-bold">{'★'.repeat(player.rating)}</span>
                      <span className="text-gray-300">{'★'.repeat(5 - player.rating)}</span>
                    </div>
                  </div>

                  {player.isMonthlySubscriber && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        💳 Mensalista
                      </span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="mt-auto flex items-center gap-2 pt-3 border-t border-gray-50">
                    {whatsappLink && (
                       <a 
                        href={whatsappLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                        title="Conversar no WhatsApp"
                      >
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.446-.669-.446-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306.943.32 1.286.32.395 0 1.237-.52 1.411-1.015.174-.495.174-.916.124-1.015-.05-.099-.248-.174-.545-.322z"/></svg>
                      </a>
                    )}
                    
                    {isAdmin && (
                      <div className="flex gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleEdit(player)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg" title="Editar">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                           </svg>
                         </button>
                         <button onClick={() => setPlayerToDelete(player.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Excluir">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (Mobile) - Admin Only */}
       {isAdmin && (
         <button
          onClick={openNewPlayerModal}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-110 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
       )}

      {/* Modal: Create/Edit Player */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 {editingId ? 'Editar Jogador' : 'Novo Jogador'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {/* Feature: Import Global ID */}
              {!editingId && (
                <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-blue-800 mb-1 uppercase">Importar ID Global (Celular)</label>
                    <input 
                      type="text" 
                      value={searchId} 
                      onChange={e => setSearchId(e.target.value)} 
                      placeholder="Digite o ID/Celular do usuário..."
                      className="w-full text-sm p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleSearchGlobalId}
                    disabled={isSearching}
                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-blue-700"
                  >
                    {isSearching ? '...' : '🔍 Buscar'}
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Avatar Upload */}
                <div className="md:col-span-2 flex flex-col items-center mb-2">
                  <div className={`relative group cursor-pointer ${isUploading ? 'cursor-wait' : ''}`} onClick={!isUploading ? triggerFileInput : undefined}>
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100">
                      {avatar ? (
                        <img src={avatar} alt="Avatar" className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-50' : ''}`} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                      )}
                    </div>
                    {/* Overlay Icon */}
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" disabled={isUploading} />
                  </div>
                  {isUploading && <span className="text-xs text-green-600 mt-1 font-bold animate-pulse">Enviando imagem...</span>}
                  <span className="text-xs text-gray-400 mt-1">Toque para alterar a foto</span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo <span className="text-red-500">*</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ex: João da Silva" required />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apelido</label>
                  <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ex: Jota" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                  <DateInput 
                    value={birthDate}
                    onChange={(v) => setBirthDate(v)}
                    className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="joao@email.com" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular (WhatsApp)</label>
                  <input type="tel" value={phone} onChange={handlePhoneChange} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="(00) 00000-0000" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time do Coração</label>
                  <input type="text" value={favoriteTeam} onChange={(e) => setFavoriteTeam(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ex: Flamengo" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posição</label>
                  <select value={position} onChange={(e) => setPosition(e.target.value as Position)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none">
                    {Object.values(Position).map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Habilidade (1-5)</label>
                  <input type="range" min="1" max="5" step="0.5" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full accent-green-600" />
                  <div className="text-center text-sm font-bold text-yellow-500 mt-1">{'★'.repeat(Math.floor(rating))}{rating % 1 !== 0 ? '½' : ''}</div>
                </div>

                {/* Monthly Subscriber Toggle */}
                <div className={`md:col-span-2 p-3 rounded-lg border flex items-center justify-between ${isGuestCheckbox ? 'bg-purple-50 border-purple-100 opacity-50 cursor-not-allowed' : 'bg-purple-50 border-purple-100'}`}>
                  <div>
                    <label className="block text-sm font-bold text-purple-900">Mensalista</label>
                    <p className="text-xs text-purple-700">Paga valor fixo mensal e não paga por jogo.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isMonthlySubscriber} 
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsMonthlySubscriber(checked);
                        if (checked && !monthlyStartMonth) {
                          const now = new Date();
                          const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                          setMonthlyStartMonth(prefix);
                        }
                      }} 
                      className="sr-only peer" 
                      disabled={isGuestCheckbox} 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Guest Toggle */}
                <div className="md:col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold text-yellow-900">Convidado</label>
                    <p className="text-xs text-yellow-700">Perfil sem cadastro no app. Não vincula permissões.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isGuestCheckbox} onChange={e => setIsGuestCheckbox(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                  </label>
                </div>

                {/* Admin Access Checkbox - Only for Owner */}
                {isOwner && (
                  <div className="md:col-span-2 mt-2 pt-2 border-t border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">Permissões de Acesso 🔒</h4>
                    <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                      <input 
                        type="checkbox" 
                        id="adminCheck" 
                        checked={isAdminCheckbox} 
                        onChange={(e) => setIsAdminCheckbox(e.target.checked)}
                        className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="adminCheck" className="text-sm text-gray-700 cursor-pointer select-none">
                        <strong>Tornar Administrador</strong>
                        <p className="text-xs text-gray-500">Permite gerenciar jogos, campos e aprovar jogadores. (Só funciona se o jogador tiver cadastro no app)</p>
                      </label>
                    </div>
                  </div>
                )}
                
                <div className="md:col-span-2 flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
                  <button type="submit" disabled={isSaving} className={`flex-1 py-3 text-white rounded-lg font-bold shadow-md ${editingId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'} ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    {isSaving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pending Requests */}
      {isRequestsModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Solicitações Pendentes</h3>
              <button onClick={() => setIsRequestsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {pendingUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma solicitação pendente.</p>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-10 h-10 rounded-full border border-gray-200" alt={user.name} />
                        <div>
                          <p className="font-bold text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          <p className="text-xs text-blue-600 font-bold">ID: {user.id}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Recusar">✕</button>
                        <button onClick={() => handleApprove(user.id)} className="p-2 bg-green-600 text-white rounded font-bold shadow-sm hover:bg-green-700 text-sm">Aprovar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

       {/* Delete Confirmation Modal */}
       {playerToDelete && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900">Excluir Jogador?</h3>
            <p className="text-gray-500 mt-2 mb-6">
              Tem certeza que deseja remover este jogador do elenco? O histórico dele será mantido.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPlayerToDelete(null)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
