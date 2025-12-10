
import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';
import { User, Group, Player, Position } from '../types';
import { storage } from '../services/storage';

interface GroupsScreenProps {
  user: User;
  onSelectGroup: (group: Group) => void;
  activeGroupId?: string;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ user, onSelectGroup, activeGroupId }) => {
  // Data State
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [otherGroups, setOtherGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  
  // Create Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSport, setNewGroupSport] = useState('Futebol Society');
  const [newGroupDate, setNewGroupDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newGroupLogo, setNewGroupLogo] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [newPaymentMode, setNewPaymentMode] = useState<'split' | 'fixed'>('fixed');
  const [newFixedPerPerson, setNewFixedPerPerson] = useState<string>('0');
  const [newMonthlyFee, setNewMonthlyFee] = useState<string>('0');
  const [newGroupCity, setNewGroupCity] = useState<string>('');

  const compressImage = (file: File, maxWidth = 512, maxHeight = 512, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('noctx')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Join Group Form
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    loadGroups();
  }, [user.id]); // Reload when user ID changes

  const loadGroups = async () => {
    setLoading(true);
    try {
      // Fetch all groups to separate "Mine" (Admin or Member) vs "Others"
      const allGroups = await storage.groups.getAll();
      
      const mine: Group[] = [];
      const others: Group[] = [];

      allGroups.forEach(g => {
        const isOwner = g.adminId === user.id;
        const isMember = g.members && g.members.includes(user.id);
        
        if (isOwner || isMember) {
          mine.push(g);
        } else {
          others.push(g);
        }
      });

      setMyGroups(mine);
      setOtherGroups(others);
    } catch (error) {
      console.error("Failed to load groups", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newGroupId = crypto.randomUUID();

      const newGroup: Group = {
        id: newGroupId,
        adminId: user.id,
        name: newGroupName,
        sport: newGroupSport,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: new Date(newGroupDate).toISOString(),
        members: [user.id],
        pendingRequests: [],
        logo: newGroupLogo || undefined,
        paymentMode: newPaymentMode,
        fixedAmount: newPaymentMode === 'fixed' ? Number(newFixedPerPerson || 0) : 0,
        monthlyFee: Number(newMonthlyFee || 0),
        city: newGroupCity.trim()
      };

      await storage.groups.save(newGroup);

      const adminPlayer: Player = {
        id: crypto.randomUUID(),
        groupId: newGroupId,
        userId: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        nickname: user.nickname || user.name.split(' ')[0],
        phone: user.phone || '',
        birthDate: user.birthDate || '',
        favoriteTeam: user.favoriteTeam || '',
        position: user.position || Position.MEIO,
        rating: 5,
        matchesPlayed: 0
      };

      await storage.players.save(adminPlayer);

      setMyGroups([...myGroups, newGroup]);
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDate(new Date().toISOString().split('T')[0]);
      setNewGroupLogo('');
      onSelectGroup(newGroup);
    } catch (err: any) {
      alert(err?.message || 'Não foi possível criar o grupo. Verifique sua conexão e tente novamente.');
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const allGroups = await storage.groups.getAll();
    const groupToJoin = allGroups.find(g => g.inviteCode === inviteCode);

    if (groupToJoin) {
      if (groupToJoin.members?.includes(user.id)) {
        alert("Você já faz parte deste grupo!");
        return;
      }
      if (groupToJoin.pendingRequests?.includes(user.id)) {
        alert("Você já enviou uma solicitação para este grupo. Aguarde a aprovação do administrador.");
        return;
      }

      await storage.groups.requestJoin(groupToJoin.id, user.id);
      
      alert(`Solicitação enviada para o grupo "${groupToJoin.name}"! Aguarde a aprovação do administrador.`);
      setShowJoinModal(false);
      setInviteCode('');
      loadGroups(); // Refresh to update lists if needed
    } else {
      alert("Código de convite inválido ou grupo não encontrado.");
    }
  };

  const startJoinWithCode = (code: string) => {
    setInviteCode(code);
    setShowJoinModal(true);
  };

  const openEditGroup = (group: Group) => {
    setEditGroup(group);
    setNewGroupName(group.name);
    setNewGroupSport(group.sport);
    setNewGroupDate(group.createdAt.split('T')[0]);
    setNewGroupLogo(group.logo || '');
    setNewPaymentMode(group.paymentMode || 'fixed');
    setNewFixedPerPerson(String(group.fixedAmount ?? 0));
    setNewMonthlyFee(String((group as any).monthlyFee ?? 0));
    setNewGroupCity(group.city || '');
    setShowEditModal(true);
  };

  const handleCancelRequest = async (groupId: string) => {
    try {
      await storage.groups.cancelRequest(groupId, user.id);
      await loadGroups();
    } catch (err: any) {
      alert(err?.message || 'Não foi possível cancelar a solicitação.');
    }
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(user.id);
    alert("ID (Celular) copiado!");
  };

  // Filter Logic
  const filteredOtherGroups = otherGroups.filter(g => {
    const q = searchTerm.toLowerCase();
    const c = cityFilter.toLowerCase();
    const matchesQuery = !q || g.name.toLowerCase().includes(q) || g.sport.toLowerCase().includes(q);
    const matchesCity = !c || (g.city || '').toLowerCase().includes(c);
    return matchesQuery && matchesCity;
  });

  return (
    <div className="space-y-12 animate-fade-in pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Hub de Grupos</h2>
           <p className="text-gray-500">Gerencie seus times ou encontre novas turmas para jogar.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowJoinModal(true)}
            className="flex-1 md:flex-none px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Entrar com Código
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex-1 md:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Criar Grupo
          </button>
          <button 
            onClick={async () => {
              try {
                if (!activeGroupId) { alert('Selecione um grupo para gerar convite.'); return; }
                const res = await storage.groups.generateInvite(activeGroupId, 7 * 24 * 3600);
                const link = `${window.location.origin}/join?token=${encodeURIComponent(res.token)}`;
                try { await navigator.clipboard.writeText(link); } catch {}
                alert(`Convite gerado. Link copiado: \n${link}`);
              } catch (e: any) {
                alert(e?.message || 'Falha ao gerar convite.');
              }
            }}
            className="flex-1 md:flex-none px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-md transition-colors"
          >
            Gerar Convite
          </button>
        </div>
      </div>

      {/* User ID Card */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
            ID
          </div>
          <div>
            <h3 className="font-bold text-indigo-900">Seu ID Global (Celular)</h3>
            <p className="text-indigo-700 text-sm">Este é seu código único. Compartilhe para ser adicionado a grupos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-indigo-200 w-full md:w-auto justify-between">
          <code className="text-indigo-800 font-mono font-bold text-sm md:text-base">{user.id}</code>
          <button onClick={copyUserId} className="text-indigo-500 hover:text-indigo-700 p-1" title="Copiar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Section: My Groups */}
          <section className="space-y-4">
            <h3 className="font-bold text-gray-800 text-xl border-b pb-2 flex items-center gap-2">
              <span className="bg-green-100 text-green-700 p-1 rounded">🏆</span>
              Meus Grupos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myGroups.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                  <p className="text-lg font-medium mb-1">Você ainda não participa de nenhum grupo.</p>
                  <p className="text-sm">Crie seu primeiro grupo acima ou explore as opções abaixo.</p>
                </div>
              ) : (
                myGroups.map(group => (
                   <GroupCard 
                    key={group.id} 
                    group={group} 
                    isActive={group.id === activeGroupId} 
                    onClick={() => onSelectGroup(group)} 
                    isOwner={group.adminId === user.id}
                    isAdmin={group.adminId === user.id || (group.admins?.includes(user.id) ?? false)}
                    onEdit={() => openEditGroup(group)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Section: Explore/Other Groups */}
          <section className="space-y-4 pt-4">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center border-b pb-2 gap-2">
              <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 p-1 rounded">🌍</span>
                Explorar Comunidade
              </h3>
              
              {/* Search Bars */}
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar grupos..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="relative w-full md:w-64">
                  <input 
                    type="text"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder="Filtrar por cidade..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414m0 0a4 4 0 10-5.657 5.657 4 4 0 005.657-5.657z" />
                  </svg>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500">Grupos públicos encontrados na plataforma. Solicite entrada para participar.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOtherGroups.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-400">
                  {searchTerm ? <p>Nenhum grupo encontrado para "{searchTerm}".</p> : <p>Não há outros grupos públicos no momento.</p>}
                </div>
              ) : (
                filteredOtherGroups.map(group => {
                   const isPending = group.pendingRequests?.includes(user.id);
                  return (
                     <GroupDiscoveryCard 
                        key={group.id} 
                        group={group} 
                        isPending={isPending}
                        onJoin={() => startJoinWithCode(group.inviteCode)}
                        onCancel={() => handleCancelRequest(group.id)}
                      />
                   );
                })
              )}
            </div>
          </section>
        </>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Criar Novo Grupo</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Grupo</label>
                <input 
                  type="text" 
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Ex: Pelada de Quarta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalidade</label>
                <select 
                  value={newGroupSport}
                  onChange={(e) => setNewGroupSport(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option>Futebol Society</option>
                  <option>Futebol de Campo</option>
                  <option>Futsal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Criação</label>
                <DateInput 
                  value={newGroupDate}
                  onChange={(v) => setNewGroupDate(v)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo do Grupo (opcional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                    {newGroupLogo ? (
                      <img src={newGroupLogo} alt="Logo" className={`w-full h-full object-cover ${isUploadingLogo ? 'opacity-50' : ''}`} />
                    ) : (
                      <span className="text-gray-400 text-lg">🏷️</span>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? 'Enviando...' : 'Selecionar imagem'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingLogo(true);
                        compressImage(file)
                          .then((dataUrl) => {
                            setNewGroupLogo(dataUrl);
                          })
                          .catch(() => {
                            alert('Falha ao processar a imagem. Tente outra imagem.');
                          })
                          .finally(() => setIsUploadingLogo(false));
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Formatos suportados: PNG, JPG. Tamanho máximo: 2MB.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input 
                  type="text" 
                  value={newGroupCity}
                  onChange={(e) => setNewGroupCity(e.target.value)}
                  placeholder="Ex: São Paulo, SP"
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cobrança</label>
                <div className="flex gap-2">
                  <select 
                    value={newPaymentMode}
                    onChange={(e) => {
                      const v = e.target.value as 'split' | 'fixed';
                      setNewPaymentMode(v);
                      if (v === 'split') setNewFixedPerPerson('0');
                    }}
                    className="flex-1 border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="split">Dividir valor do campo</option>
                    <option value="fixed">Valor fixo por pessoa</option>
                  </select>
                  {newPaymentMode === 'fixed' && (
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="R$ por pessoa"
                      value={newFixedPerPerson}
                      onChange={(e) => setNewFixedPerPerson(e.target.value)}
                      className="w-40 border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor da mensalidade</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="R$ (mensal)"
                  value={newMonthlyFee}
                  onChange={(e) => setNewMonthlyFee(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Usado para pagamentos de mensalistas.</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Editar Grupo</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const updated: Group = { 
                  ...editGroup, 
                  name: newGroupName, 
                  sport: newGroupSport, 
                  logo: newGroupLogo || undefined,
                  createdAt: new Date(newGroupDate).toISOString(),
                  paymentMode: newPaymentMode,
                  fixedAmount: newPaymentMode === 'fixed' ? Number(newFixedPerPerson || 0) : 0,
                  monthlyFee: Number(newMonthlyFee || 0),
                  city: newGroupCity.trim()
                };
                await storage.groups.save(updated);
                setShowEditModal(false);
                setEditGroup(null);
                await loadGroups();
              } catch (err: any) {
                alert(err?.message || 'Não foi possível salvar o grupo.');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Grupo</label>
                <input 
                  type="text" 
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Criação</label>
                <DateInput 
                  value={newGroupDate}
                  onChange={(v) => setNewGroupDate(v)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalidade</label>
                <select 
                  value={newGroupSport}
                  onChange={(e) => setNewGroupSport(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option>Futebol Society</option>
                  <option>Futebol de Campo</option>
                  <option>Futsal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo do Grupo (opcional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                    {newGroupLogo ? (<img src={newGroupLogo} alt="Logo" className="w-full h-full object-cover" />) : (<span className="text-gray-400 text-lg">🏷️</span>)}
                  </div>
                  <div>
                    <button
                      type="button"
                      className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? 'Enviando...' : 'Selecionar imagem'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingLogo(true);
                        compressImage(file)
                          .then((dataUrl) => {
                            setNewGroupLogo(dataUrl);
                          })
                          .catch(() => {
                            alert('Falha ao processar a imagem. Tente outra imagem.');
                          })
                          .finally(() => setIsUploadingLogo(false));
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Formatos suportados: PNG, JPG. Tamanho máximo: 2MB.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cobrança</label>
                <div className="flex gap-2">
                  <select 
                    value={newPaymentMode}
                    onChange={(e) => {
                      const v = e.target.value as 'split' | 'fixed';
                      setNewPaymentMode(v);
                      if (v === 'split') setNewFixedPerPerson('0');
                    }}
                    className="flex-1 border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="split">Dividir valor do campo</option>
                    <option value="fixed">Valor fixo por pessoa</option>
                  </select>
                  {newPaymentMode === 'fixed' && (
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="R$ por pessoa"
                      value={newFixedPerPerson}
                      onChange={(e) => setNewFixedPerPerson(e.target.value)}
                      className="w-40 border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor da mensalidade</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="R$ (mensal)"
                  value={newMonthlyFee}
                  onChange={(e) => setNewMonthlyFee(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Usado para pagamentos de mensalistas.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input 
                  type="text" 
                  value={newGroupCity}
                  onChange={(e) => setNewGroupCity(e.target.value)}
                  placeholder="Ex: São Paulo, SP"
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setEditGroup(null); }} className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Entrar em um Grupo</h3>
            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código do Convite</label>
                <input 
                  type="text" 
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono uppercase tracking-widest text-center text-lg"
                  placeholder="XXX-XXX"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">Peça o código ao administrador do grupo.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link ou Token de Convite</label>
                <input 
                  type="text" 
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-center"
                  placeholder="Cole aqui o link enviado"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowJoinModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      if (inviteToken) {
                        let token = inviteToken;
                        try { const u = new URL(inviteToken); token = u.searchParams.get('token') || inviteToken; } catch {}
                        await storage.groups.joinWithInvite(token, user.id);
                        setShowJoinModal(false);
                        setInviteToken('');
                        alert('Solicitação enviada via link. Aguarde aprovação.');
                        return;
                      }
                      await handleJoinGroup(e as any);
                    } catch (err: any) {
                      alert(err?.message || 'Falha ao solicitar entrada.');
                    }
                  }}
                >
                  Solicitar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// Card for "My Groups"
const GroupCard: React.FC<{ group: Group; isActive?: boolean; onClick: () => void; isOwner?: boolean; isAdmin?: boolean; onEdit?: () => void }> = ({ group, isActive, onClick, isOwner, isAdmin, onEdit }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 relative group-card
    ${isActive ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-200'}`}
  >
    {isActive && (
      <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
        Selecionado
      </div>
    )}
    
    {/* Banner/Header */}
    <div className={`h-24 flex items-center justify-center text-5xl relative overflow-hidden
      ${isActive ? 'bg-gradient-to-br from-green-600 to-green-800' : 'bg-gradient-to-br from-gray-100 to-gray-200'}`}>
      {group.logo ? (
        <img src={group.logo} alt="Logo" className="absolute inset-0 w-full h-full object-cover opacity-90" />
      ) : (
        <span className="z-10 relative">⚽</span>
      )}
      {/* Decorative circles */}
      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full"></div>
      <div className="absolute top-2 right-8 w-8 h-8 bg-white/10 rounded-full"></div>
    </div>

    <div className="p-5">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 truncate">{group.name}</h3>
        {isOwner ? (
          <span className="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">Admin</span>
        ) : (
          <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Membro</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">{group.sport}</p>
      
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded justify-between group-hover:bg-green-50 transition-colors">
        <span className="font-mono text-xs font-bold text-gray-400">COD:</span>
        <span className="font-bold tracking-wider">{group.inviteCode}</span>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
        <button onClick={onClick} className="text-green-600 font-bold hover:underline">Acessar Dashboard →</button>
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }} className="text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded">Editar Grupo</button>
        )}
      </div>
    </div>
  </div>
);

// Card for "Discovery"
const GroupDiscoveryCard: React.FC<{ group: Group; isPending?: boolean; onJoin: () => void; onCancel?: () => void }> = ({ group, isPending, onJoin, onCancel }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between hover:border-blue-300 transition-colors">
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center text-blue-600 font-bold text-lg">
          {group.logo ? (
            <img src={group.logo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span>{group.name.charAt(0)}</span>
          )}
        </div>
        <div>
           <h3 className="font-bold text-gray-900">{group.name}</h3>
           <p className="text-xs text-gray-500">{group.sport}</p>
           {group.city && <p className="text-xs text-gray-500">🏙️ {group.city}</p>}
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 mb-4">
        <span className="font-bold">Admin ID:</span> {group.adminId.substring(0, 8)}...
      </div>
    </div>

    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-center text-gray-400">Código (Demo): {group.inviteCode}</div>
      
      {isPending ? (
        <div className="flex gap-2">
          <button 
            type="button"
            disabled
            className="flex-1 py-2 font-bold rounded-lg bg-yellow-100 text-yellow-700 cursor-default"
          >
            Solicitação Enviada
          </button>
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button 
          onClick={onJoin}
          className="w-full py-2 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100"
        >
          Solicitar Entrada
        </button>
      )}
    </div>
  </div>
);
