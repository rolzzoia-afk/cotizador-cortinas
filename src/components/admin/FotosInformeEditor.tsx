// Cargador de fotos referenciales del informe: sube, ordena y quita.
//
// Lo usan los tres lugares donde el correo lleva imagen — las introducciones de
// pasos de luz, los bloques fijos del final y la ficha de la tela de cada
// habitación —, así que la mecánica (comprimir, subir al bucket público, guardar
// la URL) se escribe una sola vez.
//
// Quitar una foto la saca de la LISTA, no del bucket. El archivo se borra recién
// cuando la sección se guarda (ver `fotosHuerfanas`): si se borrara al instante,
// alguien que quita una foto y se va sin guardar dejaría la configuración
// apuntando a un archivo inexistente, y el próximo informe saldría con la imagen
// rota en el correo del cliente.
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { subirFotoInforme } from '@/modules/visita/informeAssetsStore';
import { MAX_FOTOS_TEXTO } from '@/modules/visita/imagenesInforme';

type Props = {
  fotos: string[];
  onChange: (fotos: string[]) => void;
  /** Carpeta dentro del bucket; solo ordena los archivos. */
  grupo: string;
  /** Tope de fotos. 1 = una sola (la ficha de una tela). */
  max?: number;
  disabled?: boolean;
  /** Texto del botón cuando no hay ninguna foto todavía. */
  etiqueta?: string;
};

/**
 * Las fotos que estaban guardadas y ya no están en el borrador: son las que se
 * pueden borrar del bucket una vez que el guardado salió bien.
 */
export function fotosHuerfanas(antes: readonly string[], ahora: readonly string[]): string[] {
  const vivas = new Set(ahora);
  return antes.filter((u) => !vivas.has(u));
}

export function FotosInformeEditor({
  fotos,
  onChange,
  grupo,
  max = MAX_FOTOS_TEXTO,
  disabled = false,
  etiqueta = 'Agregar foto',
}: Props) {
  const { empresaId } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);

  const lleno = fotos.length >= max;

  const subir = async (files: FileList) => {
    if (!empresaId) return;
    const elegidas = [...files].slice(0, Math.max(0, max - fotos.length));
    if (elegidas.length === 0) return;
    // Se acumulan y se guardan de una: una subida que falla a mitad de camino no
    // debe perder las que ya habían subido bien.
    const subidas: string[] = [];
    try {
      for (const [i, file] of elegidas.entries()) {
        setSubiendo(i + 1);
        subidas.push(await subirFotoInforme(empresaId, grupo, file));
      }
    } catch (e) {
      toast.error('No se pudo subir la foto: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(0);
      if (subidas.length) onChange([...fotos, ...subidas].slice(0, max));
    }
  };

  const quitar = (url: string) => onChange(fotos.filter((u) => u !== url));

  const mover = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= fotos.length) return;
    const lista = [...fotos];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    onChange(lista);
  };

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) subir(e.target.files);
          e.target.value = '';
        }}
      />

      {fotos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {fotos.map((url, i) => (
            <div
              key={url}
              className="group relative h-24 w-32 overflow-hidden rounded-md border border-border bg-secondary"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              {!disabled && (
                <>
                  <button
                    type="button"
                    title="Quitar del informe"
                    onClick={() => quitar(url)}
                    className="absolute right-1 top-1 rounded-full border border-destructive/40 bg-background/90 p-0.5 text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {max > 1 && fotos.length > 1 && (
                    <div className="absolute bottom-1 left-1 flex gap-0.5">
                      <button
                        type="button"
                        title="Mover antes"
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                        className="rounded border border-border bg-background/90 p-0.5 text-muted-foreground disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Mover después"
                        disabled={i === fotos.length - 1}
                        onClick={() => mover(i, 1)}
                        className="rounded border border-border bg-background/90 p-0.5 text-muted-foreground disabled:opacity-30"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || lleno || subiendo > 0 || !empresaId}
        onClick={() => inputRef.current?.click()}
        className="h-7 text-[11px]"
      >
        <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
        {subiendo > 0 ? `Subiendo foto ${subiendo}…` : fotos.length ? 'Agregar otra' : etiqueta}
      </Button>
      {lleno && (
        <span className="ml-2 text-[11px] text-muted-foreground">
          Máximo {max} {max === 1 ? 'foto' : 'fotos'}.
        </span>
      )}
    </div>
  );
}
