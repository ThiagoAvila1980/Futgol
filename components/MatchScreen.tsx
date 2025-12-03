
import React, { useState } from 'react';
import { Player, Field, Match, User, Group } from '../types';
import { balanceTeamsWithAI } from '../services/geminiService';
import { storage } from '../services/storage';

interface MatchScreenProps {
  players: Player[];
  fields: Field[];
  matches: Match[];
  onSave: (match: Match) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeGroupId: string;
  currentUser: User;
  activeGroup: Group;
}

export const MatchScreen: React.FC<MatchScreenProps> = ({ players, fields, matches, onSave, onDelete, activeGroupId, currentUser, activeGroup }) => {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  // Filter State for Details View
  const [playerFilter, setPlayerFilter] = useState<'all' | 'confirmed' | 'paid' | 'monthly'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [fieldId, setFieldId] = useState('');

  // Finish Match State
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [mvpId, setMvpId] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  // AI Loading State
  const [isBalancing, setIsBalancing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Delete Modal State
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);

  // Permission Checks: Admin can be owner OR in admin list
  const isAdmin = activeGroup.adminId === currentUser.id || (activeGroup.admins?.includes(currentUser.id) || false);
  
  // Find the player record associated with the current user in this group
  const currentPlayer = players.find(p => p.userId === currentUser.id);

  const handleCreateOrUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    let matchToSave: Match;

    if (editingMatchId) {
      // Update logic
      const existing = matches.find(m => m.id === editingMatchId);
      if (!existing) return;
      matchToSave = {
        ...existing,
        date,
        time,
        fieldId
      };
    } else {
      // Create logic
      matchToSave = {
        id: crypto.randomUUID(),
        groupId: activeGroupId,
        date,
        time,
        fieldId,
        confirmedPlayerIds: [],
        teamA: [],
        teamB: [],
        scoreA: 0,
        scoreB: 0,
        finished: false,
      };
    }

    await onSave(matchToSave);
    closeModal();
  };

  const openNewMatchModal = () => {
    resetForm();
    setIsModalOpen(true);
  }

  const handleEditMatch = (match: Match) => {
    if (!isAdmin) return;
    setDate(match.date);
    setTime(match.time);
    setFieldId(match.fieldId);
    setEditingMatchId(match.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const confirmDelete = async () => {
    if (matchToDelete) {
      await onDelete(matchToDelete);
      if (selectedMatch?.id === matchToDelete) {
        setSelectedMatch(null);
        setView('list');
      }
      setMatchToDelete(null);
    }
  };

  const resetForm = () => {
    setDate('');
    setTime('');
    setFieldId('');
    setEditingMatchId(null);
  };

  const togglePresence = async (matchId: string, playerId: string) => {
    // Only Admin OR the user themselves can toggle presence
    const canToggle = isAdmin || (currentPlayer && currentPlayer.id === playerId);
    if (!canToggle) return;

    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const isConfirmed = match.confirmedPlayerIds.includes(playerId);
      
    // If unconfirming, also remove from teams to avoid inconsistency
    let newTeamA = match.teamA;
    let newTeamB = match.teamB;
    
    if (isConfirmed) {
      newTeamA = match.teamA.filter(p => p.id !== playerId);
      newTeamB = match.teamB.filter(p => p.id !== playerId);
    }

    const updatedMatch = {
      ...match,
      confirmedPlayerIds: isConfirmed
        ? match.confirmedPlayerIds.filter(id => id !== playerId)
        : [...match.confirmedPlayerIds, playerId],
      teamA: newTeamA,
      teamB: newTeamB
    };
    
    // Update selected match if it's the current one
    if (selectedMatch?.id === matchId) {
      setSelectedMatch(updatedMatch);
    }
    
    await onSave(updatedMatch);
  };

  // Payment Toggle Logic - Now UPDATES Financial History Automatically
  const togglePayment = async (matchId: string, playerId: string) => {
    if (!isAdmin) return;
    
    const match = matches.find(m => m.id === matchId);
    const field = fields.find(f => f.id === match?.fieldId);
    if (!match || !field) return;

    const paidList = match.paidPlayerIds || [];
    const isPaid = paidList.includes(playerId);

    const newPaidList = isPaid ? paidList.filter(id => id !== playerId) : [...paidList, playerId];

    const updatedMatch: Match = {
       ...match,
       paidPlayerIds: newPaidList
    };

    if (selectedMatch?.id === matchId) {
       setSelectedMatch(updatedMatch);
    }
    await onSave(updatedMatch);

    // --- FINANCIAL SYNC ---
    const confirmedCount = updatedMatch.confirmedPlayerIds.length;
    
    if (confirmedCount > 0 && field.hourlyRate > 0) {
      const costPerPerson = field.hourlyRate / confirmedCount;
      const totalAmount = newPaidList.length * costPerPerson;
      
      const description = `Pagamentos Avulsos - ${match.date.split('-').reverse().join('/')} - ${field.name}`;
      
      // Upsert transaction in background
      await storage.transactions.upsertMatchTransaction(
        activeGroupId,
        matchId,
        totalAmount,
        description,
        match.date
      );
    }
  };

  const handleGenerateTeams = async (match: Match) => {
    if (!isAdmin) return;
    if (match.confirmedPlayerIds.length < 2) {
      alert("Selecione pelo menos 2 jogadores confirmados para dividir os times.");
      return;
    }

    setIsBalancing(true);
    setAiReasoning(null);

    try {
      const confirmedPlayers = players.filter(p => match.confirmedPlayerIds.includes(p.id));
      const { teamAIds, teamBIds, reasoning } = await balanceTeamsWithAI(confirmedPlayers);

      const updatedMatch = {
        ...match,
        teamA: confirmedPlayers.filter(p => teamAIds.includes(p.id)),
        teamB: confirmedPlayers.filter(p => teamBIds.includes(p.id))
      };

      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
      setAiReasoning(reasoning);

    } catch (error) {
      alert("Erro ao gerar times. Verifique sua chave de API ou tente novamente.");
    } finally {
      setIsBalancing(false);
    }
  };

  const handleFinishMatch = async () => {
    if (!selectedMatch || !isAdmin) return;
    
    const updatedMatch = {
      ...selectedMatch,
      finished: true,
      scoreA,
      scoreB,
      mvpId: mvpId || undefined
    };

    await onSave(updatedMatch);
    
    setIsFinishing(false);
    setSelectedMatch(null); // Close or refresh details
    setView('list');
  };

  const getDisplayName = (p: Player) => p.nickname || p.name;

  // --- Utility Functions ---

  const calculateCostPerPlayer = (match: Match) => {
    const field = fields.find(f => f.id === match.fieldId);
    if (!field || field.hourlyRate <= 0 || match.confirmedPlayerIds.length === 0) return 0;
    return field.hourlyRate / match.confirmedPlayerIds.length;
  };

  const calculateTotalCollected = (match: Match) => {
    const costPerPerson = calculateCostPerPlayer(match);
    if (!costPerPerson) return 0;
    // Assume paidPlayerIds tracks avulso payments.
    return (match.paidPlayerIds?.length || 0) * costPerPerson;
  };

  const shareOnWhatsApp = (match: Match) => {
    const field = fields.find(f => f.id === match.fieldId);
    const cost = calculateCostPerPlayer(match);
    
    let text = `⚽ *FUTGOL - Jogo Confirmado!*\n`;
    text += `📅 ${match.date.split('-').reverse().join('/')} às ${match.time}\n`;
    text += `📍 ${field?.name || 'Local a definir'}\n`;
    if (cost > 0) text += `💰 R$ ${cost.toFixed(2)} por pessoa\n`;
    text += `\n`;

    if (match.teamA.length > 0) {
      text += `🔵 *TIME A (Colete)*\n`;
      match.teamA.forEach(p => text += `• ${getDisplayName(p)}\n`);
      text += `\n`;
    }

    if (match.teamB.length > 0) {
      text += `🔴 *TIME B (Sem Colete)*\n`;
      match.teamB.forEach(p => text += `• ${getDisplayName(p)}\n`);
    }

    if (match.teamA.length === 0 && match.teamB.length === 0) {
      text += `✅ *Confirmados (${match.confirmedPlayerIds.length}):*\n`;
      players
        .filter(p => match.confirmedPlayerIds.includes(p.id))
        .forEach(p => text += `• ${getDisplayName(p)}\n`);
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  // --- DETAIL VIEW (MANAGEMENT) ---
  if (view === 'details' && selectedMatch) {
    const field = fields.find(f => f.id === selectedMatch.fieldId);
    const fieldName = field?.name || "Local desconhecido";
    const confirmedCount = selectedMatch.confirmedPlayerIds.length;
    const costPerPerson = calculateCostPerPlayer(selectedMatch);
    const totalCollected = calculateTotalCollected(selectedMatch);

    // SORT PLAYERS: Current User First, then Alphabetical
    const sortedPlayersForPresence = [...players].sort((a, b) => {
      const isMeA = a.userId === currentUser.id;
      const isMeB = b.userId === currentUser.id;
      
      if (isMeA && !isMeB) return -1;
      if (!isMeA && isMeB) return 1;
      
      const nameA = a.nickname || a.name;
      const nameB = b.nickname || b.name;
      return nameA.localeCompare(nameB);
    });

    // FILTER PLAYERS BASED ON SELECTION
    const filteredPlayersList = sortedPlayersForPresence.filter(p => {
      if (playerFilter === 'confirmed') return selectedMatch.confirmedPlayerIds.includes(p.id);
      if (playerFilter === 'paid') return selectedMatch.paidPlayerIds?.includes(p.id);
      if (playerFilter === 'monthly') return p.isMonthlySubscriber;
      return true; // 'all'
    });

    return (
      <div className="space-y-6 relative h-full">
        <button onClick={() => { setView('list'); setIsFinishing(false); setSelectedMatch(null); setPlayerFilter('all'); }} className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1 font-medium">
          ← Voltar para lista
        </button>

        {/* Header da Partida */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Partida: {selectedMatch.date.split('-').reverse().join('/')}</h2>
              <p className="text-green-700 font-medium text-lg">{selectedMatch.time} - {fieldName}</p>
              
              {!selectedMatch.finished && field && field.hourlyRate > 0 && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                   <div className="inline-flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <span className="text-xs font-semibold text-green-800">Custo Total: R${field.hourlyRate}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm font-bold text-green-700">R$ {costPerPerson.toFixed(2)} / pessoa</span>
                  </div>
                  {isAdmin && (
                    <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                      <span className="text-xs font-bold text-blue-800">Arrecadado: R$ {totalCollected.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedMatch.finished && (
                <div className="mt-2">
                  <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">Partida Finalizada</span>
                  <div className="mt-2 text-xl font-bold">
                    Placar: Time A {selectedMatch.scoreA} x {selectedMatch.scoreB} Time B
                  </div>
                  {selectedMatch.mvpId && (
                     <div className="mt-1 text-yellow-600 font-semibold flex items-center gap-1">
                       🏆 Craque: {getDisplayName(players.find(p => p.id === selectedMatch.mvpId) || players[0])}
                     </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-2 self-end md:self-auto">
               <button 
                onClick={() => shareOnWhatsApp(selectedMatch)}
                className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-200 transition-colors flex items-center gap-2"
                title="Compartilhar no WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.446-.669-.446-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306.943.32 1.286.32.395 0 1.237-.52 1.411-1.015.174-.495.174-.916.124-1.015-.05-.099-.248-.174-.545-.322z"/></svg>
                Compartilhar
              </button>
            </div>
          </div>
        </div>

        {/* --- ACTIONS FOR ACTIVE GAME --- */}
        {!selectedMatch.finished && (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
              <button 
                onClick={() => setPlayerFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                  ${playerFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                Todos ({players.length})
              </button>
              <button 
                onClick={() => setPlayerFilter('confirmed')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                  ${playerFilter === 'confirmed' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'}`}
              >
                Confirmados ({selectedMatch.confirmedPlayerIds.length})
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setPlayerFilter('paid')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                    ${playerFilter === 'paid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50'}`}
                >
                  Pagos ({selectedMatch.paidPlayerIds?.length || 0})
                </button>
              )}
              <button 
                onClick={() => setPlayerFilter('monthly')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                  ${playerFilter === 'monthly' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50'}`}
              >
                Mensalistas ({players.filter(p => p.isMonthlySubscriber).length})
              </button>
            </div>

            {/* Presence List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg text-gray-900 mb-4 flex justify-between items-center">
                Lista de Jogadores
                {playerFilter !== 'all' && (
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Filtrando por: <strong className="uppercase">{playerFilter}</strong>
                  </span>
                )}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
                {filteredPlayersList.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-gray-400 italic">
                    Nenhum jogador encontrado neste filtro.
                  </div>
                ) : (
                  filteredPlayersList.map(player => {
                    const isConfirmed = selectedMatch.confirmedPlayerIds.includes(player.id);
                    const isMe = player.userId === currentUser.id;
                    const canToggle = isAdmin || isMe;
                    const isPaid = selectedMatch.paidPlayerIds?.includes(player.id);
                    
                    return (
                      <div 
                        key={player.id}
                        className={`p-2 rounded text-sm border transition-all flex items-center justify-between
                          ${isMe ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 z-10 shadow-md transform scale-[1.01]' : ''}
                          ${isConfirmed 
                            ? (isMe ? 'bg-blue-100' : 'bg-green-50 border-green-200 text-green-900 font-medium') 
                            : 'bg-gray-50 border-gray-200 text-gray-500'}
                        `}
                      >
                        <button
                          onClick={() => togglePresence(selectedMatch.id, player.id)}
                          disabled={!canToggle}
                          className={`flex-1 text-left flex items-center gap-2 truncate ${canToggle ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <span>{isConfirmed ? '✅' : '⬜'}</span>
                          <span className="truncate">{getDisplayName(player)}</span>
                          {isMe && <span className="text-blue-600 font-bold text-xs">(Você)</span>}
                        </button>

                        {/* Payment Action (Only Admin) */}
                        {isConfirmed && isAdmin && (
                          <div className="ml-2 pl-2 border-l border-gray-300">
                            {player.isMonthlySubscriber ? (
                              <span title="Mensalista (Isento)" className="cursor-help text-purple-600 font-bold bg-purple-100 w-6 h-6 rounded-full flex items-center justify-center text-xs">M</span>
                            ) : (
                              <button 
                                onClick={() => togglePayment(selectedMatch.id, player.id)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors border
                                  ${isPaid ? 'bg-green-600 text-white border-green-700' : 'bg-white text-gray-300 border-gray-200 hover:border-green-500 hover:text-green-500'}
                                `}
                                title={isPaid ? "Pago" : "Marcar Pagamento"}
                              >
                                $
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t flex flex-col md:flex-row gap-4 items-center justify-between">
                <p className="text-sm text-gray-500 italic hidden md:block">
                  {isAdmin 
                    ? (confirmedCount < 2 ? "Selecione jogadores para gerar times." : "Pronto para escalar.")
                    : "Marque sua presença para participar."}
                </p>
                
                {/* ADMIN ONLY ACTIONS */}
                {isAdmin && (
                  <div className="flex gap-2 w-full md:w-auto">
                    {/* Button: Generate Teams */}
                    <button 
                      onClick={() => handleGenerateTeams(selectedMatch)}
                      disabled={isBalancing || confirmedCount < 2}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-white transition-all
                        ${isBalancing || confirmedCount < 2 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'}
                      `}
                    >
                      {isBalancing ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          IA Escalando...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                          </svg>
                          Escalar Times
                        </>
                      )}
                    </button>

                    {/* Button: Finish Match */}
                    <button 
                      onClick={() => setIsFinishing(true)}
                      className="flex-none px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 shadow-lg"
                      title="Encerrar Partida"
                    >
                      🏁 Encerrar
                    </button>
                  </div>
                )}
              </div>
              
              {aiReasoning && (
                <div className="mt-4 p-4 bg-indigo-50 text-indigo-800 rounded-lg text-sm border border-indigo-100 flex gap-2">
                  <span>🤖</span>
                  <div><strong>Análise da IA:</strong> {aiReasoning}</div>
                </div>
              )}
            </div>

            {/* Teams Display */}
            {(selectedMatch.teamA.length > 0 || selectedMatch.teamB.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                <div className="bg-white p-4 rounded-xl shadow border-t-4 border-blue-500">
                  <h3 className="font-bold text-blue-700 text-lg mb-2 text-center">Time A (Colete)</h3>
                  <ul className="divide-y">
                    {selectedMatch.teamA.map(p => (
                      <li key={p.id} className="py-2 flex justify-between items-center text-sm">
                        <span className="text-gray-900 font-medium">{getDisplayName(p)} <span className="text-gray-500 text-xs">({p.position})</span></span>
                        <span className="text-yellow-500 text-xs">{'★'.repeat(p.rating)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-xl shadow border-t-4 border-red-500">
                  <h3 className="font-bold text-red-700 text-lg mb-2 text-center">Time B (Sem Colete)</h3>
                  <ul className="divide-y">
                    {selectedMatch.teamB.map(p => (
                      <li key={p.id} className="py-2 flex justify-between items-center text-sm">
                        <span className="text-gray-900 font-medium">{getDisplayName(p)} <span className="text-gray-500 text-xs">({p.position})</span></span>
                        <span className="text-yellow-500 text-xs">{'★'.repeat(p.rating)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal: Finish Match */}
        {isFinishing && !selectedMatch.finished && isAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-[scaleIn_0.2s_ease-out]">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                🏁 Encerrar Partida
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-center items-center gap-4 bg-gray-50 p-4 rounded-lg">
                  <div className="text-center">
                    <label className="block text-sm font-bold text-blue-700 mb-1">Time A</label>
                    <input 
                      type="number" 
                      min="0"
                      value={scoreA} 
                      onChange={(e) => setScoreA(Number(e.target.value))} 
                      className="w-16 h-16 text-center text-3xl font-bold border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-2xl font-bold text-gray-400">X</span>
                  <div className="text-center">
                    <label className="block text-sm font-bold text-red-700 mb-1">Time B</label>
                    <input 
                      type="number" 
                      min="0"
                      value={scoreB} 
                      onChange={(e) => setScoreB(Number(e.target.value))} 
                      className="w-16 h-16 text-center text-3xl font-bold border rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Craque da Partida (MVP) 🏆</label>
                  <select 
                    value={mvpId}
                    onChange={(e) => setMvpId(e.target.value)}
                    className="w-full border p-3 rounded-lg bg-yellow-50 border-yellow-200 focus:ring-2 focus:ring-yellow-400 outline-none"
                  >
                    <option value="">Selecione o craque...</option>
                    {selectedMatch.confirmedPlayerIds.map(id => {
                      const p = players.find(player => player.id === id);
                      return p ? <option key={p.id} value={p.id}>{getDisplayName(p)}</option> : null;
                    })}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setIsFinishing(false)}
                  className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleFinishMatch}
                  className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-black"
                >
                  Salvar Resultado
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- GRID VIEW ---

  return (
    <div className="space-y-6 relative h-full">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-700 text-lg">Partidas Agendadas</h3>
        {isAdmin && (
          <button 
            onClick={openNewMatchModal}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Agendar Jogo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {matches.map(match => {
            const field = fields.find(f => f.id === match.fieldId);
            const fieldName = field?.name || "Local desconhecido";
            const isFinished = match.finished;
            const dateObj = new Date(`${match.date}T${match.time}`);
            const day = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
            const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });

            return (
              <div 
                key={match.id} 
                className={`group relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer ${isFinished ? 'opacity-90 bg-gray-50' : ''}`}
                onClick={() => { setSelectedMatch(match); setView('details'); }}
              >
                {/* Date Side or Top Banner */}
                <div className={`h-2 w-full ${isFinished ? 'bg-gray-400' : 'bg-green-500'}`}></div>
                
                <div className="p-5 flex items-start gap-4">
                  {/* Calendar Box */}
                  <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg border ${isFinished ? 'bg-gray-100 border-gray-300 text-gray-500' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    <span className="text-xs font-bold uppercase">{month}</span>
                    <span className="text-2xl font-bold leading-none">{day}</span>
                    <span className="text-[10px] uppercase mt-1">{weekday}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                       <h3 className={`font-bold truncate ${isFinished ? 'text-gray-600' : 'text-gray-900'}`}>{fieldName}</h3>
                       {isFinished && (
                         <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">Encerrado</span>
                       )}
                    </div>
                    
                    <p className={`text-sm mt-1 ${isFinished ? 'text-gray-500' : 'text-green-600 font-medium'}`}>
                      {match.time}
                    </p>

                    {isFinished ? (
                      <div className="mt-2 text-sm font-bold text-gray-800 bg-gray-200 inline-block px-2 py-1 rounded">
                        {match.scoreA} x {match.scoreB}
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full border border-green-100 font-bold">
                          {match.confirmedPlayerIds.length} confirmados
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover Actions - Admin Only */}
                {!isFinished && isAdmin && (
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditMatch(match); }}
                        className="p-1.5 bg-white rounded shadow text-gray-400 hover:text-blue-600 hover:scale-110 transition-all"
                        title="Editar"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                         </svg>
                      </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMatchToDelete(match.id); }}
                      className="p-1.5 bg-white rounded shadow text-gray-400 hover:text-red-600 hover:scale-110 transition-all"
                      title="Excluir"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                  </div>
                )}
              </div>
            );
        })}
        {matches.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
             <div className="text-6xl mb-4">📅</div>
             <p className="text-lg font-medium">Nenhuma partida agendada.</p>
             {isAdmin && <p className="text-sm">Clique no botão "Agendar Jogo" para começar.</p>}
           </div>
        )}
      </div>

       {/* Floating Action Button (Mobile) */}
       {isAdmin && (
         <button
          onClick={openNewMatchModal}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-110 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
       )}

      {/* Modal: Create/Edit Match */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 {editingMatchId ? 'Editar Partida' : 'Agendar Nova Partida'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
               <form onSubmit={handleCreateOrUpdateMatch} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                  <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campo</label>
                  <select required value={fieldId} onChange={e => setFieldId(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="">Selecione um campo...</option>
                    {fields.map(f => <option key={f.id} value={f.id}>{f.name} - R${f.hourlyRate}/h</option>)}
                  </select>
                  {fields.length === 0 && <p className="text-xs text-red-500 mt-1">Cadastre um campo primeiro.</p>}
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
                  <button type="submit" className={`flex-1 py-3 text-white rounded-lg font-bold shadow-md ${editingMatchId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}>
                    {editingMatchId ? 'Salvar Alterações' : 'Agendar Jogo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

       {/* Delete Confirmation Modal */}
       {matchToDelete && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900">Excluir Partida?</h3>
            <p className="text-gray-500 mt-2 mb-6">
              Tem certeza que deseja cancelar esta partida? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMatchToDelete(null)}
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
