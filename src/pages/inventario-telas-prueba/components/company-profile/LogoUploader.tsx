// Logo flotante del panel de empresa (cuadrado 96x96 que se monta
// como overlay sobre el borde inferior del banner). En vista estática
// muestra la imagen o un placeholder "ROLZZO Cortinas". En modo
// edición agrega un overlay drag&drop chico con click-to-pick.

import { useRef, type DragEvent } from 'react';
import { Upload } from 'lucide-react';

interface LogoUploaderProps {
  logoUrl: string | null;
  isEditing: boolean;
  dragActive: boolean;
  onSetDragActive: (active: boolean) => void;
  onFile: (file: File) => void;
}

export default function LogoUploader({
  logoUrl,
  isEditing,
  dragActive,
  onSetDragActive,
  onFile,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    onSetDragActive(active);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSetDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl bg-[#121212] border-2 border-neutral-800 shadow-md overflow-hidden flex items-center justify-center p-1 group">
      {logoUrl ? (
        <img
          src={logoUrl}
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

      {isEditing && (
        <div
          onDragEnter={(e) => handleDrag(e, true)}
          onDragOver={(e) => handleDrag(e, true)}
          onDragLeave={(e) => handleDrag(e, false)}
          onDrop={handleDrop}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className={`absolute inset-0 bg-black/85 flex flex-col justify-center items-center text-white cursor-pointer transition-all rounded-xl ${
            dragActive ? 'border-2 border-indigo-500 bg-indigo-950/90' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Upload size={16} className="mb-0.5 text-indigo-400" />
          <span className="text-[11px] text-center font-bold px-1">Cambiar Logo</span>
          <input
            type="file"
            ref={inputRef}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            accept="image/*"
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
