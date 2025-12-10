
import React, { useState, useRef } from 'react';
import DateInput from './DateInput';
import { User, Position } from '../types';

interface ProfileScreenProps {
  user: User;
  onSave: (updatedUser: User) => Promise<void>;
  onCancel: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onSave, onCancel }) => {
  const [name, setName] = useState(user.name);
  const [nickname, setNickname] = useState(user.nickname || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [email, setEmail] = useState(user.email);
  const [favoriteTeam, setFavoriteTeam] = useState(user.favoriteTeam || '');
  const [position, setPosition] = useState<Position>(user.position || Position.MEIO);
  const [avatar, setAvatar] = useState<string>(user.avatar || '');
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const updatedUser: User = {
      ...user,
      name,
      nickname,
      birthDate,
      email,
      favoriteTeam,
      position,
      avatar
    };

    try {
      await onSave(updatedUser);
      // Removed alert to allow immediate closure by parent component
    } catch (error) {
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10 animate-fade-in-up">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header Banner */}
        <div className="h-32 bg-gradient-to-r from-green-600 to-green-800 relative">
           <button 
              onClick={onCancel}
              className="absolute top-4 left-4 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 backdrop-blur-sm"
           >
             ← Voltar
           </button>
           <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
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
           </div>
        </div>

        <div className="pt-16 pb-8 px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">{name}</h2>
            <p className="text-gray-500 text-sm">Gerencie suas informações pessoais</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                <label className="block text-xs font-bold text-yellow-800 mb-1 uppercase tracking-wide">
                  ID Global / Celular (Bloqueado)
                </label>
                <div className="flex items-center gap-2">
                   <span className="text-lg font-mono font-bold text-gray-700 tracking-wider">
                     {user.phone || user.id}
                   </span>
                   <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                     Não alterável
                   </span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Seu número de celular é sua identidade única nos grupos.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apelido</label>
                <input 
                  type="text" 
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <DateInput 
                  value={birthDate} 
                  onChange={(v) => setBirthDate(v)} 
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time do Coração</label>
                <input 
                  type="text" 
                  value={favoriteTeam} 
                  onChange={(e) => setFavoriteTeam(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" 
                  placeholder="Ex: Flamengo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posição Preferida</label>
                <select 
                  value={position} 
                  onChange={(e) => setPosition(e.target.value as Position)} 
                  className="w-full rounded-lg border-gray-300 border p-3 focus:ring-2 focus:ring-green-500 outline-none transition-shadow bg-white text-gray-900"
                >
                  {Object.values(Position).map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-6 flex gap-4">
              <button 
                type="button" 
                onClick={onCancel}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transition-all hover:scale-[1.01] flex justify-center gap-2"
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
