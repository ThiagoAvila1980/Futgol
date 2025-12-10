
import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';
import { Player, Field, Match, User, Group, Position, Comment } from '../types';
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
  onRefresh?: () => Promise<void>;
}

export const MatchScreen: React.FC<MatchScreenProps> = ({ players, fields, matches, onSave, onDelete, activeGroupId, currentUser, activeGroup, onRefresh }) => {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  // Filter State for Details View
  const [playerFilter, setPlayerFilter] = useState<'all' | 'confirmed' | 'paid' | 'unpaid' | 'monthly'>('all');
  const [finishedPaymentsFilter, setFinishedPaymentsFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

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
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>(Position.MEIO);
  const [hideGuests, setHideGuests] = useState(false);

  // AI Loading State
  const [isBalancing, setIsBalancing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Delete Modal State
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestCandidates, setGuestCandidates] = useState<Player[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);
  const [monthlyTxMap, setMonthlyTxMap] = useState<Record<string, string>>({});
  const [monthlyAggregateId, setMonthlyAggregateId] = useState<string | null>(null);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyOpenMap, setReplyOpenMap] = useState<Record<string, boolean>>({});
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  // Permission Checks: Admin can be owner OR in admin list
  const isAdmin = activeGroup.adminId === currentUser.id || (activeGroup.admins?.includes(currentUser.id) || false);
  
  // Find the player record associated with the current user in this group
  const currentPlayer = players.find(p => p.userId === currentUser.id);

  const currentMonth = () => new Date().toISOString().split('T')[0].slice(0, 7);
  const loadMonthlyStatus = async () => {
    try {
      setIsMonthlyLoading(true);
      const txs = await storage.transactions.getAll(activeGroupId);
      const m = currentMonth();
      const map: Record<string, string> = {};
      txs.forEach(t => {
        if (t.category === 'MONTHLY_FEE' && (t.date || '').slice(0, 7) === m && t.relatedPlayerId) {
          map[t.relatedPlayerId] = t.id;
        }
      });
      setMonthlyTxMap(map);
      const aggregate = txs.find(t => t.category === 'MONTHLY_FEE' && !t.relatedPlayerId && (t.date || '').slice(0, 7) === m && (t.description || '').toLowerCase().includes('mensalistas'));
      setMonthlyAggregateId(aggregate ? aggregate.id : null);
      await syncMonthlyAggregate(Object.keys(map).length);
    } catch {
      setMonthlyTxMap({});
      setMonthlyAggregateId(null);
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const firstDayOfCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const syncMonthlyAggregate = async (paidCount: number) => {
    const amt = (Number(activeGroup.fixedAmount || 0)) * paidCount;
    const tx = {
      id: monthlyAggregateId || crypto.randomUUID(),
      groupId: activeGroupId,
      description: 'Mensalistas',
      amount: amt,
      type: 'INCOME' as const,
      category: 'MONTHLY_FEE' as const,
      date: firstDayOfCurrentMonth(),
    };
    await storage.transactions.save(tx as any);
    if (!monthlyAggregateId) setMonthlyAggregateId(tx.id);
  };

  useEffect(() => {
    if (view === 'details' && selectedMatch) {
      loadMonthlyStatus();
      loadComments();
    }
  }, [view, selectedMatch, activeGroupId]);

  const loadComments = async () => {
    try {
      if (!selectedMatch) return;
      setIsCommentsLoading(true);
      const data = await storage.comments.getAll(activeGroupId, selectedMatch.id);
      data.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const submitNewComment = async () => {
    if (!selectedMatch || !newCommentText.trim()) return;
    const genId = () => {
      const c: any = (window as any).crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    };
    const c: Comment = {
      id: genId(),
      groupId: activeGroupId,
      matchId: selectedMatch.id,
      parentId: undefined,
      authorPlayerId: currentPlayer ? currentPlayer.id : currentUser.id,
      content: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      await storage.comments.save(c);
      setNewCommentText('');
      await loadComments();
    } catch {
      alert('Não foi possível enviar o comentário.');
    }
  };

  const submitReply = async (parentId: string) => {
    if (!selectedMatch) return;
    const text = (replyTextMap[parentId] || '').trim();
    if (!text) return;
    const genId = () => {
      const c: any = (window as any).crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    };
    const c: Comment = {
      id: genId(),
      groupId: activeGroupId,
      matchId: selectedMatch.id,
      parentId,
      authorPlayerId: currentPlayer ? currentPlayer.id : currentUser.id,
      content: text,
      createdAt: new Date().toISOString(),
    };
    try {
      await storage.comments.save(c);
      setReplyTextMap(prev => ({ ...prev, [parentId]: '' }));
      setReplyOpenMap(prev => ({ ...prev, [parentId]: false }));
      await loadComments();
    } catch {
      alert('Não foi possível enviar a resposta.');
    }
  };

  const requestDeleteComment = (id: string) => {
    setDeleteCommentId(id);
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentId) return;
    await storage.comments.delete(deleteCommentId);
    setDeleteCommentId(null);
    await loadComments();
  };

  const cancelDeleteComment = () => {
    setDeleteCommentId(null);
  };

  const isMonthlyPaid = (playerId: string) => !!monthlyTxMap[playerId];
  const toggleMonthlyFee = async (player: Player) => {
    if (!isAdmin || !player.isMonthlySubscriber) return;
    const existingId = monthlyTxMap[player.id];
    try {
      if (existingId) {
        await storage.transactions.delete(existingId);
      } else {
        const txId = crypto.randomUUID();
        const amt = Number(activeGroup.fixedAmount || 0);
        const tx = {
          id: txId,
          groupId: activeGroupId,
          description: `Mensalidade - ${getDisplayName(player)}`,
          amount: amt,
          type: 'INCOME' as const,
          category: 'MONTHLY_FEE' as const,
          relatedPlayerId: player.id,
          date: new Date().toISOString().split('T')[0],
        };
        await storage.transactions.save(tx);
      }
      // Update local map optimistically
      const newMap = { ...monthlyTxMap };
      if (existingId) {
        delete newMap[player.id];
      } else {
        // Not knowing exact id yet; reload to get accurate state
        // But we can add a placeholder to count
        newMap[player.id] = 'new';
      }
      setMonthlyTxMap(newMap);
      await syncMonthlyAggregate(Object.keys(newMap).length);
      // Finally, reload to get actual ids
      await loadMonthlyStatus();
    } catch {
      alert('Não foi possível atualizar a mensalidade.');
    }
  };

  const handleCreateOrUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!date || !time || !fieldId) return;

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

    try {
      await onSave(matchToSave);
      closeModal();
    } catch (err) {
      alert('Falha ao agendar partida. Verifique os dados e tente novamente.');
    }
  };

  const openNewMatchModal = () => {
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const pad = (n: number) => String(n).padStart(2, '0');
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultTime = `${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`;
    setDate(isoDate);
    setTime(defaultTime);
    setFieldId(fields[0]?.id || '');
    setEditingMatchId(null);
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
    const costPerPersonSync = calculateCostPerPlayer(updatedMatch);
    if (confirmedCount > 0 && costPerPersonSync > 0) {
      const totalAmount = newPaidList.length * costPerPersonSync;
      const description = `Pagamentos Avulsos - ${match.date.split('-').reverse().join('/')} - ${field.name}`;
      await storage.transactions.upsertMatchTransaction(
        activeGroupId,
        matchId,
        totalAmount,
        description,
        match.date
      );
    }
  };

  const addExistingGuest = async (playerId: string) => {
    if (!isAdmin) return;
    if (!selectedMatch) return;
    if (selectedMatch.confirmedPlayerIds.includes(playerId)) {
      setIsGuestPickerOpen(false);
      return;
    }
    const updated: Match = {
      ...selectedMatch,
      confirmedPlayerIds: [...selectedMatch.confirmedPlayerIds, playerId]
    };
    await onSave(updated);
    setSelectedMatch(updated);
    setIsGuestPickerOpen(false);
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
    if (!field || match.confirmedPlayerIds.length === 0) return 0;
    const mode = activeGroup.paymentMode || 'fixed';
    if (mode === 'fixed') {
      const amt = Number(activeGroup.fixedAmount || 0);
      return amt > 0 ? amt : 0;
    }
    if (field.hourlyRate <= 0) return 0;
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
    if (cost > 0) {
      const mode = activeGroup.paymentMode || 'split';
      text += mode === 'fixed' 
        ? `💰 Valor fixo: R$ ${cost.toFixed(2)} por pessoa\n`
        : `💰 Estimado: R$ ${cost.toFixed(2)} por pessoa (divisão)\n`;
    }
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
    const confirmedPlayersForFinished = players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id));
    const filteredConfirmedPlayersForFinished = finishedPaymentsFilter === 'paid'
      ? confirmedPlayersForFinished.filter(p => selectedMatch.paidPlayerIds?.includes(p.id))
      : finishedPaymentsFilter === 'unpaid'
        ? confirmedPlayersForFinished.filter(p => !(selectedMatch.paidPlayerIds || []).includes(p.id))
        : confirmedPlayersForFinished;

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
    let filteredPlayersList = sortedPlayersForPresence.filter(p => {
      if (playerFilter === 'confirmed') return selectedMatch.confirmedPlayerIds.includes(p.id);
      if (playerFilter === 'paid') return selectedMatch.paidPlayerIds?.includes(p.id);
      if (playerFilter === 'unpaid') {
        const isConfirmed = selectedMatch.confirmedPlayerIds.includes(p.id);
        const isPaid = selectedMatch.paidPlayerIds?.includes(p.id);
        const isMonthly = p.isMonthlySubscriber;
        return isConfirmed && !isPaid && !isMonthly;
      }
      if (playerFilter === 'monthly') return p.isMonthlySubscriber;
      return true; // 'all'
    });
    if (playerFilter === 'all') {
      filteredPlayersList = filteredPlayersList.filter(p => !p.isGuest);
    }

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
              
              {!selectedMatch.finished && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                   <div className="inline-flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    {activeGroup.paymentMode === 'split' && field?.hourlyRate ? (
                      <>
                        <span className="text-xs font-semibold text-green-800">Custo Total: R$ {field.hourlyRate}</span>
                        <span className="text-gray-300">|</span>
                      </>
                    ) : null}
                    <span className="text-sm font-bold text-green-700">R$ {costPerPerson.toFixed(2)} / pessoa</span>
                  </div>
                </div>
              )}

              {selectedMatch.finished && (
                <div className="mt-2">
                  <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">Partida Finalizada</span>
                  
                  {selectedMatch.mvpId && (
                     <div className="mt-1 text-yellow-600 font-semibold flex items-center gap-1">
                       🏆 Craque: {getDisplayName(players.find(p => p.id === selectedMatch.mvpId) || players[0])}
                     </div>
                  )}
                  {isAdmin && (
                    <div className="mt-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="mb-3 hidden md:flex flex-wrap gap-2">
                        <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                          <span className="text-xs font-semibold text-gray-700">Confirmados:</span>
                          <span className="text-sm font-bold text-gray-900">{confirmedCount}</span>
                        </div>
                        <div className="inline-flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                          <span className="text-xs font-semibold text-green-800">R$ por pessoa:</span>
                          <span className="text-sm font-bold text-green-700">{costPerPerson ? costPerPerson.toFixed(2) : '—'}</span>
                        </div>
                        
                        
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-blue-800 font-bold">Receber Pagamentos Avulsos (após encerramento)</p>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Financeiro</span>
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 -mb-2">
                        <button
                          onClick={() => setFinishedPaymentsFilter('all')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                            ${finishedPaymentsFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                        >
                          Todos ({confirmedPlayersForFinished.length})
                        </button>
                        <button
                          onClick={() => setFinishedPaymentsFilter('paid')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                            ${finishedPaymentsFilter === 'paid' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'}`}
                        >
                          Pagos ({(selectedMatch.paidPlayerIds || []).length})
                        </button>
                        <button
                          onClick={() => setFinishedPaymentsFilter('unpaid')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                            ${finishedPaymentsFilter === 'unpaid' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50'}`}
                        >
                          A Pagar ({confirmedPlayersForFinished.filter(p => !(selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber).length})
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {selectedMatch.confirmedPlayerIds.length === 0 ? (
                          <div className="col-span-full text-sm text-blue-700">Nenhum confirmado nesta partida.</div>
                        ) : (
                          filteredConfirmedPlayersForFinished.map(player => {
                              const isPaid = selectedMatch.paidPlayerIds?.includes(player.id);
                              return (
                                <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-sm font-medium text-gray-800 truncate">{getDisplayName(player)}</span>
                                  </div>
                                  <button 
                                    onClick={() => togglePayment(selectedMatch.id, player.id)}
                                    className={`text-xs px-3 py-1 rounded-full border font-bold transition-colors
                                      ${isPaid ? 'bg-green-600 text-white border-green-700' : 'bg-red-600 text-white border-red-700 hover:bg-red-700'}`}
                                  >
                                    {isPaid ? 'Pago' : 'Pagar'}
                                  </button>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              
            </div>
            <button
              onClick={() => shareOnWhatsApp(selectedMatch)}
              className="absolute top-4 right-4 p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Compartilhar"
              aria-label="Compartilhar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </div>

        

        {isAdmin && isGuestPickerOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Selecionar Convidado</h3>
                <button onClick={() => setIsGuestPickerOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold px-2">✕</button>
              </div>
              <div className="p-4">
                <input 
                  type="text" 
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Buscar convidado..."
                  className="w-full border p-2 rounded mb-3"
                />
                <div className="space-y-2 overflow-y-auto max-h-[50vh]">
                  {guestCandidates
                    .filter(p => (p.nickname || p.name).toLowerCase().includes(guestSearch.toLowerCase()))
                    .map(p => (
                      <div key={p.id} className="flex items-center justify-between border rounded p-2">
                        <div className="flex items-center gap-2">
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-gray-900">{p.nickname || p.name}</div>
                            <div className="text-xs text-gray-500">{p.position}</div>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => addExistingGuest(p.id)}
                          className="text-sm font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1 rounded"
                        >
                          Adicionar
                        </button>
                      </div>
                  ))}
                  {guestCandidates.filter(p => (p.nickname || p.name).toLowerCase().includes(guestSearch.toLowerCase())).length === 0 && (
                    <div className="text-sm text-gray-500">Nenhum convidado encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- ACTIVE GAME: ACTIONS --- */}
        {!selectedMatch.finished && (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
              <button 
                onClick={() => setPlayerFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                  ${playerFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                Todos ({players.filter(p => !p.isGuest).length})
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
                onClick={() => setPlayerFilter('unpaid')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                  ${playerFilter === 'unpaid' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50'}`}
              >
                A Pagar ({players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id) && !(selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber).length})
              </button>
              <button 
                onClick={() => setPlayerFilter('monthly')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap
                  ${playerFilter === 'monthly' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50'}`}
              >
                Mensalistas ({players.filter(p => p.isMonthlySubscriber).length})
              </button>
              {/* Guests are always excluded from the list; add via modal */}
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

              {isAdmin && (
                <div className="mb-4">
                  <button 
                    type="button"
                    onClick={async () => {
                      setIsLoadingGuests(true);
                      try {
                        const all = await storage.players.getAll(activeGroupId);
                        const available = all.filter(p => p.isGuest && !selectedMatch.confirmedPlayerIds.includes(p.id));
                        setGuestCandidates(available);
                        setIsGuestPickerOpen(true);
                      } catch (e) {
                        alert('Não foi possível carregar convidados.');
                      } finally {
                        setIsLoadingGuests(false);
                      }
                    }}
                    className="bg-purple-600 text-white rounded px-3 py-2 hover:bg-purple-700"
                  >
                    {isLoadingGuests ? 'Carregando...' : 'Adicionar Convidado'}
                  </button>
                </div>
              )}
              
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
                          
                          {player.isGuest && (
                            <span className="text-[10px] bg-yellow-100 px-1 py-0.5 rounded text-yellow-800 border border-yellow-200">Convidado</span>
                          )}
                          {isMe && <span className="text-blue-600 font-bold text-xs">(Você)</span>}
                        </button>

                        {/* Payment Action (Only Admin) */}
                        {isConfirmed && isAdmin && (
                          <div className="ml-2 pl-2 border-l border-gray-300">
                            {player.isMonthlySubscriber ? (
                              <button
                                type="button"
                                onClick={() => toggleMonthlyFee(player)}
                                title={isMonthlyPaid(player.id) ? 'Mensalidade paga' : 'Mensalidade pendente'}
                                className={`w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center bg-white
                                  ${isMonthlyPaid(player.id) ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}`}
                              >
                                M
                              </button>
                            ) : (
                              <button 
                                onClick={() => togglePayment(selectedMatch.id, player.id)}
                                className={`px-3 py-1 rounded-full font-bold text-xs transition-colors border
                                  ${isPaid ? 'bg-green-600 text-white border-green-700' : 'bg-red-600 text-white border-red-700 hover:bg-red-700'}
                                `}
                              >
                                {isPaid ? 'Pago' : 'Pagar'}
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
                      onClick={() => {}}
                      disabled={true}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-white transition-all bg-gray-400 cursor-not-allowed`}
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
              
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-800">Conversas</h3>
                  <button onClick={loadComments} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Atualizar</button>
                </div>
                <div className="mt-2 bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Escreva um comentário"
                      className="flex-1 border p-2 rounded-lg text-sm"
                    />
                    <button type="button" onClick={(e) => { e.stopPropagation(); submitNewComment(); }} disabled={!newCommentText.trim()} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">Enviar</button>
                  </div>
                  {isCommentsLoading ? (
                    <div className="text-sm text-gray-400">Carregando...</div>
                  ) : (
                    <div className="space-y-3">
                      {comments.filter(c => !c.parentId).map(c => {
                        const author = players.find(p => p.id === c.authorPlayerId);
                        const replies = comments.filter(r => r.parentId === c.id);
                        const isMine = c.authorPlayerId === (currentPlayer?.id || currentUser.id);
                        return (
                          <div key={c.id} className={`border rounded-lg p-3 ${isMine ? 'bg-green-50 border-green-100' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-bold text-gray-800">{author ? (author.nickname || author.name) : 'Jogador'}</div>
                              <div className="flex items-center gap-3">
                                <div className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString('pt-BR')}</div>
                                {currentPlayer?.id === c.authorPlayerId && (
                                  <button onClick={() => requestDeleteComment(c.id)} className="text-[11px] text-red-600 font-bold">Excluir</button>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-700">{c.content}</div>
                            <div className="mt-2">
                              <button
                                onClick={() => setReplyOpenMap(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                className="text-xs text-blue-600 font-bold"
                              >Responder</button>
                            </div>
                            {replyOpenMap[c.id] && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="text"
                                  value={replyTextMap[c.id] || ''}
                                  onChange={(e) => setReplyTextMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                                  placeholder="Escreva uma resposta"
                                  className="flex-1 border p-2 rounded-lg text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); submitReply(c.id); }}
                                  disabled={!((replyTextMap[c.id] || '').trim())}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                >Enviar</button>
                              </div>
                            )}
                            {replies.length > 0 && (
                              <div className="mt-3 pl-3 border-l-2 border-gray-200 space-y-2">
                                {replies.map(r => {
                                  const rauthor = players.find(p => p.id === r.authorPlayerId);
                                  const isMineReply = r.authorPlayerId === (currentPlayer?.id || currentUser.id);
                                  return (
                                    <div key={r.id} className={`border rounded-lg p-2 ${isMineReply ? 'bg-green-50 border-green-100' : 'bg-white border-gray-200'}`}>
                                      <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-gray-800">{rauthor ? (rauthor.nickname || rauthor.name) : 'Jogador'}</div>
                                        <div className="flex items-center gap-2">
                                          <div className="text-[11px] text-gray-500">{new Date(r.createdAt).toLocaleString('pt-BR')}</div>
                                          {currentPlayer?.id === r.authorPlayerId && (
                                            <button onClick={() => requestDeleteComment(r.id)} className="text-[11px] text-red-600 font-bold">Excluir</button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="mt-1 text-sm text-gray-700">{r.content}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {comments.filter(c => !c.parentId).length === 0 && (
                        <div className="text-sm text-gray-400">Nenhum comentário ainda.</div>
                      )}
                    </div>
                  )}
                </div>
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
                        <span className="text-gray-900 font-medium">
                          {getDisplayName(p)} <span className="text-gray-500 text-xs">({p.position})</span>
                          {p.isGuest && <span className="ml-2 text-[10px] bg-yellow-100 px-1 py-0.5 rounded text-yellow-800 border border-yellow-200">Convidado</span>}
                        </span>
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
                        <span className="text-gray-900 font-medium">
                          {getDisplayName(p)} <span className="text-gray-500 text-xs">({p.position})</span>
                          {p.isGuest && <span className="ml-2 text-[10px] bg-yellow-100 px-1 py-0.5 rounded text-yellow-800 border border-yellow-200">Convidado</span>}
                        </span>
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

        {deleteCommentId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Excluir comentário</h3>
              <p className="text-sm text-gray-600 mb-6">Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita.</p>
              <div className="mt-2 flex gap-3">
                <button onClick={cancelDeleteComment} className="flex-1 py-2 px-3 text-gray-700 bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button onClick={confirmDeleteComment} className="flex-1 py-2 px-3 bg-red-600 text-white rounded-lg font-bold">Excluir</button>
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
        {([...matches].sort((a, b) => {
            const aFinished = !!a.finished;
            const bFinished = !!b.finished;
            if (aFinished !== bFinished) return aFinished ? 1 : -1;
            const aDate = new Date(`${a.date}T${a.time || '00:00'}`);
            const bDate = new Date(`${b.date}T${b.time || '00:00'}`);
            if (!aFinished && !bFinished) return aDate.getTime() - bDate.getTime();
            return bDate.getTime() - aDate.getTime();
          })).map(match => {
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
                  <DateInput value={date} onChange={(v) => setDate(v)} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" required min={new Date().toISOString().split('T')[0]} />
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
