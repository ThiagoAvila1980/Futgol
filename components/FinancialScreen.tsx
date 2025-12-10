
import React, { useState, useEffect, useMemo } from 'react';
import DateInput from './DateInput';
import { Transaction, Player, Group, TransactionType } from '../types';
import { storage } from '../services/storage';

interface FinancialScreenProps {
  activeGroup: Group;
  players: Player[];
}

export const FinancialScreen: React.FC<FinancialScreenProps> = ({ activeGroup, players }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter State (Default: Current Month)
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('OTHER');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // New: Extra field for "Other" description
  const [otherDescription, setOtherDescription] = useState('');

  // Quick Pay Modal (Monthly)
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null); // Loading state
  const [successId, setSuccessId] = useState<string | null>(null); // Success state checkmark
  
  // Delete Confirmation State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  
  const monthlyCandidates = players;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const selectedMonthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Updated Category Translation Map
  const categoryLabels: Record<string, string> = {
    MATCH_REVENUE: 'Receita de Jogo',
    MONTHLY_FEE: 'Mensalidade',
    FIELD_RENT: 'Aluguel de Quadra',
    EQUIPMENT: 'Equipamentos',
    EVENT_BBQ: 'Churrasco/Evento',
    GIFTS: 'Brindes/Prêmios',
    DONATION: 'Doação',
    SPONSORSHIP: 'Patrocínio',
    OTHER: 'Outros'
  };

  // Dynamic Category Lists
  const expenseCategories = [
    { id: 'FIELD_RENT', label: 'Aluguel de Campo/Quadra' },
    { id: 'EQUIPMENT', label: 'Equipamentos (Bola, Colete...)' },
    { id: 'EVENT_BBQ', label: 'Churrasco' },
    { id: 'GIFTS', label: 'Brindes' },
    { id: 'OTHER', label: 'Outros' }
  ];

  const incomeCategories = [
    { id: 'MATCH_REVENUE', label: 'Receita de Jogos' },
    { id: 'MONTHLY_FEE', label: 'Mensalidade' },
    { id: 'DONATION', label: 'Doação' },
    { id: 'SPONSORSHIP', label: 'Patrocínio' },
    { id: 'OTHER', label: 'Outros' }
  ];

  useEffect(() => {
    loadTransactions();
  }, [activeGroup.id]);

  // Reset category when switching type
  useEffect(() => {
    if (isModalOpen) {
      setCategory(type === 'EXPENSE' ? 'FIELD_RENT' : 'MATCH_REVENUE');
    }
  }, [type, isModalOpen]);

  const loadTransactions = async () => {
    setLoading(true);
    const data = await storage.transactions.getAll(activeGroup.id);
    // Sort by date desc
    data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(data);
    setLoading(false);
  };

  const calculateBalance = () => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, total: income - expense };
  };

  const { income, expense, total } = calculateBalance();

  const earliestDate = useMemo(() => {
    if (transactions.length === 0) return '';
    let min = transactions[0].date;
    for (const t of transactions) {
      if (t.date < min) min = t.date;
    }
    return min;
  }, [transactions]);

  useEffect(() => {
    if (!earliestDate) return;
    if (filterStartDate < earliestDate) setFilterStartDate(earliestDate);
    if (filterEndDate < earliestDate) setFilterEndDate(earliestDate);
  }, [earliestDate]);

  // Filter Logic
  const filteredTransactions = transactions.filter(t => {
    return t.date >= filterStartDate && t.date <= filterEndDate;
  });

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  // Helper to check if paid current month
  const hasPaidSelectedMonth = (playerId: string) => {
    return transactions.some(t => 
      t.relatedPlayerId === playerId && 
      t.category === 'MONTHLY_FEE' && 
      t.date.startsWith(selectedMonthPrefix)
    );
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    try {
      // If "Other" is selected and specific description is provided, append it
      let finalDescription = description;
      if (category === 'OTHER' && otherDescription.trim()) {
        finalDescription += ` - ${otherDescription.trim()}`;
      }

      const newTx: Transaction = {
        id: generateId(),
        groupId: activeGroup.id,
        description: finalDescription,
        amount: parseFloat(amount),
        type,
        category: category as any,
        date: transactionDate
      };

      await storage.transactions.save(newTx);
      await loadTransactions();
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      alert("Erro ao salvar. Tente novamente.");
    }
  };

  const handlePayMonthlyFee = async (player: Player) => {
    setProcessingId(player.id);
    setSuccessId(null);

    try {
      const newTx: Transaction = {
        id: generateId(),
        groupId: activeGroup.id,
        description: `Mensalidade - ${player.nickname || player.name}`,
        amount: Number(activeGroup.monthlyFee || 0),
        type: 'INCOME',
        category: 'MONTHLY_FEE',
        relatedPlayerId: player.id,
        date: `${selectedMonthPrefix}-01`
      };

      await storage.transactions.save(newTx);
      await loadTransactions();
      setSuccessId(player.id);
      
      setTimeout(() => {
        setSuccessId(null);
      }, 2000);

    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      alert("Erro técnico ao salvar.");
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDelete = async () => {
    if (transactionToDelete) {
      await storage.transactions.delete(transactionToDelete);
      await loadTransactions();
      setTransactionToDelete(null);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDescription('');
    setAmount('');
    setType('EXPENSE');
    setCategory('OTHER');
    setOtherDescription('');
  };

  const currentMonthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long' });
  
  // Available categories based on selected type
  const availableCategories = type === 'EXPENSE' ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Controle Financeiro</h2>
          <p className="text-gray-500 text-sm">Gerencie o caixa do grupo, mensalidades e despesas.</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setIsMonthlyModalOpen(true)}
            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
           >
             📋 Mensalistas
           </button>
           <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2"
           >
             + Lançamento
           </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <p className="text-sm text-gray-500 font-bold uppercase">Saldo em Caixa</p>
           <h3 className={`text-3xl font-bold mt-1 ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
             R$ {total.toFixed(2)}
           </h3>
           <p className="text-xs text-gray-400 mt-1">Acumulado total</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <p className="text-sm text-gray-500 font-bold uppercase">Receitas</p>
           <h3 className="text-3xl font-bold mt-1 text-blue-600">
             R$ {income.toFixed(2)}
           </h3>
           <p className="text-xs text-gray-400 mt-1">Total arrecadado</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <p className="text-sm text-gray-500 font-bold uppercase">Despesas</p>
           <h3 className="text-3xl font-bold mt-1 text-red-500">
             R$ {expense.toFixed(2)}
           </h3>
           <p className="text-xs text-gray-400 mt-1">Total gasto</p>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
          <div className="font-bold text-gray-700 flex items-center gap-2">
            📄 Histórico
            <span className="text-xs font-normal bg-gray-200 px-2 py-0.5 rounded text-gray-600">{filteredTransactions.length} registros</span>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
             <div className="flex items-center gap-1 px-2">
               <span className="text-xs font-bold text-gray-500 uppercase">De</span>
               <DateInput 
                 value={filterStartDate}
                 onChange={(v) => setFilterStartDate(v)}
                 className="text-sm text-gray-900 bg-white font-medium focus:outline-none cursor-pointer"
                 max={new Date().toISOString().split('T')[0]}
                 min={earliestDate || undefined}
               />
             </div>
             <div className="w-px h-4 bg-gray-300"></div>
             <div className="flex items-center gap-1 px-2">
               <span className="text-xs font-bold text-gray-500 uppercase">Até</span>
               <DateInput 
                 value={filterEndDate}
                 onChange={(v) => setFilterEndDate(v)}
                 className="text-sm text-gray-900 bg-white font-medium focus:outline-none cursor-pointer"
                 max={new Date().toISOString().split('T')[0]}
                 min={earliestDate || undefined}
               />
             </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg">Nenhuma movimentação neste período.</p>
            <p className="text-sm mt-1">Ajuste as datas no filtro acima.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {filteredTransactions.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm border ${tx.type === 'INCOME' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                    {tx.type === 'INCOME' ? '💰' : '💸'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{tx.description}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      📅 {new Date(tx.date).toLocaleDateString('pt-BR')} • <span className="uppercase text-[10px] bg-gray-100 px-1.5 rounded tracking-wide">{categoryLabels[tx.category] || tx.category}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                  </span>
                  <button onClick={() => setTransactionToDelete(tx.id)} className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors" title="Excluir">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Novo Lançamento</h3>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                 <div className="flex gap-2">
                   <button type="button" onClick={() => setType('EXPENSE')} className={`flex-1 py-2 rounded-lg font-bold border ${type === 'EXPENSE' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>Despesa</button>
                   <button type="button" onClick={() => setType('INCOME')} className={`flex-1 py-2 rounded-lg font-bold border ${type === 'INCOME' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>Receita</button>
                 </div>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                 <input type="text" required value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500 outline-none" placeholder={type === 'EXPENSE' ? "Ex: Churrasco" : "Ex: Venda de Camisas"} />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                 <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full border p-2 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500 outline-none" placeholder="0.00" step="0.01" />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                 <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border p-2 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500 outline-none">
                   {availableCategories.map(cat => (
                     <option key={cat.id} value={cat.id}>{cat.label}</option>
                   ))}
                 </select>
               </div>

               {/* Conditional Input for Other */}
               {category === 'OTHER' && (
                 <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Especifique (Opcional)</label>
                    <input 
                      type="text" 
                      value={otherDescription} 
                      onChange={e => setOtherDescription(e.target.value)} 
                      className="w-full border p-2 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-300 outline-none" 
                      placeholder="Detalhes..." 
                    />
                 </div>
               )}
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                 <DateInput value={transactionDate} onChange={(v) => setTransactionDate(v)} className="w-full border p-2 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500 outline-none" required />
               </div>
               
               <div className="flex gap-3 pt-4">
                 <button type="button" onClick={closeModal} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
                 <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">Salvar</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Mensalistas */}
      {isMonthlyModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-in-up">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">Mensalidades de {currentMonthName}</h3>
                  <p className="text-xs text-indigo-700">Selecione mês e ano para cobrar atrasados.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="border border-indigo-200 rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value={1}>janeiro</option>
                    <option value={2}>fevereiro</option>
                    <option value={3}>março</option>
                    <option value={4}>abril</option>
                    <option value={5}>maio</option>
                    <option value={6}>junho</option>
                    <option value={7}>julho</option>
                    <option value={8}>agosto</option>
                    <option value={9}>setembro</option>
                    <option value={10}>outubro</option>
                    <option value={11}>novembro</option>
                    <option value={12}>dezembro</option>
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="border border-indigo-200 rounded px-2 py-1 text-sm bg-white"
                  >
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => setIsMonthlyModalOpen(false)} className="text-indigo-400 hover:text-indigo-600 font-bold px-2">✕</button>
            </div>
            <div className="p-4 overflow-y-auto bg-white">
              {monthlyCandidates.length === 0 ? (
                <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  <p>Nenhum jogador disponível.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlyCandidates.map(p => {
                    const alreadyPaid = hasPaidSelectedMonth(p.id);
                    const eligible = !p.monthlyStartMonth || selectedMonthPrefix >= (p.monthlyStartMonth || '');
                    return (
                      <div key={p.id} className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-3 w-full sm:w-auto mb-2 sm:mb-0">
                           <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}`} className="w-10 h-10 rounded-full border border-gray-100 object-cover" alt="Avatar" />
                           <div>
                              <span className="font-bold text-gray-800 block">{p.nickname || p.name}</span>
                              {p.isMonthlySubscriber && <span className="text-xs text-gray-500 block">Mensalista</span>}
                              {p.monthlyStartMonth && (
                                <span className="text-[11px] text-gray-400">Início: {p.monthlyStartMonth.split('-').reverse().join('/')}</span>
                              )}
                           </div>
                        </div>
                        
                        <button 
                          onClick={() => handlePayMonthlyFee(p)}
                          disabled={processingId === p.id || successId === p.id || alreadyPaid || !eligible}
                          className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 min-w-[140px]
                            ${successId === p.id
                              ? 'bg-green-500 text-white border border-green-600'
                              : alreadyPaid
                                ? 'bg-gray-100 text-green-700 border border-green-200 cursor-default'
                                : processingId === p.id 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                  : eligible 
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                    : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'}
                          `}
                        >
                          {processingId === p.id && (
                            <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          )}
                          {successId === p.id && (
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                          {alreadyPaid && !successId && !processingId && (
                            <span className="flex items-center gap-1">✅ Pago</span>
                          )}
                          
                          {successId === p.id ? 'Salvo!' : processingId === p.id ? '...' : alreadyPaid ? '' : 'Receber'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900">Excluir Lançamento?</h3>
            <p className="text-gray-500 mt-2 mb-6">
              Tem certeza que deseja apagar este registro financeiro? O saldo será recalculado.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTransactionToDelete(null)}
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
