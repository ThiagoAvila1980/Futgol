
import React, { useState } from 'react';
import { authService } from '../services/auth';
import { User, Position } from '../types';

interface LandingScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('thiago@teste.com');
  const [password, setPassword] = useState('123456');
  
  // Registration Extra Fields
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [position, setPosition] = useState<Position>(Position.MEIO);

  const [error, setError] = useState('');

  // Helper Phone Mask
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
        <div className="relative z-10">
          <div className="mb-8 inline-block p-3 bg-green-800 rounded-lg">
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.22-7.52-1.5z"/></svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Gerencie seu futebol com inteligência.
          </h1>
          <p className="text-green-100 text-lg mb-8 max-w-md">
            Organize partidas, avalie jogadores e deixe nossa IA equilibrar os times para jogos mais competitivos.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center">✓</div>
              <span>Agendamento fácil de partidas</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center">✓</div>
              <span>Equilíbrio de times com IA</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center">✓</div>
              <span>Estatísticas e MVP da rodada</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="md:w-1/2 p-4 md:p-12 flex flex-col justify-center bg-gray-50 overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
          </h2>
          <p className="text-gray-500 mb-6">
            {isLogin ? 'Entre para gerenciar seu grupo.' : 'Preencha seus dados de jogador para começar.'}
          </p>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 p-3 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 mb-6"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Continuar com Google
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-sm">Ou continue com email</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* LOGIN FORM (Simple) */}
            {isLogin ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="******"
                    required
                  />
                </div>
              </>
            ) : (
              /* REGISTER FORM (Detailed) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Ex: João da Silva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apelido</label>
                  <input 
                    type="text" 
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Ex: Jota"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                  <input 
                    type="date" 
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular (WhatsApp) <span className="text-xs text-red-500">* Será seu ID Global</span></label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>

                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time que torce</label>
                  <input 
                    type="text" 
                    value={favoriteTeam}
                    onChange={e => setFavoriteTeam(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Ex: Flamengo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posição</label>
                  <select 
                    value={position}
                    onChange={e => setPosition(e.target.value as Position)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                     {Object.values(Position).map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="******"
                    required
                  />
                </div>
              </div>
            )}

            {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

            <button 
              type="submit" 
              disabled={isLoading}
              className={`w-full p-3 rounded-lg text-white font-bold transition-all shadow-lg mt-6
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:scale-[1.01]'}
              `}
            >
              {isLoading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Finalizar Cadastro')}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-600">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
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
