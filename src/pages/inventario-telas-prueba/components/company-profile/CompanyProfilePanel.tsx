// Orquestador del panel de perfil de empresa.
//
// Maneja el estado de edición (isEditing, formData, dragActive logo/banner)
// y compone 3 componentes hijos:
//   - BannerUploader       (banner top con drag&drop)
//   - LogoUploader         (logo flotante con drag&drop)
//   - CompanyProfileForm   (formulario de edición)
//
// La lógica de subir el archivo a Storage la inyecta el padre vía
// onUploadImage. Si no la inyecta, hace fallback a base64 inline
// (modo standalone, sin Supabase).

import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { Edit3, Save, X } from 'lucide-react';
import type { CompanyProfile } from '../../types';
import BannerUploader from './BannerUploader';
import LogoUploader from './LogoUploader';
import CompanyProfileForm from './CompanyProfileForm';
import StaticProfileView from './StaticProfileView';

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
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompanyProfile>({ ...profile });
  const [dragActiveLogo, setDragActiveLogo] = useState(false);
  const [dragActiveBanner, setDragActiveBanner] = useState(false);

  // Sync state if prop changes
  React.useEffect(() => {
    setFormData({ ...profile });
  }, [profile]);

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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUrlChange = (field: 'logoUrl' | 'bannerUrl', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    await persistir(formData);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setFormData({ ...profile });
    setIsEditing(false);
  };

  return (
    <div id="company-profile-panel" className="bg-[#121212] rounded-2xl shadow-lg border border-neutral-800/80 overflow-hidden transition-all duration-300">
      <BannerUploader
        bannerUrl={formData.bannerUrl}
        isEditing={isEditing}
        dragActive={dragActiveBanner}
        onSetDragActive={setDragActiveBanner}
        onFile={(file) => procesarArchivo(file, 'bannerUrl')}
      />

      <div className="relative px-6 pb-6 pt-16 bg-neutral-900/40">
        <LogoUploader
          logoUrl={formData.logoUrl}
          isEditing={isEditing}
          dragActive={dragActiveLogo}
          onSetDragActive={setDragActiveLogo}
          onFile={(file) => procesarArchivo(file, 'logoUrl')}
        />

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
                onClick={cancelEdit}
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

        {!isEditing ? (
          <StaticProfileView profile={profile} />
        ) : (
          <CompanyProfileForm
            formData={formData}
            onChange={handleChange}
            onUrlChange={handleUrlChange}
            onSubmit={handleSave}
            onReset={onReset}
          />
        )}
      </div>
    </div>
  );
}
