
import React, { useState } from 'react';
import DateInput from './DateInput';
import { authService } from '../services/auth';
import api from '../services/api';
import { User, Position } from '../types';

interface LandingScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration Extra Fields
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [position, setPosition] = useState<Position>(Position.MEIO);

  const [error, setError] = useState('');
  const [lookupInfo, setLookupInfo] = useState('');
  const [lookupGroups, setLookupGroups] = useState<Array<{id: string; name: string}>>([]);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotUid, setForgotUid] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [newForgotPassword, setNewForgotPassword] = useState('');

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await api.get('/api/health/');
        if (isMounted) setServerOnline(true);
      } catch {
        if (isMounted) setServerOnline(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Helper Phone Mask
  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
      .slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = formatPhone(e.target.value);
    setPhone(v);
  };

  const handlePhoneBlur = async () => {
    if (isLogin) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setLookupGroups([]);
      setLookupInfo('');
      return;
    }
    try {
      const resp = await authService.lookupByPhone(digits);
      if (resp && resp.found && resp.profile) {
        setName(resp.profile.name || '');
        setNickname(resp.profile.nickname || '');
        setBirthDate(resp.profile.birthDate || '');
        setFavoriteTeam(resp.profile.favoriteTeam || '');
        setPosition((resp.profile.position || Position.MEIO) as Position);
        // Não preencher email automaticamente no cadastro
        const gs = resp.groups || [];
        setLookupGroups(gs);
        const names = (gs || []).map(g => g.name).join(', ');
        const src = ((resp as any)?.source === 'profile') ? 'profile' : 'guest';
        if (src === 'profile') {
          setLookupInfo(names ? `Este celular já possui conta. Grupos: ${names}` : 'Este celular já possui conta.');
        } else {
          setLookupInfo(names ? `Este celular já possui cadastro como convidado. Grupos: ${names}. Continue o cadastro.` : 'Este celular já possui cadastro como convidado. Continue o cadastro.');
        }
      } else {
        setLookupGroups([]);
        setLookupInfo('');
      }
    } catch {
      setLookupGroups([]);
      setLookupInfo('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let user;
      if (isLogin) {
        user = await authService.login(email, password);
      } else {
        user = await authService.register({
          name,
          email,
          password,
          nickname,
          birthDate,
          phone,
          favoriteTeam,
          position
        });
      }
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar. Verifique os dados e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotInfo('');
    try {
      const resp = await authService.forgotPassword(forgotEmail || email);
      setForgotInfo('Se existir uma conta com este email, enviaremos instruções.');
      if (resp && resp.uid && resp.token) {
        setForgotUid(resp.uid);
        setForgotToken(resp.token);
      }
    } catch {
      setForgotInfo('Se existir uma conta com este email, enviaremos instruções.');
    } finally {
      setForgotLoading(false);
    }
  };
  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUid || !forgotToken || !newForgotPassword) return;
    setForgotLoading(true);
    try {
      await authService.resetPasswordConfirm(forgotUid, forgotToken, newForgotPassword);
      setForgotInfo('Senha redefinida com sucesso. Faça login novamente.');
      setShowForgot(false);
      setNewForgotPassword('');
      setForgotUid('');
      setForgotToken('');
    } catch {
      setForgotInfo('Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await authService.loginWithGoogle();
      onLoginSuccess(user);
    } catch (err) {
      setError('Erro no login com Google.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Lado Esquerdo - Apresentação */}
      <div className="md:w-1/2 bg-green-900 text-white p-8 md:p-16 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop')] bg-cover opacity-20 bg-center"></div>
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-6 w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center"><span className="text-2xl">⚽</span></div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">Futgol</h1>
          <p className="text-green-100 text-lg max-w-md mx-auto">Organize seus jogos, seus times e suas finanças.</p>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="md:w-1/2 p-4 md:p-12 flex flex-col justify-center bg-gray-50 overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Entrar no Futgol' : 'Criar conta'}
          </h2>
          {serverOnline !== null && (
            <div className={`inline-flex items-center gap-2 text-xs font-bold px-2 py-1 rounded ${serverOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-600' : 'bg-red-600'}`}></span>
              {serverOnline ? 'Servidor online' : 'Servidor offline'}
            </div>
          )}
          <p className="text-gray-500 mb-6">
            {isLogin ? 'Acesse para gerenciar seu grupo.' : 'Preencha seus dados para começar.'}
          </p>

          

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* LOGIN FORM (Simple) */}
            {isLogin ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="seu@email.com" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="******" required />
                  <div className="mt-2 text-right">
                    <button type="button" className="text-sm text-green-700 hover:underline" onClick={() => { setShowForgot(true); setForgotEmail(email); }}>
                      Esqueci minha senha
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* REGISTER FORM (Detailed) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Celular (WhatsApp) <span className="text-xs text-red-500">* ID Global</span></label>
                  <input type="tel" value={phone} onChange={handlePhoneChange} onBlur={handlePhoneBlur} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="(00) 00000-0000" required />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="Ex: João da Silva" required />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Apelido</label>
                  <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="Ex: Jota" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
                  <DateInput value={birthDate} onChange={(v) => setBirthDate(v)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" required max={new Date().toISOString().split('T')[0]} />
                </div>

                 <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Time que torce</label>
                  <input type="text" value={favoriteTeam} onChange={e => setFavoriteTeam(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="Ex: Flamengo" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Posição</label>
                  <select value={position} onChange={e => setPosition(e.target.value as Position)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none">
                     {Object.values(Position).map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="seu@email.com" required />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="******" required />
                </div>
              </div>
            )}

            {error && <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 p-3 rounded-md"><span>⚠️</span><span>{error}</span></div>}

            {(!isLogin && lookupInfo) && (
              <div className="mt-2 flex items-center gap-2 text-blue-800 text-xs bg-blue-50 p-3 rounded-md border border-blue-200">
                <span>ℹ️</span>
                <span>{lookupInfo}</span>
              </div>
            )}
            <button type="submit" disabled={isLoading} className={`w-full p-3 rounded-lg text-white font-bold transition-all shadow-lg mt-4 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:scale-[1.01]'}`}>
              {isLoading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Finalizar Cadastro')}
            </button>
          </form>

          {showForgot && (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Recuperar senha</h3>
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="seu@email.com" required />
                {forgotInfo && <p className="text-sm text-gray-600">{forgotInfo}</p>}
                {forgotUid && forgotToken && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Ambiente de desenvolvimento: você pode redefinir a senha diretamente.</p>
                    <input type="password" value={newForgotPassword} onChange={e => setNewForgotPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none" placeholder="Nova senha" />
                    <button onClick={handleForgotConfirm} className={`w-full p-2 rounded-lg text-white font-medium ${forgotLoading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`} disabled={forgotLoading}>Redefinir agora</button>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" className="flex-1 p-2 bg-gray-100 rounded-lg" onClick={() => { setShowForgot(false); setForgotInfo(''); }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={forgotLoading} className={`flex-1 p-2 rounded-lg text-white font-medium ${forgotLoading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                    {forgotLoading ? 'Enviando...' : 'Enviar instruções'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="mt-8 text-center text-gray-600">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button 
              onClick={() => { 
                const toRegister = isLogin === true;
                setIsLogin(!isLogin); 
                setError(''); 
                setLookupInfo('');
                setLookupGroups([]);
                setEmail('');
                setPassword('');
                if (toRegister) {
                  setName('');
                  setNickname('');
                  setBirthDate('');
                  setPhone('');
                  setFavoriteTeam('');
                }
              }}
              className="ml-2 text-green-600 font-bold hover:underline focus:outline-none"
            >
              {isLogin ? 'Cadastre-se' : 'Fazer Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
