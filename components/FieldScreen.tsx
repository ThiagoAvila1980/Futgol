
import React, { useState, useEffect, useRef } from 'react';
import { Field, User, Group } from '../types';

// Declare Leaflet on window
declare global {
  interface Window {
    L: any;
  }
}

interface FieldScreenProps {
  fields: Field[];
  onSave: (field: Field) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeGroupId: string;
  currentUser: User;
  activeGroup: Group;
}

export const FieldScreen: React.FC<FieldScreenProps> = ({ fields, onSave, onDelete, activeGroupId, currentUser, activeGroup }) => {
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  
  // Coordinates State
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Delete Modal State
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  // Map Refs
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapContainerId = 'field-map-container';

  // Permission Check: Admin can be owner OR in admin list
  const isAdmin = activeGroup.adminId === currentUser.id || (activeGroup.admins?.includes(currentUser.id) || false);

  // Helper Phone Mask
  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
      .slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactPhone(formatPhone(e.target.value));
  };

  // Filter Logic
  const filteredFields = fields.filter(field => 
    field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Initialize Map Logic
  useEffect(() => {
    // Only initialize map if modal is open and Leaflet is loaded
    if (!isModalOpen || !window.L) return;

    // Small timeout to allow modal to render before initializing map
    const timer = setTimeout(() => {
      // Cleanup previous map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Default: São Paulo
      const defaultLat = -23.55052;
      const defaultLng = -46.633309;

      let startLat = defaultLat;
      let startLng = defaultLng;
      let zoomLevel = 13;

      if (editingId && lat && lng) {
        startLat = lat;
        startLng = lng;
        zoomLevel = 15;
      }

      const map = window.L.map(mapContainerId).setView([startLat, startLng], zoomLevel);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Add marker if we have coords
      if (editingId && lat && lng) {
        markerRef.current = window.L.marker([lat, lng], { draggable: isAdmin }).addTo(map); // Only draggable if admin
      } else if (!editingId && !lat) {
        // Try Geolocation only for new fields
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              map.setView([latitude, longitude], 15);
            },
            () => { console.log('Geolocation unavailable or denied'); }
          );
        }
      }

      // Map Click Event (Only if Admin)
      if (isAdmin) {
        map.on('click', (e: any) => {
          const { lat: clickedLat, lng: clickedLng } = e.latlng;
          setLat(clickedLat);
          setLng(clickedLng);

          if (markerRef.current) {
            markerRef.current.setLatLng([clickedLat, clickedLng]);
          } else {
            markerRef.current = window.L.marker([clickedLat, clickedLng], { draggable: true }).addTo(map);
            markerRef.current.on('dragend', (event: any) => {
              const marker = event.target;
              const position = marker.getLatLng();
              setLat(position.lat);
              setLng(position.lng);
            });
          }
        });

        if (markerRef.current) {
           markerRef.current.on('dragend', (event: any) => {
              const marker = event.target;
              const position = marker.getLatLng();
              setLat(position.lat);
              setLng(position.lng);
            });
        }
      }

      mapRef.current = map;
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, editingId, isAdmin]); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!name.trim()) return;

    const coordinates = (lat && lng) ? { lat, lng } : undefined;

    const baseField = {
      name,
      location,
      contactName,
      contactPhone,
      hourlyRate: Number(hourlyRate) || 0,
      coordinates,
      groupId: activeGroupId
    };

    try {
      setIsSaving(true);
      if (editingId) {
        const existing = fields.find(f => f.id === editingId);
        if (existing) {
          await onSave({ ...existing, ...baseField });
        }
      } else {
        const newField: Field = {
          ...baseField,
          id: crypto.randomUUID()
        };
        await onSave(newField);
      }
      closeModal();
    } catch (err) {
      alert('Falha ao cadastrar campo. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewFieldModal = () => {
    resetForm();
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (field: Field) => {
    // Admins can edit, members can only view details (reuse modal as view-only? simplified for now just edit)
    if (!isAdmin) return; 

    setName(field.name);
    setLocation(field.location);
    setContactName(field.contactName || '');
    setContactPhone(field.contactPhone || '');
    setHourlyRate(field.hourlyRate.toString());
    
    if (field.coordinates) {
      setLat(field.coordinates.lat);
      setLng(field.coordinates.lng);
    } else {
      setLat(null);
      setLng(null);
    }

    setEditingId(field.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setEditingId(null);
  };

  const resetForm = () => {
    setName('');
    setLocation('');
    setContactName('');
    setContactPhone('');
    setHourlyRate('');
    setLat(null);
    setLng(null);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  };

  const confirmDelete = async () => {
    if (fieldToDelete) {
      await onDelete(fieldToDelete);
      setFieldToDelete(null);
    }
  };

  return (
    <div className="space-y-6 relative h-full">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
           <h3 className="font-bold text-gray-700 text-lg">Campos Cadastrados</h3>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              className="pl-10 p-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none shadow-sm text-sm"
              placeholder="Buscar campos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isAdmin && (
            <button 
              onClick={openNewFieldModal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-105 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Novo Campo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
        {fields.length === 0 ? (
           <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
             <div className="text-6xl mb-4">🏟️</div>
             <p className="text-lg font-medium">Nenhum campo cadastrado.</p>
             {isAdmin && <p className="text-sm">Clique no botão "+" para adicionar um local de jogo.</p>}
           </div>
        ) : filteredFields.length === 0 ? (
           <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg font-medium">Nenhum campo encontrado.</p>
          </div>
        ) : (
          filteredFields.map((field) => {
            const cleanPhone = field.contactPhone?.replace(/\D/g, '');
            const whatsappLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

            return (
              <div key={field.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col">
                {/* Thin Colored Line for Fields (Green for grass/pitch) */}
                <div className="h-1.5 w-full bg-green-500"></div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-lg text-gray-800 truncate pr-2">{field.name}</h3>
                       <div className="bg-green-50 text-green-700 font-bold px-2 py-1 rounded text-sm whitespace-nowrap">
                          {field.hourlyRate > 0 ? `R$ ${field.hourlyRate}/h` : 'Grátis'}
                       </div>
                    </div>
                    
                    <p className="text-gray-500 text-sm mt-1 mb-3 flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="truncate">{field.location || "Sem endereço cadastrado"}</span>
                    </p>
                    
                    {(field.contactName || field.contactPhone) && (
                      <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mb-3 space-y-1">
                        {field.contactName && <div className="font-medium flex items-center gap-1">
                           <span className="text-gray-400">👤</span> {field.contactName}
                        </div>}
                        {field.contactPhone && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="whitespace-nowrap">📞 {field.contactPhone}</span>
                            {whatsappLink && (
                              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1">
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {field.coordinates && (
                      <div className="mt-3">
                         <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${field.coordinates.lat},${field.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          Ver no Mapa
                        </a>
                      </div>
                    )}
                  </div>
                  
                  {/* ACTIONS - ADMIN ONLY */}
                  {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(field)}
                        className="text-blue-600 text-sm font-bold bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                      <button
                        onClick={() => setFieldToDelete(field.id)}
                        className="text-red-500 text-sm font-bold bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                      >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

       {/* Floating Action Button (Mobile) - Admin Only */}
       {isAdmin && (
         <button
          onClick={openNewFieldModal}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-110 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
       )}

      {/* Modal: Create/Edit Field (Simplified for Admin Only edit) */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 {editingId ? 'Editar Campo' : 'Novo Campo'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Campo <span className="text-red-500">*</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ex: Arena Soccer Society" required />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Rua das Palmeiras, 100" />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contato (Nome)</label>
                  <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ex: Sr. João" />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular do Contato</label>
                  <input type="tel" value={contactPhone} onChange={handlePhoneChange} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="(00) 00000-0000" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Hora (R$)</label>
                  <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-green-500 outline-none" placeholder="0.00" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Localização (Toque para marcar)</label>
                  <div id={mapContainerId} className="w-full h-64 rounded-lg border border-gray-300 z-0 relative"></div>
                  {lat && lng ? (
                    <p className="text-xs text-green-600 mt-1">✓ Marcado: {lat.toFixed(5)}, {lng.toFixed(5)}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">O mapa centralizará em sua localização atual.</p>
                  )}
                </div>
                
                <div className="md:col-span-2 flex gap-3 pt-4">
                   <button type="button" onClick={closeModal} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-4 rounded-lg transition-colors flex-1">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSaving} className={`font-medium py-2.5 px-4 rounded-lg transition-colors shadow-md text-white flex-1 ${editingId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'} ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    {isSaving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar Campo')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fieldToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900">Excluir Campo?</h3>
            <p className="text-gray-500 mt-2 mb-6">
              Tem certeza que deseja remover este campo?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setFieldToDelete(null)} className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
