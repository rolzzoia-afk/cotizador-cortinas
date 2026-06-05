// Formulario de edición del perfil de empresa. Componente "tonto":
// recibe formData + handlers y emite cambios. No tiene estado propio.

import type { ChangeEvent, FormEvent } from 'react';
import { Building2, FileText, Instagram, Globe, MapPin, RotateCcw, Save } from 'lucide-react';
import type { CompanyProfile } from '../../types';

interface CompanyProfileFormProps {
  formData: CompanyProfile;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onUrlChange: (field: 'logoUrl' | 'bannerUrl', value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
}

export default function CompanyProfileForm({
  formData,
  onChange,
  onUrlChange,
  onSubmit,
  onReset,
}: CompanyProfileFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1">
        Modificar Datos de la Empresa
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldInput
          icon={<Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />}
          label="Razón Social"
          name="razonSocial"
          value={formData.razonSocial}
          onChange={onChange}
          required
        />
        <FieldInput
          icon={<FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />}
          label="RUT Comercial"
          name="rut"
          value={formData.rut}
          onChange={onChange}
          placeholder="e.g. 76.452.891-K"
          required
        />
        <FieldInput
          icon={<Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />}
          label="Instagram (@cuenta)"
          name="instagram"
          value={formData.instagram}
          onChange={onChange}
          placeholder="@mi_empresa"
          required
        />
        <FieldInput
          icon={<Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-550" />}
          label="Página Web (URL)"
          name="paginaWeb"
          value={formData.paginaWeb}
          onChange={onChange}
          placeholder="www.miempresa.cl"
          required
        />

        <div className="md:col-span-2">
          <label className="block text-neutral-400 text-xs font-medium mb-1">Dirección Corporativa</label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-3 text-neutral-550" />
            <textarea
              name="direccion"
              value={formData.direccion}
              onChange={onChange}
              rows={2}
              className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
              required
            />
          </div>
        </div>
      </div>

      <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-2 text-xs">
        <span className="font-semibold text-neutral-300 block">Enlaces Directos de Imágenes (Opcional)</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-neutral-500">URL del Logotipo</label>
            <input
              type="text"
              value={formData.logoUrl || ''}
              placeholder="https://ejemplo.com/logo.png"
              onChange={(e) => onUrlChange('logoUrl', e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-indigo-505 outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-500">URL de Imagen de Banner</label>
            <input
              type="text"
              value={formData.bannerUrl || ''}
              placeholder="https://ejemplo.com/banner.png"
              onChange={(e) => onUrlChange('bannerUrl', e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-indigo-505 outline-none font-mono"
            />
          </div>
        </div>
        <p className="text-[10px] text-neutral-500">
          Puedes arrastrar archivos directamente a las zonas de arriba, o pegar links directos aquí.
        </p>
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
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
        >
          <Save size={12} />
          Confirmar y Guardar Cambios
        </button>
      </div>
    </form>
  );
}

// Helper interno: input con ícono y label. Reduce repetición en el form.
function FieldInput({
  icon,
  label,
  name,
  value,
  onChange,
  placeholder,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-neutral-400 text-xs font-medium mb-1">{label}</label>
      <div className="relative">
        {icon}
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          required={required}
        />
      </div>
    </div>
  );
}
