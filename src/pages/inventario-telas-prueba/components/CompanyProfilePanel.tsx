/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { CompanyProfile } from '../types';
import { Building2, FileText, Instagram, Globe, MapPin, Edit3, Save, X, RotateCcw, Upload, Image as ImageIcon } from 'lucide-react';

interface CompanyProfilePanelProps {
  profile: CompanyProfile;
  onSave?: (newProfile: CompanyProfile) => void | Promise<void>;
  onUploadImage?: (file: File, tipo: 'logo' | 'banner') => Promise<string>;
  isExpanded?: boolean;
  setIsExpanded?: (b: boolean) => void;
  onUpdateProfile?: (newProfile: CompanyProfile) => void;
  onReset: () => void;
}

export default function CompanyProfilePanel({
  profile,
  onSave,
  onUpdateProfile,
  onReset,
  onUploadImage,
}: CompanyProfilePanelProps) {
  const persistir = async (p: CompanyProfile) => {
    if (onSave) await onSave(p);
    else if (onUpdateProfile) onUpdateProfile(p);
  };
  const procesarArchivo = async (file: File, field: 'logoUrl' | 'bannerUrl') => {
    if (onUploadImage) {
      try {
        const tipo: 'logo' | 'banner' = field === 'logoUrl' ? 'logo' : 'banner';
        const url = await onUploadImage(file, tipo);
        setFormData((prev) => ({ ...prev, [field]: url }));
      } catch (err) {
        alert('Error subiendo imagen: ' + (err instanceof Error ? err.message : String(err)));
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => setFormData((prev) => ({ ...prev, [field]: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompanyProfile>({ ...profile });
  const [dragActiveLogo, setDragActiveLogo] = useState(false);
  const [dragActiveBanner, setDragActiveBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Sync state if prop changes
  React.useEffect(() => {
    setFormData({ ...profile });
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistir(formData);
    setIsEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file, field);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent, field: 'logo' | 'banner', active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (field === 'logo') setDragActiveLogo(active);
    else setDragActiveBanner(active);
  };

  const handleDrop = (e: React.DragEvent, field: 'logoUrl' | 'bannerUrl') => {
    e.preventDefault();
    e.stopPropagation();
    if (field === 'logoUrl') setDragActiveLogo(false);
    else setDragActiveBanner(false);

    const file = e.dataTransfer.files?.[0];
    if (file) procesarArchivo(file, field);
  };

  return (
    <div id="company-profile-panel" className="bg-[#121212] rounded-2xl shadow-lg border border-neutral-800/80 overflow-hidden transition-all duration-300">
      
      {/* Banner Area */}
      <div className="relative h-44 bg-neutral-950 group">
        {formData.bannerUrl ? (
          <img 
            src={formData.bannerUrl} 
            alt="Banner de la Empresa" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-indigo-950/70 to-neutral-950 flex flex-col justify-center items-center text-neutral-405 text-white/40">
            <ImageIcon size={32} className="mb-2 text-indigo-400 opacity-60" />
            <span className="text-sm font-medium tracking-wide text-neutral-300">Banner corporativo de Cortinas Rolzzo</span>
            <span className="text-xs opacity-60 text-neutral-500">Sube una imagen o usa el editor</span>
          </div>
        )}

        {/* Banner Edit overlay during edit mode */}
        {isEditing && (
          <div 
            onDragEnter={(e) => handleDrag(e, 'banner', true)}
            onDragOver={(e) => handleDrag(e, 'banner', true)}
            onDragLeave={(e) => handleDrag(e, 'banner', false)}
            onDrop={(e) => handleDrop(e, 'bannerUrl')}
            onClick={() => bannerInputRef.current?.click()}
            className={`absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col justify-center items-center text-white cursor-pointer transition-all ${
              dragActiveBanner ? 'border-4 border-indigo-500 bg-indigo-950/80' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Upload size={24} className="mb-1 text-indigo-400" />
            <span className="text-xs font-semibold">Haz clic o arrastra para cambiar el Banner</span>
            <span className="text-[10px] opacity-75">Sugerido: 1200 x 300px</span>
            <input 
              type="file" 
              ref={bannerInputRef} 
              onChange={(e) => handleFileChange(e, 'bannerUrl')} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        )}
      </div>

      {/* Profile summary with floating logo */}
      <div className="relative px-6 pb-6 pt-16 bg-neutral-900/40">
        
        {/* Floating Logo */}
        <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl bg-[#121212] border-2 border-neutral-800 shadow-md overflow-hidden flex items-center justify-center p-1 group">
          {formData.logoUrl ? (
            <img 
              src={formData.logoUrl} 
              alt="Logo" 
              className="w-full h-full object-contain rounded-xl bg-neutral-950"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-neutral-950 text-white font-bold flex flex-col items-center justify-center text-center rounded-xl p-1 border border-neutral-850">
              <span className="text-[11px] leading-tight font-extrabold text-white tracking-tighter">ROLZZO</span>
              <span className="text-[7px] text-indigo-400 font-medium tracking-widest uppercase">Cortinas</span>
            </div>
          )}

          {/* Logo Edit overlay during edit mode */}
          {isEditing && (
            <div 
              onDragEnter={(e) => handleDrag(e, 'logo', true)}
              onDragOver={(e) => handleDrag(e, 'logo', true)}
              onDragLeave={(e) => handleDrag(e, 'logo', false)}
              onDrop={(e) => handleDrop(e, 'logoUrl')}
              onClick={(e) => {
                e.stopPropagation();
                logoInputRef.current?.click();
              }}
              className={`absolute inset-0 bg-black/85 flex flex-col justify-center items-center text-white cursor-pointer transition-all rounded-xl ${
                dragActiveLogo ? 'border-2 border-indigo-500 bg-indigo-950/90' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <Upload size={16} className="mb-0.5 text-indigo-400" />
              <span className="text-[8px] text-center font-bold px-1">Cambiar Logo</span>
              <input 
                type="file" 
                ref={logoInputRef} 
                onChange={(e) => handleFileChange(e, 'logoUrl')} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          )}
        </div>

        {/* Action Toggle buttons */}
        <div className="absolute top-4 right-6 flex items-center gap-2">
          {!isEditing ? (
            <button
              id="btn-edit-profile"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs rounded-lg border border-neutral-700/60 transition-all cursor-pointer"
            >
              <Edit3 size={13} />
              Editar Datos
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-cancel-profile"
                type="button"
                onClick={() => {
                  setFormData({ ...profile });
                  setIsEditing(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 font-medium text-xs rounded-lg transition-all cursor-pointer"
              >
                <X size={13} />
                Cancelar
              </button>
              <button
                id="btn-save-profile"
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-medium text-xs rounded-lg transition-all shadow-xs cursor-pointer border border-indigo-500/20"
              >
                <Save size={13} />
                Guardar
              </button>
            </div>
          )}
        </div>

        {/* Render Form or Static Information */}
        {!isEditing ? (
          <div>
            <div className="mb-4">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {profile.razonSocial}
                <span className="text-xs font-normal text-neutral-300 bg-neutral-950 px-2.5 py-0.5 rounded-full border border-neutral-800/80">
                  RUT: {profile.rut}
                </span>
              </h1>
              <p className="text-neutral-400 text-xs mt-0.5">Control corporativo & gestión automatizada de rollos de tela</p>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-850">
                <div className="p-1.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-lg shrink-0">
                  <Instagram size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Instagram</span>
                  <a 
                    href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-neutral-200 hover:text-indigo-400 font-medium text-xs truncate block"
                  >
                    {profile.instagram}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-850">
                <div className="p-1.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-lg shrink-0">
                  <Globe size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Página Web</span>
                  <a 
                    href={profile.paginaWeb.startsWith('http') ? profile.paginaWeb : `https://${profile.paginaWeb}`}
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-neutral-200 hover:text-indigo-400 font-medium text-xs truncate block"
                  >
                    {profile.paginaWeb}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-850 md:col-span-1">
                <div className="p-1.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 rounded-lg shrink-0">
                  <MapPin size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Dirección</span>
                  <span className="text-neutral-200 font-medium text-xs truncate block">
                    {profile.direccion}
                  </span>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1">Modificar Datos de la Empresa</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1">Razón Social</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />
                  <input
                    type="text"
                    name="razonSocial"
                    value={formData.razonSocial}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1">RUT Comercial</label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />
                  <input
                    type="text"
                    name="rut"
                    value={formData.rut}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="e.g. 76.452.891-K"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1">Instagram (@cuenta)</label>
                <div className="relative">
                  <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />
                  <input
                    type="text"
                    name="instagram"
                    value={formData.instagram}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="@mi_empresa"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs font-medium mb-1">Página Web (URL)</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />
                  <input
                    type="text"
                    name="paginaWeb"
                    value={formData.paginaWeb}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="www.miempresa.cl"
                    required
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-neutral-400 text-xs font-medium mb-1">Dirección Corporativa</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3 text-neutral-550" />
                  <textarea
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    rows={2}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Direct Image URL fallback fields */}
            <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-2 text-xs">
              <span className="font-semibold text-neutral-300 block">Enlaces Directos de Imágenes (Opcional)</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-500">URL del Logotipo</label>
                  <input
                    type="text"
                    name="logoUrl"
                    value={formData.logoUrl || ''}
                    placeholder="https://ejemplo.com/logo.png"
                    onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value || null }))}
                    className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-indigo-505 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500">URL de Imagen de Banner</label>
                  <input
                    type="text"
                    name="bannerUrl"
                    value={formData.bannerUrl || ''}
                    placeholder="https://ejemplo.com/banner.png"
                    onChange={(e) => setFormData(prev => ({ ...prev, bannerUrl: e.target.value || null }))}
                    className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-indigo-505 outline-none font-mono"
                  />
                </div>
              </div>
              <p className="text-[10px] text-neutral-500">Puedes arrastrar archivos directamente a las zonas de arriba, o pegar links directos aquí.</p>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1 text-neutral-500 hover:text-neutral-300 hover:underline text-[11px] font-medium transition-all cursor-pointer"
                title="Restablece la empresa a la información por defecto de Cortinas Rolzzo"
              >
                <RotateCcw size={11} />
                Restablecer a valores iniciales
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500/20 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Confirmar y Guardar Cambios
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
