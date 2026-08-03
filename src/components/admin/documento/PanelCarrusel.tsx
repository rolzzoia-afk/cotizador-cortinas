// Las imágenes de un bloque carrusel: subir, ordenar, poner enlace y borrar.
// El carrusel es estático (una fila), así que el orden de esta lista es el
// orden en que salen de izquierda a derecha.

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ImagenCarrusel } from '@/modules/cotizador/docCotizacion';
import { subirImagenDoc } from '@/modules/cotizador/docCotizacionStore';

interface PanelCarruselProps {
  imagenes: ImagenCarrusel[];
  empresaId: string | null | undefined;
  onChange: (imagenes: ImagenCarrusel[]) => void;
}

export default function PanelCarrusel({ imagenes, empresaId, onChange }: PanelCarruselProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = async (files: FileList | null | undefined) => {
    if (!files?.length || !empresaId) return;
    setSubiendo(true);
    try {
      // Varias a la vez: se agregan al final en el orden en que se eligieron.
      const urls = await Promise.all(Array.from(files).map((f) => subirImagenDoc(empresaId, f)));
      onChange([...imagenes, ...urls.map((url) => ({ url }))]);
      toast.success(urls.length === 1 ? 'Imagen agregada.' : `${urls.length} imágenes agregadas.`);
    } catch (e) {
      toast.error('No se pudo subir: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
    }
  };

  const parchar = (i: number, patch: Partial<ImagenCarrusel>) =>
    onChange(imagenes.map((im, j) => (i === j ? { ...im, ...patch } : im)));

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= imagenes.length) return;
    const out = [...imagenes];
    [out[i], out[j]] = [out[j], out[i]];
    onChange(out);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          subir(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-3 text-center text-xs transition ${
          dragActive ? 'border-accent bg-accent/10' : 'border-border'
        }`}
      >
        {subiendo ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">
          {subiendo ? 'Subiendo…' : 'Arrastra imágenes o haz clic (puedes elegir varias)'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => subir(e.target.files)}
        />
      </div>

      {imagenes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Sin imágenes: el carrusel no se dibuja en la cotización.
        </p>
      ) : (
        <ul className="space-y-2">
          {imagenes.map((im, i) => (
            <li key={`${im.url}-${i}`} className="space-y-1 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <img src={im.url} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                <span className="flex-1 text-[11px] text-muted-foreground">#{i + 1}</span>
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground disabled:opacity-30"
                  title="Mover a la izquierda"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === imagenes.length - 1}
                  className="text-muted-foreground disabled:opacity-30"
                  title="Mover a la derecha"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onChange(imagenes.filter((_, j) => j !== i))}
                  className="text-destructive"
                  title="Quitar esta imagen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                value={im.enlace ?? ''}
                onChange={(e) => parchar(i, { enlace: e.target.value })}
                placeholder="Enlace al hacer clic (opcional)"
                className="h-7 text-[11px]"
              />
              <Input
                value={im.alt ?? ''}
                onChange={(e) => parchar(i, { alt: e.target.value })}
                placeholder="Texto alternativo"
                className="h-7 text-[11px]"
              />
            </li>
          ))}
        </ul>
      )}

      <Label className="block text-[11px] font-normal text-muted-foreground">
        Salen en fila, en este orden. Ajusta el ancho del bloque con el control de arriba.
      </Label>
    </div>
  );
}
