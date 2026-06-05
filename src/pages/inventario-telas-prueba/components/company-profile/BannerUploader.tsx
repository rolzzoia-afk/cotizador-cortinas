// Banner superior del panel de empresa. En vista estática muestra la
// imagen del banner (o un placeholder). En modo edición agrega un
// overlay drag&drop con click-to-pick que llama al callback con el File.

import { useRef, type DragEvent } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface BannerUploaderProps {
  bannerUrl: string | null;
  isEditing: boolean;
  dragActive: boolean;
  onSetDragActive: (active: boolean) => void;
  onFile: (file: File) => void;
}

export default function BannerUploader({
  bannerUrl,
  isEditing,
  dragActive,
  onSetDragActive,
  onFile,
}: BannerUploaderProps) {
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
    <div className="relative h-44 bg-neutral-950 group">
      {bannerUrl ? (
        <img
          src={bannerUrl}
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

      {isEditing && (
        <div
          onDragEnter={(e) => handleDrag(e, true)}
          onDragOver={(e) => handleDrag(e, true)}
          onDragLeave={(e) => handleDrag(e, false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col justify-center items-center text-white cursor-pointer transition-all ${
            dragActive ? 'border-4 border-indigo-500 bg-indigo-950/80' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Upload size={24} className="mb-1 text-indigo-400" />
          <span className="text-xs font-semibold">Haz clic o arrastra para cambiar el Banner</span>
          <span className="text-[10px] opacity-75">Sugerido: 1200 x 300px</span>
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
